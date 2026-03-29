#!/usr/bin/env python3
"""
TalentCodeHub Desktop Client — Dark UI
Full automated workflow: login → get issue → clone → run claude-hfi
"""

import tkinter as tk
from tkinter import ttk, messagebox
import threading
import subprocess
import requests
import json
import os
import re
import time
import shutil
from datetime import datetime
from pathlib import Path

BASE_URL = "https://www.talentcodehub.com"
SESSION_FILE = os.path.expanduser("~/.talentcodehub_session")
DOCUMENTS_DIR = Path.home() / "Documents"

# ── Dark colour palette (Spotify-/JupyterLab-inspired) ─────────────────
DARK = {
    "bg":         "#121212",
    "surface":    "#1e1e1e",
    "surface2":   "#2a2a2a",
    "surface3":   "#333333",
    "border":     "#3a3a3a",
    "primary":    "#1db954",   # Spotify green
    "primary_dk": "#158a3e",
    "accent":     "#0e7afe",
    "text":       "#e8e8e8",
    "text_dim":   "#999999",
    "text_muted": "#555555",
    "danger":     "#e05c5c",
    "warn":       "#e0a030",
    "success":    "#1db954",
    "mono":       "#b5cea8",
}

FONT_UI    = ("Segoe UI", 10)
FONT_BOLD  = ("Segoe UI", 10, "bold")
FONT_TITLE = ("Segoe UI", 14, "bold")
FONT_MONO  = ("Consolas", 9)
FONT_SMALL = ("Segoe UI", 9)


# ── Session ─────────────────────────────────────────────────────────────

class SessionManager:
    def __init__(self):
        self.session = requests.Session()
        self._load()

    def _load(self):
        try:
            if os.path.exists(SESSION_FILE):
                with open(SESSION_FILE) as f:
                    for name, value in json.load(f).items():
                        self.session.cookies.set(name, value)
        except Exception:
            pass

    def save(self):
        try:
            with open(SESSION_FILE, "w") as f:
                json.dump({c.name: c.value for c in self.session.cookies}, f)
        except Exception:
            pass

    def clear(self):
        self.session.cookies.clear()
        try:
            os.remove(SESSION_FILE)
        except FileNotFoundError:
            pass

    def post(self, path, **kwargs):
        return self.session.post(
            BASE_URL + path,
            headers={"Content-Type": "application/json"},
            timeout=kwargs.pop("timeout", 20),
            **kwargs,
        )


session = SessionManager()


# ── Helpers ─────────────────────────────────────────────────────────────

def apply_dark(root):
    style = ttk.Style(root)
    style.theme_use("clam")

    bg  = DARK["bg"]
    sf  = DARK["surface"]
    sf2 = DARK["surface2"]
    sf3 = DARK["surface3"]
    bd  = DARK["border"]
    tx  = DARK["text"]
    tdm = DARK["text_dim"]
    pr  = DARK["primary"]

    style.configure(".",
        background=bg, foreground=tx,
        fieldbackground=sf2, insertcolor=tx,
        troughcolor=sf, selectbackground=pr,
        selectforeground=bg, font=FONT_UI,
        bordercolor=bd, darkcolor=bd, lightcolor=bd,
        relief="flat",
    )
    style.configure("TFrame",        background=bg)
    style.configure("Surface.TFrame", background=sf)
    style.configure("TLabel",        background=bg, foreground=tx, font=FONT_UI)
    style.configure("Dim.TLabel",    background=bg, foreground=tdm, font=FONT_SMALL)
    style.configure("Title.TLabel",  background=bg, foreground=tx, font=FONT_TITLE)
    style.configure("Mono.TLabel",   background=sf2, foreground=DARK["mono"], font=FONT_MONO)

    style.configure("TEntry",
        fieldbackground=sf2, foreground=tx,
        insertcolor=tx, bordercolor=bd, lightcolor=bd, darkcolor=bd,
    )
    style.map("TEntry", fieldbackground=[("focus", sf3)])

    # Primary button (green)
    style.configure("Primary.TButton",
        background=pr, foreground=DARK["bg"],
        font=FONT_BOLD, relief="flat", padding=(14, 8),
    )
    style.map("Primary.TButton",
        background=[("active", DARK["primary_dk"]), ("disabled", sf3)],
        foreground=[("disabled", tdm)],
    )

    # Ghost button
    style.configure("Ghost.TButton",
        background=bg, foreground=tdm,
        font=FONT_UI, relief="flat", padding=(10, 6),
    )
    style.map("Ghost.TButton",
        background=[("active", sf2)],
        foreground=[("active", tx)],
    )

    # Danger button
    style.configure("Danger.TButton",
        background=DARK["danger"], foreground=DARK["bg"],
        font=FONT_BOLD, relief="flat", padding=(14, 8),
    )
    style.map("Danger.TButton",
        background=[("active", "#b04040"), ("disabled", sf3)],
    )

    style.configure("TScrollbar",
        background=sf2, troughcolor=sf,
        arrowcolor=tdm, bordercolor=bd,
    )
    style.configure("TSeparator", background=bd)
    style.configure("TCombobox",
        fieldbackground=sf2, foreground=tx,
        selectbackground=sf3, selectforeground=tx,
        bordercolor=bd,
    )

    root.configure(bg=bg)


def labeled_entry(parent, label_text, show=None):
    """Returns (frame, entry_widget)."""
    f = tk.Frame(parent, bg=DARK["bg"])
    tk.Label(f, text=label_text, bg=DARK["bg"], fg=DARK["text_dim"],
             font=FONT_SMALL).pack(anchor="w", pady=(0, 2))
    e = ttk.Entry(f, show=show)
    e.pack(fill=tk.X)
    return f, e


def status_label(parent, textvariable, color=None):
    return tk.Label(parent, textvariable=textvariable,
                    bg=DARK["surface"], fg=color or DARK["text_dim"],
                    font=FONT_SMALL, anchor="w", padx=10, pady=4)


def divider(parent):
    tk.Frame(parent, bg=DARK["border"], height=1).pack(fill=tk.X, pady=4)


# ── Login Window ─────────────────────────────────────────────────────────

class LoginWindow:
    def __init__(self, root, on_success):
        self.root  = root
        self.cb    = on_success
        apply_dark(root)
        root.title("TalentCodeHub")
        root.resizable(False, False)
        w, h = 420, 460
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")
        self._build()

    def _build(self):
        outer = tk.Frame(self.root, bg=DARK["bg"])
        outer.pack(fill=tk.BOTH, expand=True)

        # ── hero area ──
        hero = tk.Frame(outer, bg=DARK["surface"], pady=36)
        hero.pack(fill=tk.X)
        tk.Label(hero, text="●  TalentCodeHub",
                 bg=DARK["surface"], fg=DARK["primary"],
                 font=("Segoe UI", 18, "bold")).pack()
        tk.Label(hero, text="Sign in to continue",
                 bg=DARK["surface"], fg=DARK["text_dim"],
                 font=FONT_SMALL).pack(pady=(4, 0))

        # ── form ──
        form = tk.Frame(outer, bg=DARK["bg"], padx=40, pady=30)
        form.pack(fill=tk.X)

        fe, self.email = labeled_entry(form, "Email address")
        fe.pack(fill=tk.X, pady=(0, 14))
        self.email.focus()

        fp, self.pwd = labeled_entry(form, "Password", show="●")
        fp.pack(fill=tk.X, pady=(0, 20))
        self.pwd.bind("<Return>", lambda _: self._signin())

        self.err_var = tk.StringVar()
        self.err_lbl = tk.Label(form, textvariable=self.err_var,
                                bg=DARK["bg"], fg=DARK["danger"],
                                font=FONT_SMALL, wraplength=320, justify="left")
        self.err_lbl.pack(fill=tk.X, pady=(0, 12))

        self.btn = ttk.Button(form, text="Sign in", style="Primary.TButton",
                              command=self._signin)
        self.btn.pack(fill=tk.X, ipady=4)

    def _signin(self):
        email = self.email.get().strip()
        pwd   = self.pwd.get()
        if not email or not pwd:
            self.err_var.set("Email and password are required.")
            return
        self.btn.config(state=tk.DISABLED)
        self.err_var.set("")

        def task():
            try:
                r = session.post("/api/auth/signin", json={"email": email, "password": pwd})
                d = r.json()
                if d.get("success"):
                    session.save()
                    self.root.after(0, self.cb)
                else:
                    self.root.after(0, lambda: self.err_var.set(d.get("message", "Sign in failed.")))
            except Exception as e:
                self.root.after(0, lambda: self.err_var.set(f"Connection error: {e}"))
            finally:
                self.root.after(0, lambda: self.btn.config(state=tk.NORMAL))

        threading.Thread(target=task, daemon=True).start()


# ── Terminal Panel ────────────────────────────────────────────────────────

class TerminalPanel(tk.Frame):
    """Embedded terminal-like log panel."""

    def __init__(self, parent, **kw):
        super().__init__(parent, bg=DARK["surface"], **kw)
        self._build()

    def _build(self):
        hdr = tk.Frame(self, bg=DARK["surface2"])
        hdr.pack(fill=tk.X)
        tk.Label(hdr, text="  TERMINAL", bg=DARK["surface2"],
                 fg=DARK["text_dim"], font=("Segoe UI", 8, "bold"),
                 pady=4).pack(side=tk.LEFT)
        self.clear_btn = tk.Label(hdr, text="✕ clear", bg=DARK["surface2"],
                                  fg=DARK["text_muted"], font=("Segoe UI", 8),
                                  cursor="hand2", padx=8)
        self.clear_btn.pack(side=tk.RIGHT)
        self.clear_btn.bind("<Button-1>", lambda _: self.clear())

        self.text = tk.Text(
            self, bg=DARK["surface"], fg=DARK["text"],
            font=FONT_MONO, state=tk.DISABLED,
            wrap=tk.WORD, relief="flat",
            insertbackground=DARK["text"],
            selectbackground=DARK["surface3"],
        )
        sb = ttk.Scrollbar(self, command=self.text.yview)
        self.text.configure(yscrollcommand=sb.set)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.text.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)

        self.text.tag_configure("green",  foreground=DARK["primary"])
        self.text.tag_configure("yellow", foreground=DARK["warn"])
        self.text.tag_configure("red",    foreground=DARK["danger"])
        self.text.tag_configure("blue",   foreground=DARK["accent"])
        self.text.tag_configure("dim",    foreground=DARK["text_dim"])
        self.text.tag_configure("prompt", foreground="#c678dd")

    def write(self, line, tag=None):
        self.text.config(state=tk.NORMAL)
        self.text.insert(tk.END, line + "\n", tag or "")
        self.text.see(tk.END)
        self.text.config(state=tk.DISABLED)

    def clear(self):
        self.text.config(state=tk.NORMAL)
        self.text.delete("1.0", tk.END)
        self.text.config(state=tk.DISABLED)


# ── Issue Detail Panel ────────────────────────────────────────────────────

class IssuePanel(tk.Frame):
    def __init__(self, parent, **kw):
        super().__init__(parent, bg=DARK["surface"], **kw)
        self._build()

    def _build(self):
        tk.Label(self, text="ISSUE", bg=DARK["surface"],
                 fg=DARK["text_dim"], font=("Segoe UI", 8, "bold"),
                 pady=6, padx=10).pack(anchor="w")
        tk.Frame(self, bg=DARK["border"], height=1).pack(fill=tk.X)

        body = tk.Frame(self, bg=DARK["surface"], padx=12, pady=8)
        body.pack(fill=tk.BOTH, expand=True)

        self._vars = {}
        fields = [
            ("Title",    "issueTitle"),
            ("Repo",     "repoName"),
            ("Category", "repoCategory"),
            ("Base SHA", "baseSha"),
            ("Status",   "takenStatus"),
        ]
        for label, key in fields:
            row = tk.Frame(body, bg=DARK["surface"])
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label, bg=DARK["surface"],
                     fg=DARK["text_dim"], font=FONT_SMALL,
                     width=10, anchor="w").pack(side=tk.LEFT)
            var = tk.StringVar()
            self._vars[key] = var
            tk.Label(row, textvariable=var, bg=DARK["surface"],
                     fg=DARK["text"], font=FONT_SMALL,
                     anchor="w").pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Issue link (clickable-looking)
        link_row = tk.Frame(body, bg=DARK["surface"])
        link_row.pack(fill=tk.X, pady=2)
        tk.Label(link_row, text="Issue", bg=DARK["surface"],
                 fg=DARK["text_dim"], font=FONT_SMALL,
                 width=10, anchor="w").pack(side=tk.LEFT)
        self.link_var = tk.StringVar()
        tk.Label(link_row, textvariable=self.link_var, bg=DARK["surface"],
                 fg=DARK["accent"], font=FONT_SMALL,
                 anchor="w").pack(side=tk.LEFT, fill=tk.X, expand=True)

    def display(self, issue):
        for key, var in self._vars.items():
            var.set(issue.get(key, ""))
        self.link_var.set(issue.get("issueLink", ""))

    def clear(self):
        for var in self._vars.values():
            var.set("")
        self.link_var.set("")


# ── Prompt Panel ──────────────────────────────────────────────────────────

class PromptPanel(tk.Frame):
    def __init__(self, parent, **kw):
        super().__init__(parent, bg=DARK["surface"], **kw)
        self._build()

    def _build(self):
        tk.Label(self, text="PROMPT", bg=DARK["surface"],
                 fg=DARK["text_dim"], font=("Segoe UI", 8, "bold"),
                 pady=6, padx=10).pack(anchor="w")
        tk.Frame(self, bg=DARK["border"], height=1).pack(fill=tk.X)

        self.title_var = tk.StringVar()
        tk.Label(self, textvariable=self.title_var,
                 bg=DARK["surface"], fg=DARK["primary"],
                 font=FONT_BOLD, pady=4, padx=12).pack(anchor="w")

        self.text = tk.Text(
            self, bg=DARK["surface2"], fg=DARK["text"],
            font=FONT_MONO, state=tk.DISABLED, relief="flat",
            wrap=tk.WORD, padx=8, pady=6,
            selectbackground=DARK["surface3"],
        )
        sb = ttk.Scrollbar(self, command=self.text.yview)
        self.text.configure(yscrollcommand=sb.set)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.text.pack(fill=tk.BOTH, expand=True, padx=6, pady=(0, 6))

    def display(self, prompt):
        self.title_var.set(prompt.get("title", "(no prompt)") if prompt else "(no prompt)")
        self.text.config(state=tk.NORMAL)
        self.text.delete("1.0", tk.END)
        if prompt:
            self.text.insert(tk.END, prompt.get("content", ""))
        self.text.config(state=tk.DISABLED)

    def get_content(self):
        return self.text.get("1.0", tk.END).rstrip()

    def clear(self):
        self.title_var.set("")
        self.text.config(state=tk.NORMAL)
        self.text.delete("1.0", tk.END)
        self.text.config(state=tk.DISABLED)


# ── Workflow Engine ───────────────────────────────────────────────────────

class WorkflowEngine:
    """Runs the full end-to-end workflow in a background thread."""

    RETRY_DELAY = 30  # seconds between issue-fetch retries

    def __init__(self, term, issue_panel, prompt_panel, on_status, on_done, on_stop_flag):
        self.term        = term
        self.issue_panel = issue_panel
        self.prompt_panel = prompt_panel
        self.on_status   = on_status   # callable(str)
        self.on_done     = on_done     # callable() — called when workflow ends
        self.stop_flag   = on_stop_flag  # threading.Event

    def _log(self, msg, tag=None):
        self.term.write(msg, tag)

    def _status(self, msg):
        self.on_status(msg)

    def run(self):
        while not self.stop_flag.is_set():
            # ── Step 1: get issue ────────────────────────────────────────
            issue, prompt = self._fetch_issue_with_retry()
            if issue is None:
                break  # stop requested

            self.issue_panel.display(issue)
            self.prompt_panel.display(prompt)

            # ── Step 2: create work directory ───────────────────────────
            work_dir = self._create_work_dir(issue, prompt)
            if work_dir is None:
                break

            # ── Step 3: clone repo ──────────────────────────────────────
            repo_dir = self._clone_repo(issue, work_dir)
            if repo_dir is None:
                break

            # ── Step 4: checkout base SHA ───────────────────────────────
            if not self._checkout_sha(issue, repo_dir):
                break

            # ── Step 5: open chrome ─────────────────────────────────────
            self._open_chrome()

            # ── Step 6: run claude-hfi ──────────────────────────────────
            if not self._run_hfi(repo_dir, prompt, issue):
                break

            # ── Done with this issue — loop for next ────────────────────
            self._log("", "dim")
            self._log("─" * 60, "dim")
            self._log("Workflow complete. Starting next cycle…", "green")
            self._log("─" * 60, "dim")

        self.on_done()

    # ── Fetch issue ──────────────────────────────────────────────────────

    def _fetch_issue_with_retry(self):
        while not self.stop_flag.is_set():
            self._status("Fetching issue from server…")
            self._log("→ GET /v1/issue", "blue")
            try:
                r = session.post("/v1/issue", json={})
                d = r.json()
                if d.get("success"):
                    issue  = d["data"]["issue"]
                    prompt = d["data"]["prompt"]
                    self._log(f"✓ Issue: {issue.get('issueTitle')}", "green")
                    self._status(f"Issue: {issue.get('issueTitle')}")
                    return issue, prompt
                else:
                    msg = d.get("message", "No issue available")
                    self._log(f"✗ {msg}. Retrying in {self.RETRY_DELAY}s…", "yellow")
                    self._status(f"No issue. Retrying in {self.RETRY_DELAY}s…")
            except Exception as e:
                self._log(f"✗ Connection error: {e}. Retrying in {self.RETRY_DELAY}s…", "red")
                self._status("Connection error. Retrying…")

            for _ in range(self.RETRY_DELAY):
                if self.stop_flag.is_set():
                    return None, None
                time.sleep(1)

        return None, None

    # ── Create work directory ────────────────────────────────────────────

    def _create_work_dir(self, issue, prompt):
        ts = datetime.now().strftime("%Y-%m-%d-%H-%M")
        work_dir = DOCUMENTS_DIR / ts
        self._status(f"Creating directory: {ts}")
        self._log(f"→ mkdir {work_dir}", "blue")
        try:
            work_dir.mkdir(parents=True, exist_ok=True)

            # issue.json
            issue_path = work_dir / "issue.json"
            with open(issue_path, "w") as f:
                json.dump(issue, f, indent=2)
            self._log(f"✓ Wrote issue.json", "green")

            # prompt.txt
            prompt_path = work_dir / "prompt.txt"
            with open(prompt_path, "w") as f:
                f.write(prompt.get("content", "") if prompt else "")
            self._log(f"✓ Wrote prompt.txt", "green")

            return work_dir
        except Exception as e:
            self._log(f"✗ Failed to create work dir: {e}", "red")
            return None

    # ── Clone repo ───────────────────────────────────────────────────────

    def _clone_repo(self, issue, work_dir):
        issue_link = issue.get("issueLink", "")
        # Parse owner/repo from issue link: https://github.com/owner/repo/issues/N
        m = re.match(r"https?://github\.com/([^/]+/[^/]+)", issue_link)
        if not m:
            self._log(f"✗ Cannot parse repo from: {issue_link}", "red")
            return None

        repo_slug = m.group(1)
        clone_url = f"https://github.com/{repo_slug}.git"
        repo_name = repo_slug.split("/")[-1]
        dest = work_dir / repo_name

        self._status(f"Cloning {repo_slug}…")
        self._log(f"→ git clone {clone_url}", "blue")

        try:
            proc = subprocess.Popen(
                ["git", "clone", "--depth", "1000", clone_url, str(dest)],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, cwd=str(work_dir),
            )
            for line in proc.stdout:
                line = line.rstrip()
                if line:
                    self._log(f"  {line}", "dim")
            proc.wait()
            if proc.returncode != 0:
                self._log("✗ git clone failed", "red")
                return None
            self._log(f"✓ Cloned to {dest}", "green")
            return dest
        except FileNotFoundError:
            self._log("✗ git not found — please install git", "red")
            return None
        except Exception as e:
            self._log(f"✗ Clone error: {e}", "red")
            return None

    # ── Checkout base SHA ────────────────────────────────────────────────

    def _checkout_sha(self, issue, repo_dir):
        base_sha = issue.get("baseSha", "").strip()
        if not base_sha:
            self._log("⚠ No baseSha — skipping checkout", "yellow")
            return True

        self._status(f"Checking out {base_sha[:8]}…")
        self._log(f"→ git checkout {base_sha}", "blue")
        try:
            r = subprocess.run(
                ["git", "checkout", base_sha],
                cwd=str(repo_dir),
                capture_output=True, text=True,
            )
            if r.returncode != 0:
                self._log(f"✗ git checkout failed: {r.stderr.strip()}", "red")
                return False
            self._log(f"✓ Checked out {base_sha[:8]}", "green")
            return True
        except Exception as e:
            self._log(f"✗ Checkout error: {e}", "red")
            return False

    # ── Open Chrome ──────────────────────────────────────────────────────

    def _open_chrome(self):
        self._status("Opening browser…")
        self._log("→ Opening https://github.com in Chrome", "blue")
        try:
            for cmd in [
                ["google-chrome", "https://github.com"],
                ["chromium-browser", "https://github.com"],
                ["xdg-open", "https://github.com"],
            ]:
                if shutil.which(cmd[0]):
                    subprocess.Popen(cmd)
                    self._log("✓ Browser opened", "green")
                    return
            self._log("⚠ Chrome not found — skipping browser open", "yellow")
        except Exception as e:
            self._log(f"⚠ Browser open failed: {e}", "yellow")

    # ── Run claude-hfi ───────────────────────────────────────────────────

    def _run_hfi(self, repo_dir, prompt, issue):
        prompt_text = prompt.get("content", "") if prompt else ""

        self._status("Starting claude-hfi…")
        self._log("→ claude-hfi --vscode", "blue")

        hfi_cmd = shutil.which("claude-hfi")
        if not hfi_cmd:
            self._log("✗ claude-hfi not found in PATH", "red")
            self._log("  Install it and make sure it is on your PATH.", "yellow")
            return False

        try:
            import pexpect
        except ImportError:
            self._log("✗ pexpect not installed.", "red")
            self._log("  Run: pip3 install pexpect", "yellow")
            return False

        # pexpect logfile adapter — streams every character to the terminal panel
        class _TermWriter:
            def __init__(self, log_fn):
                self._buf = ""
                self._log = log_fn
            def write(self, data):
                if isinstance(data, bytes):
                    data = data.decode("utf-8", errors="replace")
                self._buf += data
                while "\n" in self._buf:
                    line, self._buf = self._buf.split("\n", 1)
                    self._log(line.rstrip("\r"), "dim")
            def flush(self):
                pass

        def _send(child, text, label):
            self._log(f"  ◀ {label}", "prompt")
            child.sendline(text)
            time.sleep(1.5)   # give the tool time to process input before we read next output

        try:
            child = pexpect.spawn(
                hfi_cmd, ["--vscode"],
                cwd=str(repo_dir),
                encoding="utf-8",
                codec_errors="replace",
                timeout=300,
            )
            child.logfile_read = _TermWriter(self._log)
        except Exception as e:
            self._log(f"✗ Failed to start claude-hfi: {e}", "red")
            return False

        try:
            # ── Step 1: wait for interface code prompt ───────────────────
            self._status("Waiting for interface code prompt…")
            child.expect("interface code", timeout=120)
            time.sleep(1)
            _send(child, "cc_code_behavior", "cc_code_behavior")
            self._log("✓ Sent interface code", "green")

            # ── Step 2: wait for repo question ───────────────────────────
            # The tool takes a few seconds after processing the interface code
            # before it asks "The github repository used for this session"
            self._status("Waiting for repository question…")
            child.expect(r"github repository", timeout=180)
            time.sleep(2)
            _send(child, "N/A", "N/A")
            self._log("✓ Sent N/A for repo", "green")

            # ── Step 3: wait for prompt input cue ────────────────────────
            # claude-hfi outputs something like "Now you will be ready to
            # type prompt" / "Human:" / a bare "> " before expecting input
            self._status("Waiting for prompt input…")
            child.expect(
                r"(Human:|ready to type|first prompt|type the prompt|> |\$ )",
                timeout=180,
            )
            time.sleep(1)
            _send(child, prompt_text, f"<prompt ({len(prompt_text)} chars)>")
            self._log("✓ Sent prompt", "green")
            self._status("Prompt sent — waiting for HFI to complete…")

            # ── Step 4: wait for evaluation / completion output ──────────
            child.expect(
                r"(What did Model|A'?s pros|B'?s pros|Overall Prefer|evaluation|A is better|B is better)",
                timeout=7200,
            )
            self._log("✓ HFI evaluation output detected", "green")
            self._status("HFI done — closing VS Code…")

            child.close(force=True)
            subprocess.Popen(["pkill", "-f", "code"], stderr=subprocess.DEVNULL)
            time.sleep(2)
            return True

        except pexpect.TIMEOUT:
            self._log("✗ Timed out waiting for expected output from claude-hfi", "red")
            try:
                child.close(force=True)
            except Exception:
                pass
            return False

        except pexpect.EOF:
            self._log("✗ claude-hfi exited before workflow completed", "red")
            return False

        except Exception as e:
            self._log(f"✗ HFI error: {e}", "red")
            try:
                child.close(force=True)
            except Exception:
                pass
            return False


# ── Main Window ───────────────────────────────────────────────────────────

class MainWindow:
    def __init__(self, root):
        self.root = root
        apply_dark(root)
        root.title("TalentCodeHub")
        root.resizable(True, True)
        w, h = 1100, 740
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")
        root.minsize(860, 560)

        self._proc    = None
        self._running = False
        self._stop_ev = threading.Event()
        self._issue   = None
        self._prompt  = None

        self._build()

    def _build(self):
        # ── Title bar strip ──────────────────────────────────────────────
        bar = tk.Frame(self.root, bg=DARK["surface"], pady=0)
        bar.pack(fill=tk.X)

        tk.Label(bar, text="● TalentCodeHub",
                 bg=DARK["surface"], fg=DARK["primary"],
                 font=("Segoe UI", 12, "bold"),
                 pady=10, padx=16).pack(side=tk.LEFT)

        right = tk.Frame(bar, bg=DARK["surface"])
        right.pack(side=tk.RIGHT, padx=12)

        self.stop_btn = ttk.Button(right, text="■  Stop",
                                   style="Danger.TButton",
                                   command=self._stop, state=tk.DISABLED)
        self.stop_btn.pack(side=tk.RIGHT, padx=(6, 0))

        self.start_btn = ttk.Button(right, text="▶  START",
                                    style="Primary.TButton",
                                    command=self._start)
        self.start_btn.pack(side=tk.RIGHT)

        ttk.Button(right, text="Sign out",
                   style="Ghost.TButton",
                   command=self._signout).pack(side=tk.RIGHT, padx=(0, 12))

        tk.Frame(self.root, bg=DARK["border"], height=1).pack(fill=tk.X)

        # ── Status bar ───────────────────────────────────────────────────
        self.status_var = tk.StringVar(value="Ready — press START to begin.")
        status = tk.Frame(self.root, bg=DARK["surface"])
        status.pack(fill=tk.X, side=tk.BOTTOM)
        tk.Frame(status, bg=DARK["border"], height=1).pack(fill=tk.X)
        tk.Label(status, textvariable=self.status_var,
                 bg=DARK["surface"], fg=DARK["text_dim"],
                 font=FONT_SMALL, anchor="w", padx=12, pady=5).pack(fill=tk.X)

        # ── Body ─────────────────────────────────────────────────────────
        body = tk.Frame(self.root, bg=DARK["bg"])
        body.pack(fill=tk.BOTH, expand=True)

        # Left column: issue + prompt
        left = tk.Frame(body, bg=DARK["bg"], width=380)
        left.pack(side=tk.LEFT, fill=tk.BOTH, padx=(8, 4), pady=8)
        left.pack_propagate(False)

        self.issue_panel = IssuePanel(left)
        self.issue_panel.pack(fill=tk.X)

        tk.Frame(left, bg=DARK["border"], height=1).pack(fill=tk.X, pady=4)

        self.prompt_panel = PromptPanel(left)
        self.prompt_panel.pack(fill=tk.BOTH, expand=True)

        # Right column: terminal
        right_col = tk.Frame(body, bg=DARK["bg"])
        right_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(4, 8), pady=8)

        self.term = TerminalPanel(right_col)
        self.term.pack(fill=tk.BOTH, expand=True)

    # ── Workflow control ─────────────────────────────────────────────────

    def _start(self):
        self._stop_ev.clear()
        self._running = True
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.term.write("═" * 60, "green")
        self.term.write("  TalentCodeHub Workflow Started", "green")
        self.term.write("═" * 60, "green")

        engine = WorkflowEngine(
            term=self.term,
            issue_panel=self.issue_panel,
            prompt_panel=self.prompt_panel,
            on_status=lambda m: self.root.after(0, lambda: self.status_var.set(m)),
            on_done=lambda: self.root.after(0, self._on_workflow_done),
            on_stop_flag=self._stop_ev,
        )
        threading.Thread(target=engine.run, daemon=True).start()

    def _stop(self):
        self._stop_ev.set()
        self.stop_btn.config(state=tk.DISABLED)
        self.status_var.set("Stopping…")
        self.term.write("⚠ Stop requested — finishing current step…", "yellow")

    def _on_workflow_done(self):
        self._running = False
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.status_var.set("Stopped. Press START to run again.")
        self.term.write("● Workflow stopped.", "dim")

    def _signout(self):
        if self._running:
            if not messagebox.askyesno("Sign out", "Workflow is running. Stop and sign out?"):
                return
            self._stop_ev.set()
        try:
            session.post("/api/auth/signout", json={}, timeout=8)
        except Exception:
            pass
        session.clear()
        self.root.destroy()
        _bootstrap()


# ── Bootstrap ─────────────────────────────────────────────────────────────

def _open_main():
    main_root = tk.Tk()
    MainWindow(main_root)
    main_root.mainloop()


def _bootstrap():
    root = tk.Tk()
    apply_dark(root)
    root.withdraw()

    def on_login():
        root.destroy()
        _open_main()

    def try_resume():
        try:
            r = session.post("/api/auth/me", json={}, timeout=10)
            if r.json().get("data"):
                root.after(0, on_login)
                return
        except Exception:
            pass
        root.after(0, lambda: _show_login(root, on_login))

    threading.Thread(target=try_resume, daemon=True).start()
    root.mainloop()


def _show_login(root, cb):
    root.deiconify()
    LoginWindow(root, cb)


if __name__ == "__main__":
    _bootstrap()
