# Ask Mode

## Question

explain my /agent folder

## Answer

Here’s a quick, high‑level walk‑through of the **`/agent`** folder in your project and what each file is doing:

| File | Purpose | Key Concepts |
|------|---------|--------------|
| **`action-tracker.ts`** | Maintains a history of all actions (file create/modify/delete, shell commands, etc.) that the agent has queued. <br> *Can add, list, update status, and filter pending mutations.* | `ActionLog` / `ActionStatus` types, in‑memory array of actions. |
| **`agent-tools.ts`** | Exposes reusable “tool” functions that the AI agent can call. These are wrapped with the `tool()` helper from the AI SDK, automatically giving them inputs validation (via `zod`) and proper typing. <br> *Handles file I/O, shell commands, skill introspection, etc.* | See tool list in the file (read_file, create_file, modify_file, delete_file, etc.). |
| **`approval.ts`** | Implements the “review & approve” workflow. After the agent has queued mutations, the user is prompted (via `clack/prompts`) to approve, reject or see a diff. <br> *Integrates diff rendering, shell command review, and folder creation grouping.* | Uses `ActionTracker` to fetch pending actions, groups by path, renders Markdown diffs with `renderHTMLMarkdown`. |
| **`diff-view.ts`** | Utility for generating visual diffs for changed files. It composes the “before” and “after” states of a file from a series of successive actions and formats them into a unified diff string. | `composeBeforeAfter`, `formatPatch`. |
| **`orchestrator.ts`** | (Not opened in the snippet, but contextually) orchestrates the overall workflow: generating prompts, invoking skills, chaining tool calls, feeding results back to the agent, and eventually calling the approval step. <br> *It is likely to be the entry point for running “tasks” or “skills”.* | Holds `AgentReady`, `TaskStarter` logic (searchable in the rest of repository). |
| **`tool-executor.ts`** | Actual implementation of the tool functions referenced in `agent-tools.ts`. It performs concrete file operations, file reading, shell queuing, and skill file reads. | Methods like `readFile`, `createFile`, `listFiles`, `queueShell`, etc. |
| **`types.ts`** | Central type definitions for action logs, file operation details, shell commands, etc. Keeps the rest of the files typed and consistent. | Contains `ActionLog`, `ActionStatus`, `MutationType`, etc. |

### How it all fits together

1. **Action Generation** – An AI skill or orchestration logic generates a list of desired changes (e.g., “create `README.md`”, “modify `src/index.ts`”).  
2. **Tool Calls** – These changes are expressed as calls to the tools defined in `agent-tools.ts`. The tool functions delegate to the `tool-executor` methods.  
3. **Tracking** – Every tool call produces an `ActionLog` entry via `ActionTracker`. Mutating actions are marked `pending` until approved.  
4. **Review** – The `approval.ts` module collects all pending actions, groups file‑level changes, shows diffs, and prompts the user.  
5. **Applying** – Approved actions are actually written to disk (or queued as shell commands) and the restored (or new) state is committed to the workspace.

### Example Flow

```text
User invokes skill →  
Agent plans actions →  
Tool calls (create_file, modify_file, ...) →  
ActionTracker logs pending actions →  
User sees review screen →  
    • Accept → ActionStatus = approved → apply changes
    • Reject → ActionStatus = rejected
```

### Quick Insight Into Some Key Functions

- **`composeBeforeAfter` (in `diff-view.ts`)** – Walks the series of actions on a file and produces an object `{ before: string, after: string }` to feed into unified‑diff formatting.
- **`runApprovalFlow`** – The centerpiece of the approval UI. Utilizes Clack prompts to confirm, diff‑view or reject, and updates ActionTracker accordingly.
- **`createAgentTools`** – Automatically wires each tool to a corresponding executor method. When AI says `create_file`, the `tool` infrastructure ensures the correct signature and passes the parameters.

---

#### Next Steps

* **Open `orchestrator.ts`** to see how it calls the tools and how it triggers the approval flow.  
* Spin up your dev environment (`npm run start` or similar) and try generating a simple task – you’ll see the approval prompt in action.  
* Review the `types.ts` to understand shape of logs and actions you can filter or output elsewhere.

If you’d like more details on a particular file, feel free to ask!
