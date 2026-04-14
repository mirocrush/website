# PR Preparation App — Workflow Documentation

## Overview

The PR Preparation App automates the analysis of GitHub issues. It assigns open issues to workers, clones the relevant repository at the correct commit, runs a Human Feedback Interface (HFI) session via `claude-hfi`, collects structured evaluation output, and uploads the result to a file server for the next stage (PR Interaction).

Up to **3 parallel workers** (Alice, Bob, Charlie) can process separate issues simultaneously. Each worker is fully independent, sharing only the issue-fetch lock to prevent duplicate assignments.

---

## High-Level Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                         WorkflowEngine                          │
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────────┐   │
│  │ Fetch Issue │ ──▶ │  Setup Env  │ ──▶ │  Run HFI (tmux)  │   │
│  └─────────────┘     └─────────────┘     └──────────────────┘   │
│         ▲                                         │             │
│         │                                         ▼             │
│  ┌─────────────┐                       ┌──────────────────────┐ │
│  │  Next Issue │ ◀──────────────────── │  Upload & Mark Done  │ │
│  └─────────────┘                       └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Breakdown

### Step 1 — Fetch Issue

**API:** `POST /v1/issue`

The engine requests the next available open issue from the TalentCodeHub backend. The response contains:

| Field | Description |
|---|---|
| `id` | Issue identifier |
| `repoName` | GitHub repo in `owner/repo` format |
| `baseSha` | Git commit hash to check out |
| `issueLink` | Full GitHub issue URL |
| `prompt` | Evaluation prompt object with `name` and `content` |

- Access is serialized with `_issue_fetch_lock` so multiple workers never claim the same issue.
- If no issues are available (or a network error occurs), the engine retries every **30 seconds** indefinitely until stopped by the user.

---

### Step 2 — Display Issue & Start Heartbeat

Once an issue is claimed:
- The **IssuePanel** is updated with the issue title, number, state, and labels.
- The **SlimPromptPanel** shows the prompt name and begins streaming the `console.log` file (if present).
- A **background heartbeat thread** starts, POSTing to `POST /v1/issue/progress` every **60 seconds** to signal the server that this worker is alive and still processing.

---

### Step 3 — Create Work Directory

A timestamped work directory is created under `~/Documents/`:

```
~/Documents/YYYY-MM-DD-HH-MM/          ← single worker
~/Documents/YYYY-MM-DD-HH-MM-w2/       ← worker 2
~/Documents/YYYY-MM-DD-HH-MM-w3/       ← worker 3
```

Inside this directory:
- `issue.json` — serialized issue metadata
- `prompt.txt` — evaluation prompt content
- `result/` — will hold the cloned repo and outputs

---

### Step 4 — Clone Repository & Checkout Base SHA

```bash
git clone https://github.com/{repoName} {work_dir}/{repo_name}
git checkout {baseSha}
```

- Full clone (no `--depth`), so git history is intact for analysis.
- The clone is validated before proceeding; on failure the issue is reset to `open` and the engine retries.

---

### Step 5 — Set Up Result Directory

```
work_dir/
├── issue.json
├── prompt.txt
└── result/
    ├── {repo_name}/       ← copy of cloned repo
    └── result.txt         ← placeholder for HFI output
```

The result directory mirrors the repository and will later contain the evaluation artifacts written by `claude-hfi`.

---

### Step 6 — Open Chrome

Chrome is launched pointing to `github.com` so the worker can view the issue and related PR context during the HFI session.

---Please enter the interface code:

### Step 7 — Run HFI Session (tmux Orchestration)

This is the core step. `claude-hfi` is launched in a **tmux session** and the engine drives it programmatically by watching terminal output and sending keystrokes/text.

**tmux session name:** `talentcodehub-hfi` (or `talentcodehub-hfi-w2` / `-w3` for workers 2 and 3)

The interaction sequence:

```
Engine                         claude-hfi (tmux)
  │                                 │
  │  tmux new-session -d …          │
  │ ──────────────────────────────▶ │ starts
  │                                 │
  │  wait: "interface code"         │
  │ ◀────────────────────────────── │ prompts for interface code
  │                                 │
  │  send: "cc_code_behavior"       │
  │ ──────────────────────────────▶ │
  │                                 │
  │  wait 5s                        │
  │  send: "N/A"  (repo question)   │
  │ ──────────────────────────────▶ │
  │                                 │
  │  wait 5s, send Enter            │
  │ ──────────────────────────────▶ │
  │                                 │
  │  wait for: "Debug mode enabled" │
  │ ◀────────────────────────────── │ (up to 10 × 4s polls)
  │                                 │
  │  send: full prompt text         │
  │ ──────────────────────────────▶ │ runs evaluation
  │                                 │
  │  wait for evaluation output     │
  │  (timeout: 7200s / 2 hours)     │
  │ ◀────────────────────────────── │ evaluation complete
  │                                 │
  │  kill tmux session              │
  │  pkill VS Code windows          │
```

**Pattern watched for evaluation completion:**

```
"What did Model|A.{0,4}s pros|B.{0,4}s pros|..."
```

**Error handling:**
- If `"submission failed"` is detected in output → `SubmissionFailed` exception → issue reset to `open` for retry.
- If timeout (7200s) expires without completion → engine logs error and resets.
- User can press **Stop** at any time via the `stop_flag` threading.Event.

---

### Step 8 — Upload Result

```
work_dir/  →  zip  →  POST {file_server}/upload
```

- `work_dir` is zipped using `shutil.make_archive`.
- Uploaded to the local file server (`DEFAULT_UPLOAD_SERVER = http://172.16.98.4:5000`).
- Up to **3 retries** with 60-second gaps on failure.
- Upload speed is recorded and displayed on the **NetworkGraph** widget.
- The returned filename is passed to the next API call.

---

### Step 9 — Mark Issue as Initialized

**API:** `POST /v1/issue/initialized`

Payload:
```json
{
  "issueId": "...",
  "uploadedFileName": "2024-01-15-14-30.zip"
}
```

This transitions the issue from `open` → `initialized`, making it available for the **PR Interaction App** to pick up.

---

### Step 10 — Loop

After a 2-second pause, the engine clears the UI panels and loops back to Step 1 to fetch the next issue.

---

## Retry & Error Recovery

| Scenario | Recovery |
|---|---|
| No issues available | Retry every 30s |
| Clone failure | Reset issue to `open`, retry |
| `submission failed` in HFI output | Reset to `open`, retry |
| Upload failure | 3 retries × 60s, then skip |
| HFI timeout | Reset to `open`, log error |
| User presses Stop | Graceful shutdown via `stop_flag` event |

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/issue` | POST | Claim next open issue |
| `/v1/issue/progress` | POST | Heartbeat (every 60s) |
| `/v1/issue/initialized` | POST | Mark issue complete |
| `/v1/issue/failed` | POST | Mark issue as failed |
| `/v1/issue/reset-to-open` | POST | Reset issue for retry |
| `{file_server}/upload` | POST | Upload result zip |

---

## Threading Model

```
Main Thread (Tkinter UI)
  ├── Worker 1: WorkflowEngine.run()   [daemon thread]
  │     └── Heartbeat Thread           [daemon thread]
  ├── Worker 2: WorkflowEngine.run()   [daemon thread]
  │     └── Heartbeat Thread           [daemon thread]
  └── Worker 3: WorkflowEngine.run()   [daemon thread]
        └── Heartbeat Thread           [daemon thread]
```

All UI updates from worker threads go through `root.after(0, callback)` to ensure thread safety with Tkinter.

---

## Directory Layout (per cycle)

```
~/Documents/2024-01-15-14-30/
├── issue.json            ← issue metadata
├── prompt.txt            ← evaluation prompt
├── repo-name/            ← cloned repository
└── result/
    ├── repo-name/        ← copy for HFI working directory
    └── result.txt        ← evaluation output placeholder
```
