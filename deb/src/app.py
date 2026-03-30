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


# ── Network Graph Widget ─────────────────────────────────────────────────

class EndlessRunner(tk.Canvas):
    """
    Cmd-style endless runner.
    - Manual mode : click / Space to jump
    - Auto mode   : character jumps perfectly before every obstacle
    - Day / night : sky gradually shifts every 30 seconds
    """
    WIDTH    = 260
    HEIGHT   = 110
    GROUND   = 88
    CHAR_X   = 42
    CHAR_H   = 22
    GRAVITY  = 1.3
    JUMP_VY  = -14.0
    INTERVAL = 30          # ms per frame
    DAY_DUR  = 30_000      # ms for one full day→night or night→day transition

    # sky palette: (bg, ground_dot, ground_line, star_visible)
    _DAY   = {"sky": "#1a1a2e", "dot": "#444466", "gnd": "#334",  "stars": False, "sun": True}
    _NIGHT = {"sky": "#05050f", "dot": "#222233", "gnd": "#223",  "stars": True,  "sun": False}

    def __init__(self, parent, **kw):
        super().__init__(
            parent,
            width=self.WIDTH, height=self.HEIGHT,
            bg=self._DAY["sky"], highlightthickness=0,
            **kw,
        )
        self._auto      = False
        self._vy        = 0.0
        self._cy        = float(self.GROUND)
        self._grounded  = True
        self._obstacles = []
        self._speed     = 3.0
        self._score     = 0
        self._frame     = 0
        self._running   = False
        self._dead      = False
        self._tick_id   = None
        self._spawn_in  = 80
        self._time_ms   = 0       # elapsed game time in ms (drives day/night)
        import random, math
        self._rng       = random
        self._math      = math
        # fixed star positions (generated once)
        self._stars = [(self._rng.randint(0, self.WIDTH),
                        self._rng.randint(4, self.GROUND - 20))
                       for _ in range(28)]

        self.bind("<Button-1>", self._on_input)
        self.bind("<space>",    self._on_input)
        self._render()

    # ── public ───────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            return
        self._reset_state()
        self._running = True
        self._schedule()

    def stop_game(self):
        self._running = False
        if self._tick_id:
            self.after_cancel(self._tick_id)
            self._tick_id = None

    def set_auto(self, enabled: bool):
        self._auto = enabled
        if enabled and self._dead:
            self._reset_state()
            self._running = True
            self._schedule()

    # ── internals ────────────────────────────────────────────────────────

    def _reset_state(self):
        self._vy        = 0.0
        self._cy        = float(self.GROUND)
        self._grounded  = True
        self._obstacles = []
        self._speed     = 3.0
        self._score     = 0
        self._frame     = 0
        self._dead      = False
        self._spawn_in  = 80

    def _on_input(self, _=None):
        self.focus_set()
        if self._auto:
            return          # ignore manual input in auto mode
        if self._dead:
            self._reset_state()
            if not self._running:
                self._running = True
                self._schedule()
            return
        if not self._running:
            self.start()
            return
        self._jump()

    def _jump(self):
        if self._grounded:
            self._vy       = self.JUMP_VY
            self._grounded = False

    def _schedule(self):
        self._tick_id = self.after(self.INTERVAL, self._tick)

    def _tick(self):
        if not self._running:
            return
        self._time_ms += self.INTERVAL
        self._update()
        self._render()
        if not self._dead:
            self._schedule()
        elif self._auto:
            # auto mode: restart immediately after death (shouldn't die, but safety)
            self.after(200, self._auto_restart)

    def _auto_restart(self):
        if self._auto:
            self._reset_state()
            self._running = True
            self._schedule()

    def _auto_jump(self):
        """Called every frame in auto mode. Jumps when the closest obstacle is
        close enough that the character must jump now to clear it perfectly."""
        if not self._grounded:
            return
        for obs in sorted(self._obstacles, key=lambda o: o["x"]):
            ox = obs["x"]
            # only care about obstacles ahead of the character
            if ox < self.CHAR_X - 10:
                continue
            # how many frames until the obstacle reaches us?
            dist = ox - (self.CHAR_X + 6)
            if dist < 0:
                continue
            frames_until = dist / self._speed
            # simulate jump trajectory: find how many frames to clear obstacle top
            # jump now if landing would be past the obstacle
            vy_sim = self.JUMP_VY
            cy_sim = self._cy
            for _ in range(int(frames_until) + 2):
                vy_sim += self.GRAVITY
                cy_sim += vy_sim
                if cy_sim >= self.GROUND:
                    break
            # jump as soon as we know we need to
            if frames_until <= 38:
                self._jump()
            break

    def _update(self):
        self._frame += 1
        self._score += 1
        self._speed  = 3.0 + self._score / 600.0

        if self._auto:
            self._auto_jump()

        # gravity
        self._vy += self.GRAVITY
        self._cy += self._vy
        if self._cy >= self.GROUND:
            self._cy      = float(self.GROUND)
            self._vy      = 0.0
            self._grounded = True

        # spawn obstacles
        self._spawn_in -= 1
        if self._spawn_in <= 0:
            h = self._rng.randint(14, 26)
            self._obstacles.append({"x": float(self.WIDTH + 10), "h": h})
            self._spawn_in = self._rng.randint(55, 110)

        # scroll
        for obs in self._obstacles:
            obs["x"] -= self._speed
        self._obstacles = [o for o in self._obstacles if o["x"] > -20]

        # collision
        if not self._auto:   # in auto mode never die
            cx0, cx1 = self.CHAR_X - 6, self.CHAR_X + 6
            cy0, cy1 = self._cy - self.CHAR_H + 2, self._cy
            for obs in self._obstacles:
                ox0, ox1 = obs["x"], obs["x"] + 14
                oy0 = self.GROUND - obs["h"]
                if cx1 > ox0 and cx0 < ox1 and cy1 > oy0 and cy0 < self.GROUND:
                    self._dead    = True
                    self._running = False
                    self._render()
                    return

    # ── day / night ──────────────────────────────────────────────────────

    def _day_night(self):
        """Returns a float 0.0=day .. 1.0=night based on elapsed time."""
        cycle = (self._time_ms % (self.DAY_DUR * 2)) / self.DAY_DUR
        # 0→1 = day→night,  1→2 = night→day  (smooth sine)
        t = cycle if cycle <= 1.0 else 2.0 - cycle
        return self._math.sin(t * self._math.pi / 2)  # 0=day, 1=night

    @staticmethod
    def _lerp_color(c1, c2, t):
        """Linearly interpolate between two hex colours."""
        def _parse(c):
            c = c.lstrip("#")
            return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
        r1, g1, b1 = _parse(c1)
        r2, g2, b2 = _parse(c2)
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        return f"#{r:02x}{g:02x}{b:02x}"

    # ── rendering ────────────────────────────────────────────────────────

    def _render(self):
        self.delete("all")
        w, g = self.WIDTH, self.GROUND

        night = self._day_night()

        # sky background
        sky_col = self._lerp_color(self._DAY["sky"], self._NIGHT["sky"], night)
        self.configure(bg=sky_col)

        # stars (fade in at night)
        if night > 0.1:
            star_alpha = min(1.0, (night - 0.1) / 0.5)
            for sx, sy in self._stars:
                bri = int(180 * star_alpha)
                star_col = f"#{bri:02x}{bri:02x}{bri:02x}"
                # twinkle via frame parity
                if (sx + self._frame // 10) % 3 != 0:
                    self.create_text(sx, sy, text="·",
                                     fill=star_col, font=("Courier", 7), anchor="center")

        # sun / moon
        if night < 0.5:
            # sun: rises from right, sets left
            sun_x = w - int(w * 0.15 * night * 2)
            sun_y = 16 - int(8 * night)
            sun_col = self._lerp_color("#ffe066", "#ff8844", night * 2)
            self.create_oval(sun_x - 8, sun_y - 8, sun_x + 8, sun_y + 8,
                             fill=sun_col, outline="")
        else:
            # moon
            moon_x = int(w * 0.15 * (night - 0.5) * 2) + 10
            moon_y = 14
            self.create_oval(moon_x - 7, moon_y - 7, moon_x + 7, moon_y + 7,
                             fill="#ddddee", outline="")
            # crater illusion
            self.create_oval(moon_x + 1, moon_y - 4, moon_x + 5, moon_y,
                             fill=sky_col, outline="")

        # time-of-day label
        if night < 0.25:
            tod = "DAY"
        elif night < 0.75:
            tod = "DUSK" if (self._time_ms % (self.DAY_DUR * 2)) < self.DAY_DUR else "DAWN"
        else:
            tod = "NIGHT"
        tod_col = self._lerp_color("#888888", "#aaaacc", night)
        self.create_text(4, 6, text=tod, fill=tod_col,
                         font=("Courier", 6, "bold"), anchor="w")

        # auto badge
        if self._auto:
            self.create_text(4, 16, text="AUTO", fill=DARK["primary"],
                             font=("Courier", 6, "bold"), anchor="w")

        # scrolling ground dots
        dot_col = self._lerp_color(self._DAY["dot"], self._NIGHT["dot"], night)
        offset = int(self._frame * self._speed) % 16 if self._running else 0
        for x in range(-16, w + 16, 16):
            self.create_text(x + offset, g + 7, text="·",
                             fill=dot_col, font=("Courier", 8), anchor="center")

        # ground line
        gnd_col = self._lerp_color(self._DAY["gnd"], self._NIGHT["gnd"], night)
        self.create_line(0, g + 2, w, g + 2, fill=gnd_col, width=1)

        # score
        score_col = self._lerp_color("#666666", "#888899", night)
        self.create_text(w - 4, 4,
                         text=f"{self._score or 'SCORE'}",
                         fill=score_col, font=("Courier", 8, "bold"), anchor="ne")

        if self._dead:
            self.create_text(w // 2, g // 2 - 8, text="── GAME OVER ──",
                             fill=DARK["danger"], font=("Courier", 9, "bold"), anchor="center")
            self.create_text(w // 2, g // 2 + 8, text="click or space to retry",
                             fill=score_col, font=("Courier", 7), anchor="center")
            self._draw_char(dead=True, night=night)
            return

        if not self._running:
            self.create_text(w // 2, g // 2,
                             text="[ click or space to start ]",
                             fill=score_col, font=("Courier", 7), anchor="center")
            self._draw_char(night=night)
            return

        # obstacles
        obs_col = self._lerp_color(DARK["danger"], "#cc4444", night)
        for obs in self._obstacles:
            x, oh = obs["x"], obs["h"]
            self.create_rectangle(x + 3, g - oh, x + 11, g + 2,
                                  fill=obs_col, outline="")
            arm_y = g - oh + oh // 3
            self.create_rectangle(x - 3, arm_y, x + 3, arm_y + 5,
                                  fill=obs_col, outline="")
            self.create_rectangle(x + 11, arm_y, x + 17, arm_y + 5,
                                  fill=obs_col, outline="")

        self._draw_char(night=night)

    def _draw_char(self, dead=False, night=0.0):
        cx = self.CHAR_X
        cy = int(self._cy)
        c  = self._lerp_color(DARK["primary"], "#44aaff", night)

        if dead:
            self.create_text(cx, cy - 8, text="x_x",
                             fill=DARK["warn"], font=("Courier", 10, "bold"), anchor="center")
            self.create_line(cx - 8, cy - 2, cx + 8, cy - 2, fill=DARK["warn"], width=1)
            self.create_line(cx - 6, cy - 2, cx - 9, cy + 2, fill=DARK["warn"], width=1)
            self.create_line(cx + 6, cy - 2, cx + 9, cy + 2, fill=DARK["warn"], width=1)
            return

        bg = self._lerp_color(self._DAY["sky"], self._NIGHT["sky"], night)
        self.create_oval(cx - 5, cy - self.CHAR_H,
                         cx + 5, cy - self.CHAR_H + 10,
                         outline=c, fill=bg, width=1)
        self.create_line(cx, cy - self.CHAR_H + 10, cx, cy - 6, fill=c, width=1)
        self.create_line(cx - 7, cy - self.CHAR_H + 14,
                         cx + 7, cy - self.CHAR_H + 14, fill=c, width=1)
        phase = (self._frame // 5) % 2
        if not self._grounded:
            self.create_line(cx, cy - 6, cx - 4, cy - 2, fill=c, width=1)
            self.create_line(cx, cy - 6, cx + 4, cy - 2, fill=c, width=1)
        elif phase == 0:
            self.create_line(cx, cy - 6, cx - 5, cy,     fill=c, width=1)
            self.create_line(cx, cy - 6, cx + 4, cy - 4, fill=c, width=1)
        else:
            self.create_line(cx, cy - 6, cx - 4, cy - 4, fill=c, width=1)
            self.create_line(cx, cy - 6, cx + 5, cy,     fill=c, width=1)


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

            # ── Create result/ directory structure ───────────────────────
            # result/result.txt  (empty)
            # result/project/    (copy of the cloned repo)
            result_dir = work_dir / "result"
            result_dir.mkdir(exist_ok=True)
            (result_dir / "result.txt").touch()
            self._log("✓ Created result/result.txt", "green")

            project_dir = result_dir / "project"
            shutil.copytree(str(dest), str(project_dir))
            self._log(f"✓ Copied repo → result/project", "green")

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
        tk.Label(timer_card, text="CYCLE TIMER  /  NETWORK", bg=DARK["surface"],
                 fg=DARK["text_dim"], font=("Segoe UI", 8, "bold"),
                 padx=12).pack(anchor="w")
        tk.Frame(timer_card, bg=DARK["border"], height=1).pack(fill=tk.X)
        timer_inner = tk.Frame(timer_card, bg=DARK["surface"])
        timer_inner.pack(fill=tk.X, pady=10, padx=10)
        self.timer_widget = CircularTimer(timer_inner)
        self.timer_widget.pack(side=tk.LEFT)
        # Endless runner game
        game_frame = tk.Frame(timer_inner, bg=DARK["surface"])
        game_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(10, 0))
        game_header = tk.Frame(game_frame, bg=DARK["surface"])
        game_header.pack(fill=tk.X)
        tk.Label(game_header, text="RUNNER  [ click or space to jump ]",
                 bg=DARK["surface"], fg=DARK["text_muted"],
                 font=("Segoe UI", 7)).pack(side=tk.LEFT, anchor="w")
        self._auto_mode = tk.BooleanVar(value=False)
        self._auto_btn = tk.Button(
            game_header, text="AUTO: OFF",
            bg=DARK["surface3"], fg=DARK["text_dim"],
            font=("Segoe UI", 7, "bold"), relief=tk.FLAT,
            bd=0, padx=4, pady=1,
            cursor="hand2",
            command=self._toggle_auto,
        )
        self._auto_btn.pack(side=tk.RIGHT, anchor="e")
        self.runner = EndlessRunner(game_frame)
        self.runner.pack(pady=(2, 0))
        self.root.after(500, self.runner.start)

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

    def _toggle_auto(self):
        state = not self._auto_mode.get()
        self._auto_mode.set(state)
        self.runner.set_auto(state)
        if state:
            self._auto_btn.config(
                text="AUTO: ON",
                bg=DARK["primary_dk"], fg=DARK["text"],
            )
        else:
            self._auto_btn.config(
                text="AUTO: OFF",
                bg=DARK["surface3"], fg=DARK["text_dim"],
            )

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
