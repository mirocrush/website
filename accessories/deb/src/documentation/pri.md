# PR Interaction App — Workflow Documentation

## Overview

The PR Interaction App is the second stage in the TalentCodeHub pipeline. It picks up issues that have been **initialized** (prepared) by the PR Preparation App, downloads the prepared zip from the file server, runs a `claude-hfi` session in `cc_agentic_coding` mode to perform structured human-in-the-loop evaluation, and uploads the final interaction result back to the file server before marking the issue as `interacted`.

Up to **3 parallel workers** can process separate initialized issues simultaneously.

---

## High-Level Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    InteractionWorkflowEngine                         │
│                                                                      │
│  ┌──────────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │  Fetch Initialized│ ──▶ │ Download &   │ ──▶ │  Run HFI       │  │
│  │  Issue           │     │ Unzip        │     │  (cc_agentic)  │  │
│  └──────────────────┘     └──────────────┘     └────────────────┘  │
│           ▲                                              │            │
│           │                                              ▼            │
│  ┌──────────────────┐                       ┌──────────────────────┐ │
│  │   Next Issue     │ ◀─────────────────────│  Finalize & Upload   │ │
│  └──────────────────┘                       └──────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Breakdown

### Step 1 — Fetch Initialized Issue

**API:** `POST /v1/interaction-issue`

The engine requests the next issue that has been prepared (status = `initialized`) by the PR Preparation App. The response includes:

| Field | Description |
|---|---|
| `id` | Issue identifier |
| `repoName` | GitHub repo in `owner/repo` format |
| `baseSha` | Git commit hash used during preparation |
| `issueLink` | Full GitHub issue URL |
| `uploadFileName` | Filename of the prepared zip on the file server |

- Uses `_issue_fetch_lock` to prevent multiple workers from claiming the same issue.
- Retries every **30 seconds** if no initialized issues are available.
- A **background heartbeat** immediately starts (`POST /v1/issue/progress-interaction` every 60s).

---

### Step 2 — Download Prepared Zip

**API:** `GET {file_server}/download/{uploadFileName}`

The engine:
1. Checks file server health via `GET {file_server}/status`.
2. Streams the zip file to `~/Downloads/`, handling filename collisions with `_1`, `_2` suffixes.
3. Retries up to **3 times** with 60-second gaps on failure.

If all retries fail, the issue is reset to `initialized` and the engine waits before retrying from Step 1.

---

### Step 3 — Unzip to Working Directory

The zip is extracted to `~/Downloads/`. After extraction:
- The engine navigates into the single top-level directory (or the most recently modified one).
- Inside this root, it locates the `result/` subdirectory.
- Inside `result/`, it finds the first project subdirectory (the cloned repository copy).

**Resulting path variables:**

```
root_dir       →  ~/Downloads/{prepared-work-dir}/
result_dir     →  ~/Downloads/{prepared-work-dir}/result/
project_dir    →  ~/Downloads/{prepared-work-dir}/result/{repo-name}/
```

If the destination already exists, the engine force-removes it with `chmod` before re-extracting.

---

### Step 4 — Write `initial_info.json`

A JSON metadata file is written to the project directory:

```json
{
  "repoName": "owner/repo",
  "issueLink": "https://github.com/owner/repo/issues/123",
  "commitHead": "abc1234...",
  "anthropicUUID": ""
}
```

The `anthropicUUID` field is populated later during the HFI session.

---

### Step 5 — Run HFI Interaction Session (tmux Orchestration)

This is the core step. `claude-hfi` is launched in `cc_agentic_coding` mode inside a **tmux session** and the engine drives it through the full evaluation questionnaire.

**tmux session name:** `talentcodehub-interaction` (or `-w2` / `-w3`)

#### Phase A — Setup

```
Engine                              claude-hfi (tmux)
  │                                       │
  │  tmux new-session -d …               │
  │ ────────────────────────────────────▶ │ starts
  │                                       │
  │  wait: "interface code"              │
  │  [extract anthropicUUID from output] │
  │ ◀──────────────────────────────────── │
  │                                       │
  │  send: "cc_agentic_coding"           │
  │ ────────────────────────────────────▶ │
  │                                       │
  │  open Chrome (github.com)            │
  │                                       │
  │  wait: "github repository used"      │
  │ ◀──────────────────────────────────── │
  │                                       │
  │  send: "https://github.com/{repo}"   │
  │ ────────────────────────────────────▶ │
  │                                       │
  │  wait: "existing GitHub issue or PR" │
  │ ◀──────────────────────────────────── │
  │                                       │
  │  send: issueLink                     │
  │ ────────────────────────────────────▶ │
  │                                       │
  │  wait: "HEAD commit at the time"     │
  │ ◀──────────────────────────────────── │
  │                                       │
  │  send: baseSha                       │
  │ ────────────────────────────────────▶ │
  │                                       │
  │  wait: "Continue" button             │
  │  press: Enter                        │
  │ ────────────────────────────────────▶ │
  │                                       │
  │  wait: "Debug mode enabled"          │
  │  (timeout: 120s)                     │
  │ ◀──────────────────────────────────── │ ready for interactions
```

#### Phase B — Interaction Loop

The engine loads `result.json` from `result_dir/result.json`. This file contains an array of interaction objects, each with a `prompt` and answers for **Q1–Q13**.

For each interaction:

```
  1. Send prompt text (via tmux paste buffer)
  2. Wait for evaluation output pattern
  3. Answer Q1  (plain text)
  4. Answer Q2  (plain text)
  5. Answer Q3  (plain text)
  6. Answer Q4  (plain text)
  7. Answer Q5  (arrow-key navigation: A1/A2/A3/A4 or B1/B2/B3/B4 or N/A)
  8. Answer Q6  (same arrow-key navigation)
  9. Answer Q7  (same)
 10. Answer Q8  (same)
 11. Answer Q9  (same)
 12. Answer Q10 (same)
 13. Answer Q11 (same)
 14. Answer Q12 (same)
 15. Answer Q13 (same)
 16. Press Enter on "Submit Feedback"

 If more interactions remain:
     Wait for: "What would you like to do next"
     Continue to next interaction
```

**Arrow-key mapping for multiple-choice answers (Q5–Q13):**

| Answer | Keystrokes |
|---|---|
| `A1` | ← ← ← ← (4 lefts) |
| `A2` | ← ← ← (3 lefts) |
| `A3` | ← ← (2 lefts) |
| `A4` | ← (1 left) |
| `N/A` | → → → → → (5 rights, center) |
| `B1` | → (1 right) |
| `B2` | → → (2 rights) |
| `B3` | → → → (3 rights) |
| `B4` | → → → → (4 rights) |

#### Phase C — Cleanup

After all interactions are submitted:
- The tmux session is killed.
- Any open VS Code windows are closed (`pkill -x code`).
- The `anthropicUUID` is captured (from earlier in the session or as a late capture from output).

---

### Step 6 — Finalize

After the HFI session ends, the engine performs these finalization steps:

#### 6a — Copy Dockerfile

The Dockerfile is copied from `project_dir/Dockerfile` into `result_dir/`. Its content is also read and stored for inclusion in the API payload.

#### 6b — Create `first_prompt.txt`

The prompt from `result.json[0].prompt` (the first interaction) is written to `result_dir/first_prompt.txt`.

#### 6c — Tar Project Directory

```bash
tar -cf {project_name}.tar {project_dir}
```

The project directory is archived as a tar file inside `result_dir/`.

#### 6d — Zip Result Directory

```
result_dir/  →  zip  →  {root_name}-interaction.zip
```

The entire `result_dir` is zipped using `shutil.make_archive`.

#### 6e — Upload Zip

```
POST {file_server}/upload
```

The interaction zip is uploaded to the local file server, with up to **3 retries**. Upload speed is visualized on the **NetworkGraph** widget.

---

### Step 7 — Mark Issue as Interacted

**API:** `POST /v1/issue/interacted`

Payload:
```json
{
  "issueId": "...",
  "anthropicUUID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "dockerfileContent": "FROM ubuntu:22.04\n...",
  "firstPrompt": "Analyze the following issue..."
}
```

This transitions the issue from `initialized` → `interacted`, completing the pipeline.

---

### Step 8 — Loop

After a 2-second pause, the engine clears the UI and loops back to Step 1 to fetch the next initialized issue.

---

## `result.json` Structure

The `result.json` file (written by the PR Preparation stage) drives the interaction loop:

```json
[
  {
    "prompt": "Analyze the following issue and provide a detailed review...",
    "Q1": "The implementation looks correct because...",
    "Q2": "One concern is...",
    "Q3": "I would suggest...",
    "Q4": "Overall quality is...",
    "Q5": "A3",
    "Q6": "B2",
    "Q7": "N/A",
    "Q8": "A1",
    "Q9": "B4",
    "Q10": "A2",
    "Q11": "N/A",
    "Q12": "B1",
    "Q13": "A4"
  }
]
```

Each element in the array corresponds to one complete interaction cycle through the Q1–Q13 questionnaire.

---

## Retry & Error Recovery

| Scenario | Recovery |
|---|---|
| No initialized issues available | Retry every 30s |
| File server unreachable | Retry every 30s, log error |
| Download failure | 3 retries × 60s, then reset to `initialized` |
| `submission failed` in HFI output | Reset to `initialized`, retry |
| HFI timeout | Reset to `initialized`, log error |
| Upload failure | 3 retries × 60s, then skip and continue |
| User presses Stop | Graceful shutdown via `stop_flag` event |

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/interaction-issue` | POST | Claim next initialized issue |
| `/v1/issue/progress-interaction` | POST | Heartbeat (every 60s) |
| `/v1/issue/interacted` | POST | Mark issue complete |
| `/v1/issue/reset-to-initialized` | POST | Reset issue for retry |
| `{file_server}/status` | GET | Check file server health |
| `{file_server}/download/{filename}` | GET | Download prepared zip |
| `{file_server}/upload` | POST | Upload interaction zip |

---

## Threading Model

```
Main Thread (Tkinter UI)
  ├── Worker 1: InteractionWorkflowEngine.run()   [daemon thread]
  │     └── Heartbeat Thread                       [daemon thread]
  ├── Worker 2: InteractionWorkflowEngine.run()   [daemon thread]
  │     └── Heartbeat Thread                       [daemon thread]
  └── Worker 3: InteractionWorkflowEngine.run()   [daemon thread]
        └── Heartbeat Thread                       [daemon thread]
```

All UI updates from worker threads go through `root.after(0, callback)` to ensure Tkinter thread safety.

---

## Directory Layout (per cycle)

```
~/Downloads/{prepared-work-dir}/
├── result/
│   ├── {repo-name}/              ← project_dir (cloned repo copy)
│   │   ├── Dockerfile
│   │   ├── initial_info.json     ← written in Step 4
│   │   └── result.json           ← interaction Q&A data
│   ├── Dockerfile                ← copied in Step 6a
│   ├── first_prompt.txt          ← written in Step 6b
│   └── {repo-name}.tar           ← archive from Step 6c
└── {prepared-work-dir}-interaction.zip  ← final upload artifact
```

---

## Live UI Updates

The **InteractionWorkerContentPanel** displays live progress during a cycle:

| Field | Content |
|---|---|
| Result Dir | Path to extracted `result/` directory |
| Upload File | Filename downloaded from file server |
| Project Dir | Path to the repo copy within `result/` |
| UUID | Anthropic UUID extracted from HFI session |
| Interactions | Count of interactions completed (e.g., `2 / 5`) |

These fields update in real time as the engine progresses through each step.
