#!/usr/bin/env python3
"""
TalentCodeHub Desktop Client
Sign in and fetch GitHub issues with your associated prompt.
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import threading
import requests
import json
import os

BASE_URL = "https://www.talentcodehub.com"
SESSION_FILE = os.path.expanduser("~/.talentcodehub_session")


class SessionManager:
    """Manages persistent HTTP session with cookie storage."""

    def __init__(self):
        self.session = requests.Session()
        self._load()

    def _load(self):
        try:
            if os.path.exists(SESSION_FILE):
                with open(SESSION_FILE, "r") as f:
                    cookies = json.load(f)
                for name, value in cookies.items():
                    self.session.cookies.set(name, value)
        except Exception:
            pass

    def save(self):
        try:
            cookies = {c.name: c.value for c in self.session.cookies}
            with open(SESSION_FILE, "w") as f:
                json.dump(cookies, f)
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
            **kwargs,
        )


session_mgr = SessionManager()


# ──────────────────────────────────────────────────────────────────
# Sign-In Window
# ──────────────────────────────────────────────────────────────────

class SignInWindow:
    def __init__(self, root, on_success):
        self.root = root
        self.on_success = on_success

        self.root.title("TalentCodeHub – Sign In")
        self.root.resizable(False, False)
        self._center(380, 260)

        self._build()

    def _center(self, w, h):
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _build(self):
        frame = ttk.Frame(self.root, padding=24)
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="TalentCodeHub", font=("Helvetica", 16, "bold")).pack(pady=(0, 4))
        ttk.Label(frame, text="Sign in to your account", foreground="#666").pack(pady=(0, 16))

        ttk.Label(frame, text="Email").pack(anchor="w")
        self.email_var = tk.StringVar()
        email_entry = ttk.Entry(frame, textvariable=self.email_var, width=40)
        email_entry.pack(fill=tk.X, pady=(2, 10))
        email_entry.focus()

        ttk.Label(frame, text="Password").pack(anchor="w")
        self.pwd_var = tk.StringVar()
        pwd_entry = ttk.Entry(frame, textvariable=self.pwd_var, show="*", width=40)
        pwd_entry.pack(fill=tk.X, pady=(2, 16))
        pwd_entry.bind("<Return>", lambda _: self._do_signin())

        self.err_var = tk.StringVar()
        self.err_label = ttk.Label(frame, textvariable=self.err_var, foreground="red")
        self.err_label.pack(pady=(0, 6))

        self.btn = ttk.Button(frame, text="Sign In", command=self._do_signin)
        self.btn.pack(fill=tk.X)

    def _do_signin(self):
        email = self.email_var.get().strip()
        pwd   = self.pwd_var.get()
        if not email or not pwd:
            self.err_var.set("Email and password are required.")
            return

        self.btn.config(state=tk.DISABLED)
        self.err_var.set("")

        def task():
            try:
                resp = session_mgr.post(
                    "/api/auth/signin",
                    json={"email": email, "password": pwd},
                    timeout=15,
                )
                data = resp.json()
                if data.get("success"):
                    session_mgr.save()
                    self.root.after(0, self.on_success)
                else:
                    msg = data.get("message", "Sign in failed.")
                    self.root.after(0, lambda: self._set_error(msg))
            except requests.RequestException as e:
                self.root.after(0, lambda: self._set_error(f"Connection error: {e}"))
            finally:
                self.root.after(0, lambda: self.btn.config(state=tk.NORMAL))

        threading.Thread(target=task, daemon=True).start()

    def _set_error(self, msg):
        self.err_var.set(msg)


# ──────────────────────────────────────────────────────────────────
# Issue Detail Panel
# ──────────────────────────────────────────────────────────────────

class IssueDetailFrame(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        self._build()

    def _build(self):
        self.columnconfigure(0, weight=1)

        # Issue section
        ttk.Label(self, text="GitHub Issue", font=("Helvetica", 11, "bold")).grid(
            row=0, column=0, sticky="w", padx=8, pady=(8, 2)
        )
        issue_frame = ttk.LabelFrame(self, text="", padding=10)
        issue_frame.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 8))
        issue_frame.columnconfigure(1, weight=1)

        fields = [
            ("Title",    "title"),
            ("Repo",     "repo"),
            ("Issue",    "issue_link"),
            ("PR",       "pr_link"),
            ("Base SHA", "base_sha"),
            ("Category", "category"),
            ("Status",   "status"),
        ]
        self._issue_vars = {}
        for i, (label, key) in enumerate(fields):
            ttk.Label(issue_frame, text=label + ":", width=10, anchor="w").grid(
                row=i, column=0, sticky="w", pady=2
            )
            var = tk.StringVar()
            self._issue_vars[key] = var
            ttk.Entry(issue_frame, textvariable=var, state="readonly", width=60).grid(
                row=i, column=1, sticky="ew", padx=(6, 0), pady=2
            )

        ttk.Label(issue_frame, text="Files:", anchor="w", width=10).grid(
            row=len(fields), column=0, sticky="nw", pady=2
        )
        self.files_text = tk.Text(issue_frame, height=3, state=tk.DISABLED, wrap=tk.WORD)
        self.files_text.grid(row=len(fields), column=1, sticky="ew", padx=(6, 0), pady=2)

        # Prompt section
        ttk.Label(self, text="Your Prompt", font=("Helvetica", 11, "bold")).grid(
            row=2, column=0, sticky="w", padx=8, pady=(4, 2)
        )
        prompt_outer = ttk.LabelFrame(self, text="", padding=10)
        prompt_outer.grid(row=3, column=0, sticky="nsew", padx=8, pady=(0, 8))
        prompt_outer.columnconfigure(0, weight=1)
        prompt_outer.rowconfigure(1, weight=1)
        self.rowconfigure(3, weight=1)

        self.prompt_title_var = tk.StringVar()
        ttk.Entry(prompt_outer, textvariable=self.prompt_title_var, state="readonly").grid(
            row=0, column=0, sticky="ew", pady=(0, 6)
        )
        self.prompt_text = scrolledtext.ScrolledText(
            prompt_outer, height=14, state=tk.DISABLED,
            wrap=tk.WORD, font=("Courier New", 10),
        )
        self.prompt_text.grid(row=1, column=0, sticky="nsew")

    def display(self, issue, prompt):
        i = issue
        self._issue_vars["title"].set(i.get("issueTitle", ""))
        self._issue_vars["repo"].set(i.get("repoName", ""))
        self._issue_vars["issue_link"].set(i.get("issueLink", ""))
        self._issue_vars["pr_link"].set(i.get("prLink") or "")
        self._issue_vars["base_sha"].set(i.get("baseSha", ""))
        self._issue_vars["category"].set(i.get("repoCategory", ""))
        self._issue_vars["status"].set(i.get("takenStatus", ""))

        files = i.get("filesChanged") or []
        self.files_text.config(state=tk.NORMAL)
        self.files_text.delete("1.0", tk.END)
        self.files_text.insert(tk.END, "\n".join(files) if files else "(none)")
        self.files_text.config(state=tk.DISABLED)

        self.prompt_title_var.set(prompt.get("title", "(no prompt)") if prompt else "(no prompt)")
        self.prompt_text.config(state=tk.NORMAL)
        self.prompt_text.delete("1.0", tk.END)
        if prompt:
            self.prompt_text.insert(tk.END, prompt.get("content", ""))
        self.prompt_text.config(state=tk.DISABLED)

    def clear(self):
        for var in self._issue_vars.values():
            var.set("")
        self.files_text.config(state=tk.NORMAL)
        self.files_text.delete("1.0", tk.END)
        self.files_text.config(state=tk.DISABLED)
        self.prompt_title_var.set("")
        self.prompt_text.config(state=tk.NORMAL)
        self.prompt_text.delete("1.0", tk.END)
        self.prompt_text.config(state=tk.DISABLED)


# ──────────────────────────────────────────────────────────────────
# Main Application Window
# ──────────────────────────────────────────────────────────────────

class MainWindow:
    def __init__(self, root):
        self.root = root
        self.root.title("TalentCodeHub Client")
        self._center(820, 700)
        self.root.resizable(True, True)
        self._current_issue_id = None
        self._build()

    def _center(self, w, h):
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _build(self):
        # ── Top bar ──────────────────────────────────────────────
        top = ttk.Frame(self.root, padding=(12, 8))
        top.pack(fill=tk.X)

        ttk.Label(top, text="TalentCodeHub", font=("Helvetica", 14, "bold")).pack(side=tk.LEFT)

        btn_frame = ttk.Frame(top)
        btn_frame.pack(side=tk.RIGHT)

        self.done_btn = ttk.Button(
            btn_frame, text="Mark as Done", command=self._mark_done, state=tk.DISABLED
        )
        self.done_btn.pack(side=tk.RIGHT, padx=(6, 0))

        self.get_btn = ttk.Button(
            btn_frame, text="Get New Issue", command=self._get_issue
        )
        self.get_btn.pack(side=tk.RIGHT)

        signout_btn = ttk.Button(btn_frame, text="Sign Out", command=self._signout)
        signout_btn.pack(side=tk.RIGHT, padx=(0, 12))

        ttk.Separator(self.root, orient=tk.HORIZONTAL).pack(fill=tk.X)

        # ── Status bar ──────────────────────────────────────────
        self.status_var = tk.StringVar(value="Ready. Click 'Get New Issue' to begin.")
        status_bar = ttk.Label(
            self.root, textvariable=self.status_var,
            relief=tk.SUNKEN, anchor="w", padding=(8, 4)
        )
        status_bar.pack(fill=tk.X, side=tk.BOTTOM)

        # ── Detail panel ─────────────────────────────────────────
        self.detail = IssueDetailFrame(self.root)
        self.detail.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)

    def _set_status(self, msg):
        self.status_var.set(msg)

    def _get_issue(self):
        self.get_btn.config(state=tk.DISABLED)
        self.done_btn.config(state=tk.DISABLED)
        self._set_status("Fetching issue…")
        self.detail.clear()
        self._current_issue_id = None

        def task():
            try:
                resp = session_mgr.post("/v1/issue", json={}, timeout=20)
                data = resp.json()
                if data.get("success"):
                    issue  = data["data"]["issue"]
                    prompt = data["data"]["prompt"]
                    self._current_issue_id = issue.get("id") or issue.get("_id")
                    self.root.after(0, lambda: self._on_issue_loaded(issue, prompt))
                else:
                    msg = data.get("message", "Failed to get issue.")
                    self.root.after(0, lambda: self._set_status(f"Error: {msg}"))
            except requests.RequestException as e:
                self.root.after(0, lambda: self._set_status(f"Connection error: {e}"))
            finally:
                self.root.after(0, lambda: self.get_btn.config(state=tk.NORMAL))

        threading.Thread(target=task, daemon=True).start()

    def _on_issue_loaded(self, issue, prompt):
        self.detail.display(issue, prompt)
        self.done_btn.config(state=tk.NORMAL)
        self._set_status(f"Issue loaded: {issue.get('issueTitle', '')}")

    def _mark_done(self):
        if not self._current_issue_id:
            return
        if not messagebox.askyesno("Confirm", "Mark this issue as done?"):
            return

        self.done_btn.config(state=tk.DISABLED)
        self._set_status("Marking issue as done…")

        issue_id = self._current_issue_id

        def task():
            try:
                resp = session_mgr.post(
                    "/v1/issue/done",
                    json={"issueId": issue_id},
                    timeout=20,
                )
                data = resp.json()
                if data.get("success"):
                    self.root.after(0, lambda: self._set_status("Issue marked as done."))
                    self.root.after(0, self.detail.clear)
                    self._current_issue_id = None
                else:
                    msg = data.get("message", "Failed to mark done.")
                    self.root.after(0, lambda: self._set_status(f"Error: {msg}"))
                    self.root.after(0, lambda: self.done_btn.config(state=tk.NORMAL))
            except requests.RequestException as e:
                self.root.after(0, lambda: self._set_status(f"Connection error: {e}"))
                self.root.after(0, lambda: self.done_btn.config(state=tk.NORMAL))

        threading.Thread(target=task, daemon=True).start()

    def _signout(self):
        try:
            session_mgr.post("/api/auth/signout", json={}, timeout=10)
        except Exception:
            pass
        session_mgr.clear()
        self.root.destroy()
        start()


# ──────────────────────────────────────────────────────────────────
# Application Bootstrap
# ──────────────────────────────────────────────────────────────────

def start():
    root = tk.Tk()
    style = ttk.Style(root)
    # Use a clean theme if available
    available = style.theme_names()
    for preferred in ("clam", "alt", "default"):
        if preferred in available:
            style.theme_use(preferred)
            break

    def on_signin_success():
        # Destroy sign-in window, open main window
        root.destroy()
        main_root = tk.Tk()
        MainWindow(main_root)
        main_root.mainloop()

    def try_resume():
        """Check if we already have a valid session."""
        try:
            resp = session_mgr.post("/api/auth/me", json={}, timeout=10)
            data = resp.json()
            if data.get("user"):
                on_signin_success()
                return
        except Exception:
            pass
        SignInWindow(root, on_signin_success)

    # Show sign-in; check existing session in background
    SignInWindow(root, on_signin_success)
    root.after(200, try_resume)
    root.mainloop()


if __name__ == "__main__":
    start()
