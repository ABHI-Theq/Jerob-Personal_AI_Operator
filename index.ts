#!/usr/bin/env bun
import chalk from "chalk";
import {program} from "commander";
import { startArena } from "./tui/spinup";
import { authenticate, getAllKeys, updateApiKey, resetAuth, switchModelFlow } from "./auth/auth";
import { writeEnvFile } from "./auth/env-writer";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

program.name("jerob").description(" Your personal Assistant sits in your computer").version("0.1.0")

program.command("jet")
.description("agent spin up command")
.action(
    async()=>{
        try {
            const { config, password } = await authenticate();
            const keys = getAllKeys(config, password);

            // Write .env so subprocesses and tools that read it directly work too
            writeEnvFile(keys);

            // Apply all keys to process.env (skip empty values)
            for (const [k, v] of Object.entries(keys)) {
                if (v) process.env[k] = v;
            }
            process.env.OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
            await startArena()
        } catch (error) {
            if (error instanceof Error && error.message.includes("cancelled")) {
                console.log(chalk.yellow("\n✓ Exited cleanly\n"));
            } else {
                console.log(chalk.red("Authentication failed"));
                console.log(chalk.red(error instanceof Error ? error.message : String(error)));
            }
            process.exit(0);
        }
    }
)

program.command("switch-model")
.description("Switch the active model for any provider (OpenRouter, Gemini, Claude, OpenAI, Groq)")
.action(async () => {
    try {
        const { config, password: pwd } = await authenticate();
        await switchModelFlow(config, pwd);
        // Rewrite .env with the updated model overrides
        const keys = getAllKeys(config, pwd);
        writeEnvFile(keys);
        for (const [k, v] of Object.entries(keys)) {
            if (v) process.env[k] = v;
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes("cancelled")) {
            console.log(chalk.yellow("\n✓ Cancelled\n"));
        } else {
            console.log(chalk.red(error instanceof Error ? error.message : String(error)));
        }
        process.exit(0);
    }
});

program.command("set-key")
.description("Update stored API keys or model preferences")
.action(async () => {
    try {
        await updateApiKey();
    } catch (error) {
        if (error instanceof Error && error.message.includes("cancelled")) {
            console.log(chalk.yellow("\n✓ Update cancelled\n"));
        } else {
            console.log(chalk.red("Failed to update"));
            console.log(chalk.red(error instanceof Error ? error.message : String(error)));
        }
        process.exit(0);
    }
});

program.command("reset-auth")
.description("Remove stored auth config and API key")
.action(async () => {
    try {
        resetAuth();
        console.log(chalk.green("\n✓ Auth reset complete. Stored login and key removed.\n"));
    } catch (error) {
        console.log(chalk.red("Failed to reset auth"));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(0);
    }
});

program.command("sync-credentials")
.description("Sync API keys and credentials to Supabase user_config table")
.action(async () => {
    try {
        const { syncAllSecrets } = await import("./scheduler/config-sync");
        await syncAllSecrets();
        console.log(chalk.green("\n✓ Credentials synced to Supabase user_config table\n"));
    } catch (error) {
        console.log(chalk.red("Sync failed"));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
});

program.command("scheduler-debug")
.description("Debug scheduler: check tasks, credentials, and test Edge Function")
.action(async () => {
    try {
        await import("./scheduler/debug");
    } catch (error) {
        console.log(chalk.red("Scheduler debug failed"));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
});

await program.parseAsync(process.argv)
