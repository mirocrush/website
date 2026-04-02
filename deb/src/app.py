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


def _ensure_user_path():
    """
    Augment os.environ['PATH'] with common user-local binary directories so
    that tools installed outside /usr/bin (e.g. claude-hfi via npm/pip into
    ~/.local/bin or ~/.nvm/...) are findable by shutil.which() when the app
    is launched from a desktop launcher rather than a login shell.
    Call once at startup.
    """
    home = str(Path.home())
    extra = [
        f"{home}/.local/bin",
        f"{home}/.npm-global/bin",
        f"{home}/npm/bin",
        f"{home}/.yarn/bin",
        f"{home}/.cargo/bin",
        "/usr/local/bin",
        "/usr/local/sbin",
    ]
    # Also expand any nvm-managed node versions
    nvm_dir = os.environ.get("NVM_DIR", f"{home}/.nvm")
    nvm_default = Path(nvm_dir) / "alias" / "default"
    if nvm_default.exists():
        try:
            version = nvm_default.read_text().strip()
            extra.append(f"{nvm_dir}/versions/node/{version}/bin")
        except Exception:
            pass
    # Add each candidate only if it exists and isn't already in PATH
    current = os.environ.get("PATH", "").split(":")
    additions = [p for p in extra if p not in current and os.path.isdir(p)]
    if additions:
        os.environ["PATH"] = ":".join(additions) + ":" + os.environ.get("PATH", "")


def find_hfi_cmd():
    """
    Return the full path to claude-hfi, or None if not found.
    Tries shutil.which after ensuring the PATH is fully expanded.
    """
    _ensure_user_path()
    return shutil.which("claude-hfi")


# ── App icon ──────────────────────────────────────────────────────────────

_ICON_PATHS = [
    # Installed location (deb package)
    "/usr/lib/talentcodehub/talent-icon.png",
    # Dev location (running directly from source)
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "talent-icon.png"),
]

def _load_icon_image():
    """Return a PhotoImage for the app icon, or None if not available."""
    try:
        from PIL import Image, ImageTk
        for path in _ICON_PATHS:
            if os.path.exists(path):
                img = Image.open(path).resize((64, 64), Image.LANCZOS)
                return ImageTk.PhotoImage(img)
    except ImportError:
        # Pillow not available — fall back to tk.PhotoImage (PNG only, no resize)
        try:
            for path in _ICON_PATHS:
                if os.path.exists(path):
                    return tk.PhotoImage(file=path)
        except Exception:
            pass
    except Exception:
        pass
    return None


def set_window_icon(root):
    """Set the window icon on any Tk or Toplevel window."""
    img = _load_icon_image()
    if img:
        root.iconphoto(True, img)
        # Keep a reference so GC doesn't collect it
        root._icon_ref = img

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


_ensure_user_path()
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


def apply_light(root):
    """Configure ttk styles for the white-theme windows (MainWindow, PRInteractionWindow)."""
    style = ttk.Style(root)
    style.theme_use("clam")

    bg  = HOME["bg"]        # light blue-white
    sf  = HOME["card"]      # white card
    sf2 = HOME["primary_lt"]
    bd  = HOME["border"]
    tx  = HOME["text"]
    tdm = HOME["text_dim"]
    pr  = HOME["primary"]

    style.configure(".",
        background=bg, foreground=tx,
        fieldbackground=sf, insertcolor=tx,
        troughcolor=bd, selectbackground=pr,
        selectforeground="#ffffff", font=FONT_UI,
        bordercolor=bd, darkcolor=bd, lightcolor=bd,
        relief="flat",
    )
    style.configure("TFrame",  background=bg)
    style.configure("TLabel",  background=bg, foreground=tx, font=FONT_UI)

    style.configure("TEntry",
        fieldbackground=sf, foreground=tx,
        insertcolor=tx, bordercolor=bd, lightcolor=bd, darkcolor=bd,
    )
    style.map("TEntry", fieldbackground=[("focus", sf2)])

    # Primary button (blue)
    style.configure("Primary.TButton",
        background=pr, foreground="#ffffff",
        font=FONT_BOLD, relief="flat", padding=(14, 8),
    )
    style.map("Primary.TButton",
        background=[("active", HOME["accent"]), ("disabled", HOME["border"])],
        foreground=[("disabled", tdm)],
    )

    # Ghost button (light)
    style.configure("Ghost.TButton",
        background=HOME["sidebar"], foreground=tdm,
        font=FONT_UI, relief="flat", padding=(10, 6),
    )
    style.map("Ghost.TButton",
        background=[("active", sf2)],
        foreground=[("active", tx)],
    )

    # Danger button
    style.configure("Danger.TButton",
        background="#ef4444", foreground="#ffffff",
        font=FONT_BOLD, relief="flat", padding=(14, 8),
    )
    style.map("Danger.TButton",
        background=[("active", "#dc2626"), ("disabled", bd)],
    )

    style.configure("TScrollbar",
        background=bd, troughcolor=sf,
        arrowcolor=tdm, bordercolor=bd,
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

import math
import random

# Light palette used only by the login screen
LOGIN = {
    "bg":        "#f0f4ff",
    "card":      "#ffffff",
    "primary":   "#4f6ef7",
    "primary_dk":"#3a57d4",
    "accent":    "#7c3aed",
    "text":      "#1a1a2e",
    "text_dim":  "#6b7280",
    "border":    "#e2e8f0",
    "danger":    "#ef4444",
    "input_bg":  "#f8faff",
    "input_focus":"#eef2ff",
    "bubble1":   "#c7d7fd",
    "bubble2":   "#ddd6fe",
    "bubble3":   "#bfdbfe",
    "bubble4":   "#fde68a",
    "bubble5":   "#fca5a5",
}


class _Bubble:
    """A single floating bubble for the animated background."""
    def __init__(self, w, h):
        self.reset(w, h, initial=True)

    def reset(self, w, h, initial=False):
        self.r  = random.randint(18, 60)
        self.x  = random.randint(0, w)
        self.y  = h + self.r if not initial else random.randint(-h, h)
        self.vx = random.uniform(-0.4, 0.4)
        self.vy = random.uniform(-0.6, -0.2)
        self.color = random.choice([
            LOGIN["bubble1"], LOGIN["bubble2"], LOGIN["bubble3"],
            LOGIN["bubble4"], LOGIN["bubble5"],
        ])
        self.alpha_phase = random.uniform(0, math.pi * 2)
        self.pulse_speed = random.uniform(0.02, 0.05)

    def step(self, w, h):
        self.x += self.vx
        self.y += self.vy
        self.alpha_phase += self.pulse_speed
        if self.y + self.r < 0:
            self.reset(w, h)


class LoginWindow:
    W, H = 520, 600      # window size
    CARD_W = 380         # inner card width
    FPS  = 30

    def __init__(self, root, on_success):
        self.root = root
        self.cb   = on_success
        self._animating = True

        root.title("TalentCodeHub — Sign In")
        root.resizable(False, False)
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{self.W}x{self.H}+{(sw-self.W)//2}+{(sh-self.H)//2}")
        root.configure(bg=LOGIN["bg"])
        set_window_icon(root)

        # ── Canvas background ──────────────────────────────────────────
        self._canvas = tk.Canvas(root, width=self.W, height=self.H,
                                 highlightthickness=0, bg=LOGIN["bg"])
        self._canvas.place(x=0, y=0)

        # Gradient gradient rows painted once as rectangles
        self._draw_gradient()

        # Bubbles
        self._bubbles = [_Bubble(self.W, self.H) for _ in range(22)]

        # ── Card (plain Frame over canvas) ─────────────────────────────
        card_x = (self.W - self.CARD_W) // 2

        self._card = tk.Frame(root, bg=LOGIN["card"],
                              bd=0, highlightthickness=1,
                              highlightbackground=LOGIN["border"])

        self._build_card()

        # Measure actual card height after content is built, then center it
        root.update_idletasks()
        card_h = self._card.winfo_reqheight()
        card_y = max(16, (self.H - card_h) // 2)
        self._card_x = card_x
        self._card_y = card_y
        self._card.place(x=card_x, y=card_y, width=self.CARD_W)

        # Start animation
        self._tick()

        # Slide-in the card
        self._fade_in()

        root.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── Gradient ──────────────────────────────────────────────────────

    def _draw_gradient(self):
        """Paint a soft top→bottom gradient on the canvas."""
        top_r, top_g, top_b = 0xe8, 0xed, 0xff
        bot_r, bot_g, bot_b = 0xf5, 0xf0, 0xff
        steps = self.H
        for i in range(steps):
            t = i / steps
            r = int(top_r + (bot_r - top_r) * t)
            g = int(top_g + (bot_g - top_g) * t)
            b = int(top_b + (bot_b - top_b) * t)
            color = f"#{r:02x}{g:02x}{b:02x}"
            self._canvas.create_rectangle(0, i, self.W, i + 1,
                                          fill=color, outline=color)

    # ── Animated tick ─────────────────────────────────────────────────

    def _tick(self):
        if not self._animating:
            return
        self._canvas.delete("bubble")
        for b in self._bubbles:
            b.step(self.W, self.H)
            # pulsing opacity via stipple isn't available in tk, so vary size
            pulse = math.sin(b.alpha_phase) * 4
            r = max(6, b.r + pulse)
            x0, y0, x1, y1 = b.x - r, b.y - r, b.x + r, b.y + r
            self._canvas.create_oval(x0, y0, x1, y1,
                                     fill=b.color, outline="",
                                     tags="bubble")
        self.root.after(1000 // self.FPS, self._tick)

    def _fade_in(self):
        """Slide card in from slightly above using ease-out cubic."""
        STEPS    = 18
        target_y = self._card_y
        start_y  = max(0, target_y - 28)
        card_x   = self._card_x

        def step(i):
            if i > STEPS:
                self._card.place(x=card_x, y=target_y)
                return
            ease = 1 - (1 - i / STEPS) ** 3
            y = int(start_y + (target_y - start_y) * ease)
            self._card.place(x=card_x, y=y)
            self.root.after(16, lambda: step(i + 1))

        step(0)

    # ── Card contents ─────────────────────────────────────────────────

    def _build_card(self):
        pad = 36

        # Logo / brand
        brand = tk.Frame(self._card, bg=LOGIN["card"])
        brand.pack(fill=tk.X, padx=pad, pady=(32, 0))

        # App logo (24×24)
        logo_img = None
        try:
            from PIL import Image, ImageTk
            for path in _ICON_PATHS:
                if os.path.exists(path):
                    pil = Image.open(path).resize((24, 24), Image.LANCZOS)
                    logo_img = ImageTk.PhotoImage(pil)
                    break
        except Exception:
            try:
                for path in _ICON_PATHS:
                    if os.path.exists(path):
                        raw = tk.PhotoImage(file=path)
                        # subsample to ~24px (PNG is typically 256px → factor 10)
                        factor = max(1, raw.width() // 24)
                        logo_img = raw.subsample(factor, factor)
                        break
            except Exception:
                pass

        if logo_img:
            lbl = tk.Label(brand, image=logo_img, bg=LOGIN["card"])
            lbl.image = logo_img   # keep reference
            lbl.pack(side=tk.LEFT)
        else:
            # Fallback dot icon
            dot_canvas = tk.Canvas(brand, width=24, height=24,
                                   bg=LOGIN["card"], highlightthickness=0)
            dot_canvas.pack(side=tk.LEFT)
            dot_canvas.create_oval(2, 2, 22, 22, fill=LOGIN["primary"], outline="")
            dot_canvas.create_oval(7, 7, 17, 17, fill=LOGIN["card"], outline="")
            dot_canvas.create_oval(10, 10, 14, 14, fill=LOGIN["accent"], outline="")

        name_frame = tk.Frame(brand, bg=LOGIN["card"])
        name_frame.pack(side=tk.LEFT, padx=(10, 0))
        tk.Label(name_frame, text="TalentCodeHub",
                 bg=LOGIN["card"], fg=LOGIN["text"],
                 font=("Segoe UI", 15, "bold")).pack(anchor="w")
        tk.Label(name_frame, text="AI-powered issue workflow",
                 bg=LOGIN["card"], fg=LOGIN["text_dim"],
                 font=("Segoe UI", 9)).pack(anchor="w")

        # Separator
        tk.Frame(self._card, bg=LOGIN["border"], height=1).pack(
            fill=tk.X, padx=pad, pady=(20, 0))

        # Heading
        tk.Label(self._card, text="Welcome back",
                 bg=LOGIN["card"], fg=LOGIN["text"],
                 font=("Segoe UI", 18, "bold")).pack(anchor="w", padx=pad, pady=(20, 2))
        tk.Label(self._card, text="Sign in to your account to continue",
                 bg=LOGIN["card"], fg=LOGIN["text_dim"],
                 font=("Segoe UI", 10)).pack(anchor="w", padx=pad, pady=(0, 20))

        # Email field
        self._build_field(self._card, "Email address", pad)
        self.email = self._last_entry

        # Password field with inline next button
        self._build_field(self._card, "Password", pad, show="●", with_next_btn=True)
        self.pwd = self._last_entry
        self.pwd.bind("<Return>", lambda _: self._signin())

        # Remember me
        remember_row = tk.Frame(self._card, bg=LOGIN["card"])
        remember_row.pack(fill=tk.X, padx=pad, pady=(4, 0))
        self._remember_var = tk.BooleanVar()
        cb = tk.Checkbutton(
            remember_row, text="Remember me",
            variable=self._remember_var,
            bg=LOGIN["card"], fg=LOGIN["text_dim"],
            selectcolor=LOGIN["input_bg"],
            activebackground=LOGIN["card"],
            activeforeground=LOGIN["text"],
            font=("Segoe UI", 9), bd=0, highlightthickness=0,
            cursor="hand2",
        )
        cb.pack(side=tk.LEFT)

        # Pre-fill remembered credentials
        saved = load_settings()
        if saved.get("remember_me") and saved.get("saved_email"):
            self.email.insert(0, saved["saved_email"])
            self.pwd.insert(0, saved.get("saved_password", ""))
            self._remember_var.set(True)
            self.pwd.focus_set()
        else:
            self.email.focus_set()

        # Error label
        self.err_var = tk.StringVar()
        self.err_lbl = tk.Label(self._card, textvariable=self.err_var,
                                bg=LOGIN["card"], fg=LOGIN["danger"],
                                font=("Segoe UI", 9), wraplength=self.CARD_W - pad * 2,
                                justify="left")
        self.err_lbl.pack(fill=tk.X, padx=pad, pady=(6, 0))

        # Footer
        tk.Label(self._card, text="Secure sign-in · TalentCodeHub © 2025",
                 bg=LOGIN["card"], fg=LOGIN["text_dim"],
                 font=("Segoe UI", 8)).pack(pady=(4, 24))

    def _build_field(self, parent, label, pad, show=None, with_next_btn=False):
        """Build a styled input field with focus highlight."""
        tk.Label(parent, text=label,
                 bg=LOGIN["card"], fg=LOGIN["text"],
                 font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=pad, pady=(0, 4))

        container = tk.Frame(parent, bg=LOGIN["border"],
                             highlightthickness=0, bd=0)
        container.pack(fill=tk.X, padx=pad, pady=(0, 12), ipady=1)

        inner = tk.Frame(container, bg=LOGIN["input_bg"])
        inner.pack(fill=tk.X, padx=1, pady=1)

        entry = tk.Entry(inner, show=show, bg=LOGIN["input_bg"],
                         fg=LOGIN["text"], insertbackground=LOGIN["primary"],
                         relief="flat", bd=0,
                         font=("Segoe UI", 11),
                         highlightthickness=0)
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(10, 4), pady=8)

        if with_next_btn:
            self._next_btn = tk.Label(
                inner, text="→",
                bg=LOGIN["primary"], fg="white",
                font=("Segoe UI", 13, "bold"),
                cursor="hand2", padx=14, pady=6,
            )
            self._next_btn.pack(side=tk.RIGHT, padx=(0, 4), pady=4)
            self._next_btn.bind("<Button-1>", lambda _: self._signin())
            self._next_btn.bind("<Enter>",
                lambda _: self._next_btn.configure(bg=LOGIN["primary_dk"]))
            self._next_btn.bind("<Leave>",
                lambda _: self._next_btn.configure(bg=LOGIN["primary"]))

        def on_focus_in(_e):
            container.configure(bg=LOGIN["primary"])
            inner.configure(bg=LOGIN["input_focus"])
            entry.configure(bg=LOGIN["input_focus"])
            if with_next_btn:
                self._next_btn.configure(bg=LOGIN["primary"])

        def on_focus_out(_e):
            container.configure(bg=LOGIN["border"])
            inner.configure(bg=LOGIN["input_bg"])
            entry.configure(bg=LOGIN["input_bg"])

        entry.bind("<FocusIn>",  on_focus_in)
        entry.bind("<FocusOut>", on_focus_out)

        self._last_entry = entry

    # ── Sign-in logic ─────────────────────────────────────────────────

    def _set_loading(self, loading):
        txt = "…" if loading else "→"
        bg  = LOGIN["primary_dk"] if loading else LOGIN["primary"]
        self._next_btn.configure(text=txt, bg=bg, state="disabled" if loading else "normal")

    def _signin(self):
        email = self.email.get().strip()
        pwd   = self.pwd.get()
        if not email or not pwd:
            self.err_var.set("Please enter your email and password.")
            self._shake()
            return
        self._set_loading(True)
        self.err_var.set("")
        remember = self._remember_var.get()

        def task():
            try:
                r = session.post("/api/auth/signin", json={"email": email, "password": pwd})
                d = r.json()
                if d.get("success"):
                    session.save()
                    if remember:
                        save_settings({"remember_me": True, "saved_email": email, "saved_password": pwd})
                    else:
                        save_settings({"remember_me": False, "saved_email": "", "saved_password": ""})
                    self._animating = False
                    self.root.after(0, self._show_success_splash)
                else:
                    self.root.after(0, lambda: (
                        self.err_var.set(d.get("message", "Sign in failed.")),
                        self._shake(),
                    ))
            except Exception as e:
                self.root.after(0, lambda: (
                    self.err_var.set(f"Connection error: {e}"),
                    self._shake(),
                ))
            finally:
                self.root.after(0, lambda: self._set_loading(False))

        threading.Thread(target=task, daemon=True).start()

    def _show_success_splash(self):
        """Full-window animated checkmark overlay, then transition to main."""
        cx, cy   = self.W // 2, self.H // 2
        GREEN    = "#22c55e"
        GREEN_DK = "#16a34a"

        overlay = tk.Canvas(self.root, width=self.W, height=self.H,
                            bg=LOGIN["card"], highlightthickness=0)
        overlay.place(x=0, y=0)

        # ── Phase 1: circle grows from centre ─────────────────────────
        circle = overlay.create_oval(cx, cy, cx, cy, fill=GREEN, outline="")

        MAX_R = 72
        def grow_circle(r):
            if r >= MAX_R:
                overlay.after(60, lambda: draw_check(0))
                return
            overlay.coords(circle, cx - r, cy - r, cx + r, cy + r)
            overlay.after(11, lambda: grow_circle(min(r + 5, MAX_R)))

        # ── Phase 2: checkmark draws itself in two strokes ─────────────
        # Points relative to (cx, cy):  start → knee → end
        PTS = [(-24, 2), (-6, 22), (30, -18)]

        def draw_check(seg):
            if seg >= len(PTS) - 1:
                overlay.after(320, lambda: fade_out(0))
                return
            x1 = cx + PTS[seg][0];   y1 = cy + PTS[seg][1]
            x2 = cx + PTS[seg+1][0]; y2 = cy + PTS[seg+1][1]
            line_id = overlay.create_line(x1, y1, x1, y1,
                                          fill="white", width=5,
                                          capstyle="round", joinstyle="round")

            STEPS = 14
            def animate_seg(step):
                t = (step + 1) / STEPS
                xt = x1 + (x2 - x1) * t
                yt = y1 + (y2 - y1) * t
                overlay.coords(line_id, x1, y1, xt, yt)
                if step < STEPS - 1:
                    overlay.after(18, lambda: animate_seg(step + 1))
                else:
                    overlay.after(40, lambda: draw_check(seg + 1))

            animate_seg(0)

        # ── Phase 3: overlay fades to bg colour then disappears ────────
        def fade_out(step, steps=22):
            if step >= steps:
                overlay.destroy()
                self.cb()
                return
            t = step / steps
            # Blend card white → login bg colour
            r0, g0, b0 = 0xff, 0xff, 0xff
            r1, g1, b1 = 0xf0, 0xf4, 0xff
            r = int(r0 + (r1 - r0) * t)
            g = int(g0 + (g1 - g0) * t)
            b = int(b0 + (b1 - b0) * t)
            overlay.configure(bg=f"#{r:02x}{g:02x}{b:02x}")
            # Also shrink + fade circle
            scale = 1 + t * 0.25
            nr = int(MAX_R * scale)
            overlay.coords(circle, cx - nr, cy - nr, cx + nr, cy + nr)
            overlay.after(22, lambda: fade_out(step + 1))

        grow_circle(4)

    def _shake(self):
        """Shake the card horizontally to indicate an error."""
        card_x0 = (self.W - self.CARD_W) // 2
        card_y  = self._card.winfo_y()
        offsets = [8, -8, 6, -6, 4, -4, 2, -2, 0]

        def step(i):
            if i >= len(offsets):
                return
            self._card.place(x=card_x0 + offsets[i], y=card_y)
            self.root.after(40, lambda: step(i + 1))

        step(0)

    def _on_close(self):
        self._animating = False
        self.root.destroy()


# ── Terminal Panel ────────────────────────────────────────────────────────

class TerminalPanel(tk.Frame):
    """Embedded terminal-like log panel."""

    def __init__(self, parent, colors=None, **kw):
        self._C = colors or DARK
        super().__init__(parent, bg=self._C.get("surface", DARK["surface"]), **kw)
        self._build()

    def _build(self):
        C = self._C
        sf  = C.get("surface",  DARK["surface"])
        sf2 = C.get("surface2", DARK["surface2"])
        sf3 = C.get("surface3", DARK["surface3"])
        tdm = C.get("text_dim", DARK["text_dim"])
        tmu = C.get("text_muted", DARK["text_muted"])
        tx  = C.get("text",     DARK["text"])
        pr  = C.get("primary",  DARK["primary"])
        acc = C.get("accent",   DARK["accent"])

        hdr = tk.Frame(self, bg=sf2)
        hdr.pack(fill=tk.X)
        tk.Label(hdr, text="  TERMINAL", bg=sf2,
                 fg=tdm, font=("Segoe UI", 8, "bold"),
                 pady=4).pack(side=tk.LEFT)
        self.clear_btn = tk.Label(hdr, text="✕ clear", bg=sf2,
                                  fg=tmu, font=("Segoe UI", 8),
                                  cursor="hand2", padx=8)
        self.clear_btn.pack(side=tk.RIGHT)
        self.clear_btn.bind("<Button-1>", lambda _: self.clear())

        self.text = tk.Text(
            self, bg=sf, fg=tx,
            font=FONT_MONO, state=tk.DISABLED,
            wrap=tk.WORD, relief="flat",
            insertbackground=tx,
            selectbackground=sf3,
        )
        sb = ttk.Scrollbar(self, command=self.text.yview)
        self.text.configure(yscrollcommand=sb.set)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.text.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)

        self.text.tag_configure("green",  foreground=pr)
        self.text.tag_configure("yellow", foreground=C.get("warn",   DARK["warn"]))
        self.text.tag_configure("red",    foreground=C.get("danger", DARK["danger"]))
        self.text.tag_configure("blue",   foreground=acc)
        self.text.tag_configure("dim",    foreground=tdm)
        self.text.tag_configure("prompt", foreground=acc)

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

    def __init__(self, parent, colors=None, **kw):
        self._C = colors or DARK
        super().__init__(
            parent,
            width=self.SIZE, height=self.SIZE,
            bg=self._C.get("surface", DARK["surface"]), highlightthickness=0,
            **kw,
        )
        self._elapsed = 0
        self._active  = False
        self._draw(0)

    def _draw(self, elapsed_ms):
        C = self._C
        self.delete("all")
        cx = cy = self.SIZE / 2
        r  = (self.SIZE - self.THICK) / 2
        x0, y0 = cx - r, cy - r
        x1, y1 = cx + r, cy + r

        # Background ring
        self.create_arc(x0, y0, x1, y1,
                        start=90, extent=360,
                        style=tk.ARC,
                        outline=C.get("surface3", DARK["surface3"]),
                        width=self.THICK)

        # Progress arc (sweeps 0→360 every PERIOD ms)
        pct   = (elapsed_ms % self.PERIOD) / self.PERIOD
        sweep = pct * 360
        color = C.get("primary", DARK["primary"]) if self._active else C.get("text_muted", DARK["text_muted"])
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
                         fill=C.get("text", DARK["text"]) if self._active else C.get("text_dim", DARK["text_dim"]),
                         font=("Segoe UI", 10, "bold"))
        self.create_text(cx, cy + 10,
                         text="elapsed",
                         fill=C.get("text_muted", DARK["text_muted"]),
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

    def __init__(self, parent, colors=None, **kw):
        self._C = colors or DARK
        super().__init__(
            parent,
            width=self.WIDTH, height=self.HEIGHT,
            bg=self._C.get("surface", DARK["surface"]), highlightthickness=0,
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
        C = self._C
        self.delete("all")
        w, h = self.WIDTH, self.HEIGHT

        # layout constants
        PL, PR, PT, PB = 4, 4, 28, 14   # padding left/right/top/bottom
        gw = w - PL - PR
        gh = h - PT - PB

        # graph area background
        self.create_rectangle(PL, PT, PL + gw, PT + gh,
                              fill=C.get("surface2", DARK["surface2"]),
                              outline=C.get("border", DARK["border"]))

        # current rate labels (top)
        up_now = self._up_hist[-1]
        dn_now = self._dn_hist[-1]
        self.create_text(PL + 2, 3,
                         text=f"\u2191 {self._fmt(up_now)}",
                         fill=C.get("primary", DARK["primary"]), font=("Courier", 8, "bold"), anchor="nw")
        self.create_text(PL + 2, 15,
                         text=f"\u2193 {self._fmt(dn_now)}",
                         fill=C.get("accent", DARK["accent"]),  font=("Courier", 8, "bold"), anchor="nw")

        # y-scale: dynamic max, at least 1 KB/s so graph is always visible
        max_val = max(max(self._up_hist), max(self._dn_hist), 1024.0)

        # horizontal grid lines at 25 / 50 / 75 / 100 %
        for frac in (0.25, 0.5, 0.75, 1.0):
            gy = PT + gh - int(gh * frac)
            self.create_line(PL, gy, PL + gw, gy,
                             fill=C.get("surface3", DARK["surface3"]), dash=(2, 4))

        # build point lists for upload and download
        n    = len(self._up_hist)
        step = gw / max(n - 1, 1)

        up_pts, dn_pts = [], []
        for i in range(n):
            x = PL + int(i * step)
            up_pts += [x, PT + gh - int(gh * min(self._up_hist[i] / max_val, 1.0))]
            dn_pts += [x, PT + gh - int(gh * min(self._dn_hist[i] / max_val, 1.0))]

        if len(up_pts) >= 4:
            self.create_line(*up_pts, fill=C.get("primary", DARK["primary"]), width=1, smooth=True)
        if len(dn_pts) >= 4:
            self.create_line(*dn_pts, fill=C.get("accent", DARK["accent"]),  width=1, smooth=True)

        # bottom label: current scale
        self.create_text(PL + gw // 2, h - 2,
                         text=f"max {self._fmt(max_val)}",
                         fill=C.get("text_muted", DARK["text_muted"]), font=("Courier", 7), anchor="s")

        # no psutil warning
        if not _psutil:
            self.create_text(PL + gw // 2, PT + gh // 2,
                             text="psutil not installed",
                             fill=DARK["text_muted"], font=("Courier", 8), anchor="center")


# ── Issue Detail Panel ────────────────────────────────────────────────────

class IssuePanel(tk.Frame):
    def __init__(self, parent, colors=None, **kw):
        self._C = colors or DARK
        super().__init__(parent, bg=self._C["surface"], **kw)
        self._build()

    def _build(self):
        C = self._C
        tk.Label(self, text="ISSUE", bg=C["surface"],
                 fg=C["text_dim"], font=("Segoe UI", 8, "bold"),
                 pady=6, padx=10).pack(anchor="w")
        tk.Frame(self, bg=C["border"], height=1).pack(fill=tk.X)

        body = tk.Frame(self, bg=C["surface"], padx=12, pady=8)
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
            row = tk.Frame(body, bg=C["surface"])
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label, bg=C["surface"],
                     fg=C["text_dim"], font=FONT_SMALL,
                     width=10, anchor="w").pack(side=tk.LEFT)
            var = tk.StringVar()
            self._vars[key] = var
            tk.Label(row, textvariable=var, bg=C["surface"],
                     fg=C["text"], font=FONT_SMALL,
                     anchor="w").pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Issue link (clickable-looking)
        link_row = tk.Frame(body, bg=C["surface"])
        link_row.pack(fill=tk.X, pady=2)
        tk.Label(link_row, text="Issue", bg=C["surface"],
                 fg=C["text_dim"], font=FONT_SMALL,
                 width=10, anchor="w").pack(side=tk.LEFT)
        self.link_var = tk.StringVar()
        tk.Label(link_row, textvariable=self.link_var, bg=C["surface"],
                 fg=C["accent"], font=FONT_SMALL,
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
    def __init__(self, parent, colors=None, **kw):
        self._C = colors or DARK
        super().__init__(parent, bg=self._C["surface"], **kw)
        self._console_path  = None
        self._console_pos   = 0       # byte offset of last read position
        self._console_after = None    # scheduled after() id
        self._build()

    def _build(self):
        C = self._C
        tk.Label(self, text="PROMPT", bg=C["surface"],
                 fg=C["text_dim"], font=("Segoe UI", 8, "bold"),
                 pady=6, padx=10).pack(anchor="w")
        tk.Frame(self, bg=C["border"], height=1).pack(fill=tk.X)

        self.title_var = tk.StringVar()
        tk.Label(self, textvariable=self.title_var,
                 bg=C["surface"], fg=C["primary"],
                 font=FONT_BOLD, pady=4, padx=12).pack(anchor="w")

        self.text = tk.Text(
            self, bg=C["surface2"], fg=C["text"],
            font=FONT_MONO, state=tk.DISABLED, relief="flat",
            wrap=tk.WORD, padx=8, pady=6,
            selectbackground=C["surface3"],
        )
        sb = ttk.Scrollbar(self, command=self.text.yview)
        self.text.configure(yscrollcommand=sb.set)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.text.pack(fill=tk.BOTH, expand=True, padx=6, pady=(0, 0))

        # ── Status console ────────────────────────────────────────────────
        tk.Frame(self, bg=C["border"], height=1).pack(fill=tk.X, pady=(4, 0))
        console_hdr = tk.Frame(self, bg=C["surface"])
        console_hdr.pack(fill=tk.X)
        tk.Label(console_hdr, text="STATUS LOG", bg=C["surface"],
                 fg=C["text_muted"], font=("Segoe UI", 7, "bold"),
                 padx=10, pady=3).pack(side=tk.LEFT, anchor="w")
        self._console_status = tk.Label(console_hdr, text="idle",
                 bg=C["surface"], fg=C["text_muted"],
                 font=("Segoe UI", 7), padx=8)
        self._console_status.pack(side=tk.RIGHT, anchor="e")

        self.console = tk.Text(
            self, bg="#0a0a0a", fg=C["primary"],
            font=("Consolas", 8), state=tk.DISABLED, relief="flat",
            wrap=tk.NONE, height=6, padx=6, pady=4,
            selectbackground=C["surface3"],
        )
        csb = ttk.Scrollbar(self, command=self.console.yview)
        self.console.configure(yscrollcommand=csb.set)
        csb.pack(side=tk.RIGHT, fill=tk.Y)
        self.console.pack(fill=tk.X, padx=6, pady=(0, 6))

        self.console.tag_configure("err",  foreground=C["danger"])
        self.console.tag_configure("warn", foreground=C["warn"])
        self.console.tag_configure("dim",  foreground=C["text_dim"])

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


# ── Slim Prompt Panel ─────────────────────────────────────────────────────

class SlimPromptPanel:
    """
    Compact prompt display for white-theme windows.
    Takes two frames: one for the prompt-name label, one for the status console.
    Provides the same public API as PromptPanel (display/start_console/stop_console/clear).
    """

    def __init__(self, name_frame, console_frame, colors=None):
        C = colors or HOME_PANEL
        sf  = C.get("surface",    HOME_PANEL["surface"])
        sf2 = C.get("surface2",   HOME_PANEL["surface2"])
        sf3 = C.get("surface3",   HOME_PANEL["surface3"])
        bd  = C.get("border",     HOME_PANEL["border"])
        pr  = C.get("primary",    HOME_PANEL["primary"])
        tdm = C.get("text_dim",   HOME_PANEL["text_dim"])
        tmu = C.get("text_muted", HOME_PANEL["text_muted"])
        tx  = C.get("text",       HOME_PANEL["text"])

        # ── Prompt name label (in name_frame) ─────────────────────────
        self._title_var = tk.StringVar(value="—")
        tk.Label(name_frame, textvariable=self._title_var,
                 bg=sf, fg=pr,
                 font=FONT_BOLD, pady=5, padx=12,
                 anchor="w").pack(fill=tk.X)

        # ── Status console (in console_frame) ─────────────────────────
        self._console_path  = None
        self._console_pos   = 0
        self._console_after = None
        self._cf = console_frame   # for after() calls

        hdr = tk.Frame(console_frame, bg=sf)
        hdr.pack(fill=tk.X)
        tk.Label(hdr, text="STATUS LOG", bg=sf,
                 fg=tdm, font=("Segoe UI", 8, "bold"),
                 padx=12, pady=6).pack(side=tk.LEFT)
        self._console_status = tk.Label(hdr, text="idle",
                 bg=sf, fg=tmu, font=("Segoe UI", 7), padx=8)
        self._console_status.pack(side=tk.RIGHT)
        tk.Frame(console_frame, bg=bd, height=1).pack(fill=tk.X)

        self.console = tk.Text(
            console_frame, bg=sf2, fg=tx,
            font=("Consolas", 9), state=tk.DISABLED, relief="flat",
            wrap=tk.NONE, padx=6, pady=4,
            selectbackground=sf3,
        )
        csb = ttk.Scrollbar(console_frame, command=self.console.yview)
        self.console.configure(yscrollcommand=csb.set)
        csb.pack(side=tk.RIGHT, fill=tk.Y)
        self.console.pack(fill=tk.BOTH, expand=True)

        err_fg  = C.get("danger", HOME_PANEL["danger"])
        warn_fg = C.get("warn",   HOME_PANEL["warn"])
        self.console.tag_configure("err",  foreground=err_fg)
        self.console.tag_configure("warn", foreground=warn_fg)
        self.console.tag_configure("dim",  foreground=tmu)

    # ── Public API ────────────────────────────────────────────────────────

    def display(self, prompt):
        self._title_var.set(
            prompt.get("title", "(no prompt)") if prompt else "(no prompt)"
        )

    def get_content(self):
        return ""

    def start_console(self, log_path):
        self.stop_console()
        self._console_path = str(log_path)
        self._console_pos  = 0
        self._console_status.config(
            text=f"watching: {os.path.basename(self._console_path)}"
        )
        self._console_poll()

    def stop_console(self):
        if self._console_after:
            try:
                self._cf.after_cancel(self._console_after)
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
        self._console_after = self._cf.after(1000, self._console_poll)

    def _console_append(self, text):
        self.console.config(state=tk.NORMAL)
        for line in text.splitlines(keepends=True):
            lo = line.lower()
            tag = ("err"  if any(w in lo for w in ("error", "fail", "traceback")) else
                   "warn" if any(w in lo for w in ("warn", "retry")) else None)
            self.console.insert(tk.END, line, tag or "")
        self.console.see(tk.END)
        self.console.config(state=tk.DISABLED)

    def clear(self):
        self._title_var.set("—")
        self.console.config(state=tk.NORMAL)
        self.console.delete("1.0", tk.END)
        self.console.config(state=tk.DISABLED)
        self.stop_console()


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

    def _mark_initialized(self, issue_id, result_dir_name, upload_file_name):
        try:
            session.post("/v1/issue/initialized", json={
                "issueId":          issue_id,
                "initialResultDir": result_dir_name,
                "uploadFileName":   upload_file_name,
            }, timeout=10)
            self._log(f"✓ Issue marked as initialized (upload: {upload_file_name})", "green")
        except Exception as e:
            self._log(f"⚠ Could not mark initialized: {e}", "yellow")

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
                with open(zip_path, "rb") as fh:
                    resp = requests.post(
                        f"{server}/upload",
                        files={"file": (zip_path.name, fh, "application/zip")},
                        timeout=300,
                    )
                elapsed = time.time() - t_start
                avg_up  = file_size / elapsed if elapsed > 0 else 0

                if resp.status_code == 200:
                    data = resp.json()
                    uploaded_name = data.get('filename', zip_path.name)
                    self._log(f"✓ Uploaded: {uploaded_name}", "green")
                    self._log(f"  Avg upload speed: {avg_up/1024:.1f} KB/s", "dim")
                    return uploaded_name
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

                if not self._setup_result_dir(work_dir, repo_dir):
                    raise RuntimeError("Could not set up result directory")

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
                result_dir_name  = work_dir.name if work_dir else ""
                upload_file_name = ""
                if work_dir:
                    uploaded = self._upload_result(work_dir)
                    upload_file_name = uploaded if uploaded else ""
                self._mark_initialized(issue_id, result_dir_name, upload_file_name)
                self._status("✓ Initialized — clearing and starting next cycle…")
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

    # ── Set up result directory ──────────────────────────────────────────

    def _setup_result_dir(self, work_dir, repo_dir):
        """
        Create work_dir/result/, move the cloned repo into it, and
        create an empty result.txt inside result/.
        Returns the new repo path (work_dir/result/<repo-name>) or None on error.
        """
        result_dir = work_dir / "result"
        self._status("Setting up result directory…")
        try:
            result_dir.mkdir(parents=True, exist_ok=True)
            shutil.copytree(str(repo_dir), str(result_dir / repo_dir.name))
            self._log(f"✓ Copied {repo_dir.name} → result/", "green")
            (result_dir / "result.txt").touch()
            self._log("✓ Created result/result.txt", "green")
            return True
        except Exception as e:
            self._log(f"✗ Failed to set up result dir: {e}", "red")
            return False

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

        hfi_cmd = find_hfi_cmd()
        if not hfi_cmd:
            self._log("✗ claude-hfi not found in PATH", "red")
            self._log(f"  Searched: {os.environ.get('PATH', '')}", "dim")
            self._log("  Install claude-hfi and ensure its directory is in PATH.", "yellow")
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
    def __init__(self, root, on_back=None, on_signout=None):
        self.root       = root
        self._on_back    = on_back
        self._on_signout = on_signout
        apply_light(root)
        root.title("TalentCodeHub — PR Preparation")
        root.resizable(True, True)
        w, h = 1100, 740
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")
        root.minsize(860, 560)
        set_window_icon(root)

        self._proc    = None
        self._running = False
        self._stop_ev = threading.Event()
        self._issue   = None
        self._prompt  = None

        self._build()

    def _build(self):
        H = HOME
        # ── Title bar ────────────────────────────────────────────────────
        bar = tk.Frame(self.root, bg=H["sidebar"])
        bar.pack(fill=tk.X)

        tk.Button(
            bar, text="⊞",
            bg=H["sidebar"], fg=H["text_dim"],
            font=("Segoe UI", 14), relief=tk.FLAT, bd=0,
            padx=12, pady=8, cursor="hand2",
            activebackground=H["primary_lt"], activeforeground=H["primary"],
            command=self._go_home,
        ).pack(side=tk.LEFT)

        tk.Label(bar, text="PR Preparation",
                 bg=H["sidebar"], fg=H["primary"],
                 font=("Segoe UI", 12, "bold"),
                 pady=10, padx=8).pack(side=tk.LEFT)

        right = tk.Frame(bar, bg=H["sidebar"])
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

        tk.Frame(self.root, bg=H["border"], height=1).pack(fill=tk.X)

        # ── Status bar ───────────────────────────────────────────────────
        self.status_var = tk.StringVar(value="Ready — press START to begin.")
        status = tk.Frame(self.root, bg=H["sidebar"])
        status.pack(fill=tk.X, side=tk.BOTTOM)
        tk.Frame(status, bg=H["border"], height=1).pack(fill=tk.X)
        tk.Label(status, textvariable=self.status_var,
                 bg=H["sidebar"], fg=H["text_dim"],
                 font=FONT_SMALL, anchor="w", padx=12, pady=5).pack(fill=tk.X)

        # ── Body ─────────────────────────────────────────────────────────
        body = tk.Frame(self.root, bg=H["bg"])
        body.pack(fill=tk.BOTH, expand=True)

        # ── Left column: timer + issue + prompt name + status log ───────
        left = tk.Frame(body, bg=H["bg"], width=320)
        left.pack(side=tk.LEFT, fill=tk.BOTH, padx=(10, 5), pady=10)
        left.pack_propagate(False)

        # Timer card
        timer_card = tk.Frame(left, bg=H["card"],
                              highlightbackground=H["border"], highlightthickness=1)
        timer_card.pack(fill=tk.X, pady=(0, 8))
        tk.Label(timer_card, text="CYCLE TIMER", bg=H["card"],
                 fg=H["text_dim"], font=("Segoe UI", 8, "bold"),
                 padx=12, pady=6).pack(anchor="w")
        tk.Frame(timer_card, bg=H["border"], height=1).pack(fill=tk.X)
        timer_inner = tk.Frame(timer_card, bg=H["card"])
        timer_inner.pack(fill=tk.X, pady=10, padx=6)
        self.timer_widget = CircularTimer(timer_inner, colors=HOME_WIDGET)
        self.timer_widget.pack(side=tk.LEFT)
        self.net_graph = NetworkGraph(timer_inner, colors=HOME_WIDGET)
        self.net_graph.pack(side=tk.LEFT, padx=(6, 0))
        self.root.after(600, self.net_graph.start)

        # Issue + prompt name card
        issue_card = tk.Frame(left, bg=H["card"],
                              highlightbackground=H["border"], highlightthickness=1)
        issue_card.pack(fill=tk.X, pady=(0, 8))
        self.issue_panel = IssuePanel(issue_card, colors=HOME_PANEL)
        self.issue_panel.pack(fill=tk.X)
        # Prompt name inside same card, below issue fields
        tk.Frame(issue_card, bg=H["border"], height=1).pack(fill=tk.X)
        tk.Label(issue_card, text="PROMPT", bg=H["card"],
                 fg=H["text_dim"], font=("Segoe UI", 8, "bold"),
                 padx=12, pady=4).pack(anchor="w")
        prompt_name_frame = tk.Frame(issue_card, bg=H["card"])
        prompt_name_frame.pack(fill=tk.X)

        # Status log card — fills remaining space
        log_card = tk.Frame(left, bg=H["card"],
                            highlightbackground=H["border"], highlightthickness=1)
        log_card.pack(fill=tk.BOTH, expand=True)

        # SlimPromptPanel wires prompt name + status log together
        self.prompt_panel = SlimPromptPanel(
            name_frame=prompt_name_frame,
            console_frame=log_card,
            colors=HOME_PANEL,
        )

        # ── Right area: terminal fills all remaining space ────────────────
        right_area = tk.Frame(body, bg=H["bg"])
        right_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True,
                        padx=(5, 10), pady=10)

        term_outer = tk.Frame(right_area, bg=H["card"],
                              highlightbackground=H["border"], highlightthickness=1)
        term_outer.pack(fill=tk.BOTH, expand=True)
        self.term = TerminalPanel(term_outer, colors=HOME_WIDGET)
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
        win.configure(bg=HOME["bg"])
        set_window_icon(win)
        w, h = 420, 200
        sw, sh = win.winfo_screenwidth(), win.winfo_screenheight()
        win.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")
        win.grab_set()

        body = tk.Frame(win, bg=HOME["bg"], padx=24, pady=20)
        body.pack(fill=tk.BOTH, expand=True)

        tk.Label(body, text="Upload Server URL", bg=HOME["bg"],
                 fg=HOME["text_dim"], font=FONT_SMALL).pack(anchor="w", pady=(0, 4))

        url_var = tk.StringVar(value=get_upload_server())
        entry = ttk.Entry(body, textvariable=url_var)
        entry.pack(fill=tk.X, pady=(0, 8))
        entry.focus()

        err_var = tk.StringVar()
        tk.Label(body, textvariable=err_var, bg=HOME["bg"],
                 fg=HOME_PANEL["danger"], font=FONT_SMALL).pack(anchor="w", pady=(0, 8))

        def _save():
            url = url_var.get().strip()
            if not url.startswith("http"):
                err_var.set("URL must start with http:// or https://")
                return
            save_settings({"upload_server": url})
            win.destroy()

        btn_row = tk.Frame(body, bg=HOME["bg"])
        btn_row.pack(fill=tk.X)
        ttk.Button(btn_row, text="Save", style="Primary.TButton", command=_save).pack(side=tk.RIGHT)
        ttk.Button(btn_row, text="Cancel", style="Ghost.TButton",
                   command=win.destroy).pack(side=tk.RIGHT, padx=(0, 6))

    def _go_home(self):
        """Return to the HomeMenu without signing out."""
        if self._running:
            if not messagebox.askyesno("Back to menu", "Workflow is running. Stop and go to menu?"):
                return
            self._stop_ev.set()
        if self._on_back:
            self.root.destroy()
            self._on_back()

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
        if self._on_signout:
            self._on_signout()
        else:
            _bootstrap()


# ── Interaction Workflow Engine ───────────────────────────────────────────

class InteractionWorkflowEngine:
    """
    Background workflow for the PR Interaction app.
    Fetches the oldest 'initialized' issue, downloads its prepared zip,
    runs claude-hfi --vscode interactions, and marks as 'interacted'.
    """
    RETRY_DELAY        = 30
    HEARTBEAT_INTERVAL = 60
    TMUX_SESSION       = "talentcodehub-interaction"

    def __init__(self, root, term, issue_panel,
                 on_status, on_done, on_stop_flag, on_timer):
        self.root              = root
        self.term              = term
        self.issue_panel       = issue_panel
        self.on_status         = on_status
        self.on_done           = on_done
        self.stop_flag         = on_stop_flag
        self.on_timer          = on_timer
        self._cycle_start      = None
        self._on_issue_loaded  = None
        self._on_info_update   = None   # callback(dict) for live UI info panel
        self._heartbeat_stop   = threading.Event()
        self._heartbeat_thread = None
        self._current_issue_id = None

    def _log(self, msg, tag=None):
        self.root.after(0, lambda m=msg, t=tag: self.term.write(m, t))

    def _status(self, msg):
        self.root.after(0, lambda m=msg: self.on_status(m))

    def _info(self, **kwargs):
        """Push live info to the UI panel (safe to call from background thread)."""
        if self._on_info_update:
            self.root.after(0, lambda kw=kwargs: self._on_info_update(kw))

    def _tick_timer(self):
        if self._cycle_start is None:
            return
        elapsed = int((time.time() - self._cycle_start) * 1000)
        self.root.after(0, lambda: self.on_timer(elapsed))

    # ── Heartbeat ────────────────────────────────────────────────────────────

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
                session.post("/v1/issue/progress-interaction",
                             json={"issueId": issue_id}, timeout=10)
                self._log("  ♥ heartbeat sent", "dim")
            except Exception:
                pass

    # ── Issue status API calls ────────────────────────────────────────────────

    def _mark_interacted(self, issue_id, anthropic_uuid, dockerfile_content, first_prompt):
        try:
            session.post("/v1/issue/interacted", json={
                "issueId":           issue_id,
                "taskUuid":          anthropic_uuid or "unknown",
                "dockerfileContent": dockerfile_content,
                "firstPrompt":       first_prompt,
            }, timeout=10)
            self._log("✓ Issue marked as interacted", "green")
        except Exception as e:
            self._log(f"⚠ Could not mark interacted: {e}", "yellow")

    def _mark_initialized_back(self, issue_id):
        """Reset to 'initialized' on error so it can be retried."""
        try:
            session.post("/v1/issue/reset-to-initialized",
                         json={"issueId": issue_id}, timeout=10)
            self._log("  Issue reset to initialized for retry", "yellow")
        except Exception as e:
            self._log(f"⚠ Could not reset issue: {e}", "yellow")

    # ── Download ─────────────────────────────────────────────────────────────

    def _download_file(self, filename):
        """Download filename from file server to ~/Downloads. Returns Path or None."""
        server = get_upload_server()
        downloads_dir = Path.home() / "Downloads"

        self._log(f"→ Checking file server at {server}…", "blue")
        try:
            r = requests.get(f"{server}/status", timeout=5)
            if r.status_code != 200:
                self._log(f"✗ File server HTTP {r.status_code}", "red")
                return None
        except Exception as e:
            self._log(f"✗ File server not reachable: {e}", "red")
            return None

        self._log(f"→ Downloading {filename}…", "blue")
        try:
            r = requests.get(f"{server}/download/{filename}", stream=True, timeout=60)
        except Exception as e:
            self._log(f"✗ Download request failed: {e}", "red")
            return None

        if r.status_code in (400, 404):
            try:
                err = r.json().get("error", f"HTTP {r.status_code}")
            except Exception:
                err = f"HTTP {r.status_code}"
            self._log(f"✗ Download failed: {err}", "red")
            return None
        if r.status_code != 200:
            self._log(f"✗ Download failed: HTTP {r.status_code}", "red")
            return None

        downloads_dir.mkdir(parents=True, exist_ok=True)
        dest = downloads_dir / filename
        if dest.exists():
            base, ext = os.path.splitext(filename)
            counter = 1
            while dest.exists():
                dest = downloads_dir / f"{base}_{counter}{ext}"
                counter += 1

        try:
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        except Exception as e:
            self._log(f"✗ Failed to save file: {e}", "red")
            return None

        self._log(f"✓ Downloaded → {dest}", "green")
        return dest

    # ── Unzip ────────────────────────────────────────────────────────────────

    @staticmethod
    def _force_remove_tree(path):
        """Remove a directory tree, chmod-ing read-only files before deleting."""
        import stat as _stat

        def _on_error(func, fpath, exc_info):
            # Make the file/dir writable, then retry
            try:
                os.chmod(fpath, _stat.S_IWRITE | _stat.S_IREAD)
                func(fpath)
            except Exception:
                pass

        shutil.rmtree(str(path), onerror=_on_error)

    def _unzip_file(self, zip_path):
        """Unzip into ~/Downloads. Returns result_dir Path or None."""
        import zipfile
        downloads_dir = Path.home() / "Downloads"
        self._log(f"→ Unzipping {zip_path.name}…", "blue")
        try:
            # Find the top-level directory name(s) inside the zip
            with zipfile.ZipFile(zip_path, 'r') as zf:
                # Collect unique top-level names
                top_level = {name.split('/')[0] for name in zf.namelist()
                             if name.split('/')[0]}
                # Delete any pre-existing target directories so read-only
                # git objects from a previous extraction don't block us
                for name in top_level:
                    existing = downloads_dir / name
                    if existing.is_dir():
                        self._log(f"  Removing existing {existing.name}/ before extract…", "dim")
                        self._force_remove_tree(existing)
                zf.extractall(downloads_dir)

            # Determine result_dir: prefer the single top-level dir from the zip
            if len(top_level) == 1:
                result_dir = downloads_dir / next(iter(top_level))
            else:
                # Multiple top-levels: pick the most recently modified subdir
                subdirs = [d for d in downloads_dir.iterdir() if d.is_dir()]
                if not subdirs:
                    self._log("✗ No directory found after unzip", "red")
                    return None
                result_dir = max(subdirs, key=lambda d: d.stat().st_mtime)

            if not result_dir.is_dir():
                self._log(f"✗ Expected directory not found: {result_dir}", "red")
                return None

            self._log(f"✓ Extracted → {result_dir}", "green")
            return result_dir
        except Exception as e:
            self._log(f"✗ Unzip failed: {e}", "red")
            return None

    # ── initial_info.json ─────────────────────────────────────────────────────

    def _write_initial_info(self, result_dir, issue, anthropic_uuid=""):
        path = result_dir / "initial_info.json"
        data = {}
        if path.exists():
            try:
                with open(path) as f:
                    data = json.load(f)
            except Exception:
                pass
        data.update({
            "repoName":     issue.get("repoName", ""),
            "issueLink":    issue.get("issueLink", ""),
            "commitHead":   issue.get("baseSha", ""),
            "anthropicUUID": anthropic_uuid,
        })
        try:
            with open(path, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            self._log(f"⚠ Could not write initial_info.json: {e}", "yellow")
        return data

    # ── tmux helpers ──────────────────────────────────────────────────────────

    def _tmux_running(self):
        return shutil.which("tmux") is not None

    def _open_terminal(self, session_name):
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
        self._log("⚠ No supported terminal emulator found", "yellow")

    def _tmux_send(self, session_name, text, label):
        self._log(f"  ◀ {label}", "prompt")
        use_paste = (len(text) > 80 or '\n' in text or
                     any(c in text for c in '!"$\'\\`{}[]|&;<>()'))
        if use_paste:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt',
                                            delete=False, encoding='utf-8') as tmp:
                tmp.write(text)
                tmp_path = tmp.name
            subprocess.run(["tmux", "load-buffer", tmp_path], stderr=subprocess.DEVNULL)
            subprocess.run(["tmux", "paste-buffer", "-t", session_name],
                           stderr=subprocess.DEVNULL)
            os.unlink(tmp_path)
            time.sleep(0.5)
            subprocess.run(["tmux", "send-keys", "-t", session_name, "", "Enter"],
                           stderr=subprocess.DEVNULL)
        else:
            subprocess.run(["tmux", "send-keys", "-t", session_name, text, "Enter"],
                           stderr=subprocess.DEVNULL)
        time.sleep(2)

    def _tmux_send_choice(self, session_name, code):
        """
        Arrow-key navigation for Q5–Q13 multiple-choice answers.
        A1–A4 → Left ×N | B1–B4 → Right ×N | N/A → Right ×5 | then Enter.
        """
        code = (code or "").strip()
        if code.startswith("A") and code[1:].isdigit():
            key, count = "Left",  5 - int(code[1:])   # A1→4, A2→3, A3→2, A4→1
        elif code.startswith("B") and code[1:].isdigit():
            key, count = "Right", 5 - int(code[1:])   # B1→4, B2→3, B3→2, B4→1
        elif code == "N/A":
            key, count = "Right", 5
        else:
            self._tmux_send(session_name, code, code)
            return
        self._log(f"  ◀ {code} ({key} ×{count})", "prompt")
        for _ in range(count):
            subprocess.run(["tmux", "send-keys", "-t", session_name, key],
                           stderr=subprocess.DEVNULL)
            time.sleep(0.12)
        time.sleep(0.3)
        subprocess.run(["tmux", "send-keys", "-t", session_name, "", "Enter"],
                       stderr=subprocess.DEVNULL)
        time.sleep(2)

    @staticmethod
    def _strip_ansi(text):
        """Remove ANSI/VT100 escape sequences so regexes work on plain text."""
        return re.sub(r'\x1b(?:[@-Z\\-_]|\[[0-9;]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\))', '', text)

    def _tmux_capture(self, session_name, scrollback=False):
        """
        Capture pane content. Pass scrollback=True to include all scrollback
        history (needed when the screen was cleared after the UUID was printed).
        """
        cmd = ["tmux", "capture-pane", "-p", "-t", session_name]
        if scrollback:
            cmd += ["-S", "-"]          # capture from the very beginning
        result = subprocess.run(cmd, capture_output=True, text=True)
        raw = result.stdout if result.returncode == 0 else ""
        return self._strip_ansi(raw)

    def _tmux_wait_for(self, session_name, pattern, timeout=300, status_msg=None):
        if status_msg:
            self._status(status_msg)
        compiled   = re.compile(pattern, re.IGNORECASE)
        deadline   = time.time() + timeout
        seen_lines = set()
        while time.time() < deadline:
            if self.stop_flag.is_set():
                raise InterruptedError("Stop requested")
            # Always include scrollback so we never miss text scrolled off-screen
            pane = self._tmux_capture(session_name, scrollback=True)
            for line in pane.splitlines():
                s = line.strip()
                if s and s not in seen_lines:
                    seen_lines.add(s)
                    self._log(s, "dim")
            if compiled.search(pane):
                return pane
            time.sleep(1)
        raise TimeoutError(f"Timeout ({timeout}s) waiting for: {pattern!r}")

    def _tmux_line_count(self, session_name):
        """Return the current number of lines in the full scrollback."""
        pane = self._tmux_capture(session_name, scrollback=True)
        return len(pane.splitlines())

    def _tmux_wait_for_after(self, session_name, pattern, baseline_lines,
                             timeout=600, status_msg=None, on_new_text=None):
        """
        Like _tmux_wait_for, but only matches pattern in lines that appeared
        AFTER baseline_lines (the scrollback line count captured before the
        trigger action was sent). This prevents false-positive matches from
        earlier content already in the scrollback history.

        on_new_text: optional callable(new_text) called on each poll with the
        accumulated new text — use it for side-effect extraction (e.g. UUID).
        """
        if status_msg:
            self._status(status_msg)
        compiled   = re.compile(pattern, re.IGNORECASE)
        deadline   = time.time() + timeout
        seen_lines = set()
        while time.time() < deadline:
            if self.stop_flag.is_set():
                raise InterruptedError("Stop requested")
            pane      = self._tmux_capture(session_name, scrollback=True)
            all_lines = pane.splitlines()
            new_lines = all_lines[baseline_lines:]
            for line in new_lines:
                stripped = line.strip()
                if stripped and stripped not in seen_lines:
                    seen_lines.add(stripped)
                    self._log(stripped, "dim")
            new_text = "\n".join(new_lines)
            if on_new_text:
                on_new_text(new_text)
            if compiled.search(new_text):
                return new_text
            time.sleep(1)
        raise TimeoutError(f"Timeout ({timeout}s) waiting for: {pattern!r}")

    # Regex that matches UUID from either output format:
    #  "Check tmux session "UUID-A" and session "UUID-B" for possible..."
    #  "Terminal: tmux attach -t UUID-B"
    _UUID_RE = re.compile(
        r'(?:session\s+["\']?|attach\s+-t\s+)'
        r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
        r'(?:-[AB])?',
        re.IGNORECASE,
    )

    def _extract_uuid_from_text(self, text):
        """Return UUID string if found in text, else empty string."""
        m = self._UUID_RE.search(text)
        return m.group(1) if m else ""

    def _extract_anthropic_uuid(self, session_name):
        """
        Capture both visible pane and full scrollback, extract UUID.
        Retries up to 15 times with 1s gaps.
        """
        for _ in range(15):
            for use_scrollback in (False, True):
                pane = self._tmux_capture(session_name, scrollback=use_scrollback)
                uuid = self._extract_uuid_from_text(pane)
                if uuid:
                    self._log(f"✓ anthropicUUID extracted: {uuid}", "green")
                    return uuid
            time.sleep(1)
        self._log("⚠ Could not extract anthropicUUID from tmux output", "yellow")
        return ""

    # ── Open Chrome ───────────────────────────────────────────────────────────

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
            self._log("⚠ Chrome not found — skipping", "yellow")
        except Exception as e:
            self._log(f"⚠ Browser open failed: {e}", "yellow")

    # ── Upload ────────────────────────────────────────────────────────────────

    def _upload_zip(self, zip_path):
        """Upload zip_path to file server. Returns uploaded filename or None."""
        server    = get_upload_server()
        MAX_TRIES = 3
        for attempt in range(1, MAX_TRIES + 1):
            self._status(f"Uploading interaction zip (attempt {attempt}/{MAX_TRIES})…")
            self._log(f"→ POST {server}/upload  (attempt {attempt})", "blue")
            try:
                file_size = zip_path.stat().st_size
                t_start   = time.time()
                with open(zip_path, "rb") as fh:
                    resp = requests.post(
                        f"{server}/upload",
                        files={"file": (zip_path.name, fh, "application/zip")},
                        timeout=300,
                    )
                elapsed = time.time() - t_start
                avg_up  = file_size / elapsed if elapsed > 0 else 0
                if resp.status_code == 200:
                    uploaded_name = resp.json().get("filename", zip_path.name)
                    self._log(f"✓ Uploaded: {uploaded_name}  ({avg_up/1024:.1f} KB/s)", "green")
                    return uploaded_name
                else:
                    self._log(f"✗ Upload failed: {resp.text[:120]}", "red")
            except Exception as e:
                self._log(f"✗ Upload error: {e}", "red")
            if attempt < MAX_TRIES:
                self._log("  Retrying in 60s…", "yellow")
                for _ in range(60):
                    if self.stop_flag.is_set():
                        return None
                    time.sleep(1)
        self._log("✗ Upload failed after all attempts", "red")
        return None

    # ── HFI interaction workflow ───────────────────────────────────────────────

    def _run_interaction_hfi(self, first_folder, result_dir, issue):
        """
        Start claude-hfi --vscode in a tmux session, complete all interactions
        from result.json, and return the anthropicUUID string.
        """
        hfi_cmd = find_hfi_cmd()
        if not hfi_cmd:
            raise RuntimeError(
                f"claude-hfi not found in PATH.\nSearched: {os.environ.get('PATH', '')}"
            )
        if not self._tmux_running():
            raise RuntimeError("tmux not found — sudo apt install tmux")

        s = self.TMUX_SESSION
        subprocess.run(["tmux", "kill-session", "-t", s], stderr=subprocess.DEVNULL)
        time.sleep(0.5)

        self._log(f"→ Starting tmux session in {first_folder.name}…", "blue")
        try:
            subprocess.run(
                ["tmux", "new-session", "-d", "-s", s,
                 "-c", str(first_folder), hfi_cmd, "--vscode"],
                check=True,
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to start tmux session: {e}")

        self._open_terminal(s)
        anthropic_uuid = ""

        try:
            # ── Step 1: wait for interface code, capture UUID ─────────────
            self._tmux_wait_for(s, r"interface\s*code",
                                timeout=300,
                                status_msg="Waiting for interface code prompt…")
            anthropic_uuid = self._extract_anthropic_uuid(s)
            if anthropic_uuid:
                self._write_initial_info(result_dir, issue, anthropic_uuid)
                self._log("✓ Saved anthropicUUID to initial_info.json", "green")
                self._info(anthropic_uuid=anthropic_uuid)
            else:
                self._log("⚠ anthropicUUID not yet visible — will retry later", "yellow")

            time.sleep(1)
            self._tmux_send(s, "cc_agentic_coding", "cc_agentic_coding")
            self._log("✓ Sent interface code", "green")

            # ── Open Chrome now that we've sent the interface code ────────
            self._open_chrome()

            # ── Step 2: GitHub repo ───────────────────────────────────────
            self._tmux_wait_for(s, r"github repository used",
                                timeout=60,
                                status_msg="Waiting for GitHub repo question…")
            repo_url = f"https://github.com/{issue.get('repoName', '')}"
            time.sleep(1)
            self._tmux_send(s, repo_url, f"repo: {repo_url}")

            # ── Step 3: issue/PR URL ──────────────────────────────────────
            self._tmux_wait_for(s, r"existing GitHub issue or PR",
                                timeout=30,
                                status_msg="Waiting for issue/PR URL question…")
            time.sleep(1)
            self._tmux_send(s, issue.get("issueLink", ""), "issueLink")

            # ── Step 4: HEAD commit ───────────────────────────────────────
            self._tmux_wait_for(s, r"HEAD commit at the time",
                                timeout=30,
                                status_msg="Waiting for HEAD commit question…")
            time.sleep(1)
            self._tmux_send(s, issue.get("baseSha", ""), "commitHead")

            # ── Step 5: ▶ Continue ────────────────────────────────────────
            self._tmux_wait_for(s, r"Continue",
                                timeout=30,
                                status_msg="Waiting for Continue prompt…")
            time.sleep(3)
            subprocess.run(["tmux", "send-keys", "-t", s, "", "Enter"],
                           stderr=subprocess.DEVNULL)
            self._log("✓ Pressed Continue", "green")

            # ── Step 6: wait for Debug mode ───────────────────────────────
            self._tmux_wait_for(s, r"Debug\s*mode\s*enabled",
                                timeout=120,
                                status_msg="Waiting for debug mode enabled…")
            self._log("✓ Debug mode enabled — starting interactions", "green")

            # ── Step 7: load result.json ──────────────────────────────────
            # Located at: root_dir/result/result.json  (i.e. result_dir/result.json)
            result_json_path = result_dir / "result.json"
            if not result_json_path.exists():
                raise RuntimeError(f"result.json not found at {result_json_path}")

            with open(result_json_path) as f:
                interactions = json.load(f)
            self._log(f"✓ Loaded {len(interactions)} interaction(s) from result.json", "green")

            # ── Step 8: run all interactions ──────────────────────────────
            self._do_interactions(s, interactions, result_dir, issue)

            # ── Late UUID capture if missed earlier ───────────────────────
            if not anthropic_uuid:
                anthropic_uuid = self._extract_anthropic_uuid(s)
                if anthropic_uuid:
                    self._write_initial_info(result_dir, issue, anthropic_uuid)
                    self._log(f"✓ anthropicUUID captured late: {anthropic_uuid}", "green")
                    self._info(anthropic_uuid=anthropic_uuid)

            return anthropic_uuid

        except InterruptedError:
            raise
        except (TimeoutError, RuntimeError):
            raise
        except Exception as e:
            raise RuntimeError(str(e))
        finally:
            # ── Step 9: close tmux session and VS Code ────────────────────
            subprocess.run(["tmux", "kill-session", "-t", s], stderr=subprocess.DEVNULL)
            for sig_cmd in [["pkill", "-x", "code"], ["pkill", "-x", "Code"],
                            ["pkill", "-f", "electron.*vscode"],
                            ["pkill", "-f", "/usr/share/code/code"]]:
                subprocess.run(sig_cmd, stderr=subprocess.DEVNULL)
            time.sleep(2)

    def _do_interactions(self, tmux_session, interactions, result_dir, issue):
        """Send all prompt + Q&A inputs for every interaction in result.json."""
        s = tmux_session
        _current_uuid = [""]   # mutable cell shared with the callback closure

        def _try_uuid_from_text(new_text):
            """Called on every poll during the evaluation wait — grab UUID if seen."""
            uuid = self._extract_uuid_from_text(new_text)
            if uuid and uuid != _current_uuid[0]:
                _current_uuid[0] = uuid
                self._write_initial_info(result_dir, issue, uuid)
                self._info(anthropic_uuid=uuid)
                self._log(f"✓ anthropicUUID: {uuid}", "green")

        for idx, item in enumerate(interactions, 1):
            if self.stop_flag.is_set():
                raise InterruptedError("Stop requested")
            self._log(f"─── Interaction {idx}/{len(interactions)} ───", "green")
            self._status(f"Interaction {idx}/{len(interactions)}…")
            self._info(interaction=f"{idx} / {len(interactions)}")

            # Snapshot scrollback length just before sending the prompt so we
            # only watch for NEW output — not earlier interactions in history.
            baseline = self._tmux_line_count(s)

            # Prompt — send it, then wait for evaluation output before Q&A.
            # UUID is extracted as a side-effect of each poll.
            self._tmux_send(s, item.get("prompt", ""),
                            f"<prompt ({len(item.get('prompt',''))} chars)>")
            self._log("  Waiting for evaluation output (HFI Feedback / Model A Pros)…", "dim")
            self._tmux_wait_for_after(
                s,
                r"HFI\s+Feedback|Model\s+A\s+Pros|▶\s*Model\s+A",
                baseline_lines=baseline,
                timeout=600,
                status_msg=f"Waiting for evaluation output ({idx}/{len(interactions)})…",
                on_new_text=_try_uuid_from_text,
            )
            self._log("✓ Evaluation output received — starting Q&A", "green")

            # Q1–Q4: plain text
            for q in ("Q1", "Q2", "Q3", "Q4"):
                val = item.get(q)
                if val:
                    time.sleep(2)
                    self._tmux_send(s, val, q)

            # Q5–Q13: arrow-key navigation
            for q in ("Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q11", "Q12", "Q13"):
                val = item.get(q)
                if val:
                    time.sleep(2)
                    self._tmux_send_choice(s, val)

            # Wait for ▶ Submit Feedback, hit Enter
            self._tmux_wait_for(s, r"Submit\s*Feedback",
                                timeout=120,
                                status_msg=f"Waiting for Submit Feedback ({idx}/{len(interactions)})…")
            time.sleep(1)
            subprocess.run(["tmux", "send-keys", "-t", s, "", "Enter"],
                           stderr=subprocess.DEVNULL)
            self._log(f"✓ Submitted interaction {idx}", "green")

            if idx < len(interactions):
                # Wait for "What would you like to do next?" and hit Enter
                self._tmux_wait_for(s, r"What would you like to do next",
                                    timeout=120,
                                    status_msg=f"Waiting for next prompt ({idx})…")
                time.sleep(1)
                subprocess.run(["tmux", "send-keys", "-t", s, "", "Enter"],
                               stderr=subprocess.DEVNULL)
                # Wait up to 60s for next interaction response
                self._status(f"Waiting for interaction {idx + 1} response…")
                try:
                    self._tmux_wait_for(s, r"Debug\s*mode|Q1|interface\s*code",
                                        timeout=60,
                                        status_msg=f"Loading interaction {idx + 1}…")
                except TimeoutError:
                    self._log("⚠ Response taking long — continuing anyway", "yellow")

        self._log(f"✓ All {len(interactions)} interaction(s) complete", "green")

    # ── Finalize ──────────────────────────────────────────────────────────────

    def _finalize(self, result_dir, first_folder, issue_id, anthropic_uuid):
        """
        Steps 10–14: copy Dockerfile, create first_prompt.txt, tar project dir,
        zip result_dir as interaction zip, upload, mark issue as interacted.
        """
        # result.json is always at result_dir/result.json
        result_json_path = result_dir / "result.json"

        first_prompt = ""
        try:
            with open(result_json_path) as f:
                interactions_data = json.load(f)
            first_prompt = interactions_data[0].get("prompt", "") if interactions_data else ""
        except Exception as e:
            self._log(f"⚠ Could not read result.json for first_prompt: {e}", "yellow")

        # Step 10: Copy Dockerfile from first_folder → result_dir
        dockerfile_content = ""
        dockerfile_src = first_folder / "Dockerfile"
        dockerfile_dst = result_dir  / "Dockerfile"
        if dockerfile_src.exists():
            try:
                shutil.copy2(dockerfile_src, dockerfile_dst)
                dockerfile_content = dockerfile_dst.read_text(encoding="utf-8",
                                                               errors="replace")
                self._log(f"✓ Copied Dockerfile → {result_dir.name}/", "green")
            except Exception as e:
                self._log(f"⚠ Dockerfile copy failed: {e}", "yellow")
        else:
            self._log("⚠ Dockerfile not found in project directory", "yellow")

        # Step 11: Create first_prompt.txt in result_dir
        if first_prompt:
            try:
                (result_dir / "first_prompt.txt").write_text(
                    first_prompt, encoding="utf-8")
                self._log("✓ Created first_prompt.txt", "green")
            except Exception as e:
                self._log(f"⚠ Could not create first_prompt.txt: {e}", "yellow")

        # Step 12: Tar project directory inside result_dir
        tar_base = result_dir / first_folder.name
        self._log(f"→ Archiving {first_folder.name}/ as .tar…", "blue")
        try:
            shutil.make_archive(str(tar_base), "tar", str(result_dir), first_folder.name)
            self._log(f"✓ Created {first_folder.name}.tar", "green")
        except Exception as e:
            self._log(f"⚠ Tar failed: {e}", "yellow")

        # Step 13: Zip the root dir (parent of result_dir) as
        # {datetime_prefix}-interaction.zip and upload.
        # Directory layout:  ~/Downloads/2026-03-30-13-09/result/MagicMirror/
        #   root_dir  = ~/Downloads/2026-03-30-13-09/   ← result_dir.parent
        #   zip name  = 2026-03-30-13-09-interaction.zip
        downloads_dir        = Path.home() / "Downloads"
        root_dir             = result_dir.parent          # e.g. 2026-03-30-13-09/
        interaction_zip_stem = root_dir.name + "-interaction"
        interaction_zip_path = downloads_dir / (interaction_zip_stem + ".zip")
        self._log(f"→ Zipping {root_dir.name}/ as {interaction_zip_path.name}…", "blue")
        try:
            shutil.make_archive(
                str(downloads_dir / interaction_zip_stem), "zip",
                str(downloads_dir), root_dir.name,
            )
            size_mb = interaction_zip_path.stat().st_size / 1_048_576
            self._log(f"✓ Created {interaction_zip_path.name} ({size_mb:.1f} MB)", "green")
            self._upload_zip(interaction_zip_path)
        except Exception as e:
            self._log(f"✗ Interaction zip/upload failed: {e}", "red")

        # Step 14: Mark issue as interacted
        self._mark_interacted(issue_id, anthropic_uuid, dockerfile_content, first_prompt)

    def run(self):
        while not self.stop_flag.is_set():
            issue = self._fetch_issue_with_retry()
            if issue is None:
                break

            issue_id        = issue.get("id") or issue.get("_id")
            upload_filename = issue.get("uploadFileName", "")
            self._cycle_start = time.time()
            self.root.after(0, lambda: self.on_timer(0))
            self.root.after(0, lambda i=issue: self.issue_panel.display(i))
            if self._on_issue_loaded:
                self.root.after(0, lambda i=issue: self._on_issue_loaded(i))

            self._start_heartbeat(issue_id)
            timer_running = [True]

            def _timer_tick():
                if timer_running[0]:
                    self._tick_timer()
                    self.root.after(200, _timer_tick)
            self.root.after(200, _timer_tick)

            success = False
            try:
                self._log(f"✓ Issue: {issue.get('issueTitle')}", "green")
                self._log(f"  Upload file : {upload_filename or '—'}", "dim")
                self._log(f"  Result dir  : {issue.get('initialResultDir', '—')}", "dim")

                if not upload_filename:
                    raise RuntimeError("Issue has no uploadFileName — cannot download zip")

                # ── Download prepared zip ─────────────────────────────────
                self._status("Downloading zip from file server…")
                zip_path = self._download_file(upload_filename)
                if not zip_path:
                    raise RuntimeError("Download failed")

                # ── Unzip ─────────────────────────────────────────────────
                self._status("Extracting zip…")
                result_dir = self._unzip_file(zip_path)
                if not result_dir:
                    raise RuntimeError("Unzip failed")

                # ── Navigate: root → result/ → project dir ───────────────
                # root dir   = ~/Downloads/2026-03-31-12-20/   (_unzip_file returns this)
                # result dir = root/result/                     (fixed name "result")
                # project dir = first non-hidden subdir of result/
                inner_result_dir = result_dir / "result"
                if not inner_result_dir.is_dir():
                    raise RuntimeError(f"'result' directory not found inside {result_dir}")
                self._log(f"✓ Result dir: {inner_result_dir.name}", "green")

                project_subdirs = sorted(
                    [d for d in inner_result_dir.iterdir()
                     if d.is_dir() and not d.name.startswith('.')],
                    key=lambda d: d.name,
                )
                if not project_subdirs:
                    raise RuntimeError(f"No project directory inside {inner_result_dir}")
                first_folder = project_subdirs[0]
                self._log(f"✓ Project dir: {first_folder.name}", "green")
                self._info(project_dir=first_folder.name)

                # ── Write initial_info.json into result_dir ───────────────
                self._write_initial_info(inner_result_dir, issue)
                self._log("✓ Wrote initial_info.json", "green")

                # ── Run HFI + all interactions (Chrome opens after cc_agentic_coding) ──
                self._status("Running claude-hfi interactions…")
                anthropic_uuid = self._run_interaction_hfi(first_folder, inner_result_dir, issue)
                self._log("✓ HFI interactions complete", "green")

                # ── Finalize (copy files, zip, upload, mark interacted) ───
                self._status("Finalizing…")
                self._finalize(inner_result_dir, first_folder, issue_id, anthropic_uuid)
                success = True

            except InterruptedError:
                self._log("⚠ Stopped by user", "yellow")
            except RuntimeError as e:
                self._log(f"✗ Workflow error: {e}", "red")
            except Exception as e:
                self._log(f"✗ Unexpected error: {e}", "red")
            finally:
                timer_running[0] = False
                self._stop_heartbeat()

            if self.stop_flag.is_set():
                break

            if not success:
                # On error: reset to 'initialized' so it can be retried
                self._mark_initialized_back(issue_id)
                self._status("✗ Error — issue reset and retrying…")
            else:
                self._status("✓ Cycle complete — starting next…")

            time.sleep(2)
            self.root.after(0, self.issue_panel.clear)
            self.root.after(0, lambda: self.on_timer(0))
            self._log("─" * 60, "dim")
            self._log("New interaction cycle starting…", "green")
            self._log("─" * 60, "dim")

        self.on_done()

    def _fetch_issue_with_retry(self):
        while not self.stop_flag.is_set():
            self._status("Fetching initialized issue…")
            self._log("→ POST /v1/interaction-issue", "blue")
            try:
                r = session.post("/v1/interaction-issue", json={})
                d = r.json()
                if d.get("success"):
                    issue    = d["data"]["issue"]
                    issue_id = issue.get("id") or issue.get("_id")
                    missing  = [f for f, v in [
                        ("id",             issue_id),
                        ("repoName",       issue.get("repoName")),
                        ("baseSha",        issue.get("baseSha")),
                        ("uploadFileName", issue.get("uploadFileName")),
                    ] if not v]
                    if missing:
                        self._log(f"✗ Issue missing fields ({', '.join(missing)}). Retrying in {self.RETRY_DELAY}s…", "yellow")
                        self._status("Invalid issue data. Retrying…")
                    else:
                        self._log(f"✓ Issue: {issue.get('issueTitle')}", "green")
                        self._status(f"Issue: {issue.get('issueTitle')}")
                        return issue
                else:
                    msg = d.get("message", "No initialized issue available")
                    self._log(f"✗ {msg}. Retrying in {self.RETRY_DELAY}s…", "yellow")
                    self._status(f"No issue. Retrying in {self.RETRY_DELAY}s…")
            except Exception as e:
                self._log(f"✗ Connection error: {e}. Retrying in {self.RETRY_DELAY}s…", "red")
                self._status("Connection error. Retrying…")

            for _ in range(self.RETRY_DELAY):
                if self.stop_flag.is_set():
                    return None
                time.sleep(1)

        return None


# ── PR Interaction Window ─────────────────────────────────────────────────

class PRInteractionWindow:
    def __init__(self, root, on_back=None, on_signout=None):
        self.root        = root
        self._on_back    = on_back
        self._on_signout = on_signout
        self._running    = False
        self._stop_ev    = threading.Event()
        apply_light(root)
        root.title("TalentCodeHub — PR Interaction")
        root.resizable(True, True)
        w, h = 1100, 740
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")
        root.minsize(860, 560)
        set_window_icon(root)
        self._build()

    def _build(self):
        H = HOME
        # ── Title bar ────────────────────────────────────────────────────
        bar = tk.Frame(self.root, bg=H["sidebar"])
        bar.pack(fill=tk.X)

        tk.Button(
            bar, text="⊞",
            bg=H["sidebar"], fg=H["text_dim"],
            font=("Segoe UI", 14), relief=tk.FLAT, bd=0,
            padx=12, pady=8, cursor="hand2",
            activebackground=H["primary_lt"], activeforeground=H["primary"],
            command=self._go_home,
        ).pack(side=tk.LEFT)

        tk.Label(bar, text="PR Interaction",
                 bg=H["sidebar"], fg=H["accent"],
                 font=("Segoe UI", 12, "bold"),
                 pady=10, padx=8).pack(side=tk.LEFT)

        right = tk.Frame(bar, bg=H["sidebar"])
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

        tk.Frame(self.root, bg=H["border"], height=1).pack(fill=tk.X)

        # ── Status bar ───────────────────────────────────────────────────
        self.status_var = tk.StringVar(value="Ready — press START to begin.")
        status = tk.Frame(self.root, bg=H["sidebar"])
        status.pack(fill=tk.X, side=tk.BOTTOM)
        tk.Frame(status, bg=H["border"], height=1).pack(fill=tk.X)
        tk.Label(status, textvariable=self.status_var,
                 bg=H["sidebar"], fg=H["text_dim"],
                 font=FONT_SMALL, anchor="w", padx=12, pady=5).pack(fill=tk.X)

        # ── Body ─────────────────────────────────────────────────────────
        body = tk.Frame(self.root, bg=H["bg"])
        body.pack(fill=tk.BOTH, expand=True)

        # ── Left column: timer + issue + workflow info (fixed width) ─────
        left = tk.Frame(body, bg=H["bg"], width=280)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(10, 5), pady=10)
        left.pack_propagate(False)

        # Timer card
        timer_card = tk.Frame(left, bg=H["card"],
                              highlightbackground=H["border"], highlightthickness=1)
        timer_card.pack(fill=tk.X, pady=(0, 8))
        tk.Label(timer_card, text="CYCLE TIMER", bg=H["card"],
                 fg=H["text_dim"], font=("Segoe UI", 8, "bold"),
                 padx=12, pady=6).pack(anchor="w")
        tk.Frame(timer_card, bg=H["border"], height=1).pack(fill=tk.X)
        timer_inner = tk.Frame(timer_card, bg=H["card"])
        timer_inner.pack(fill=tk.X, pady=10, padx=6)
        self.timer_widget = CircularTimer(timer_inner, colors=HOME_WIDGET)
        self.timer_widget.pack(side=tk.LEFT)
        self.net_graph = NetworkGraph(timer_inner, colors=HOME_WIDGET)
        self.net_graph.pack(side=tk.LEFT, padx=(6, 0))
        self.root.after(600, self.net_graph.start)

        # Issue card
        issue_card = tk.Frame(left, bg=H["card"],
                              highlightbackground=H["border"], highlightthickness=1)
        issue_card.pack(fill=tk.X, pady=(0, 8))
        self.issue_panel = IssuePanel(issue_card, colors=HOME_PANEL)
        self.issue_panel.pack(fill=tk.X)

        # Workflow info card
        info_card = tk.Frame(left, bg=H["card"],
                             highlightbackground=H["border"], highlightthickness=1)
        info_card.pack(fill=tk.X)
        tk.Label(info_card, text="WORKFLOW INFO", bg=H["card"],
                 fg=H["text_dim"], font=("Segoe UI", 8, "bold"),
                 padx=12, pady=6).pack(anchor="w")
        tk.Frame(info_card, bg=H["border"], height=1).pack(fill=tk.X)
        info_body = tk.Frame(info_card, bg=H["card"], padx=12, pady=8)
        info_body.pack(fill=tk.X)
        for label, attr in [
            ("Result Dir",    "_upl_dir"),
            ("Upload File",   "_upl_file"),
            ("Project Dir",   "_upl_project"),
            ("Anthropic UUID","_upl_uuid"),
            ("Interaction",   "_upl_interaction"),
        ]:
            row = tk.Frame(info_body, bg=H["card"])
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label, bg=H["card"],
                     fg=H["text_dim"], font=FONT_SMALL,
                     width=13, anchor="w").pack(side=tk.LEFT)
            var = tk.StringVar(value="—")
            setattr(self, attr, var)
            tk.Label(row, textvariable=var, bg=H["card"],
                     fg=H["primary"], font=FONT_MONO,
                     anchor="w", wraplength=160, justify="left").pack(
                         side=tk.LEFT, fill=tk.X, expand=True)

        # ── Right column: terminal ────────────────────────────────────────
        right_col = tk.Frame(body, bg=H["bg"])
        right_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(5, 10), pady=10)

        term_outer = tk.Frame(right_col, bg=H["card"],
                              highlightbackground=H["border"], highlightthickness=1)
        term_outer.pack(fill=tk.BOTH, expand=True)
        self.term = TerminalPanel(term_outer, colors=HOME_WIDGET)
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
        self.term.write("  TalentCodeHub — PR Interaction Started", "green")
        self.term.write("═" * 60, "green")

        engine = InteractionWorkflowEngine(
            root=self.root,
            term=self.term,
            issue_panel=self.issue_panel,
            on_status=lambda m: self.root.after(0, lambda: self.status_var.set(m)),
            on_done=lambda: self.root.after(0, self._on_workflow_done),
            on_stop_flag=self._stop_ev,
            on_timer=self.timer_widget.update_time,
        )

        # Wire upload info display into the engine via callbacks
        def _on_issue_loaded(issue):
            self._upl_dir.set(issue.get("initialResultDir") or "—")
            self._upl_file.set(issue.get("uploadFileName") or "—")
            self._upl_project.set("—")
            self._upl_uuid.set("—")
            self._upl_interaction.set("—")

        def _on_info_update(kw):
            if "project_dir"   in kw: self._upl_project.set(kw["project_dir"] or "—")
            if "anthropic_uuid" in kw: self._upl_uuid.set(kw["anthropic_uuid"] or "—")
            if "interaction"   in kw: self._upl_interaction.set(kw["interaction"] or "—")

        engine._on_issue_loaded  = _on_issue_loaded
        engine._on_info_update   = _on_info_update
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
        win.configure(bg=HOME["bg"])
        w, h = 420, 200
        sw, sh = win.winfo_screenwidth(), win.winfo_screenheight()
        win.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")
        win.grab_set()

        body = tk.Frame(win, bg=HOME["bg"], padx=24, pady=20)
        body.pack(fill=tk.BOTH, expand=True)
        tk.Label(body, text="Upload Server URL", bg=HOME["bg"],
                 fg=HOME["text_dim"], font=FONT_SMALL).pack(anchor="w", pady=(0, 4))
        url_var = tk.StringVar(value=get_upload_server())
        entry = ttk.Entry(body, textvariable=url_var)
        entry.pack(fill=tk.X, pady=(0, 8))
        entry.focus()
        err_var = tk.StringVar()
        tk.Label(body, textvariable=err_var, bg=HOME["bg"],
                 fg=HOME_PANEL["danger"], font=FONT_SMALL).pack(anchor="w", pady=(0, 8))

        def _save():
            url = url_var.get().strip()
            if not url.startswith("http"):
                err_var.set("URL must start with http:// or https://")
                return
            save_settings({"upload_server": url})
            win.destroy()

        btn_row = tk.Frame(body, bg=HOME["bg"])
        btn_row.pack(fill=tk.X)
        ttk.Button(btn_row, text="Save", style="Primary.TButton", command=_save).pack(side=tk.RIGHT)
        ttk.Button(btn_row, text="Cancel", style="Ghost.TButton",
                   command=win.destroy).pack(side=tk.RIGHT, padx=(0, 6))

    def _go_home(self):
        if self._running:
            if not messagebox.askyesno("Back to menu", "Workflow is running. Stop and go to menu?"):
                return
            self._stop_ev.set()
        if self._on_back:
            self.root.destroy()
            self._on_back()

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
        if self._on_signout:
            self._on_signout()
        else:
            _bootstrap()


# ── Home Menu ─────────────────────────────────────────────────────────────

# Light palette for home menu (matches login page)
HOME = {
    "bg":        "#f0f4ff",
    "sidebar":   "#ffffff",
    "card":      "#ffffff",
    "card_hov":  "#f0f4ff",
    "border":    "#e2e8f0",
    "primary":   "#4f6ef7",
    "primary_lt":"#eef2ff",
    "accent":    "#7c3aed",
    "text":      "#1a1a2e",
    "text_dim":  "#6b7280",
    "text_muted":"#9ca3af",
    "green":     "#22c55e",
    "line1":     "#c7d7fd",
    "line2":     "#ddd6fe",
}

# Colour mapping so IssuePanel/PromptPanel can render in the light theme
HOME_PANEL = {
    "surface":    HOME["card"],
    "surface2":   HOME["primary_lt"],
    "surface3":   "#dde5ff",
    "border":     HOME["border"],
    "text":       HOME["text"],
    "text_dim":   HOME["text_dim"],
    "text_muted": HOME["text_muted"],
    "primary":    HOME["primary"],
    "accent":     HOME["accent"],
    "danger":     "#ef4444",
    "warn":       "#f59e0b",
    "mono":       HOME["primary"],
}

# White-theme colours for CircularTimer, NetworkGraph, TerminalPanel
HOME_WIDGET = {
    "surface":    HOME["card"],          # widget canvas/text bg
    "surface2":   HOME["primary_lt"],    # graph area fill
    "surface3":   HOME["border"],        # grid lines / selection
    "border":     HOME["border"],
    "text":       HOME["text"],
    "text_dim":   HOME["text_dim"],
    "text_muted": HOME["text_muted"],
    "primary":    HOME["primary"],       # upload line / green tag / arc
    "accent":     HOME["accent"],        # download line / blue tag
    "danger":     "#ef4444",
    "warn":       "#f59e0b",
}


class _Line:
    """Animated floating line segment for the background canvas."""
    def __init__(self, w, h):
        self.reset(w, h, initial=True)

    def reset(self, w, h, initial=False):
        self.x  = random.randint(0, w)
        self.y  = h + 30 if not initial else random.randint(0, h)
        self.length = random.randint(30, 100)
        self.angle  = random.uniform(0, math.pi)
        self.vx = random.uniform(-0.3, 0.3)
        self.vy = random.uniform(-0.5, -0.15)
        self.color = random.choice([HOME["line1"], HOME["line2"], "#bfdbfe", "#fde68a"])
        self.width  = random.randint(1, 2)

    def step(self, w, h):
        self.x += self.vx
        self.y += self.vy
        if self.y + self.length < 0:
            self.reset(w, h)

    def endpoints(self):
        dx = math.cos(self.angle) * self.length / 2
        dy = math.sin(self.angle) * self.length / 2
        return self.x - dx, self.y - dy, self.x + dx, self.y + dy


class HomeMenu:
    W, H = 860, 560
    FPS  = 30

    TILES = [
        {
            "key":    "pr_prep",
            "label":  "PR Preparation",
            "sub":    "Clone → analyse → upload",
            "icon":   "⚡",
            "accent": "#4f6ef7",
            "icon_bg":"#eef2ff",
        },
        {
            "key":    "pr_interact",
            "label":  "PR Interaction",
            "sub":    "Review & interact with PRs",
            "icon":   "💬",
            "accent": "#7c3aed",
            "icon_bg":"#f5f3ff",
        },
    ]

    SIDEBAR_W = 220
    TILE_W    = 160
    TILE_H    = 140

    def __init__(self, root):
        self.root      = root
        self._app_win  = None
        self._animating = True

        root.title("TalentCodeHub")
        root.resizable(True, True)
        root.minsize(680, 440)
        sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
        root.geometry(f"{self.W}x{self.H}+{(sw-self.W)//2}+{(sh-self.H)//2}")
        root.configure(bg=HOME["bg"])
        set_window_icon(root)

        self._build()
        self._tick()

    def _load_logo(self, size):
        try:
            from PIL import Image, ImageTk
            for path in _ICON_PATHS:
                if os.path.exists(path):
                    pil = Image.open(path).resize((size, size), Image.LANCZOS)
                    return ImageTk.PhotoImage(pil)
        except Exception:
            pass
        try:
            for path in _ICON_PATHS:
                if os.path.exists(path):
                    raw = tk.PhotoImage(file=path)
                    f   = max(1, raw.width() // size)
                    return raw.subsample(f, f)
        except Exception:
            pass
        return None

    def _build(self):
        # ── Left sidebar ──────────────────────────────────────────────────
        sidebar = tk.Frame(self.root, bg=HOME["sidebar"],
                           width=self.SIDEBAR_W,
                           highlightthickness=1,
                           highlightbackground=HOME["border"])
        sidebar.pack(side=tk.LEFT, fill=tk.Y)
        sidebar.pack_propagate(False)

        # Brand block
        brand = tk.Frame(sidebar, bg=HOME["sidebar"])
        brand.pack(fill=tk.X, padx=24, pady=(30, 0))

        logo = self._load_logo(28)
        if logo:
            lbl = tk.Label(brand, image=logo, bg=HOME["sidebar"])
            lbl.image = logo
            lbl.pack(anchor="w", pady=(0, 8))

        tk.Label(brand, text="TalentCodeHub",
                 bg=HOME["sidebar"], fg=HOME["text"],
                 font=("Segoe UI", 14, "bold")).pack(anchor="w")
        tk.Label(brand, text="AI Issue Workflow",
                 bg=HOME["sidebar"], fg=HOME["text_dim"],
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(2, 0))

        tk.Frame(sidebar, bg=HOME["border"], height=1).pack(
            fill=tk.X, padx=20, pady=20)

        # Nav items
        self._nav_items = []
        nav_defs = [
            ("Dashboard",    "🏠"),
            ("PR Prep",      "⚡"),
            ("PR Interact",  "💬"),
        ]
        for label, icon in nav_defs:
            row = tk.Frame(sidebar, bg=HOME["sidebar"], cursor="hand2")
            row.pack(fill=tk.X, padx=12, pady=2)
            tk.Label(row, text=icon, bg=HOME["sidebar"],
                     font=("Segoe UI", 13), width=2).pack(side=tk.LEFT, padx=(8, 6), pady=8)
            tk.Label(row, text=label, bg=HOME["sidebar"],
                     fg=HOME["text"], font=("Segoe UI", 10)).pack(side=tk.LEFT)
            self._nav_items.append(row)
            row.bind("<Enter>",    lambda e, r=row: self._nav_hover(r, True))
            row.bind("<Leave>",    lambda e, r=row: self._nav_hover(r, False))
            row.bind("<Button-1>", lambda e, r=row: self._nav_hover(r, False))
            for child in row.winfo_children():
                child.bind("<Enter>",    lambda e, r=row: self._nav_hover(r, True))
                child.bind("<Leave>",    lambda e, r=row: self._nav_hover(r, False))

        # Active indicator on first item
        self._set_nav_active(self._nav_items[0])

        tk.Frame(sidebar, bg=HOME["border"], height=1).pack(
            fill=tk.X, padx=20, pady=(16, 12))

        # Sign out button at bottom
        signout = tk.Frame(sidebar, bg=HOME["sidebar"], cursor="hand2")
        signout.pack(fill=tk.X, padx=12, pady=2)
        tk.Label(signout, text="🚪", bg=HOME["sidebar"],
                 font=("Segoe UI", 13), width=2).pack(side=tk.LEFT, padx=(8, 6), pady=8)
        tk.Label(signout, text="Sign out", bg=HOME["sidebar"],
                 fg=HOME["text_dim"], font=("Segoe UI", 10)).pack(side=tk.LEFT)
        signout.bind("<Button-1>", lambda _: self._signout())
        for child in signout.winfo_children():
            child.bind("<Button-1>", lambda _: self._signout())
        signout.bind("<Enter>", lambda e: [w.configure(fg="#ef4444") if isinstance(w, tk.Label) and w.cget("text") == "Sign out" else None for w in signout.winfo_children()])
        signout.bind("<Leave>", lambda e: [w.configure(fg=HOME["text_dim"]) if isinstance(w, tk.Label) and w.cget("text") == "Sign out" else None for w in signout.winfo_children()])

        # Version label
        tk.Label(sidebar, text="v1.3.3", bg=HOME["sidebar"],
                 fg=HOME["text_muted"], font=("Segoe UI", 8)).pack(
                 side=tk.BOTTOM, pady=12)

        # ── Main content area ─────────────────────────────────────────────
        content = tk.Frame(self.root, bg=HOME["bg"])
        content.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Animated canvas background
        self._canvas = tk.Canvas(content, bg=HOME["bg"], highlightthickness=0)
        self._canvas.pack(fill=tk.BOTH, expand=True)

        # Draw gradient once
        self._canvas.bind("<Configure>", self._on_resize)

        # Lines
        self._lines = [_Line(self.W - self.SIDEBAR_W, self.H) for _ in range(18)]

        # Overlay frame for actual content (placed over canvas)
        overlay = tk.Frame(self._canvas, bg=HOME["bg"])
        self._canvas.create_window(0, 0, anchor="nw", window=overlay,
                                   tags="overlay")
        self._canvas.bind("<Configure>",
            lambda e: self._canvas.itemconfig("overlay", width=e.width, height=e.height))
        self._overlay = overlay

        # Header row
        hdr = tk.Frame(overlay, bg="", highlightthickness=0)
        hdr.configure(bg=HOME["bg"])
        hdr.pack(fill=tk.X, padx=32, pady=(28, 0))
        tk.Label(hdr, text="Dashboard", bg=HOME["bg"],
                 fg=HOME["text"], font=("Segoe UI", 18, "bold")).pack(side=tk.LEFT)
        tk.Label(hdr, text="Select an app to launch",
                 bg=HOME["bg"], fg=HOME["text_dim"],
                 font=("Segoe UI", 10)).pack(side=tk.LEFT, padx=(14, 0), pady=(5, 0))

        tk.Frame(overlay, bg=HOME["border"], height=1).pack(
            fill=tk.X, padx=32, pady=(12, 0))

        # Section label
        tk.Label(overlay, text="APPLICATIONS",
                 bg=HOME["bg"], fg=HOME["text_muted"],
                 font=("Segoe UI", 8, "bold")).pack(
                 anchor="w", padx=32, pady=(18, 10))

        # Tile grid — top-left aligned using a wrapping frame
        tile_area = tk.Frame(overlay, bg=HOME["bg"])
        tile_area.pack(anchor="nw", padx=32)

        for tile in self.TILES:
            self._make_tile(tile_area, tile)

    def _nav_hover(self, row, on):
        bg = HOME["primary_lt"] if on else HOME["sidebar"]
        row.configure(bg=bg)
        for child in row.winfo_children():
            try: child.configure(bg=bg)
            except Exception: pass

    def _set_nav_active(self, row):
        row.configure(bg=HOME["primary_lt"])
        for child in row.winfo_children():
            try: child.configure(bg=HOME["primary_lt"])
            except Exception: pass

    def _make_tile(self, parent, tile):
        NORMAL = HOME["card"]
        HOVER  = tile["icon_bg"]
        ACCENT = tile["accent"]

        card = tk.Frame(parent, bg=NORMAL, width=self.TILE_W, height=self.TILE_H,
                        cursor="hand2",
                        highlightthickness=1, highlightbackground=HOME["border"])
        card.pack(side=tk.LEFT, padx=(0, 16))
        card.pack_propagate(False)

        # Top accent bar
        bar = tk.Frame(card, bg=ACCENT, height=3)
        bar.pack(fill=tk.X)

        # Icon bubble
        icon_bg_frame = tk.Frame(card, bg=tile["icon_bg"],
                                  width=48, height=48)
        icon_bg_frame.pack(pady=(16, 0))
        icon_bg_frame.pack_propagate(False)
        icon_lbl = tk.Label(icon_bg_frame, text=tile["icon"],
                            bg=tile["icon_bg"], font=("Segoe UI", 22))
        icon_lbl.place(relx=0.5, rely=0.5, anchor="center")

        # Title
        title_lbl = tk.Label(card, text=tile["label"],
                              bg=NORMAL, fg=HOME["text"],
                              font=("Segoe UI", 11, "bold"))
        title_lbl.pack(pady=(10, 2))

        # Subtitle
        sub_lbl = tk.Label(card, text=tile["sub"],
                           bg=NORMAL, fg=HOME["text_dim"],
                           font=("Segoe UI", 8), justify="center")
        sub_lbl.pack()

        # Arrow hint
        arrow_lbl = tk.Label(card, text="→", bg=NORMAL,
                             fg=ACCENT, font=("Segoe UI", 13, "bold"))
        arrow_lbl.pack(pady=(8, 0))

        all_widgets = [card, bar, icon_bg_frame, icon_lbl, title_lbl, sub_lbl, arrow_lbl]
        key = tile["key"]

        def on_enter(_):
            card.configure(bg=HOVER, highlightbackground=ACCENT)
            for w in [title_lbl, sub_lbl, arrow_lbl]:
                w.configure(bg=HOVER)
            self._animate_tile_in(card, arrow_lbl)

        def on_leave(_):
            card.configure(bg=NORMAL, highlightbackground=HOME["border"])
            for w in [title_lbl, sub_lbl, arrow_lbl]:
                w.configure(bg=NORMAL)

        def on_click(_):
            self._launch(key)

        for w in all_widgets:
            w.bind("<Enter>",    on_enter)
            w.bind("<Leave>",    on_leave)
            w.bind("<Button-1>", on_click)

    def _animate_tile_in(self, card, arrow_lbl):
        """Briefly pulse the arrow text."""
        origfg = arrow_lbl.cget("fg")
        def step(i):
            if i >= 4: return
            arrow_lbl.configure(fg="#ffffff" if i % 2 == 0 else origfg)
            card.after(80, lambda: step(i + 1))
        step(0)

    # ── Background animation ──────────────────────────────────────────────

    def _on_resize(self, _):
        w = self._canvas.winfo_width()
        h = self._canvas.winfo_height()
        self._canvas.delete("grad")
        top_r, top_g, top_b = 0xe8, 0xed, 0xff
        bot_r, bot_g, bot_b = 0xf5, 0xf0, 0xff
        for i in range(0, h, 2):
            t = i / max(h, 1)
            r = int(top_r + (bot_r - top_r) * t)
            g = int(top_g + (bot_g - top_g) * t)
            b = int(top_b + (bot_b - top_b) * t)
            self._canvas.create_rectangle(0, i, w, i + 2,
                fill=f"#{r:02x}{g:02x}{b:02x}", outline="", tags="grad")
        self._canvas.tag_lower("grad")

    def _tick(self):
        if not self._animating:
            return
        w = self._canvas.winfo_width() or (self.W - self.SIDEBAR_W)
        h = self._canvas.winfo_height() or self.H
        self._canvas.delete("line")
        for ln in self._lines:
            ln.step(w, h)
            x1, y1, x2, y2 = ln.endpoints()
            self._canvas.create_line(x1, y1, x2, y2,
                fill=ln.color, width=ln.width,
                capstyle="round", tags="line")
        self._canvas.tag_lower("line")
        self._canvas.tag_lower("grad")
        self.root.after(1000 // self.FPS, self._tick)

    def _launch(self, key):
        self._animating = False
        self.root.withdraw()
        win = tk.Toplevel(self.root)
        win.protocol("WM_DELETE_WINDOW", lambda: self._on_app_close(win))
        set_window_icon(win)

        def go_back():
            self._app_win  = None
            self._animating = True
            self.root.deiconify()
            self._tick()

        def do_signout():
            self._app_win = None
            self.root.destroy()
            _bootstrap()

        if key == "pr_prep":
            MainWindow(win, on_back=go_back, on_signout=do_signout)
        elif key == "pr_interact":
            PRInteractionWindow(win, on_back=go_back, on_signout=do_signout)

        self._app_win = win

    def _on_app_close(self, win):
        self._app_win   = None
        self._animating  = True
        win.destroy()
        self.root.deiconify()
        self._tick()

    def _signout(self):
        self._animating = False
        try:
            session.post("/api/auth/signout", json={}, timeout=8)
        except Exception:
            pass
        session.clear()
        self.root.destroy()
        _bootstrap()


# ── Bootstrap ─────────────────────────────────────────────────────────────

def _open_home_menu():
    home_root = tk.Tk()
    HomeMenu(home_root)
    home_root.mainloop()


def _bootstrap():
    root = tk.Tk()
    apply_dark(root)
    root.withdraw()

    def on_login():
        root.destroy()
        _open_home_menu()

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
