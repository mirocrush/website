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

try:
    import psutil as _psutil
except ImportError:
    _psutil = None

BASE_URL = "https://www.talentcodehub.com"
SESSION_FILE   = os.path.expanduser("~/.talentcodehub_session")
SETTINGS_FILE  = os.path.expanduser("~/.talentcodehub_settings")
DOCUMENTS_DIR  = Path.home() / "Documents"

DEFAULT_UPLOAD_SERVER = "http://172.16.98.4:5000"


def load_settings():
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE) as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def save_settings(data):
    try:
        existing = load_settings()
        existing.update(data)
        with open(SETTINGS_FILE, "w") as f:
            json.dump(existing, f, indent=2)
    except Exception:
        pass


def get_upload_server():
    return load_settings().get("upload_server", DEFAULT_UPLOAD_SERVER)

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


# ── Circular Timer Widget ────────────────────────────────────────────────

class CircularTimer(tk.Canvas):
    """
    Pie/arc loading indicator with elapsed time in the centre.
    Draws a full dark ring + a coloured arc that sweeps 0→360° every 60s,
    and shows elapsed time (ms) in the middle.
    """
    SIZE   = 110
    THICK  = 10
    PERIOD = 60_000   # ms for one full revolution

    def __init__(self, parent, **kw):
        super().__init__(
            parent,
            width=self.SIZE, height=self.SIZE,
            bg=DARK["surface"], highlightthickness=0,
            **kw,
        )
        self._elapsed = 0
        self._active  = False
        self._draw(0)

    def _draw(self, elapsed_ms):
        self.delete("all")
        cx = cy = self.SIZE / 2
        r  = (self.SIZE - self.THICK) / 2
        x0, y0 = cx - r, cy - r
        x1, y1 = cx + r, cy + r

        # Background ring
        self.create_arc(x0, y0, x1, y1,
                        start=90, extent=360,
                        style=tk.ARC,
                        outline=DARK["surface3"],
                        width=self.THICK)

        # Progress arc (sweeps 0→360 every PERIOD ms)
        pct   = (elapsed_ms % self.PERIOD) / self.PERIOD
        sweep = pct * 360
        color = DARK["primary"] if self._active else DARK["text_muted"]
        if sweep > 0:
            self.create_arc(x0, y0, x1, y1,
                            start=90, extent=-sweep,
                            style=tk.ARC,
                            outline=color,
                            width=self.THICK)

        # Centre text: elapsed time
        if elapsed_ms < 1000:
            label = f"{elapsed_ms}ms"
        elif elapsed_ms < 60_000:
            label = f"{elapsed_ms/1000:.1f}s"
        else:
            mins = elapsed_ms // 60_000
            secs = (elapsed_ms % 60_000) // 1000
            label = f"{mins}m{secs:02d}s"

        self.create_text(cx, cy - 8,
                         text=label,
                         fill=DARK["text"] if self._active else DARK["text_dim"],
                         font=("Segoe UI", 10, "bold"))
        self.create_text(cx, cy + 10,
                         text="elapsed",
                         fill=DARK["text_muted"],
                         font=("Segoe UI", 7))

    def update_time(self, elapsed_ms):
        self._elapsed = elapsed_ms
        self._draw(elapsed_ms)

    def set_active(self, active):
        self._active = active
        self._draw(self._elapsed)

    def reset(self):
        self._elapsed = 0
        self._active  = False
        self._draw(0)



# ── Network Graph Widget ──────────────────────────────────────────────────

class NetworkGraph(tk.Canvas):
    """
    Scrolling real-time upload / download rate graph.
    Uses psutil to diff net_io_counters every second.
    Must call .start() after the widget is packed (use root.after).
    """
    WIDTH    = 240
    HEIGHT   = 110
    INTERVAL = 1000   # ms between samples
    HISTORY  = 30     # number of data points kept

    def __init__(self, parent, **kw):
        super().__init__(
            parent,
            width=self.WIDTH, height=self.HEIGHT,
            bg=DARK["surface"], highlightthickness=0,
            **kw,
        )
        self._up_hist   = [0.0] * self.HISTORY
        self._dn_hist   = [0.0] * self.HISTORY
        self._last_sent = 0
        self._last_recv = 0
        self._last_time = 0.0
        self._tick_id   = None
        self._draw()

    # ── public ────────────────────────────────────────────────────────────

    def start(self):
        """Initialise counters and begin polling. Call after widget is realized."""
        if _psutil:
            c = _psutil.net_io_counters()
            self._last_sent = c.bytes_sent
            self._last_recv = c.bytes_recv
        self._last_time = time.time()
        # Schedule first poll — never call _poll directly here to avoid
        # calling canvas drawing before the window is fully realized.
        self._tick_id = self.after(self.INTERVAL, self._poll)

    def stop(self):
        if self._tick_id:
            self.after_cancel(self._tick_id)
            self._tick_id = None

    # ── internals ─────────────────────────────────────────────────────────

    def _poll(self):
        now = time.time()
        dt  = now - self._last_time
        if dt <= 0:
            dt = 1.0

        if _psutil:
            try:
                c  = _psutil.net_io_counters()
                up = (c.bytes_sent - self._last_sent) / dt
                dn = (c.bytes_recv - self._last_recv) / dt
                self._last_sent = c.bytes_sent
                self._last_recv = c.bytes_recv
            except Exception:
                up, dn = 0.0, 0.0
        else:
            up, dn = 0.0, 0.0

        self._last_time = now

        self._up_hist.append(up)
        self._dn_hist.append(dn)
        self._up_hist = self._up_hist[-self.HISTORY:]
        self._dn_hist = self._dn_hist[-self.HISTORY:]

        self._draw()
        self._tick_id = self.after(self.INTERVAL, self._poll)

    @staticmethod
    def _fmt(bps):
        if bps >= 1_000_000:
            return f"{bps / 1_000_000:.1f} MB/s"
        if bps >= 1_000:
            return f"{bps / 1_000:.1f} KB/s"
        return f"{int(bps)} B/s"

    def _draw(self):
        self.delete("all")
        w, h = self.WIDTH, self.HEIGHT

        # layout constants
        PL, PR, PT, PB = 4, 4, 28, 14   # padding left/right/top/bottom
        gw = w - PL - PR
        gh = h - PT - PB

        # graph area background
        self.create_rectangle(PL, PT, PL + gw, PT + gh,
                              fill=DARK["surface2"], outline=DARK["border"])

        # current rate labels (top)
        up_now = self._up_hist[-1]
        dn_now = self._dn_hist[-1]
        self.create_text(PL + 2, 3,
                         text=f"\u2191 {self._fmt(up_now)}",
                         fill=DARK["primary"], font=("Courier", 8, "bold"), anchor="nw")
        self.create_text(PL + 2, 15,
                         text=f"\u2193 {self._fmt(dn_now)}",
                         fill=DARK["accent"],  font=("Courier", 8, "bold"), anchor="nw")

        # y-scale: dynamic max, at least 1 KB/s so graph is always visible
        max_val = max(max(self._up_hist), max(self._dn_hist), 1024.0)

        # horizontal grid lines at 25 / 50 / 75 / 100 %
        for frac in (0.25, 0.5, 0.75, 1.0):
            gy = PT + gh - int(gh * frac)
            self.create_line(PL, gy, PL + gw, gy,
                             fill=DARK["surface3"], dash=(2, 4))

        # build point lists for upload and download
        n    = len(self._up_hist)
        step = gw / max(n - 1, 1)

        up_pts, dn_pts = [], []
        for i in range(n):
            x = PL + int(i * step)
            up_pts += [x, PT + gh - int(gh * min(self._up_hist[i] / max_val, 1.0))]
            dn_pts += [x, PT + gh - int(gh * min(self._dn_hist[i] / max_val, 1.0))]

        if len(up_pts) >= 4:
            self.create_line(*up_pts, fill=DARK["primary"], width=1, smooth=True)
        if len(dn_pts) >= 4:
            self.create_line(*dn_pts, fill=DARK["accent"],  width=1, smooth=True)

        # bottom label: current scale
        self.create_text(PL + gw // 2, h - 2,
                         text=f"max {self._fmt(max_val)}",
                         fill=DARK["text_muted"], font=("Courier", 7), anchor="s")

        # no psutil warning
        if not _psutil:
            self.create_text(PL + gw // 2, PT + gh // 2,
                             text="psutil not installed",
                             fill=DARK["text_muted"], font=("Courier", 8), anchor="center")


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
        self._console_path  = None
        self._console_pos   = 0       # byte offset of last read position
        self._console_after = None    # scheduled after() id
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
        self.text.pack(fill=tk.BOTH, expand=True, padx=6, pady=(0, 0))

        # ── Status console ────────────────────────────────────────────────
        tk.Frame(self, bg=DARK["border"], height=1).pack(fill=tk.X, pady=(4, 0))
        console_hdr = tk.Frame(self, bg=DARK["surface"])
        console_hdr.pack(fill=tk.X)
        tk.Label(console_hdr, text="STATUS LOG", bg=DARK["surface"],
                 fg=DARK["text_muted"], font=("Segoe UI", 7, "bold"),
                 padx=10, pady=3).pack(side=tk.LEFT, anchor="w")
        self._console_status = tk.Label(console_hdr, text="idle",
                 bg=DARK["surface"], fg=DARK["text_muted"],
                 font=("Segoe UI", 7), padx=8)
        self._console_status.pack(side=tk.RIGHT, anchor="e")

        self.console = tk.Text(
            self, bg="#0a0a0a", fg=DARK["primary"],
            font=("Consolas", 8), state=tk.DISABLED, relief="flat",
            wrap=tk.NONE, height=6, padx=6, pady=4,
            selectbackground=DARK["surface3"],
        )
        csb = ttk.Scrollbar(self, command=self.console.yview)
        self.console.configure(yscrollcommand=csb.set)
        csb.pack(side=tk.RIGHT, fill=tk.Y)
        self.console.pack(fill=tk.X, padx=6, pady=(0, 6))

        self.console.tag_configure("err",  foreground=DARK["danger"])
        self.console.tag_configure("warn", foreground=DARK["warn"])
        self.console.tag_configure("dim",  foreground=DARK["text_dim"])

    # ── Status console polling ────────────────────────────────────────────

    def start_console(self, log_path):
        """Begin watching log_path for new lines. Call from main thread."""
        self.stop_console()
        self._console_path = str(log_path)
        self._console_pos  = 0
        self._console_status.config(text=f"watching: {os.path.basename(self._console_path)}")
        self._console_poll()

    def stop_console(self):
        """Stop polling. Safe to call even if not started."""
        if self._console_after:
            try:
                self.after_cancel(self._console_after)
            except Exception:
                pass
            self._console_after = None
        self._console_path = None
        self._console_status.config(text="idle")

    def _console_poll(self):
        if not self._console_path:
            return
        try:
            if os.path.exists(self._console_path):
                with open(self._console_path, "r", errors="replace") as f:
                    f.seek(self._console_pos)
                    new_text = f.read()
                    self._console_pos = f.tell()
                if new_text:
                    self._console_append(new_text)
        except Exception:
            pass
        self._console_after = self.after(1000, self._console_poll)

    def _console_append(self, text):
        self.console.config(state=tk.NORMAL)
        for line in text.splitlines(keepends=True):
            lo = line.lower()
            tag = "err" if any(w in lo for w in ("error", "fail", "traceback")) \
                 else "warn" if any(w in lo for w in ("warn", "retry")) \
                 else None
            self.console.insert(tk.END, line, tag or "")
        self.console.see(tk.END)
        self.console.config(state=tk.DISABLED)

    # ── Prompt display ────────────────────────────────────────────────────

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
        self.stop_console()
        self.console.config(state=tk.NORMAL)
        self.console.delete("1.0", tk.END)
        self.console.config(state=tk.DISABLED)


# ── Workflow Engine ───────────────────────────────────────────────────────

class WorkflowEngine:
    """Runs the full end-to-end workflow in a background thread."""

    RETRY_DELAY = 30  # seconds between issue-fetch retries
    HEARTBEAT_INTERVAL = 60  # seconds between heartbeat calls

    def __init__(self, root, term, issue_panel, prompt_panel,
                 on_status, on_done, on_stop_flag, on_timer):
        self.root         = root
        self.term         = term
        self.issue_panel  = issue_panel
        self.prompt_panel = prompt_panel
        self.on_status    = on_status    # callable(str)
        self.on_done      = on_done      # callable()
        self.stop_flag    = on_stop_flag # threading.Event
        self.on_timer     = on_timer     # callable(elapsed_ms) — update timer widget

        self._heartbeat_thread = None
        self._heartbeat_stop   = threading.Event()
        self._current_issue_id = None
        self._cycle_start      = None

    def _log(self, msg, tag=None):
        self.term.write(msg, tag)

    def _status(self, msg):
        self.on_status(msg)

    # ── Heartbeat ────────────────────────────────────────────────────────

    def _start_heartbeat(self, issue_id):
        self._current_issue_id = issue_id
        self._heartbeat_stop.clear()
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()

    def _stop_heartbeat(self):
        self._heartbeat_stop.set()
        self._current_issue_id = None

    def _heartbeat_loop(self):
        while not self._heartbeat_stop.wait(self.HEARTBEAT_INTERVAL):
            issue_id = self._current_issue_id
            if not issue_id:
                break
            try:
                session.post("/v1/issue/progress", json={"issueId": issue_id}, timeout=10)
                self._log("  ♥ heartbeat sent", "dim")
            except Exception:
                pass

    # ── Issue status API calls ────────────────────────────────────────────

    def _mark_done(self, issue_id):
        try:
            session.post("/v1/issue/done", json={"issueId": issue_id}, timeout=10)
            self._log("✓ Issue marked as done", "green")
        except Exception as e:
            self._log(f"⚠ Could not mark done: {e}", "yellow")

    def _mark_failed(self, issue_id):
        try:
            session.post("/v1/issue/failed", json={"issueId": issue_id}, timeout=10)
            self._log("  Issue marked as failed", "yellow")
        except Exception as e:
            self._log(f"⚠ Could not mark failed: {e}", "yellow")

    # ── Upload result zip ────────────────────────────────────────────────

    def _upload_result(self, work_dir):
        """
        Zip work_dir and upload to the local file server.
        Retries up to 3 times with a 60-second gap.
        Reports upload/download speed to the network graph.
        """
        zip_path = Path(str(work_dir) + ".zip")
        self._status("Zipping result directory…")
        self._log(f"→ Creating {zip_path.name}", "blue")
        try:
            shutil.make_archive(str(work_dir), "zip", str(work_dir.parent), work_dir.name)
            size_mb = zip_path.stat().st_size / 1_048_576
            self._log(f"✓ Zip created ({size_mb:.1f} MB)", "green")
        except Exception as e:
            self._log(f"✗ Zip failed: {e}", "red")
            return False

        server = get_upload_server()
        MAX_TRIES = 3

        for attempt in range(1, MAX_TRIES + 1):
            self._status(f"Uploading result (attempt {attempt}/{MAX_TRIES})…")
            self._log(f"→ POST {server}/upload  (attempt {attempt})", "blue")
            try:
                file_size = zip_path.stat().st_size
                t_start   = time.time()
                bytes_sent = [0]

                class _ProgressFile:
                    """Wrap file read to track bytes sent."""
                    def __init__(self, path):
                        self._f = open(path, "rb")
                        self.len = os.path.getsize(path)
                    def read(self, n=-1):
                        chunk = self._f.read(n)
                        bytes_sent[0] += len(chunk)
                        return chunk
                    def __getattr__(self, name):
                        return getattr(self._f, name)

                pf = _ProgressFile(zip_path)
                pf.root_ref = self

                resp = requests.post(
                    f"{server}/upload",
                    files={"file": (zip_path.name, pf, "application/zip")},
                    timeout=300,
                )
                elapsed = time.time() - t_start
                avg_up  = file_size / elapsed if elapsed > 0 else 0

                if resp.status_code == 200:
                    data = resp.json()
                    self._log(f"✓ Uploaded: {data.get('filename', zip_path.name)}", "green")
                    self._log(f"  Avg upload speed: {avg_up/1024:.1f} KB/s", "dim")
                    return True
                else:
                    err = resp.json().get("error", resp.text)
                    self._log(f"✗ Upload failed: {err}", "red")

            except requests.ConnectionError:
                self._log(f"✗ Cannot reach upload server: {server}", "red")
            except Exception as e:
                self._log(f"✗ Upload error: {e}", "red")

            if attempt < MAX_TRIES:
                self._log(f"  Retrying in 60s…", "yellow")
                self._status(f"Upload failed — retrying in 60s ({attempt}/{MAX_TRIES})…")
                for _ in range(60):
                    if self.stop_flag.is_set():
                        return False
                    time.sleep(1)

        self._log(f"✗ Upload failed after {MAX_TRIES} attempts — moving to next issue", "red")
        return False

    # ── Timer ─────────────────────────────────────────────────────────────

    def _tick_timer(self):
        """Called from background thread — schedules UI update via root.after."""
        if self._cycle_start is None:
            return
        elapsed = int((time.time() - self._cycle_start) * 1000)
        self.root.after(0, lambda: self.on_timer(elapsed))

    # ── Main loop ─────────────────────────────────────────────────────────

    def run(self):
        while not self.stop_flag.is_set():
            issue, prompt = self._fetch_issue_with_retry()
            if issue is None:
                break

            issue_id = issue.get("id") or issue.get("_id")
            self._cycle_start = time.time()
            self.root.after(0, lambda: self.on_timer(0))

            self.root.after(0, lambda: self.issue_panel.display(issue))
            self.root.after(0, lambda: self.prompt_panel.display(prompt))

            # Start heartbeat + timer ticker
            self._start_heartbeat(issue_id)
            timer_running = [True]

            def _timer_tick():
                if timer_running[0]:
                    self._tick_timer()
                    self.root.after(200, _timer_tick)
            self.root.after(200, _timer_tick)

            success   = False
            work_dir  = None
            try:
                work_dir = self._create_work_dir(issue, prompt)
                if work_dir is None:
                    raise RuntimeError("Could not create work directory")

                # Start watching status_console.log for live monitoring
                log_path = work_dir / "status_console.log"
                self.root.after(0, lambda p=log_path: self.prompt_panel.start_console(p))

                repo_dir = self._clone_repo(issue, work_dir)
                if repo_dir is None:
                    raise RuntimeError("Could not clone repo")

                if not self._checkout_sha(issue, repo_dir):
                    raise RuntimeError("Could not checkout base SHA")

                self._open_chrome()

                if not self._run_hfi(repo_dir, prompt, issue):
                    if self.stop_flag.is_set():
                        break  # user stopped — don't mark failed, just exit
                    raise RuntimeError("HFI workflow failed")

                success = True

            except RuntimeError as e:
                self._log(f"✗ Workflow error: {e}", "red")
            except Exception as e:
                self._log(f"✗ Unexpected error: {e}", "red")
            finally:
                timer_running[0] = False
                self._stop_heartbeat()
                self.root.after(0, self.prompt_panel.stop_console)

            if self.stop_flag.is_set():
                break

            if success:
                self._mark_done(issue_id)
                # Upload result zip before moving to next cycle
                if work_dir:
                    self._upload_result(work_dir)
                self._status("✓ Done — clearing and starting next cycle…")
            else:
                self._mark_failed(issue_id)
                self._status("✗ Failed — retrying with next issue…")

            time.sleep(2)
            self.root.after(0, self.term.clear)
            self.root.after(0, self.issue_panel.clear)
            self.root.after(0, self.prompt_panel.clear)
            self.root.after(0, lambda: self.on_timer(0))
            time.sleep(0.5)
            self._log("─" * 60, "dim")
            self._log("New workflow cycle starting…", "green")
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

                    # Validate required fields before proceeding
                    issue_id = issue.get("id") or issue.get("_id")
                    missing = [f for f, v in [
                        ("id",       issue_id),
                        ("repoName", issue.get("repoName")),
                        ("baseSha",  issue.get("baseSha")),
                    ] if not v]
                    if missing:
                        self._log(f"✗ Issue missing required fields ({', '.join(missing)}). Retrying in {self.RETRY_DELAY}s…", "yellow")
                        self._status("Invalid issue data. Retrying…")
                    elif not prompt:
                        self._log(f"✗ No prompt configured. Set a main prompt on the website. Retrying in {self.RETRY_DELAY}s…", "yellow")
                        self._status("No prompt set. Retrying…")
                    else:
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
            # Full clone — no --depth flag so history matches a manual `git clone`
            # stderr=subprocess.STDOUT captures git's progress output (git writes
            # progress to stderr by default; --progress forces it even in non-TTY)
            proc = subprocess.Popen(
                ["git", "clone", "--progress", clone_url, str(dest)],
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

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _tmux_running(self):
        """Return True if tmux is available."""
        return shutil.which("tmux") is not None

    def _open_terminal(self, session_name):
        """Open a visible terminal window attached to the given tmux session."""
        # Try common terminal emulators in order of preference.
        terminals = [
            ["gnome-terminal", "--", "tmux", "attach-session", "-t", session_name],
            ["xfce4-terminal", "-e", f"tmux attach-session -t {session_name}"],
            ["konsole", "-e", "tmux", "attach-session", "-t", session_name],
            ["xterm", "-e", f"tmux attach-session -t {session_name}"],
        ]
        for cmd in terminals:
            if shutil.which(cmd[0]):
                subprocess.Popen(cmd, stderr=subprocess.DEVNULL)
                self._log(f"  Opened terminal: {cmd[0]}", "dim")
                return
        self._log("⚠ No supported terminal emulator found (tried gnome-terminal, xfce4-terminal, konsole, xterm)", "yellow")

    def _tmux_send(self, session_name, text, label):
        """
        Send text to the tmux session.
        For short plain strings (like 'cc_code_behavior', 'N/A', '') use
        send-keys directly.  For anything else (e.g. the multi-line prompt)
        write to a temp file, load it into the tmux paste buffer, paste it,
        then send Enter — this handles special characters and long text safely.
        """
        self._log(f"  ◀ {label}", "prompt")

        # Decide strategy: use paste-buffer for long / multi-line text
        use_paste = len(text) > 80 or '\n' in text or any(c in text for c in '!"$\'\\`{}[]|&;<>()')

        if use_paste:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt',
                                            delete=False, encoding='utf-8') as f:
                f.write(text)
                tmp_path = f.name
            # Load the file into tmux buffer then paste it (no trailing newline added by paste)
            subprocess.run(["tmux", "load-buffer", tmp_path], stderr=subprocess.DEVNULL)
            subprocess.run(["tmux", "paste-buffer", "-t", session_name], stderr=subprocess.DEVNULL)
            os.unlink(tmp_path)
            # Send Enter separately to submit
            time.sleep(0.5)
            subprocess.run(["tmux", "send-keys", "-t", session_name, "", "Enter"],
                           stderr=subprocess.DEVNULL)
        else:
            subprocess.run(
                ["tmux", "send-keys", "-t", session_name, text, "Enter"],
                stderr=subprocess.DEVNULL,
            )

        time.sleep(2)

    def _tmux_capture(self, session_name):
        """Capture visible pane content from the tmux session (ANSI-stripped)."""
        result = subprocess.run(
            ["tmux", "capture-pane", "-p", "-t", session_name],
            capture_output=True, text=True,
        )
        return result.stdout if result.returncode == 0 else ""

    def _tmux_wait_for(self, session_name, pattern, timeout=300, status_msg=None):
        """
        Poll tmux capture-pane until pattern matches or timeout.
        Logs new lines to the terminal panel as they appear.
        """
        if status_msg:
            self._status(status_msg)
        compiled = re.compile(pattern, re.IGNORECASE)
        deadline = time.time() + timeout
        seen_lines = set()

        while time.time() < deadline:
            if self.stop_flag.is_set():
                raise InterruptedError("Stop requested")

            pane = self._tmux_capture(session_name)

            # Log any new non-empty lines we haven't shown yet
            for line in pane.splitlines():
                stripped = line.strip()
                if stripped and stripped not in seen_lines:
                    seen_lines.add(stripped)
                    self._log(stripped, "dim")

            if compiled.search(pane):
                return pane

            time.sleep(1)

        raise TimeoutError(f"Timeout ({timeout}s) waiting for: {pattern!r}")

    # ── Run claude-hfi ───────────────────────────────────────────────────────

    def _run_hfi(self, repo_dir, prompt, issue):
        prompt_text = prompt.get("content", "") if prompt else ""

        self._status("Starting claude-hfi…")
        self._log("→ claude-hfi --vscode", "blue")

        hfi_cmd = shutil.which("claude-hfi")
        if not hfi_cmd:
            self._log("✗ claude-hfi not found in PATH", "red")
            self._log("  Install it and make sure it is on your PATH.", "yellow")
            return False

        if not self._tmux_running():
            self._log("✗ tmux not found. Install it: sudo apt install tmux", "red")
            return False

        session = "talentcodehub-hfi"

        # Kill any leftover session from a previous run
        subprocess.run(["tmux", "kill-session", "-t", session],
                       stderr=subprocess.DEVNULL)
        time.sleep(0.5)

        # Create new tmux session running claude-hfi (detached so we can attach later)
        try:
            subprocess.run(
                ["tmux", "new-session", "-d", "-s", session,
                 "-c", str(repo_dir),
                 hfi_cmd, "--vscode"],
                check=True,
            )
        except subprocess.CalledProcessError as e:
            self._log(f"✗ Failed to start tmux session: {e}", "red")
            return False

        # Open a real terminal window so the user can watch
        self._open_terminal(session)
        self._log("✓ Terminal window opened — you can watch the output there", "green")

        try:
            # ── Step 1: wait for interface code prompt ────────────────────
            self._tmux_wait_for(session, r"terface\s*code",
                                timeout=300,
                                status_msg="Waiting for interface code prompt…")
            time.sleep(1)
            self._tmux_send(session, "cc_code_behavior", "cc_code_behavior")
            self._log("✓ Sent interface code", "green")

            # ── Step 2: 5s delay then send N/A ───────────────────────────
            self._status("Waiting 5s before sending N/A for repo question…")
            self._log("  (waiting 5s for repo question)", "dim")
            time.sleep(5)
            self._tmux_send(session, "N/A", "N/A")
            self._log("✓ Sent N/A for repo", "green")

            # ── Step 2b: wait 5s then send blank Enter to confirm ────────
            self._status("Waiting 5s then pressing Enter to confirm…")
            self._log("  (waiting 5s then sending Enter)", "dim")
            time.sleep(5)
            subprocess.run(
                ["tmux", "send-keys", "-t", session, "", "Enter"],
                stderr=subprocess.DEVNULL,
            )
            self._log("✓ Sent Enter", "green")

            # ── Step 3: wait 40s, check for 'Debug mode enabled', send prompt
            # Retry every 40s until debug mode is confirmed or max attempts reached.
            MAX_PROMPT_ATTEMPTS = 10
            prompt_sent = False
            for attempt in range(1, MAX_PROMPT_ATTEMPTS + 1):
                self._status(f"Waiting 40s before sending prompt (attempt {attempt})…")
                self._log(f"  (waiting 40s — attempt {attempt})", "dim")

                # Wait 40s while watching the pane for "Debug mode enabled"
                debug_seen = False
                deadline = time.time() + 40
                seen_lines = set()
                while time.time() < deadline:
                    if self.stop_flag.is_set():
                        raise InterruptedError("Stop requested")
                    pane = self._tmux_capture(session)
                    for line in pane.splitlines():
                        s = line.strip()
                        if s and s not in seen_lines:
                            seen_lines.add(s)
                            self._log(s, "dim")
                    if re.search(r"Debug\s*mode\s*enabled", pane, re.IGNORECASE):
                        debug_seen = True
                    time.sleep(2)

                if debug_seen:
                    self._log(f"✓ 'Debug mode enabled' detected (attempt {attempt})", "green")
                else:
                    self._log(f"⚠ 'Debug mode enabled' not seen yet (attempt {attempt}) — sending prompt anyway", "yellow")

                self._tmux_send(session, prompt_text,
                                f"<prompt ({len(prompt_text)} chars)>")
                self._log("✓ Sent prompt", "green")
                prompt_sent = True

                if debug_seen:
                    break  # debug mode was ready — prompt should have registered

            if not prompt_sent:
                self._log("✗ Could not confirm debug mode after all attempts", "red")
                raise TimeoutError("Debug mode never appeared")

            # ── Step 4: wait for evaluation / completion ──────────────────
            self._tmux_wait_for(
                session,
                r"(What did Model|A.{0,4}s pros|B.{0,4}s pros|Overall Prefer|A is better|B is better)",
                timeout=7200,
                status_msg="HFI running — watching terminal for evaluation…",
            )
            self._log("✓ HFI evaluation output detected", "green")
            self._status("HFI done — cleaning up…")

            # Kill the tmux session (also closes the attached terminal window)
            subprocess.run(["tmux", "kill-session", "-t", session],
                           stderr=subprocess.DEVNULL)
            time.sleep(1)

            # Kill VS Code windows — use exact process name to avoid false matches
            for sig_cmd in [["pkill", "-x", "code"], ["pkill", "-x", "Code"],
                            ["pkill", "-f", "electron.*vscode"],
                            ["pkill", "-f", "/usr/share/code/code"]]:
                subprocess.run(sig_cmd, stderr=subprocess.DEVNULL)
            time.sleep(2)
            return True

        except InterruptedError:
            self._log("⚠ Stopped by user", "yellow")
            subprocess.run(["tmux", "kill-session", "-t", session],
                           stderr=subprocess.DEVNULL)
            return False

        except TimeoutError as e:
            self._log(f"✗ {e}", "red")
            subprocess.run(["tmux", "kill-session", "-t", session],
                           stderr=subprocess.DEVNULL)
            return False

        except Exception as e:
            self._log(f"✗ HFI error: {e}", "red")
            subprocess.run(["tmux", "kill-session", "-t", session],
                           stderr=subprocess.DEVNULL)
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

        ttk.Button(right, text="⚙ Settings",
                   style="Ghost.TButton",
                   command=self._open_settings).pack(side=tk.RIGHT, padx=(0, 4))

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

        # Left column: timer + issue + prompt
        left = tk.Frame(body, bg=DARK["bg"], width=400)
        left.pack(side=tk.LEFT, fill=tk.BOTH, padx=(8, 4), pady=8)
        left.pack_propagate(False)

        # Timer + network graph card
        timer_card = tk.Frame(left, bg=DARK["surface"], pady=10)
        timer_card.pack(fill=tk.X)
        tk.Label(timer_card, text="CYCLE TIMER", bg=DARK["surface"],
                 fg=DARK["text_dim"], font=("Segoe UI", 8, "bold"),
                 padx=12).pack(anchor="w")
        tk.Frame(timer_card, bg=DARK["border"], height=1).pack(fill=tk.X)
        timer_inner = tk.Frame(timer_card, bg=DARK["surface"])
        timer_inner.pack(fill=tk.X, pady=10, padx=10)
        self.timer_widget = CircularTimer(timer_inner)
        self.timer_widget.pack(side=tk.LEFT)
        self.net_graph = NetworkGraph(timer_inner)
        self.net_graph.pack(side=tk.LEFT, padx=(10, 0))
        self.root.after(600, self.net_graph.start)

        tk.Frame(left, bg=DARK["border"], height=1).pack(fill=tk.X, pady=4)

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
        self.timer_widget.reset()
        self.timer_widget.set_active(True)
        self.term.write("═" * 60, "green")
        self.term.write("  TalentCodeHub Workflow Started", "green")
        self.term.write("═" * 60, "green")

        engine = WorkflowEngine(
            root=self.root,
            term=self.term,
            issue_panel=self.issue_panel,
            prompt_panel=self.prompt_panel,
            on_status=lambda m: self.root.after(0, lambda: self.status_var.set(m)),
            on_done=lambda: self.root.after(0, self._on_workflow_done),
            on_stop_flag=self._stop_ev,
            on_timer=self.timer_widget.update_time,
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
        self.timer_widget.set_active(False)
        self.status_var.set("Stopped. Press START to run again.")
        self.term.write("● Workflow stopped.", "dim")

    def _open_settings(self):
        win = tk.Toplevel(self.root)
        win.title("Settings")
        win.resizable(False, False)
        win.configure(bg=DARK["bg"])
        w, h = 420, 180
        sw, sh = win.winfo_screenwidth(), win.winfo_screenheight()
        win.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")
        win.grab_set()

        body = tk.Frame(win, bg=DARK["bg"], padx=24, pady=20)
        body.pack(fill=tk.BOTH, expand=True)

        tk.Label(body, text="Upload Server URL", bg=DARK["bg"],
                 fg=DARK["text_dim"], font=FONT_SMALL).pack(anchor="w", pady=(0, 4))

        url_var = tk.StringVar(value=get_upload_server())
        entry = ttk.Entry(body, textvariable=url_var)
        entry.pack(fill=tk.X, pady=(0, 8))
        entry.focus()

        err_var = tk.StringVar()
        tk.Label(body, textvariable=err_var, bg=DARK["bg"],
                 fg=DARK["danger"], font=FONT_SMALL).pack(anchor="w", pady=(0, 8))

        def _save():
            url = url_var.get().strip()
            if not url.startswith("http"):
                err_var.set("URL must start with http:// or https://")
                return
            save_settings({"upload_server": url})
            win.destroy()

        btn_row = tk.Frame(body, bg=DARK["bg"])
        btn_row.pack(fill=tk.X)
        ttk.Button(btn_row, text="Save", style="Primary.TButton", command=_save).pack(side=tk.RIGHT)
        ttk.Button(btn_row, text="Cancel", style="Ghost.TButton",
                   command=win.destroy).pack(side=tk.RIGHT, padx=(0, 6))

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
