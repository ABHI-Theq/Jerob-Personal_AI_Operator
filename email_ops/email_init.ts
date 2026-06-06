import app, { oauth2Client } from "./email_server";
import chalk from "chalk";
import open from "open";
import { saveConfig, loadConfig, type GoogleConfig } from "./email_pass_store";
import { syncGoogleRefreshToken } from "../scheduler/config-sync";


export const authenticate = async () => {
  return await new Promise((resolve, reject) => {
    let server: ReturnType<typeof app.listen>;

    try {
      server = app.listen(8787, async () => {
        console.log(chalk.green.bold("✅ OAuth Started — opening browser..."));
        try {
          await open("http://localhost:8787/auth/google");
        } catch {
          console.log(chalk.yellow("Could not open browser automatically. Visit: http://localhost:8787/auth/google"));
        }
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(new Error(`Port 8787 is already in use. Stop any other process using it and try again.`));
        } else {
          reject(new Error(`OAuth server failed to start: ${err.message}`));
        }
      });
    } catch (err) {
      reject(err);
      return;
    }

    app.get("/auth/google/callback", async (req, res) => {
      try {
        const code = req.query.code as string;
        if (!code) {
          res.status(400).send("Missing authorization code");
          reject(new Error("OAuth callback received no authorization code"));
          server.close();
          return;
        }

        const { tokens } = await oauth2Client.getToken(code);

        // In production Google only sends refresh_token on first-ever authorization.
        // Fall back to the previously stored token if one exists.
        const storedConfig = loadConfig();
        const refreshToken = tokens.refresh_token ?? storedConfig?.refresh_token;

        if (!refreshToken) {
          res.status(400).send("No refresh token available. Please revoke app access in your Google account and re-authorize.");
          reject(new Error("No refresh token returned and none stored. User must revoke and re-authorize."));
          server.close();
          return;
        }

        if (!tokens.refresh_token) {
          console.log(chalk.yellow("⚠ No refresh token returned by Google — reusing stored token."));
        }

        const googleConfig: GoogleConfig = {
          access_token: tokens.access_token ?? undefined,
          refresh_token: refreshToken,
          scope: tokens.scope!,
          token_type: tokens.token_type!,
          expiry_date: tokens.expiry_date ?? undefined,
          createdAt: storedConfig?.createdAt ?? Date.now(),
        };

        saveConfig(googleConfig);

        // Auto-sync to Supabase — non-fatal if it fails
        syncGoogleRefreshToken(refreshToken).catch(() => {});

        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Auth</title>
<style>body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f4f9}</style>
</head><body><h1>✅ Authentication Successful</h1><p>Google Connected. You can close this window.</p>
<script>window.open('','_self','');window.close();</script></body></html>`);

        resolve(tokens);
        server.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`OAuth callback error: ${msg}`));
        res.status(500).send(`Authentication failed: ${msg}`);
        reject(error);
        server.close();
      }
    });
  });
};