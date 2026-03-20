# messenger.py — Visual Studio Code v4
# Desktop messenger · talentcodehub.com API
import tkinter as tk
from tkinter import messagebox
import ctypes, threading, json, sys, os, re, mimetypes, io
from datetime import datetime

# ── Auto-install ──────────────────────────────────────────────────────────────
def _pip(pkg):
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', pkg, '-q'])

for _pkg, _mod in [('requests','requests'), ('websocket-client','websocket'),
                    ('pystray','pystray'), ('pillow','PIL'), ('tkinterdnd2','tkinterdnd2')]:
    try: __import__(_mod)
    except ImportError: _pip(_pkg)

import requests, websocket
try:
    import pystray
    from PIL import Image as PILImage, ImageTk
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False; ImageTk = None
try:
    from tkinterdnd2 import TkinterDnD, DND_FILES
    HAS_DND = True
except ImportError:
    HAS_DND = False

# ── Constants ─────────────────────────────────────────────────────────────────
BASE_URL       = 'https://www.talentcodehub.com/api'
PUSHER_KEY     = '049fcf327599308f42da'
PUSHER_CLUSTER = 'us3'
WDA_MONITOR      = 0x00000011
GWL_EXSTYLE      = -20
WS_EX_TOOLWINDOW = 0x00000080   # hides window from taskbar / Alt+Tab
WS_EX_APPWINDOW  = 0x00040000   # forces button in taskbar
CONFIG_PATH    = os.path.join(os.path.expanduser('~'), '.vscode_msg.json')
MSG_PAGE       = 40
APP_NAME       = 'Visual Studio Code'

# ── VSCode Dark+ Palette ──────────────────────────────────────────────────────
C = {
    'bg':'#1e1e1e', 'sidebar':'#252526', 'actbar':'#333333',
    'fg':'#d4d4d4', 'dim':'#858585', 'border':'#474747',
    'icon':'#858585', 'icon_act':'#ffffff',
    'highlight':'#094771', 'hover':'#2a2d2e',
    'input_bg':'#3c3c3c', 'btn':'#0e639c', 'btn_hov':'#1177bb',
    'error':'#f48771', 'success':'#4ec9b0',
    'own_msg':'#0f4c81', 'other_msg':'#2d2d2d',
    'ts':'#6e6e6e', 'own_name':'#4fc1ff', 'other_name':'#9cdcfe',
    'unread':'#007acc', 'select_bg':'#1a3a5c',
    'reply_bg':'#1a2d3f', 'reply_bar':'#1e3448',
    'att':'#313131', 'edited':'#5a5a5a', 'del_msg':'#5a5a5a',
}
MB_BG='#3c3c3c'; MB_HOV='#505050'; SB_BG='#007acc'
AV_COLORS=['#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63']

# ── File type registry ────────────────────────────────────────────────────────
FILE_ICONS = {
    '.pdf':('📄','#e74c3c','PDF Document'), '.doc':('📝','#2b579a','Word Document'),
    '.docx':('📝','#2b579a','Word Document'), '.xls':('📊','#217346','Excel Spreadsheet'),
    '.xlsx':('📊','#217346','Excel Spreadsheet'), '.ppt':('📊','#d24726','PowerPoint'),
    '.pptx':('📊','#d24726','PowerPoint'), '.txt':('📄','#9e9e9e','Text File'),
    '.csv':('📊','#217346','CSV File'), '.rtf':('📄','#9e9e9e','Rich Text'),
    '.zip':('🗜','#8e44ad','ZIP Archive'), '.rar':('🗜','#8e44ad','RAR Archive'),
    '.7z':('🗜','#8e44ad','7-Zip Archive'), '.tar':('🗜','#8e44ad','TAR Archive'),
    '.gz':('🗜','#8e44ad','GZ Archive'),
    '.mp3':('🎵','#3498db','MP3 Audio'), '.wav':('🎵','#3498db','WAV Audio'),
    '.ogg':('🎵','#3498db','OGG Audio'), '.flac':('🎵','#3498db','FLAC Audio'),
    '.mp4':('🎬','#e74c3c','MP4 Video'), '.mkv':('🎬','#e74c3c','MKV Video'),
    '.avi':('🎬','#e74c3c','AVI Video'), '.mov':('🎬','#e74c3c','MOV Video'),
    '.webm':('🎬','#e74c3c','WebM Video'),
    '.py':('🐍','#3572a5','Python'), '.js':('📜','#f7df1e','JavaScript'),
    '.ts':('📜','#3178c6','TypeScript'), '.html':('🌐','#e34c26','HTML'),
    '.css':('🎨','#563d7c','CSS'), '.json':('{}','#cbcb41','JSON'),
    '.xml':('📃','#f0a500','XML'), '.yaml':('📃','#cb171e','YAML'),
    '.yml':('📃','#cb171e','YAML'), '.sh':('⚡','#4eaa25','Shell Script'),
    '.bat':('⚡','#4eaa25','Batch Script'), '.sql':('🗄','#dad8d8','SQL'),
    '.rs':('🦀','#dea584','Rust'), '.go':('🔷','#00acd7','Go'),
    '.java':('☕','#b07219','Java'), '.cpp':('⚙','#f34b7d','C++'),
    '.c':('⚙','#555555','C'), '.cs':('⚙','#178600','C#'),
    '.rb':('💎','#701516','Ruby'), '.php':('🐘','#4f5d95','PHP'),
    '.swift':('🎯','#ffac45','Swift'), '.kt':('🎯','#f18e33','Kotlin'),
    '.exe':('⚙','#e74c3c','Executable'), '.dmg':('💿','#999','macOS Image'),
    '.iso':('💿','#999','Disk Image'), '.db':('🗄','#dad8d8','Database'),
    '.png':('🖼','#3498db','PNG Image'), '.jpg':('🖼','#3498db','JPEG Image'),
    '.jpeg':('🖼','#3498db','JPEG Image'), '.gif':('🎞','#9b59b6','GIF Image'),
    '.svg':('🎨','#ff6b6b','SVG Image'), '.webp':('🖼','#3498db','WebP Image'),
    '.bmp':('🖼','#3498db','Bitmap'), '.ico':('🖼','#3498db','Icon'),
}
IMAGE_EXTS = {'.png','.jpg','.jpeg','.gif','.webp','.bmp'}

# ── Helpers ───────────────────────────────────────────────────────────────────
def load_config():
    try:
        with open(CONFIG_PATH) as f: return json.load(f)
    except Exception: return {}

def save_config(**kw):
    cfg = load_config(); cfg.update(kw)
    try:
        with open(CONFIG_PATH,'w') as f: json.dump(cfg,f)
    except Exception: pass

def _dark_title(hwnd):
    try:
        for a in (20,19):
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, a, ctypes.byref(ctypes.c_int(1)), ctypes.sizeof(ctypes.c_int))
    except Exception: pass

def _get_hwnd(win):
    """Return the real top-level HWND for a tkinter widget.
    GetAncestor(GA_ROOT=2) walks up to the root window — more reliable than GetParent."""
    try:
        GA_ROOT = 2
        wid = win.winfo_id()
        hwnd = ctypes.windll.user32.GetAncestor(wid, GA_ROOT)
        return hwnd or wid
    except Exception:
        return 0

def _stealth(hwnd):
    """Exclude window from all screen captures (Windows 10 build 19041+)."""
    try:
        ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_MONITOR)
    except Exception: pass

def _protect_win(win):
    win.update_idletasks()
    hwnd = _get_hwnd(win)
    if hwnd:
        _dark_title(hwnd)
        _stealth(hwnd)

def _fmt_size(b):
    if b < 1024: return f'{b} B'
    if b < 1048576: return f'{b/1024:.1f} KB'
    return f'{b/1048576:.1f} MB'

def _fmt_time(iso):
    try:
        dt = datetime.fromisoformat(iso.replace('Z','+00:00'))
        return dt.strftime('%H:%M')
    except Exception: return ''

def _av_color(name): return AV_COLORS[hash(name or '') % len(AV_COLORS)]

def _initials(name):
    parts = (name or '?').split()
    return (''.join(p[0] for p in parts[:2])).upper() or '?'

def _all_children(w):
    result = [w]
    for c in w.winfo_children(): result.extend(_all_children(c))
    return result

def _make_avatar(parent, name, size=32, bg=None):
    bg = bg or C['bg']
    cv = tk.Canvas(parent, width=size, height=size, bg=bg,
                   highlightthickness=0, bd=0)
    col = _av_color(name)
    cv.create_oval(1,1,size-1,size-1, fill=col, outline='')
    cv.create_text(size//2, size//2, text=_initials(name),
                   fill='white', font=('Segoe UI', max(8, size//3), 'bold'))
    return cv

# Module-level avatar URL cache (shared across App instance recreations)
_AV_CACHE: dict = {}

# ── Dark Scrollbar ────────────────────────────────────────────────────────────
class DarkScrollbar(tk.Canvas):
    THUMB='#424242'; THUMB_H='#686868'; SIZE=10
    def __init__(self, parent, orient='vertical', command=None, bg=None, **kw):
        d = dict(bg=bg or C['bg'], highlightthickness=0, bd=0)
        d['width' if orient=='vertical' else 'height'] = self.SIZE
        super().__init__(parent, **d, **kw)
        self.orient=orient; self.command=command
        self._pos=(0.,1.); self._hov=False; self._drag=None; self._bg=bg or C['bg']
        self.bind('<Configure>', lambda e: self._draw())
        self.bind('<ButtonPress-1>', self._click); self.bind('<B1-Motion>', self._move)
        self.bind('<MouseWheel>', self._wheel)
        self.bind('<Enter>', lambda e: self._hover(True))
        self.bind('<Leave>', lambda e: self._hover(False))
    def set(self, lo, hi): self._pos=(float(lo), float(hi)); self._draw()
    def _draw(self):
        self.delete('all'); self.configure(bg=self._bg)
        lo,hi = self._pos
        if hi-lo>=1.: return
        col = self.THUMB_H if self._hov else self.THUMB
        if self.orient=='vertical':
            H=self.winfo_height() or 1; W=self.winfo_width()
            y0,y1 = lo*H+1, hi*H-1
            if y1-y0<16: y1=y0+16
            self.create_rectangle(2,y0,W-2,y1, fill=col, outline='')
        else:
            W=self.winfo_width() or 1; H=self.winfo_height()
            x0,x1 = lo*W+1, hi*W-1
            if x1-x0<16: x1=x0+16
            self.create_rectangle(x0,2,x1,H-2, fill=col, outline='')
    def _hover(self,s): self._hov=s; self._draw()
    def _click(self,ev):
        lo,hi=self._pos
        if self.orient=='vertical':
            T=self.winfo_height(); t0,t1=lo*T,hi*T
            if t0<=ev.y<=t1: self._drag=ev.y-t0
            else: self.command and self.command('moveto', ev.y/T)
        else:
            T=self.winfo_width(); t0,t1=lo*T,hi*T
            if t0<=ev.x<=t1: self._drag=ev.x-t0
            else: self.command and self.command('moveto', ev.x/T)
    def _move(self,ev):
        if self._drag is None: return
        f=(ev.y-self._drag)/(self.winfo_height() or 1) if self.orient=='vertical' \
          else (ev.x-self._drag)/(self.winfo_width() or 1)
        self.command and self.command('moveto', f)
    def _wheel(self,ev): self.command and self.command('scroll', -1 if ev.delta>0 else 1, 'units')

# ── API Client ────────────────────────────────────────────────────────────────
class ApiClient:
    def __init__(self): self.session = requests.Session()
    def _post(self, path, **kw):
        try: return self.session.post(f'{BASE_URL}{path}', timeout=15, **kw).json()
        except Exception as e: return {'success':False,'message':str(e)}
    # Auth
    def me(self):                        return self._post('/auth/me', json={})
    def signin(self, e, p):              return self._post('/auth/signin', json={'email':e,'password':p})
    def signout(self):                   return self._post('/auth/signout', json={})
    def signup(self, e, u, d, p):        return self._post('/auth/signup', json={'email':e,'username':u,'displayName':d,'password':p})
    def verify_otp(self, e, o):          return self._post('/auth/verify-otp', json={'email':e,'otp':o})
    # Conversations
    def conversations(self):             return self._post('/conversations/list', json={})
    def mark_read(self, cid, mid):       return self._post('/conversations/read', json={'conversationId':cid,'lastReadMessageId':mid})
    def upsert_dm(self, uid):            return self._post('/dms/upsert', json={'otherUserId':uid})
    def user_by_username(self, u):       return self._post('/users/profile', json={'username':u})
    # Messages
    def messages(self, cid, cursor=None):
        b = {'conversationId':cid,'limit':MSG_PAGE}
        if cursor: b['cursor'] = {'beforeCreatedAt': cursor}
        return self._post('/messages/list', json=b)
    def send(self, cid, text, atts=None, reply_id=None):
        b = {'conversationId':cid,'content':text,'attachments':atts or []}
        if reply_id: b['replyToMessageId'] = reply_id
        return self._post('/messages/send', json=b)
    def edit_message(self, mid, content): return self._post('/messages/edit', json={'messageId':mid,'content':content})
    def delete_message(self, mid):        return self._post('/messages/delete', json={'messageId':mid})
    def upload_file(self, filepath):
        try:
            mime = mimetypes.guess_type(filepath)[0] or 'application/octet-stream'
            with open(filepath,'rb') as f:
                r = self.session.post(f'{BASE_URL}/messages/upload',
                                      files={'file':(os.path.basename(filepath),f,mime)}, timeout=60)
            return r.json()
        except Exception as e: return {'success':False,'message':str(e)}
    def pusher_auth(self, sid, ch):
        try:
            r = self.session.post(f'{BASE_URL}/pusher/auth',
                                  data={'socket_id':sid,'channel_name':ch}, timeout=10)
            return r.text
        except Exception: return None
    # Friends
    def friends_list(self):              return self._post('/friends/list', json={})
    def friends_requests(self, t):       return self._post('/friends/requests', json={'type':t})
    def friends_send(self, q):           return self._post('/friends/send', json={'query':q})
    def friends_respond(self, rid, act): return self._post('/friends/respond', json={'requestId':rid,'action':act})
    def friends_remove(self, fid):       return self._post('/friends/remove', json={'friendId':fid})
    # Servers
    def servers_list(self):              return self._post('/servers/list', json={})
    def servers_create(self, name):      return self._post('/servers/create', json={'name':name})
    def servers_join(self, key):         return self._post('/servers/join', json={'inviteKey':key})
    def servers_leave(self, sid):        return self._post('/servers/leave', json={'serverId':sid})
    # Channels
    def channels_list(self, sid):        return self._post('/channels/list', json={'serverId':sid})
    def channels_create(self, sid, name):return self._post('/channels/create', json={'serverId':sid,'name':name})
    def channels_by_key(self, key):      return self._post('/channels/by-key', json={'channelKey':key})

# ── Pusher WebSocket ──────────────────────────────────────────────────────────
class PusherClient:
    def __init__(self, key, cluster, auth_fn):
        self.key=key; self.cluster=cluster; self.auth_fn=auth_fn
        self.socket_id=None; self.ws=None
        self._subs={}; self._ready=threading.Event(); self._lock=threading.Lock()
    def connect(self):
        url=(f'wss://ws-{self.cluster}.pusher.com/app/{self.key}'
             f'?protocol=7&client=py-vsc&version=1.0&flash=false')
        self.ws=websocket.WebSocketApp(url, on_open=self._open, on_message=self._msg,
                                       on_error=self._err, on_close=self._close)
        threading.Thread(target=self.ws.run_forever,
                         kwargs={'ping_interval':25,'ping_timeout':10}, daemon=True).start()
    def subscribe(self, ch, ev, cb):
        with self._lock: self._subs.setdefault(ch,{}).setdefault(ev,[]).append(cb)
        if self._ready.is_set(): self._do_sub(ch)
    def unsubscribe(self, ch):
        with self._lock: self._subs.pop(ch, None)
        if self.ws and self._ready.is_set():
            self._send({'event':'pusher:unsubscribe','data':{'channel':ch}})
    def disconnect(self):
        try: self.ws and self.ws.close()
        except Exception: pass
    def _send(self, obj):
        try: self.ws.send(json.dumps(obj))
        except Exception: pass
    def _do_sub(self, ch):
        if not self.socket_id: return
        resp = self.auth_fn(self.socket_id, ch)
        if not resp: return
        try: auth = json.loads(resp).get('auth','')
        except Exception: return
        self._send({'event':'pusher:subscribe','data':{'channel':ch,'auth':auth}})
    def _open(self, ws): pass
    def _err(self, ws, e): pass
    def _close(self, ws, *a): self._ready.clear(); self.socket_id=None
    def _msg(self, ws, raw):
        try: pkt=json.loads(raw)
        except Exception: return
        evt=pkt.get('event',''); ch=pkt.get('channel',''); data=pkt.get('data','')
        if isinstance(data,str):
            try: data=json.loads(data)
            except Exception: pass
        if evt=='pusher:connection_established':
            sid=(data if isinstance(data,dict) else {}).get('socket_id','')
            self.socket_id=sid; self._ready.set()
            with self._lock: chs=list(self._subs)
            for c in chs: self._do_sub(c)
        elif ch:
            with self._lock: cbs=list(self._subs.get(ch,{}).get(evt,[]))
            for cb in cbs:
                try: cb(data)
                except Exception: pass

# ── Notification Toast ────────────────────────────────────────────────────────
class NotificationToast:
    _stack = []
    def __init__(self, root, sender, preview, on_click=None):
        W,H = 320,82
        sw,sh = root.winfo_screenwidth(), root.winfo_screenheight()
        idx = len(NotificationToast._stack)
        NotificationToast._stack.append(self)
        x = sw-W-12; y = sh-H-44-idx*(H+6)
        self.win = tk.Toplevel(root)
        self.win.overrideredirect(True)
        self.win.geometry(f'{W}x{H}+{x}+{y}')
        self.win.configure(bg='#252526', highlightthickness=1, highlightbackground='#007acc')
        self.win.attributes('-topmost', True)
        self.win.attributes('-alpha', 0.95)
        self.win.deiconify()
        # Apply stealth after the OS has committed the HWND (must be deferred)
        root.after(60, lambda: _protect_win(self.win))
        tk.Label(self.win, text=f'  {APP_NAME}', bg='#252526', fg='#007acc',
                 font=('Segoe UI',8,'bold'), pady=5).pack(anchor='w')
        tk.Label(self.win, text=sender, bg='#252526', fg='#ffffff',
                 font=('Segoe UI',10,'bold'), padx=12).pack(anchor='w')
        prev = (preview[:54]+'…') if len(preview)>54 else preview
        tk.Label(self.win, text=prev, bg='#252526', fg=C['dim'],
                 font=('Segoe UI',9), padx=12).pack(anchor='w')
        for w in (self.win,)+tuple(self.win.winfo_children()):
            try: w.bind('<Button-1>', lambda e: self._click(on_click))
            except Exception: pass
        root.after(4200, self.close)
    def _click(self, cb):
        self.close()
        if cb: cb()
    def close(self):
        try: NotificationToast._stack.remove(self)
        except ValueError: pass
        try: self.win.destroy()
        except Exception: pass

# ── Loading Spinner ───────────────────────────────────────────────────────────
class Spinner(tk.Canvas):
    def __init__(self, parent, size=36, color='#007acc', bg=None):
        bg = bg or parent.cget('bg')
        super().__init__(parent, width=size, height=size, bg=bg,
                         highlightthickness=0, bd=0)
        self._sz=size; self._col=color; self._angle=0; self._running=False
    def start(self): self._running=True; self._spin()
    def stop(self): self._running=False; self.delete('all')
    def _spin(self):
        if not self._running: return
        self.delete('all')
        s=self._sz; p=4
        self.create_oval(p,p,s-p,s-p, outline=C['border'], width=3)
        self.create_arc(p,p,s-p,s-p, start=self._angle, extent=100,
                        outline=self._col, width=3, style='arc')
        self._angle=(self._angle+18)%360
        self.after(40, self._spin)

# ── Main App ──────────────────────────────────────────────────────────────────
class App:
    def __init__(self, root):
        self.root = root
        self.api  = ApiClient()
        self.pusher: PusherClient | None = None
        self.user = None
        # Navigation
        self._section = 'dm'      # dm | servers | friends
        self._active_conv = None  # {id, name, type}
        self._active_server = None
        self._servers = []
        self._convs   = []
        # Messaging state
        self._msg_widgets: dict = {}    # mid -> dict
        self._msg_data:    dict = {}    # mid -> msg dict
        self._rendered:    set  = set()
        self._oldest_cursor = None
        self._has_more = False
        self._loading_more = False
        # Selection state
        self._select_mode = False
        self._selected: set = set()
        self._hold_timer = None
        # Compose
        self._reply_to: dict | None = None
        self._pending_atts: list = []
        # Misc
        self._subscribed_ch = None
        self._signup_email  = None
        self._notif_on           = load_config().get('notifications', True)
        self._notif_hide_content = load_config().get('notif_hide_content', False)
        self._tray_icon          = None
        self._window_hidden      = False
        self._chat_loader_frame  = None
        self._img_cache: dict    = {}  # url -> PhotoImage

        # Window setup
        self.root.title(APP_NAME)
        self.root.geometry('1180x760')
        self.root.configure(bg=C['bg'])
        self.root.minsize(840,520)
        self.root.withdraw()
        self.root.update_idletasks()
        _dark_title(_get_hwnd(self.root))
        self.root.deiconify()

        self._build_menubar()
        self._build_statusbar()
        self.main = tk.Frame(self.root, bg=C['bg'])
        self.main.pack(fill=tk.BOTH, expand=True)
        self._setup_tray()
        self._register_global_hotkey()   # global Ctrl+Shift+Q — works even from tray

        # Track focus so notifications know whether app is in foreground
        self._window_focused = True
        self.root.bind('<FocusIn>',  self._on_focus_in)
        self.root.bind('<FocusOut>', lambda e: setattr(self, '_window_focused', False))

        # Local binding as fallback (window focused)
        self.root.bind('<Control-Shift-Q>', lambda e: self._toggle_tray())
        self.root.bind('<Control-Shift-q>', lambda e: self._toggle_tray())

        # Stealth after first draw
        self.root.after(400, self._do_stealth)
        self._load_icon()
        self._check_session()

    # ── Windows API ──────────────────────────────────────────────────────────
    def _on_focus_in(self, event=None):
        self._window_focused = True
        # Re-enforce stealth immediately on every focus gain —
        # Windows DWM can silently clear SetWindowDisplayAffinity when the
        # window goes to/from background.
        try:
            hwnd = _get_hwnd(self.root)
            if hwnd:
                ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_MONITOR)
        except Exception:
            pass
        self._stealth_all_open_toplevels()

    def _do_stealth(self):
        try:
            hwnd = _get_hwnd(self.root)
            if not hwnd:
                self.root.after(600, self._do_stealth)
                return
            ok = ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_MONITOR)
            if ok:
                try: self._protect_lbl.configure(text='⚡ Protected', fg='#4ec9b0')
                except Exception: pass
            else:
                try: self._protect_lbl.configure(text='⚠ Unprotected', fg='#f48771')
                except Exception: pass
                self.root.after(800, self._do_stealth)
                return
        except Exception: pass
        # Re-apply every 3 s — Windows can silently reset affinity on
        # focus changes, DWM recomposition, and display driver events.
        # Also sweep all open Toplevels on each cycle
        self._stealth_all_open_toplevels()
        self.root.after(3000, self._do_stealth)

    def _stealth_all_open_toplevels(self):
        """Apply capture-exclusion to every Toplevel that is currently open."""
        try:
            for w in self.root.winfo_children():
                if isinstance(w, tk.Toplevel):
                    try:
                        hwnd = _get_hwnd(w)
                        if hwnd:
                            ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_MONITOR)
                    except Exception:
                        pass
        except Exception:
            pass

    def _load_icon(self):
        ico = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.ico')
        try: self.root.iconbitmap(ico)
        except Exception: pass

    # ── Tray ─────────────────────────────────────────────────────────────────
    def _setup_tray(self):
        if not HAS_TRAY: return
        try:
            ico = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.ico')
            img = PILImage.open(ico).resize((64,64)) if os.path.exists(ico) \
                  else PILImage.new('RGBA',(64,64),'#007acc')
            menu = pystray.Menu(
                pystray.MenuItem(
                    'Open Visual Studio Code',
                    lambda icon, item: self.root.after(0, self._restore),
                    default=True),          # left-click on tray icon triggers this
                pystray.MenuItem(
                    'Quit',
                    lambda icon, item: self.root.after(0, self._quit)),
            )
            self._tray_icon = pystray.Icon('vsc', img, APP_NAME, menu)
            threading.Thread(target=self._tray_icon.run, daemon=True).start()
        except Exception: self._tray_icon = None
        self.root.protocol('WM_DELETE_WINDOW', self._to_tray)

    def _hide_from_taskbar(self, hwnd):
        try:
            cur = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            ctypes.windll.user32.SetWindowLongW(
                hwnd, GWL_EXSTYLE,
                (cur | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW)
        except Exception:
            pass

    def _show_in_taskbar(self, hwnd):
        try:
            cur = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            ctypes.windll.user32.SetWindowLongW(
                hwnd, GWL_EXSTYLE,
                (cur | WS_EX_APPWINDOW) & ~WS_EX_TOOLWINDOW)
        except Exception:
            pass

    def _to_tray(self):
        """Hide to tray using iconify() — never destroy the DWM surface.

        withdraw() destroys the composition surface.  deiconify() then creates
        a new one, and there is always ≥1 unprotected frame before any user-mode
        call can re-arm SetWindowDisplayAffinity on it — that is the black
        frame the user sees.

        iconify() only minimises the window; the HWND and its DWM surface stay
        alive.  SetWindowDisplayAffinity remains active with no gap at all.
        WS_EX_TOOLWINDOW hides the taskbar button so it feels like tray.
        """
        self._window_hidden  = True
        self._window_focused = False
        hwnd = _get_hwnd(self.root)
        if hwnd:
            try: ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_MONITOR)
            except Exception: pass
            self._hide_from_taskbar(hwnd)
        # Go transparent before iconify so the minimise animation shows nothing.
        try: self.root.attributes('-alpha', 0.0)
        except Exception: pass
        self.root.iconify()

    def _restore(self):
        """Restore from tray — surface was never recreated, stealth never lapsed."""
        self._window_hidden = False
        hwnd = _get_hwnd(self.root)
        if hwnd:
            self._show_in_taskbar(hwnd)
        # Restore opacity BEFORE deiconify so the very first composited frame
        # is already fully opaque AND already stealth-protected.
        try: self.root.attributes('-alpha', 1.0)
        except Exception: pass
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        # Belt-and-suspenders re-arm in case DWM touched affinity during restore.
        if hwnd:
            try: ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_MONITOR)
            except Exception: pass
        try: ctypes.windll.dwmapi.DwmFlush()
        except Exception: pass

    def _toggle_tray(self):
        if self._window_hidden:
            self._restore()
        else:
            self._to_tray()

    def _register_global_hotkey(self):
        """Register Ctrl+Shift+Q as a global hotkey via Windows API.
        Works even when the window is withdrawn (in tray)."""
        try:
            import ctypes.wintypes
            WM_HOTKEY   = 0x0312
            MOD_CTRL    = 0x0002
            MOD_SHIFT   = 0x0004
            MOD_NOREP   = 0x4000
            VK_Q        = 0x51
            def _loop():
                if ctypes.windll.user32.RegisterHotKey(
                        None, 1, MOD_CTRL | MOD_SHIFT | MOD_NOREP, VK_Q):
                    msg = ctypes.wintypes.MSG()
                    while True:
                        ret = ctypes.windll.user32.GetMessageW(
                                ctypes.byref(msg), None, 0, 0)
                        if ret <= 0: break
                        if msg.message == WM_HOTKEY and msg.wParam == 1:
                            self.root.after(0, self._toggle_tray)
            threading.Thread(target=_loop, daemon=True).start()
        except Exception:
            pass  # non-Windows or no permission

    # ── Loading indicators ────────────────────────────────────────────────────
    _SPIN_FRAMES = ('⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏')

    def _show_chat_loader(self):
        """Overlay a centered spinner on the chat area while messages load."""
        self._hide_chat_loader()
        try:
            parent = self.chat_wrap
        except AttributeError:
            return
        f = tk.Frame(parent, bg=C['bg'])
        f.place(relx=0, rely=0, relwidth=1, relheight=1)
        self._chat_loader_frame = f
        lbl = tk.Label(f, text='⠋  Loading messages…', bg=C['bg'],
                       fg=C['dim'], font=('Segoe UI', 10))
        lbl.place(relx=0.5, rely=0.5, anchor='center')
        self._animate_chat_loader(lbl)

    def _animate_chat_loader(self, lbl, idx=0):
        try:
            lbl.configure(text=f'{self._SPIN_FRAMES[idx]}  Loading messages…')
            self.root.after(80, self._animate_chat_loader, lbl, (idx+1) % len(self._SPIN_FRAMES))
        except Exception:
            pass

    def _hide_chat_loader(self):
        if self._chat_loader_frame:
            try: self._chat_loader_frame.destroy()
            except Exception: pass
            self._chat_loader_frame = None

    def _show_sidebar_loader(self, parent):
        """Add an animated loading label inside a sidebar list frame."""
        lbl = tk.Label(parent, text='⠋  Loading…', bg=C['sidebar'],
                       fg=C['dim'], font=('Segoe UI', 9))
        lbl.pack(pady=14)
        self._animate_sidebar_loader(lbl)
        return lbl

    def _animate_sidebar_loader(self, lbl, idx=0):
        try:
            lbl.configure(text=f'{self._SPIN_FRAMES[idx]}  Loading…')
            self.root.after(80, self._animate_sidebar_loader, lbl, (idx+1) % len(self._SPIN_FRAMES))
        except Exception:
            pass

    def _quit(self):
        if self._tray_icon:
            try: self._tray_icon.stop()
            except Exception: pass
        self.root.destroy()

    # ── Menu bar ─────────────────────────────────────────────────────────────
    def _build_menubar(self):
        bar = tk.Frame(self.root, bg=MB_BG, height=30)
        bar.pack(fill=tk.X, side=tk.TOP); bar.pack_propagate(False)
        self._mb_open = self._mb_btn = None

        def close_open():
            if self._mb_open: self._mb_open.unpost()
            if self._mb_btn:  self._mb_btn.configure(bg=MB_BG)
            self._mb_open = self._mb_btn = None

        def make_menu(label, items):
            m = tk.Menu(self.root, tearoff=False, bg='#2d2d2d', fg=C['fg'],
                        activebackground=C['highlight'], activeforeground='#fff',
                        borderwidth=1, relief='flat', font=('Segoe UI',9))
            for it in items:
                if it=='---': m.add_separator(background=C['border'])
                else: m.add_command(label=it[0], command=it[1],
                                    activebackground=C['highlight'], activeforeground='#fff')
            btn = tk.Label(bar, text=label, bg=MB_BG, fg=C['fg'],
                           font=('Segoe UI',9), padx=10, pady=5, cursor='hand2')
            btn.pack(side=tk.LEFT)
            def show(ev, b=btn, menu=m):
                if self._mb_open is menu: close_open(); return
                close_open(); self._mb_open=menu; self._mb_btn=b
                b.configure(bg=MB_HOV)
                menu.post(b.winfo_rootx(), b.winfo_rooty()+b.winfo_height())
            def enter(ev, b=btn):
                b.configure(bg=MB_HOV)
                if self._mb_open and self._mb_open is not m: show(ev)
            def leave(ev, b=btn):
                if self._mb_btn is not b: b.configure(bg=MB_BG)
            btn.bind('<Button-1>', show); btn.bind('<Enter>', enter); btn.bind('<Leave>', leave)

        make_menu('File', [('Sign Out', self._signout), '---', ('Exit', self._quit)])
        make_menu('View', [('Friends', lambda: self._switch('friends')),
                           ('Servers', lambda: self._switch('servers')),
                           ('Messages', lambda: self._switch('dm'))])
        make_menu('Help', [('Help & Shortcuts', self._help_dialog),
                           ('About',           self._about_dialog)])

    # ── Status bar ────────────────────────────────────────────────────────────
    def _build_statusbar(self):
        sb = tk.Frame(self.root, bg=SB_BG, height=22)
        sb.pack(side=tk.BOTTOM, fill=tk.X); sb.pack_propagate(False)
        DIV='#005999'; FNT=('Segoe UI',9)
        def item(t, side=tk.LEFT, fg='#fff', padx=10):
            l = tk.Label(sb, text=t, bg=SB_BG, fg=fg, font=FNT, padx=padx)
            l.pack(side=side, fill=tk.Y); return l
        def div(side=tk.LEFT): tk.Frame(sb,bg=DIV,width=1).pack(side=side,fill=tk.Y,pady=2)
        self._protect_lbl = item('⚡ Protected'); div()
        self._user_lbl = item('Not signed in'); div()
        self._conn_lbl = item('●  Offline', side=tk.RIGHT, fg='#888')

    # ── Session ───────────────────────────────────────────────────────────────
    def _check_session(self):
        self._show_splash()
        def task():
            r = self.api.me()
            def cb():
                if r.get('success') and r.get('data'):
                    self.user=r['data']; self._on_auth()
                else: self._show_auth('login')
            self.root.after(0, cb)
        threading.Thread(target=task, daemon=True).start()

    def _show_splash(self):
        for w in self.main.winfo_children(): w.destroy()
        f = tk.Frame(self.main, bg=C['bg'])
        f.place(relx=0.5, rely=0.5, anchor='center')
        tk.Label(f, text=APP_NAME, bg=C['bg'], fg='#007acc',
                 font=('Segoe UI',28,'bold')).pack()
        tk.Label(f, text='', bg=C['bg'], fg=C['dim'],
                 font=('Segoe UI',1)).pack(pady=(0,8))
        sp = Spinner(f, 40, '#007acc', C['bg'])
        sp.pack(); sp.start()

    # ── Auth ──────────────────────────────────────────────────────────────────
    def _show_auth(self, mode='login'):
        for w in self.main.winfo_children(): w.destroy()
        {'login':self._build_login,'signup':self._build_signup,'otp':self._build_otp}[mode]()

    def _auth_card(self, title, subtitle=''):
        outer = tk.Frame(self.main, bg=C['bg'])
        outer.place(relx=0,rely=0,relwidth=1,relheight=1)
        brand = tk.Frame(outer, bg=C['bg'])
        brand.place(relx=0.5, rely=0.28, anchor='center')
        tk.Label(brand, text=APP_NAME, bg=C['bg'], fg='#007acc',
                 font=('Segoe UI',22,'bold')).pack()
        tk.Label(brand, text='', bg=C['bg'], fg=C['dim'],
                 font=('Segoe UI',1)).pack(pady=(0,2))
        card = tk.Frame(outer, bg='#252526', padx=36, pady=30,
                        highlightthickness=1, highlightbackground=C['border'])
        card.place(relx=0.5, rely=0.6, anchor='center', width=420)
        tk.Label(card, text=title, bg='#252526', fg=C['fg'],
                 font=('Segoe UI',16,'bold')).pack(anchor='w')
        if subtitle:
            tk.Label(card, text=subtitle, bg='#252526', fg=C['dim'],
                     font=('Segoe UI',9)).pack(anchor='w', pady=(3,12))
        else: tk.Frame(card, bg='#252526', height=12).pack()
        return card

    def _field(self, parent, label, show=None):
        tk.Label(parent, text=label, bg='#252526', fg=C['dim'],
                 font=('Segoe UI',9)).pack(anchor='w', pady=(10,2))
        var = tk.StringVar()
        e = tk.Entry(parent, textvariable=var, bg=C['input_bg'], fg=C['fg'],
                     insertbackground=C['fg'], font=('Consolas',11), relief='flat',
                     borderwidth=0, highlightthickness=1, highlightbackground=C['border'],
                     highlightcolor='#007acc', show=show or '')
        e.pack(fill=tk.X, ipady=7, padx=1)
        return var, e

    def _btn(self, parent, text, cmd, pady=(18,0)):
        b = tk.Button(parent, text=text, command=cmd, bg=C['btn'], fg='#fff',
                      activebackground=C['btn_hov'], activeforeground='#fff',
                      font=('Segoe UI',10,'bold'), relief='flat', borderwidth=0,
                      cursor='hand2', pady=9)
        b.pack(fill=tk.X, pady=pady)
        b.bind('<Enter>', lambda e: b.configure(bg=C['btn_hov']))
        b.bind('<Leave>', lambda e: b.configure(bg=C['btn']))
        return b

    def _err_lbl(self, parent):
        l = tk.Label(parent, text='', bg='#252526', fg=C['error'],
                     font=('Segoe UI',9), wraplength=360)
        l.pack(pady=(10,0)); return l

    def _link(self, parent, prompt, link_text, cmd):
        row = tk.Frame(parent, bg='#252526'); row.pack(pady=(14,0))
        tk.Label(row, text=prompt, bg='#252526', fg=C['dim'],
                 font=('Segoe UI',9)).pack(side=tk.LEFT)
        lnk = tk.Label(row, text=link_text, bg='#252526', fg='#007acc',
                        font=('Segoe UI',9,'underline'), cursor='hand2')
        lnk.pack(side=tk.LEFT); lnk.bind('<Button-1>', lambda e: cmd())

    def _build_login(self):
        card = self._auth_card('Welcome back', f'Sign in to {APP_NAME}')
        ev,ee = self._field(card,'Email')
        pv,pe = self._field(card,'Password', show='●')
        err   = self._err_lbl(card)
        sp_row = tk.Frame(card, bg='#252526'); sp_row.pack(pady=(14,0))
        sp = Spinner(sp_row, 28, '#007acc', '#252526')

        def do():
            err.configure(text=''); sp.pack(); sp.start()
            e,p = ev.get().strip(), pv.get()
            if not e or not p:
                sp.stop(); sp.pack_forget()
                err.configure(text='Please fill in all fields.'); return
            def task():
                r = self.api.signin(e,p)
                def cb():
                    sp.stop(); sp.pack_forget()
                    if r.get('success'): self.user=r['data']; self._on_auth()
                    else: err.configure(text=r.get('message','Sign in failed.'))
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()

        self._btn(card,'Sign In', do)
        self._link(card,"Don't have an account?",' Sign up', lambda: self._show_auth('signup'))
        ee.bind('<Return>', lambda e: pe.focus_set())
        pe.bind('<Return>', lambda e: do())
        ee.focus_set()

    def _build_signup(self):
        card = self._auth_card('Create account', f'Join {APP_NAME}')
        ev,ee = self._field(card,'Email')
        uv,ue = self._field(card,'Username  (3–20 chars)')
        dv,de = self._field(card,'Display Name')
        pv,pe = self._field(card,'Password  (min 8 chars)', show='●')
        err   = self._err_lbl(card)
        sp_row = tk.Frame(card,bg='#252526'); sp_row.pack(pady=(14,0))
        sp = Spinner(sp_row,28,'#007acc','#252526')

        def do():
            err.configure(text=''); sp.pack(); sp.start()
            e,u,d,p = ev.get().strip(),uv.get().strip(),dv.get().strip(),pv.get()
            if not all([e,u,d,p]):
                sp.stop(); sp.pack_forget()
                err.configure(text='Please fill in all fields.'); return
            def task():
                r = self.api.signup(e,u,d,p)
                def cb():
                    sp.stop(); sp.pack_forget()
                    if r.get('success'): self._signup_email=e; self._show_auth('otp')
                    else: err.configure(text=r.get('message','Signup failed.'))
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()

        self._btn(card,'Create Account', do)
        self._link(card,'Already have an account?',' Sign in', lambda: self._show_auth('login'))
        ee.bind('<Return>', lambda e: ue.focus_set())
        ue.bind('<Return>', lambda e: de.focus_set())
        de.bind('<Return>', lambda e: pe.focus_set())
        pe.bind('<Return>', lambda e: do())
        ee.focus_set()

    def _build_otp(self):
        email = self._signup_email or ''
        card  = self._auth_card('Verify your email', f'Enter the 6-digit code sent to {email}')
        ov,oe = self._field(card,'Verification Code')
        err   = self._err_lbl(card)
        sp_row = tk.Frame(card,bg='#252526'); sp_row.pack(pady=(14,0))
        sp = Spinner(sp_row,28,'#007acc','#252526')

        def do():
            err.configure(text=''); sp.pack(); sp.start()
            otp = ov.get().strip()
            if len(otp)!=6 or not otp.isdigit():
                sp.stop(); sp.pack_forget()
                err.configure(text='Enter the 6-digit code.'); return
            def task():
                r = self.api.verify_otp(email,otp)
                def cb():
                    sp.stop(); sp.pack_forget()
                    if r.get('success'): self.user=r['data']; self._on_auth()
                    else: err.configure(text=r.get('message','Verification failed.'))
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()

        self._btn(card,'Verify & Sign In', do)
        self._link(card,'','← Back to sign in', lambda: self._show_auth('login'))
        oe.bind('<Return>', lambda e: do()); oe.focus_set()

    # ── Post-auth ─────────────────────────────────────────────────────────────
    def _on_auth(self):
        self._user_lbl.configure(
            text=f'@{self.user.get("username","")}  ·  {self.user.get("displayName","")}')
        self._conn_lbl.configure(text='●  Connecting…', fg='#f0c040')
        self._init_pusher()
        self._show_messenger()

    def _init_pusher(self):
        self.pusher = PusherClient(PUSHER_KEY, PUSHER_CLUSTER, self.api.pusher_auth)
        self.pusher.connect()
        def _wait():
            self.pusher._ready.wait(timeout=8)
            def cb():
                ok = self.pusher and self.pusher._ready.is_set()
                self._conn_lbl.configure(
                    text='●  Connected' if ok else '●  Offline',
                    fg='#4ec9b0' if ok else '#f48771')
            self.root.after(0,cb)
        threading.Thread(target=_wait, daemon=True).start()

    def _signout(self):
        def task():
            self.api.signout()
            def cb():
                if self.pusher: self.pusher.disconnect(); self.pusher=None
                self.user=None; self._active_conv=None
                self._user_lbl.configure(text='Not signed in')
                self._conn_lbl.configure(text='●  Offline', fg='#888')
                self._show_auth('login')
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    # ── Messenger Layout ──────────────────────────────────────────────────────
    def _show_messenger(self):
        for w in self.main.winfo_children(): w.destroy()
        self._build_actbar()
        self.sidebar = tk.Frame(self.main, bg=C['sidebar'], width=256)
        self.sidebar.pack(side=tk.LEFT, fill=tk.Y); self.sidebar.pack_propagate(False)
        self._build_chat_area()
        self._switch('dm', rebuild_sidebar=True)

    # ── Activity Bar ──────────────────────────────────────────────────────────
    def _build_actbar(self):
        bar = tk.Frame(self.main, bg=C['actbar'], width=50)
        bar.pack(side=tk.LEFT, fill=tk.Y); bar.pack_propagate(False)
        self._act_btns = {}

        def icon_btn(sym, section=None, cmd=None, side=tk.TOP):
            l = tk.Label(bar, text=sym, bg=C['actbar'], fg=C['icon'],
                         font=('Segoe UI Symbol',18), width=2, pady=12, cursor='hand2')
            l.pack(side=side, pady=1)
            def click(e):
                if section: self._switch(section)
                elif cmd: cmd()
            l.bind('<Button-1>', click)
            l.bind('<Enter>', lambda e,lb=l: lb.configure(fg=C['icon_act']))
            l.bind('<Leave>', lambda e,lb=l: lb.configure(
                fg=C['icon_act'] if (section and self._section==section) else C['icon']))
            if section: self._act_btns[section] = l
            return l

        icon_btn('💬', 'dm')
        icon_btn('🖥', 'servers')
        icon_btn('👥', 'friends')
        icon_btn('🌐', 'browser')
        icon_btn('⚙', cmd=self._settings_dialog, side=tk.BOTTOM)

    def _update_actbar(self):
        for sec,lbl in self._act_btns.items():
            lbl.configure(fg=C['icon_act'] if sec==self._section else C['icon'])

    def _switch(self, section, rebuild_sidebar=False):
        self._section = section
        self._update_actbar()
        self._rebuild_sidebar()

    # ── Sidebar ───────────────────────────────────────────────────────────────
    def _rebuild_sidebar(self):
        for w in self.sidebar.winfo_children(): w.destroy()
        if self._section == 'dm':         self._build_dm_sidebar()
        elif self._section == 'servers':  self._build_server_sidebar()
        elif self._section == 'friends':  self._build_friends_sidebar()
        elif self._section == 'browser':  self._build_browser_sidebar()

    def _sb_header(self, text, btn_text=None, btn_cmd=None):
        hdr = tk.Frame(self.sidebar, bg='#1e1e1e', height=54)
        hdr.pack(fill=tk.X); hdr.pack_propagate(False)
        av = self._avatar_widget(hdr, self.user.get('displayName','?'),
                                 self.user.get('avatarUrl',''), 28, '#1e1e1e')
        av.pack(side=tk.LEFT, padx=10, pady=12)
        nf = tk.Frame(hdr, bg='#1e1e1e'); nf.pack(side=tk.LEFT, fill=tk.Y, pady=12)
        tk.Label(nf, text=self.user.get('displayName',''), bg='#1e1e1e', fg=C['fg'],
                 font=('Segoe UI',10,'bold'), anchor='w').pack(anchor='w')
        tk.Label(nf, text=f'@{self.user.get("username","")}', bg='#1e1e1e', fg=C['dim'],
                 font=('Segoe UI',8), anchor='w').pack(anchor='w')
        tk.Frame(self.sidebar, bg=C['border'], height=1).pack(fill=tk.X)
        sec = tk.Frame(self.sidebar, bg=C['sidebar'], height=36)
        sec.pack(fill=tk.X); sec.pack_propagate(False)
        tk.Label(sec, text=text, bg=C['sidebar'], fg=C['dim'],
                 font=('Segoe UI',8,'bold'), padx=12).pack(side=tk.LEFT, pady=10)
        if btn_text and btn_cmd:
            plus = tk.Label(sec, text=btn_text, bg=C['sidebar'], fg=C['dim'],
                            font=('Segoe UI',16), padx=12, cursor='hand2')
            plus.pack(side=tk.RIGHT, pady=2)
            plus.bind('<Button-1>', lambda e: btn_cmd())
            plus.bind('<Enter>', lambda e: plus.configure(fg=C['fg']))
            plus.bind('<Leave>', lambda e: plus.configure(fg=C['dim']))

    def _sb_scroll_area(self):
        wrap = tk.Frame(self.sidebar, bg=C['sidebar'])
        wrap.pack(fill=tk.BOTH, expand=True)
        vsb = DarkScrollbar(wrap, orient='vertical', bg=C['sidebar']); vsb.pack(side=tk.RIGHT, fill=tk.Y)
        cv = tk.Canvas(wrap, bg=C['sidebar'], highlightthickness=0, bd=0, yscrollcommand=vsb.set)
        vsb.command = cv.yview; cv.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        frm = tk.Frame(cv, bg=C['sidebar'])
        win = cv.create_window(0,0, anchor='nw', window=frm)
        cv.bind('<Configure>', lambda e: cv.itemconfig(win, width=e.width))
        frm.bind('<Configure>', lambda e: cv.configure(scrollregion=cv.bbox('all')))
        cv.bind('<MouseWheel>', lambda e: cv.yview_scroll(-1 if e.delta>0 else 1,'units'))
        return frm

    # ── DM Sidebar ────────────────────────────────────────────────────────────
    def _build_dm_sidebar(self):
        self._sb_header('DIRECT MESSAGES', '+', self._new_dm_dialog)
        self.conv_list = self._sb_scroll_area()
        self.load_conversations()

    def load_conversations(self):
        try:
            for w in self.conv_list.winfo_children(): w.destroy()
            self._show_sidebar_loader(self.conv_list)
        except Exception: pass
        def task():
            r = self.api.conversations()
            def cb():
                try:
                    for w in self.conv_list.winfo_children(): w.destroy()
                except Exception: pass
                if not r.get('success'): return
                self._convs = r.get('data',[])
                for conv in self._convs:
                    self._render_conv_item(conv)
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    def _render_conv_item(self, conv):
        # Only show DM conversations in the DM sidebar
        if conv.get('type') != 'dm':
            return
        cid = str(conv.get('conversationId',''))
        name = conv.get('title','') or 'DM'
        unread = 1 if conv.get('unread') else 0
        is_active = self._active_conv and self._active_conv.get('id') == cid

        row = tk.Frame(self.conv_list, bg=C['highlight'] if is_active else C['sidebar'],
                       cursor='hand2', pady=0)
        row.pack(fill=tk.X)

        inner = tk.Frame(row, bg=row.cget('bg'), padx=10, pady=8)
        inner.pack(fill=tk.X)

        av = _make_avatar(inner, name, 34, inner.cget('bg'))
        av.pack(side=tk.LEFT, anchor='n', pady=1)

        info = tk.Frame(inner, bg=inner.cget('bg')); info.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(8,4))
        top = tk.Frame(info, bg=info.cget('bg')); top.pack(fill=tk.X)
        tk.Label(top, text=name, bg=info.cget('bg'), fg=C['fg'],
                 font=('Segoe UI',10,'bold'), anchor='w').pack(side=tk.LEFT)
        if unread:
            badge = tk.Label(info, text='●', bg=C['sidebar'], fg='#007acc',
                             font=('Segoe UI',10,'bold'), padx=4)
            badge.pack(side=tk.RIGHT, anchor='center')

        def click(e, c=conv):
            self._select_conv(c)
        def hover(e, r=row, i=inner, inf=info, t=top):
            bg = C['hover'] if not (self._active_conv and self._active_conv.get('id')==cid) else C['highlight']
            for w in _all_children(r):
                try: w.configure(bg=bg)
                except Exception: pass
        def leave(e, r=row):
            bg = C['highlight'] if (self._active_conv and self._active_conv.get('id')==cid) else C['sidebar']
            for w in _all_children(r):
                try: w.configure(bg=bg)
                except Exception: pass

        for w in _all_children(row):
            try:
                w.bind('<Button-1>', click)
                w.bind('<Enter>', hover)
                w.bind('<Leave>', leave)
            except Exception: pass

    def _select_conv(self, conv):
        self._active_conv = {
            'id':   str(conv.get('conversationId','')),
            'name': conv.get('title','') or 'DM',
            'type': conv.get('type','dm'),
        }
        self._update_chat_header()
        self._rebuild_sidebar()
        self._load_messages()

    def _new_dm_dialog(self):
        dlg = tk.Toplevel(self.root)
        dlg.title('New Direct Message'); dlg.geometry('380x180')
        dlg.configure(bg='#252526')
        dlg.resizable(False,False); dlg.grab_set()
        self.root.after(50, lambda: _protect_win(dlg))
        tk.Label(dlg, text='Start a conversation', bg='#252526', fg=C['fg'],
                 font=('Segoe UI',14,'bold')).pack(pady=(20,4))
        tk.Label(dlg, text='Enter username', bg='#252526', fg=C['dim'],
                 font=('Segoe UI',9)).pack()
        var = tk.StringVar()
        e = tk.Entry(dlg, textvariable=var, bg=C['input_bg'], fg=C['fg'],
                     insertbackground=C['fg'], font=('Consolas',11), relief='flat',
                     highlightthickness=1, highlightbackground=C['border'], highlightcolor='#007acc')
        e.pack(fill=tk.X, padx=24, ipady=7, pady=8)
        err = tk.Label(dlg, text='', bg='#252526', fg=C['error'], font=('Segoe UI',9))
        err.pack()
        def go():
            username = var.get().strip()
            if not username: err.configure(text='Enter a username.'); return
            def task():
                r = self.api.user_by_username(username)
                def cb():
                    if not r.get('success') or not r.get('data'):
                        err.configure(text='User not found.'); return
                    uid = r['data'].get('id') or r['data'].get('_id')
                    def task2():
                        r2 = self.api.upsert_dm(uid)
                        def cb2():
                            if r2.get('success') and r2.get('data'):
                                dlg.destroy(); self.load_conversations()
                                d2 = r2['data']
                                self._select_conv({
                                    'conversationId': d2.get('conversationId',''),
                                    'title': r['data'].get('displayName','DM'),
                                    'type': 'dm',
                                })
                            else: err.configure(text=r2.get('message','Failed.'))
                        self.root.after(0,cb2)
                    threading.Thread(target=task2,daemon=True).start()
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()
        e.bind('<Return>', lambda ev: go())
        self._btn(dlg,'Open DM', go, pady=(0,0))
        e.focus_set()

    # ── Server Sidebar ────────────────────────────────────────────────────────
    def _build_server_sidebar(self):
        self._sb_header('SERVERS', '+', self._server_options)
        self.server_list = self._sb_scroll_area()
        # NOTE: do NOT reset _active_server here — preserve selection across rebuilds
        self.load_servers()

    def load_servers(self):
        try:
            for w in self.server_list.winfo_children(): w.destroy()
            self._show_sidebar_loader(self.server_list)
        except Exception: pass
        def task():
            r = self.api.servers_list()
            def cb():
                try:
                    for w in self.server_list.winfo_children(): w.destroy()
                except Exception: pass
                if not r.get('success'): return
                self._servers = r.get('data',[])
                for s in self._servers: self._render_server_item(s)
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    def _render_server_item(self, srv):
        sid = srv.get('id','')
        name = srv.get('name','Server')
        is_sel = self._active_server and self._active_server.get('id')==sid

        wrap = tk.Frame(self.server_list, bg=C['sidebar'])
        wrap.pack(fill=tk.X)

        row = tk.Frame(wrap, bg=C['highlight'] if is_sel else C['sidebar'], cursor='hand2')
        row.pack(fill=tk.X)
        inner = tk.Frame(row, bg=row.cget('bg'), padx=10, pady=8)
        inner.pack(fill=tk.X)

        av_c = tk.Canvas(inner, width=36, height=36, bg=inner.cget('bg'),
                         highlightthickness=0, bd=0)
        av_c.pack(side=tk.LEFT, anchor='n')
        col = _av_color(name)
        av_c.create_oval(1,1,35,35, fill=col, outline='')
        av_c.create_text(18,18, text=_initials(name), fill='white',
                         font=('Segoe UI',11,'bold'))

        info = tk.Frame(inner, bg=inner.cget('bg'))
        info.pack(side=tk.LEFT, padx=8, fill=tk.X, expand=True)
        tk.Label(info, text=name, bg=info.cget('bg'), fg=C['fg'],
                 font=('Segoe UI',10,'bold'), anchor='w').pack(anchor='w')
        mc = srv.get('memberCount',0)
        tk.Label(info, text=f'{mc} member{"s" if mc!=1 else ""}', bg=info.cget('bg'),
                 fg=C['dim'], font=('Segoe UI',8)).pack(anchor='w')

        # Channel list area
        ch_frame = tk.Frame(wrap, bg=C['bg'])

        def click(e, s=srv):
            if self._active_server and self._active_server.get('id') == s.get('id'):
                self._active_server = None   # toggle off
            else:
                self._active_server = s
            self._rebuild_sidebar()

        def hover(e, r=row):
            if not (self._active_server and self._active_server.get('id')==sid):
                for c in _all_children(r):
                    try: c.configure(bg=C['hover'])
                    except Exception: pass
        def leave(e, r=row):
            bg = C['highlight'] if (self._active_server and self._active_server.get('id')==sid) else C['sidebar']
            for c in _all_children(r):
                try: c.configure(bg=bg)
                except Exception: pass

        for w in _all_children(row):
            try:
                w.bind('<Button-1>', click)
                w.bind('<Enter>', hover); w.bind('<Leave>', leave)
            except Exception: pass

        if is_sel:
            ch_frame.pack(fill=tk.X)
            self._load_channels(sid, ch_frame)

    def _load_channels(self, sid, parent):
        def task():
            r = self.api.channels_list(sid)
            def cb():
                if not r.get('success'): return
                for ch in r.get('data',[]):
                    self._render_channel_item(parent, ch, sid)
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    def _render_channel_item(self, parent, ch, sid):
        ch_id = ch.get('id',''); ch_name = ch.get('name','channel')
        ch_key = ch.get('channelKey','')
        is_active = (self._active_conv and
                     self._active_conv.get('channel_key') == ch_key)

        row = tk.Frame(parent, bg=C['highlight'] if is_active else C['bg'],
                       cursor='hand2')
        row.pack(fill=tk.X)
        inner = tk.Frame(row, bg=row.cget('bg'), padx=24, pady=5)
        inner.pack(fill=tk.X)
        tk.Label(inner, text='#', bg=inner.cget('bg'), fg=C['dim'],
                 font=('Segoe UI',10)).pack(side=tk.LEFT)
        tk.Label(inner, text=ch_name, bg=inner.cget('bg'), fg=C['fg'],
                 font=('Segoe UI',10), padx=4).pack(side=tk.LEFT)

        def click(e, key=ch_key, name=ch_name):
            def task():
                r = self.api.channels_by_key(key)
                def cb():
                    if r.get('success') and r.get('data'):
                        d = r['data']
                        self._active_conv = {
                            'id': str(d.get('conversationId','')),
                            'name': f'# {name}',
                            'type': 'channel',
                            'channel_key': key,
                        }
                        self._update_chat_header()
                        self._load_messages()
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()

        def hover(e, r=row):
            if not is_active:
                for c in _all_children(r):
                    try: c.configure(bg=C['hover'])
                    except Exception: pass
        def leave(e, r=row):
            bg = C['highlight'] if is_active else C['bg']
            for c in _all_children(r):
                try: c.configure(bg=bg)
                except Exception: pass

        for w in _all_children(row):
            try:
                w.bind('<Button-1>', click)
                w.bind('<Enter>', hover); w.bind('<Leave>', leave)
            except Exception: pass

    def _server_options(self):
        dlg = tk.Toplevel(self.root); dlg.title('Server')
        dlg.geometry('320x200'); dlg.configure(bg='#252526')
        dlg.resizable(False,False); dlg.grab_set()
        self.root.after(50, lambda: _protect_win(dlg))
        tk.Label(dlg, text='Add Server', bg='#252526', fg=C['fg'],
                 font=('Segoe UI',14,'bold')).pack(pady=(18,4))
        self._btn(dlg, 'Create New Server', lambda: (dlg.destroy(), self._create_server_dialog()), pady=(12,4))
        self._btn(dlg, 'Join with Invite Key', lambda: (dlg.destroy(), self._join_server_dialog()), pady=(4,0))

    def _create_server_dialog(self):
        dlg = tk.Toplevel(self.root); dlg.title('Create Server')
        dlg.geometry('360x180'); dlg.configure(bg='#252526')
        dlg.resizable(False,False); dlg.grab_set()
        self.root.after(50, lambda: _protect_win(dlg))
        tk.Label(dlg, text='Create a server', bg='#252526', fg=C['fg'],
                 font=('Segoe UI',14,'bold')).pack(pady=(18,4))
        var = tk.StringVar()
        e = tk.Entry(dlg, textvariable=var, bg=C['input_bg'], fg=C['fg'],
                     insertbackground=C['fg'], font=('Consolas',11), relief='flat',
                     highlightthickness=1, highlightbackground=C['border'], highlightcolor='#007acc')
        e.pack(fill=tk.X, padx=24, ipady=7, pady=8)
        err = tk.Label(dlg, text='', bg='#252526', fg=C['error'], font=('Segoe UI',9)); err.pack()
        def go():
            name = var.get().strip()
            if not name: err.configure(text='Enter a server name.'); return
            def task():
                r = self.api.servers_create(name)
                def cb():
                    if r.get('success'): dlg.destroy(); self.load_servers()
                    else: err.configure(text=r.get('message','Failed.'))
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()
        e.bind('<Return>', lambda ev: go())
        self._btn(dlg,'Create', go, pady=(0,0)); e.focus_set()

    def _join_server_dialog(self):
        dlg = tk.Toplevel(self.root); dlg.title('Join Server')
        dlg.geometry('360x180'); dlg.configure(bg='#252526')
        dlg.resizable(False,False); dlg.grab_set()
        self.root.after(50, lambda: _protect_win(dlg))
        tk.Label(dlg, text='Join a server', bg='#252526', fg=C['fg'],
                 font=('Segoe UI',14,'bold')).pack(pady=(18,4))
        var = tk.StringVar()
        e = tk.Entry(dlg, textvariable=var, bg=C['input_bg'], fg=C['fg'],
                     insertbackground=C['fg'], font=('Consolas',11), relief='flat',
                     highlightthickness=1, highlightbackground=C['border'], highlightcolor='#007acc')
        e.pack(fill=tk.X, padx=24, ipady=7, pady=8)
        err = tk.Label(dlg, text='', bg='#252526', fg=C['error'], font=('Segoe UI',9)); err.pack()
        def go():
            key = var.get().strip()
            if not key: err.configure(text='Enter an invite key.'); return
            def task():
                r = self.api.servers_join(key)
                def cb():
                    if r.get('success'): dlg.destroy(); self.load_servers()
                    else: err.configure(text=r.get('message','Failed.'))
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()
        e.bind('<Return>', lambda ev: go())
        self._btn(dlg,'Join', go, pady=(0,0)); e.focus_set()

    # ── Friends Sidebar ───────────────────────────────────────────────────────
    def _build_friends_sidebar(self):
        self._sb_header('FRIENDS', None, None)
        # Tabs
        tab_row = tk.Frame(self.sidebar, bg='#1e1e1e')
        tab_row.pack(fill=tk.X)
        self._friends_tab = tk.StringVar(value='friends')
        tab_labels = {}

        def mk_tab(text, key):
            lbl = tk.Label(tab_row, text=text, bg='#1e1e1e',
                           fg='#007acc' if key=='friends' else C['dim'],
                           font=('Segoe UI',9), padx=10, pady=6, cursor='hand2')
            lbl.pack(side=tk.LEFT)
            tab_labels[key] = lbl
            def click(e, k=key):
                self._friends_tab.set(k)
                for kk,ll in tab_labels.items():
                    ll.configure(fg='#007acc' if kk==k else C['dim'])
                load_tab(k)
            lbl.bind('<Button-1>', click)

        mk_tab('Friends', 'friends')
        mk_tab('Requests', 'requests')
        mk_tab('Add', 'add')
        tk.Frame(self.sidebar, bg=C['border'], height=1).pack(fill=tk.X)

        self.friends_list_frame = self._sb_scroll_area()

        def load_tab(tab):
            for w in self.friends_list_frame.winfo_children(): w.destroy()
            if tab == 'friends':    self._load_friends()
            elif tab == 'requests': self._load_friend_requests()
            elif tab == 'add':      self._build_add_friend()

        load_tab('friends')

    # ── Browser sidebar ───────────────────────────────────────────────────────
    _BOOKMARKS = [
        ('ChatGPT',            'https://chatgpt.com'),
        ('Claude',             'https://claude.ai'),
        ('Gemini',             'https://gemini.google.com'),
        ('GitHub Copilot',     'https://github.com/features/copilot'),
        ('Google',             'https://www.google.com'),
        ('GitHub',             'https://github.com'),
        ('Stack Overflow',     'https://stackoverflow.com'),
        ('MDN Web Docs',       'https://developer.mozilla.org'),
        ('YouTube',            'https://www.youtube.com'),
    ]

    def _build_browser_sidebar(self):
        self._sb_header('BROWSER')
        body = tk.Frame(self.sidebar, bg=C['sidebar'])
        body.pack(fill=tk.BOTH, expand=True)

        # ── URL bar ───────────────────────────────────────────────────────
        url_frame = tk.Frame(body, bg=C['sidebar'])
        url_frame.pack(fill=tk.X, padx=10, pady=(12, 6))
        tk.Label(url_frame, text='URL', bg=C['sidebar'], fg=C['dim'],
                 font=('Segoe UI', 8)).pack(anchor='w', pady=(0, 3))

        entry_wrap = tk.Frame(url_frame, bg='#3c3c3c',
                              highlightthickness=1, highlightbackground=C['border'],
                              highlightcolor='#007acc')
        entry_wrap.pack(fill=tk.X)
        self._browser_url = tk.StringVar(value='https://')
        url_entry = tk.Entry(entry_wrap, textvariable=self._browser_url,
                             bg='#3c3c3c', fg=C['fg'], insertbackground=C['fg'],
                             relief='flat', font=('Segoe UI', 9),
                             highlightthickness=0)
        url_entry.pack(fill=tk.X, padx=8, pady=6)
        url_entry.bind('<Return>', lambda e: self._open_url(self._browser_url.get().strip()))

        go_btn = tk.Button(url_frame, text='Open →',
                           bg=C['btn'], fg='#fff', activebackground=C['btn_hov'],
                           activeforeground='#fff', relief='flat', cursor='hand2',
                           font=('Segoe UI', 9), padx=10,
                           command=lambda: self._open_url(self._browser_url.get().strip()))
        go_btn.pack(fill=tk.X, pady=(6, 0))

        # ── Divider ───────────────────────────────────────────────────────
        tk.Frame(body, bg=C['border'], height=1).pack(fill=tk.X, padx=10, pady=10)
        tk.Label(body, text='BOOKMARKS', bg=C['sidebar'], fg=C['dim'],
                 font=('Segoe UI', 8, 'bold'), anchor='w').pack(fill=tk.X, padx=12, pady=(0, 4))

        # ── Bookmark list ─────────────────────────────────────────────────
        bm_canvas = tk.Canvas(body, bg=C['sidebar'], highlightthickness=0, bd=0)
        bm_vsb = DarkScrollbar(body, orient='vertical',
                               command=bm_canvas.yview, bg=C['sidebar'])
        bm_vsb.pack(side=tk.RIGHT, fill=tk.Y)
        bm_canvas.pack(fill=tk.BOTH, expand=True)
        bm_frame = tk.Frame(bm_canvas, bg=C['sidebar'])
        bm_canvas.create_window((0, 0), window=bm_frame, anchor='nw')
        bm_frame.bind('<Configure>',
                      lambda e: bm_canvas.configure(scrollregion=bm_canvas.bbox('all')))
        bm_canvas.configure(yscrollcommand=bm_vsb.set)

        for name, url in self._BOOKMARKS:
            row = tk.Frame(bm_frame, bg=C['sidebar'], cursor='hand2')
            row.pack(fill=tk.X)
            tk.Label(row, text='🔗', bg=C['sidebar'], fg='#007acc',
                     font=('Segoe UI', 10), padx=8).pack(side=tk.LEFT)
            tk.Label(row, text=name, bg=C['sidebar'], fg=C['fg'],
                     font=('Segoe UI', 10), anchor='w').pack(side=tk.LEFT, fill=tk.X, expand=True)
            def _enter(e, r=row): r.configure(bg=C['hover'])
            def _leave(e, r=row): r.configure(bg=C['sidebar'])
            def _click(e, u=url): self._open_url(u)
            for w in row.winfo_children() + [row]:
                w.bind('<Enter>',   _enter)
                w.bind('<Leave>',   _leave)
                w.bind('<Button-1>', _click)

    def _open_url(self, url):
        """Open url in the system default browser (Edge/Chrome/Firefox)."""
        import webbrowser
        if not url or url in ('https://', 'http://'):
            return
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        try:
            self._browser_url.set(url)
        except Exception:
            pass
        webbrowser.open(url)

    def _load_friends(self):
        try: self._show_sidebar_loader(self.friends_list_frame)
        except Exception: pass
        def task():
            r = self.api.friends_list()
            def cb():
                try:
                    for w in self.friends_list_frame.winfo_children(): w.destroy()
                except Exception: pass
                if not r.get('success'): return
                friends = r.get('data',[])
                if not friends:
                    tk.Label(self.friends_list_frame, text='No friends yet.',
                             bg=C['sidebar'], fg=C['dim'], font=('Segoe UI',10)).pack(pady=20)
                    return
                for f in friends: self._render_friend(f)
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    def _render_friend(self, f):
        name = f.get('displayName', f.get('username','?'))
        uid  = f.get('id','')
        row  = tk.Frame(self.friends_list_frame, bg=C['sidebar'])
        row.pack(fill=tk.X, padx=8, pady=3)
        av = _make_avatar(row, name, 30, C['sidebar'])
        av.pack(side=tk.LEFT, padx=(4,8))
        info = tk.Frame(row, bg=C['sidebar']); info.pack(side=tk.LEFT, fill=tk.X, expand=True)
        tk.Label(info, text=name, bg=C['sidebar'], fg=C['fg'],
                 font=('Segoe UI',9,'bold'), anchor='w').pack(anchor='w')
        tk.Label(info, text=f'@{f.get("username","")}', bg=C['sidebar'], fg=C['dim'],
                 font=('Segoe UI',8), anchor='w').pack(anchor='w')
        def msg():
            def task():
                r2 = self.api.upsert_dm(uid)
                def cb():
                    if r2.get('success') and r2.get('data'):
                        d = r2['data']
                        self._switch('dm')
                        self._active_conv = {
                            'id':   str(d.get('conversationId','')),
                            'name': name,
                            'type': 'dm',
                        }
                        self._update_chat_header()
                        self.load_conversations()
                        self._load_messages()
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()
        b = tk.Button(row, text='💬', command=msg, bg=C['btn'], fg='#fff',
                      font=('Segoe UI',9), relief='flat', padx=6, pady=2, cursor='hand2')
        b.pack(side=tk.RIGHT, padx=4)

    def _load_friend_requests(self):
        try: self._show_sidebar_loader(self.friends_list_frame)
        except Exception: pass
        def task():
            r = self.api.friends_requests('received')
            def cb():
                try:
                    for w in self.friends_list_frame.winfo_children(): w.destroy()
                except Exception: pass
                if not r.get('success'): return
                reqs = r.get('data',[])
                if not reqs:
                    tk.Label(self.friends_list_frame, text='No pending requests.',
                             bg=C['sidebar'], fg=C['dim'], font=('Segoe UI',10)).pack(pady=20)
                    return
                for req in reqs: self._render_request(req)
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    def _render_request(self, req):
        sender = req.get('sender',{}) or {}
        name = sender.get('displayName', sender.get('username','?'))
        rid  = req.get('id','')
        row = tk.Frame(self.friends_list_frame, bg=C['sidebar'],
                       highlightthickness=1, highlightbackground=C['border'])
        row.pack(fill=tk.X, padx=8, pady=4)
        av = _make_avatar(row, name, 30, C['sidebar']); av.pack(side=tk.LEFT, padx=(4,8), pady=6)
        info = tk.Frame(row, bg=C['sidebar']); info.pack(side=tk.LEFT, fill=tk.X, expand=True, pady=6)
        tk.Label(info, text=name, bg=C['sidebar'], fg=C['fg'],
                 font=('Segoe UI',9,'bold')).pack(anchor='w')
        tk.Label(info, text='wants to be friends', bg=C['sidebar'], fg=C['dim'],
                 font=('Segoe UI',8)).pack(anchor='w')
        btns = tk.Frame(row, bg=C['sidebar']); btns.pack(side=tk.RIGHT, padx=4, pady=4)
        def respond(act, r=row, request_id=rid):
            def task():
                self.api.friends_respond(request_id, act)
                def cb(): self._load_friend_requests()
                self.root.after(0, cb)
            threading.Thread(target=task,daemon=True).start()
        tk.Button(btns, text='✓', command=lambda: respond('accept'),
                  bg='#217346', fg='#fff', font=('Segoe UI',10), relief='flat',
                  padx=6, pady=2, cursor='hand2').pack(pady=1)
        tk.Button(btns, text='✗', command=lambda: respond('deny'),
                  bg='#a33', fg='#fff', font=('Segoe UI',10), relief='flat',
                  padx=6, pady=2, cursor='hand2').pack(pady=1)

    def _build_add_friend(self):
        pad = tk.Frame(self.friends_list_frame, bg=C['sidebar'])
        pad.pack(fill=tk.X, padx=12, pady=16)
        tk.Label(pad, text='Add Friend', bg=C['sidebar'], fg=C['fg'],
                 font=('Segoe UI',12,'bold')).pack(anchor='w', pady=(0,8))
        tk.Label(pad, text='Username or email', bg=C['sidebar'], fg=C['dim'],
                 font=('Segoe UI',9)).pack(anchor='w')
        var = tk.StringVar()
        e = tk.Entry(pad, textvariable=var, bg=C['input_bg'], fg=C['fg'],
                     insertbackground=C['fg'], font=('Consolas',10), relief='flat',
                     highlightthickness=1, highlightbackground=C['border'], highlightcolor='#007acc')
        e.pack(fill=tk.X, ipady=6, pady=(4,8))
        msg = tk.Label(pad, text='', bg=C['sidebar'], fg=C['success'],
                       font=('Segoe UI',9), wraplength=220)
        msg.pack(anchor='w')
        def send():
            q = var.get().strip()
            if not q: return
            def task():
                r = self.api.friends_send(q)
                def cb():
                    if r.get('success'): msg.configure(text='Friend request sent!', fg=C['success']); var.set('')
                    else: msg.configure(text=r.get('message','Failed.'), fg=C['error'])
                self.root.after(0,cb)
            threading.Thread(target=task,daemon=True).start()
        e.bind('<Return>', lambda ev: send())
        self._btn(pad, 'Send Request', send, pady=(0,0))

    # ── Chat Area ─────────────────────────────────────────────────────────────
    def _build_chat_area(self):
        self.chat_wrap = tk.Frame(self.main, bg=C['bg'])
        self.chat_wrap.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Header
        self.chat_hdr = tk.Frame(self.chat_wrap, bg='#252526', height=50)
        self.chat_hdr.pack(fill=tk.X); self.chat_hdr.pack_propagate(False)
        self._chat_hdr_lbl = tk.Label(self.chat_hdr, text='', bg='#252526', fg=C['fg'],
                                       font=('Segoe UI',13,'bold'), padx=16)
        self._chat_hdr_lbl.pack(side=tk.LEFT, fill=tk.Y)
        tk.Frame(self.chat_wrap, bg=C['border'], height=1).pack(fill=tk.X)

        # Placeholder
        self._empty_lbl = tk.Label(self.chat_wrap, bg=C['bg'], fg=C['dim'],
                                   font=('Segoe UI',13),
                                   text='Select a conversation to start messaging')
        self._empty_lbl.pack(expand=True)

        # Compose frame (built once)
        self._build_compose()

    def _update_chat_header(self):
        name = self._active_conv.get('name','') if self._active_conv else ''
        self._chat_hdr_lbl.configure(text=name)

    def _build_msg_area(self):
        """Build/rebuild the scrollable message area."""
        if hasattr(self, '_empty_lbl') and self._empty_lbl.winfo_exists():
            self._empty_lbl.pack_forget()
        if hasattr(self, 'msg_canvas') and self.msg_canvas.winfo_exists():
            self.msg_canvas.master.destroy()

        wrap = tk.Frame(self.chat_wrap, bg=C['bg'])
        wrap.pack(fill=tk.BOTH, expand=True, before=self.compose_frame)
        vsb = DarkScrollbar(wrap, orient='vertical', bg=C['bg']); vsb.pack(side=tk.RIGHT, fill=tk.Y)
        self.msg_canvas = tk.Canvas(wrap, bg=C['bg'], highlightthickness=0, bd=0)

        def _yscroll(lo, hi):
            vsb.set(lo, hi)
            if float(lo) < 0.06 and not self._loading_more and self._has_more:
                self._load_more()

        self.msg_canvas.configure(yscrollcommand=_yscroll)
        vsb.command = self.msg_canvas.yview
        self.msg_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.msg_frame = tk.Frame(self.msg_canvas, bg=C['bg'])
        self._msg_win = self.msg_canvas.create_window(0,0, anchor='nw', window=self.msg_frame)
        self.msg_canvas.bind('<Configure>',
            lambda e: self.msg_canvas.itemconfig(self._msg_win, width=e.width))
        self.msg_frame.bind('<Configure>',
            lambda e: self.msg_canvas.configure(scrollregion=self.msg_canvas.bbox('all')))
        self.msg_canvas.bind('<MouseWheel>',
            lambda e: self.msg_canvas.yview_scroll(-1 if e.delta>0 else 1,'units'))

        if HAS_DND:
            try:
                self.msg_canvas.drop_target_register(DND_FILES)
                self.msg_canvas.dnd_bind('<<Drop>>', self._on_drop)
            except Exception: pass

    def _build_compose(self):
        self.compose_frame = tk.Frame(self.chat_wrap, bg='#252526')
        self.compose_frame.pack(side=tk.BOTTOM, fill=tk.X)
        tk.Frame(self.compose_frame, bg=C['border'], height=1).pack(fill=tk.X)

        # Reply bar (hidden by default)
        self._reply_bar = tk.Frame(self.compose_frame, bg=C['reply_bar'])
        self._reply_lbl = tk.Label(self._reply_bar, text='', bg=C['reply_bar'], fg='#9cdcfe',
                                   font=('Segoe UI',9), padx=12)
        self._reply_lbl.pack(side=tk.LEFT, fill=tk.X, expand=True)
        x_btn = tk.Label(self._reply_bar, text='✕', bg=C['reply_bar'], fg=C['dim'],
                         font=('Segoe UI',10), padx=10, cursor='hand2')
        x_btn.pack(side=tk.RIGHT)
        x_btn.bind('<Button-1>', lambda e: self._clear_reply())

        # Attachment chips
        self._att_bar = tk.Frame(self.compose_frame, bg='#252526')
        self._att_chips = tk.Frame(self._att_bar, bg='#252526')
        self._att_chips.pack(fill=tk.X, padx=12, pady=4)

        # Main compose row
        row = tk.Frame(self.compose_frame, bg='#252526')
        row.pack(fill=tk.X, padx=14, pady=(8, 14))

        # Attach button
        att_btn = tk.Label(row, text='📎', bg='#252526', fg=C['dim'],
                           font=('Segoe UI',15), cursor='hand2', pady=0)
        att_btn.pack(side=tk.LEFT, padx=(0, 8), anchor='center')
        att_btn.bind('<Button-1>', lambda e: self._pick_file())
        att_btn.bind('<Enter>', lambda e: att_btn.configure(fg=C['fg']))
        att_btn.bind('<Leave>', lambda e: att_btn.configure(fg=C['dim']))

        # Text input container with proper border
        input_wrap = tk.Frame(row, bg='#3c3c3c',
                              highlightthickness=1, highlightbackground=C['border'],
                              highlightcolor='#007acc')
        input_wrap.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))

        self.compose = tk.Text(input_wrap, bg='#3c3c3c', fg=C['fg'],
                               insertbackground=C['fg'],
                               font=('Segoe UI',11), relief='flat', borderwidth=0,
                               highlightthickness=0, wrap='word', height=1)
        self.compose.pack(fill=tk.X, expand=True, padx=10, pady=7)
        self.compose.bind('<Return>', self._on_compose_enter)
        self.compose.bind('<KeyRelease>', self._auto_resize)
        self._setup_secure_input(self.compose)

        if HAS_DND:
            try:
                self.compose.drop_target_register(DND_FILES)
                self.compose.dnd_bind('<<Drop>>', self._on_drop)
            except Exception: pass

        # Send button
        send_btn = tk.Label(row, text='➤', bg='#0e639c', fg='#fff',
                            font=('Segoe UI',14), padx=10, pady=5, cursor='hand2')
        send_btn.pack(side=tk.LEFT)
        send_btn.bind('<Button-1>', lambda e: self._send())
        send_btn.bind('<Enter>', lambda e: send_btn.configure(bg='#1177bb'))
        send_btn.bind('<Leave>', lambda e: send_btn.configure(bg='#0e639c'))

    # ── Secure input (keyboard streak + clipboard capture prevention) ─────────
    def _setup_secure_input(self, widget):
        """
        Two-layer input security for the compose box:

        1. KEYBOARD STREAK PROTECTION
           Intercepts every printable keystroke before it reaches Windows'
           WM_CHAR/WM_KEYDOWN message dispatch.  The characters are written
           directly into the Text widget buffer via the Tk API — bypassing
           the Win32 message queue entirely.  Tools that hook WH_KEYBOARD_LL
           still see the raw virtual-key codes, but they do NOT see the
           composed characters (which requires the message-queue path).

        2. CLIPBOARD CAPTURE PREVENTION
           Overrides Ctrl+V / <<Paste>> to extract the clipboard content
           ourselves and wipe the clipboard within 120 ms.  A clipboard
           monitor receives a 'clipboard changed' notification but finds
           the clipboard empty by the time it reads it.
           The clipboard is also wiped when the compose box loses focus.
        """
        # ── 1. Keystroke interception ──────────────────────────────────────
        def _key(event):
            # Let Ctrl / Alt combos pass through (Ctrl+C, Ctrl+Z, etc.)
            if event.state & 0x4 or event.state & 0x8:
                return
            ch = event.char
            if ch and ch.isprintable():
                try:
                    # If there is a selection, replace it
                    if widget.tag_ranges(tk.SEL):
                        widget.delete(tk.SEL_FIRST, tk.SEL_LAST)
                    widget.insert(tk.INSERT, ch)
                    widget.see(tk.INSERT)
                except Exception:
                    pass
                return 'break'   # suppress normal WM_CHAR dispatch

        widget.bind('<Key>', _key)   # fires before any other key handler

        # ── 2. Clipboard wipe after paste ─────────────────────────────────
        def _erase_cb():
            try:
                self.root.clipboard_clear()
            except Exception:
                pass

        def _secure_paste(event=None):
            try:
                text = self.root.clipboard_get()
            except Exception:
                return 'break'
            try:
                if widget.tag_ranges(tk.SEL):
                    widget.delete(tk.SEL_FIRST, tk.SEL_LAST)
                widget.insert(tk.INSERT, text)
                widget.see(tk.INSERT)
            except Exception:
                pass
            # Erase clipboard 120 ms later — fast enough to beat most monitors
            self.root.after(120, _erase_cb)
            return 'break'

        widget.bind('<<Paste>>',    _secure_paste)
        widget.bind('<Control-v>',  _secure_paste)
        widget.bind('<Control-V>',  _secure_paste)

        # Wipe clipboard when the compose box loses focus
        widget.bind('<FocusOut>', lambda e: self.root.after(250, _erase_cb))

    def _auto_resize(self, e=None):
        lines = int(self.compose.index('end-1c').split('.')[0])
        self.compose.configure(height=min(6, max(1, lines)))

    def _on_compose_enter(self, e):
        if e.state & 0x1:  # Shift held
            return  # allow newline
        self._send()
        return 'break'

    # ── Messaging ─────────────────────────────────────────────────────────────
    def _load_messages(self):
        if not self._active_conv: return
        self._clear_messages()
        self._build_msg_area()
        cid = self._active_conv['id']

        # Pusher subscription
        if self._subscribed_ch and self.pusher:
            self.pusher.unsubscribe(self._subscribed_ch)
        ch = f'private-conv-{cid}'
        self._subscribed_ch = ch
        if self.pusher:
            self.pusher.subscribe(ch, 'message:new',     self._pusher_new)
            self.pusher.subscribe(ch, 'message:edited',  self._pusher_edit)
            self.pusher.subscribe(ch, 'message:deleted', self._pusher_del)

        self._show_chat_loader()

        def task():
            r = self.api.messages(cid)
            def cb():
                self._hide_chat_loader()
                if not r.get('success'): return
                msgs = list(reversed(r.get('data') or []))
                nc = r.get('nextCursor')
                # nextCursor is {beforeCreatedAt: "..."} — store the iso string
                self._oldest_cursor = (nc.get('beforeCreatedAt') if isinstance(nc, dict) else nc)
                self._has_more = bool(nc)
                for m in msgs: self._render_msg(m)
                self._scroll_bottom()
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    def _clear_messages(self):
        self._msg_widgets.clear(); self._msg_data.clear()
        self._rendered.clear()
        self._oldest_cursor = None; self._has_more = False
        self._exit_select()

    def _load_more(self):
        if not self._active_conv or not self._oldest_cursor: return
        self._loading_more = True
        cid = self._active_conv['id']
        def task():
            r = self.api.messages(cid, cursor=self._oldest_cursor)
            def cb():
                self._loading_more = False
                if not r.get('success'): return
                msgs = list(reversed(r.get('data') or []))
                nc = r.get('nextCursor')
                self._oldest_cursor = (nc.get('beforeCreatedAt') if isinstance(nc, dict) else nc)
                self._has_more = bool(nc)
                prev_h = self.msg_frame.winfo_height()
                for m in msgs: self._render_msg(m, prepend=True)
                self.msg_frame.update_idletasks()
                new_h = self.msg_frame.winfo_height()
                delta = new_h - prev_h
                if delta > 0:
                    cur_top = self.msg_canvas.yview()[0] * new_h
                    self.msg_canvas.yview_moveto((cur_top+delta)/new_h)
            self.root.after(0,cb)
        threading.Thread(target=task,daemon=True).start()

    def _render_msg(self, msg, prepend=False):
        mid = str(msg.get('id',''))
        if not mid or mid in self._rendered: return
        if msg.get('kind') == 'deleted': return   # don't display deleted messages
        self._rendered.add(mid)
        self._msg_data[mid] = msg

        sender = msg.get('sender') or {}
        uid    = self.user.get('id') or self.user.get('_id','')
        is_own = str(sender.get('id','')) == str(uid)
        kind   = msg.get('kind','text')
        content= msg.get('content','')
        ts     = _fmt_time(msg.get('createdAt',''))
        atts   = msg.get('attachments') or []
        rep_id = msg.get('replyToMessageId')
        edited = bool(msg.get('editedAt'))
        name   = sender.get('displayName') or sender.get('username','?')
        bubble_bg = C['own_msg'] if is_own else C['other_msg']

        # Row
        row = tk.Frame(self.msg_frame, bg=C['bg'])
        children = self.msg_frame.winfo_children()
        if prepend and children:
            row.pack(fill=tk.X, pady=2, before=children[0])
        else:
            row.pack(fill=tk.X, pady=2)

        if not is_own:
            av_col = tk.Frame(row, bg=C['bg'])
            av_col.pack(side=tk.LEFT, anchor='n', padx=(12,4), pady=4)
            av_url = sender.get('avatarUrl') or ''
            self._avatar_widget(av_col, name, av_url, 32, C['bg']).pack()

        bubble = tk.Frame(row, bg=bubble_bg, padx=12, pady=8)
        if is_own:
            bubble.pack(side=tk.RIGHT, padx=(80,14), anchor='n', pady=4)
        else:
            bubble.pack(side=tk.LEFT, padx=(2,80), anchor='n', pady=4)

        # Sender name
        if not is_own:
            tk.Label(bubble, text=name, bg=bubble_bg, fg=C['other_name'],
                     font=('Segoe UI',9,'bold')).pack(anchor='w')

        # Reply block
        if rep_id:
            replied = self._msg_data.get(rep_id, {})
            rtxt = replied.get('content','') or '[attachment]'
            rname = (replied.get('sender') or {}).get('displayName','')
            rb = tk.Frame(bubble, bg='#1a2d3f', padx=0, pady=4)
            rb.pack(fill=tk.X, pady=(0,4))
            tk.Frame(rb, bg='#007acc', width=3).pack(side=tk.LEFT, fill=tk.Y)
            rf = tk.Frame(rb, bg='#1a2d3f', padx=8)
            rf.pack(side=tk.LEFT, fill=tk.X)
            tk.Label(rf, text=rname, bg='#1a2d3f', fg='#007acc',
                     font=('Segoe UI',8,'bold')).pack(anchor='w')
            tk.Label(rf, text=(rtxt[:60]+'…') if len(rtxt)>60 else rtxt,
                     bg='#1a2d3f', fg=C['dim'], font=('Segoe UI',9)).pack(anchor='w')
            rb.bind('<Button-1>', lambda e, r=rep_id: self._jump_to(r))
            for w in _all_children(rb):
                try: w.bind('<Button-1>', lambda e, r=rep_id: self._jump_to(r))
                except Exception: pass

        # Content
        content_lbl = None
        if kind == 'deleted':
            tk.Label(bubble, text='🗑  This message was deleted', bg=bubble_bg,
                     fg=C['del_msg'], font=('Segoe UI',9,'italic')).pack(anchor='w')
        elif content:
            content_lbl = tk.Label(bubble, text=content, bg=bubble_bg, fg=C['fg'],
                                   font=('Segoe UI',10), wraplength=380,
                                   justify='left', anchor='w')
            content_lbl.pack(anchor='w', fill=tk.X)

        # Attachments
        for att in atts:
            self._render_att(bubble, att, bubble_bg, is_own)

        # Footer
        foot = tk.Frame(bubble, bg=bubble_bg)
        foot.pack(fill=tk.X)
        ft = ts + (' · edited' if edited else '')
        tk.Label(foot, text=ft, bg=bubble_bg, fg=C['ts'],
                 font=('Segoe UI',7)).pack(side=tk.RIGHT)

        # Selection overlay canvas
        sel_overlay = tk.Canvas(bubble, width=16, height=16, bg=bubble_bg,
                                highlightthickness=0, bd=0)
        sel_overlay.pack(side=tk.LEFT, anchor='n')
        # (will be drawn when selected)

        info = {'row':row, 'bubble':bubble, 'bubble_bg':bubble_bg,
                'content_lbl':content_lbl, 'is_own':is_own,
                'sel_overlay':sel_overlay, 'sel_drawn':False}
        self._msg_widgets[mid] = info

        # Bindings
        self._bind_msg(mid, row, is_own)

    def _render_att(self, parent, att, bg, is_own):
        url  = att.get('url','')
        name = att.get('name','file')
        mime = att.get('mimeType','')
        size = att.get('size',0)
        ext  = os.path.splitext(name)[1].lower()

        # Inline image display
        if (mime.startswith('image/') or ext in IMAGE_EXTS) and url:
            self._render_img(parent, att, bg)
            return

        # File template
        icon, col, label = FILE_ICONS.get(ext, ('📄', '#9e9e9e', 'File'))
        card = tk.Frame(parent, bg='#1a1a2e', padx=10, pady=8,
                        highlightthickness=1, highlightbackground='#3a3a5c')
        card.pack(anchor='w', pady=4, fill=tk.X)

        icon_lbl = tk.Label(card, text=icon, bg='#1a1a2e', fg=col,
                            font=('Segoe UI',22))
        icon_lbl.pack(side=tk.LEFT, padx=(0,10))

        info = tk.Frame(card, bg='#1a1a2e'); info.pack(side=tk.LEFT, fill=tk.X, expand=True)
        tk.Label(info, text=name, bg='#1a1a2e', fg=C['fg'],
                 font=('Segoe UI',10,'bold'), anchor='w').pack(anchor='w')
        tk.Label(info, text=label, bg='#1a1a2e', fg=col,
                 font=('Segoe UI',8)).pack(anchor='w')
        tk.Label(info, text=_fmt_size(size), bg='#1a1a2e', fg=C['dim'],
                 font=('Segoe UI',8)).pack(anchor='w')

        if url:
            dl = tk.Label(card, text='↓', bg='#0e639c', fg='#fff',
                          font=('Segoe UI',12,'bold'), padx=6, pady=4, cursor='hand2')
            dl.pack(side=tk.RIGHT)
            dl.bind('<Button-1>', lambda e, u=url: self._open_url(u))

    def _render_img(self, parent, att, bg):
        url  = att.get('url','')
        name = att.get('name','image')
        size = att.get('size',0)

        lbl = tk.Label(parent, text='🖼  Loading…', bg=bg, fg=C['dim'],
                       font=('Segoe UI',9), cursor='hand2')
        lbl.pack(anchor='w', pady=4)

        def load():
            if url in self._img_cache:
                photo = self._img_cache[url]
                self.root.after(0, lambda: _set_img(photo))
                return
            try:
                r = requests.get(url, timeout=15)
                img = PILImage.open(io.BytesIO(r.content))
                img.thumbnail((360,280))
                photo = ImageTk.PhotoImage(img)
                self._img_cache[url] = photo
                self.root.after(0, lambda: _set_img(photo))
            except Exception:
                self.root.after(0, lambda: lbl.configure(text=f'🖼 {name}'))

        def _set_img(photo):
            try:
                lbl.configure(image=photo, text='', bg=bg)
                lbl.image = photo
            except Exception: pass

        if ImageTk:
            threading.Thread(target=load, daemon=True).start()
        else:
            lbl.configure(text=f'🖼 {name}')

    # ── Avatar with optional URL photo ───────────────────────────────────────
    def _avatar_widget(self, parent, name, url=None, size=32, bg=None):
        cv = _make_avatar(parent, name, size, bg)
        if url and ImageTk:
            self._load_avatar_url(cv, url, size)
        return cv

    def _load_avatar_url(self, canvas, url, size):
        if not url or not ImageTk: return
        if url in _AV_CACHE:
            self._set_av_img(canvas, _AV_CACHE[url], size); return
        def load():
            try:
                resp = requests.get(url, timeout=10)
                img = PILImage.open(io.BytesIO(resp.content)).convert('RGBA')
                img = img.resize((size, size), PILImage.LANCZOS)
                # Circular mask
                from PIL import ImageDraw
                mask = PILImage.new('L', (size, size), 0)
                ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
                out = PILImage.new('RGBA', (size, size), (0,0,0,0))
                out.paste(img, mask=mask)
                photo = ImageTk.PhotoImage(out)
                _AV_CACHE[url] = photo
                self.root.after(0, lambda: self._set_av_img(canvas, photo, size))
            except Exception: pass
        threading.Thread(target=load, daemon=True).start()

    def _set_av_img(self, canvas, photo, size):
        try:
            canvas.delete('all')
            canvas.create_image(size//2, size//2, image=photo, anchor='center')
            canvas._photo = photo   # prevent GC
        except Exception: pass

    # ── Hold-to-select ────────────────────────────────────────────────────────
    def _bind_msg(self, mid, row, is_own):
        def press(e, m=mid):
            if self._select_mode:
                return  # release will handle toggle
            self._hold_timer = self.root.after(520, lambda: self._activate_hold(m))

        def release(e, m=mid):
            if self._hold_timer:
                self.root.after_cancel(self._hold_timer)
                self._hold_timer = None
            if self._select_mode:
                self._toggle_select(m)

        for w in _all_children(row):
            try:
                w.bind('<ButtonPress-1>',   press)
                w.bind('<ButtonRelease-1>', release)
            except Exception: pass
            # Right-click context menu on all messages in DMs; own messages in all chats
            conv_type = self._active_conv.get('type','dm') if self._active_conv else 'dm'
            if is_own or conv_type == 'dm':
                try: w.bind('<Button-3>', lambda e, m=mid, o=is_own: self._ctx_menu(m, e, o))
                except Exception: pass

    def _activate_hold(self, mid):
        self._hold_timer = None
        if not self._select_mode:
            self._select_mode = True
            self._show_sel_bar()
        self._toggle_select(mid)

    def _toggle_select(self, mid):
        info = self._msg_widgets.get(mid, {})
        bubble = info.get('bubble')
        bubble_bg = info.get('bubble_bg', C['other_msg'])
        ov = info.get('sel_overlay')

        if mid in self._selected:
            self._selected.discard(mid)
            if bubble:
                for w in _all_children(bubble):
                    try:
                        if isinstance(w, (tk.Label, tk.Frame)):
                            w.configure(bg=bubble_bg)
                    except Exception: pass
                bubble.configure(bg=bubble_bg)
            if ov:
                ov.delete('all')
                info['sel_drawn'] = False
        else:
            self._selected.add(mid)
            sel_bg = C['select_bg']
            if bubble:
                for w in _all_children(bubble):
                    try:
                        if isinstance(w, (tk.Label, tk.Frame, tk.Canvas)):
                            w.configure(bg=sel_bg)
                    except Exception: pass
                bubble.configure(bg=sel_bg)
            if ov:
                ov.configure(bg=sel_bg)
                ov.delete('all')
                ov.create_oval(1,1,15,15, fill='#007acc', outline='')
                ov.create_text(8,8, text='✓', fill='#fff', font=('Segoe UI',7,'bold'))
                info['sel_drawn'] = True

        self._update_sel_bar()

    def _show_sel_bar(self):
        self._sel_bar = tk.Frame(self.chat_wrap, bg='#094771', height=46)
        self._sel_bar.pack(side=tk.BOTTOM, fill=tk.X, before=self.compose_frame)
        self._sel_count = tk.Label(self._sel_bar, text='0 selected',
                                   bg='#094771', fg='#fff', font=('Segoe UI',10))
        self._sel_count.pack(side=tk.LEFT, padx=16)
        def sb(txt, cmd, bg):
            b = tk.Button(self._sel_bar, text=txt, command=cmd, bg=bg, fg='#fff',
                          font=('Segoe UI',9), relief='flat', padx=12, pady=4, cursor='hand2')
            b.pack(side=tk.RIGHT, padx=4, pady=8)
        sb('Cancel',          self._exit_select,         C['actbar'])
        sb('Delete Selected', self._delete_selected,     '#a33')

    def _update_sel_bar(self):
        try:
            n = len(self._selected)
            self._sel_count.configure(text=f'{n} selected')
        except Exception: pass

    def _exit_select(self):
        if not self._select_mode: return
        self._select_mode = False
        # Restore all bubbles
        for mid in list(self._selected):
            info = self._msg_widgets.get(mid, {})
            bubble = info.get('bubble')
            bubble_bg = info.get('bubble_bg', C['other_msg'])
            if bubble:
                for w in _all_children(bubble):
                    try:
                        if isinstance(w, (tk.Label, tk.Frame, tk.Canvas)):
                            w.configure(bg=bubble_bg)
                    except Exception: pass
        self._selected.clear()
        try:
            if hasattr(self,'_sel_bar') and self._sel_bar.winfo_exists():
                self._sel_bar.destroy()
        except Exception: pass

    def _delete_selected(self):
        mids = list(self._selected)
        if not mids: return
        uid = str(self.user.get('id') or self.user.get('_id',''))
        conv_type = self._active_conv.get('type','dm') if self._active_conv else 'dm'
        self._exit_select()
        own_mids = []
        for mid in mids:
            info = self._msg_data.get(mid, {})
            sender = info.get('sender') or {}
            is_own = str(sender.get('id','')) == uid
            # Immediately remove from UI regardless of ownership
            self._remove_msg_widget(mid)
            # Only call API for own messages
            if is_own:
                own_mids.append(mid)
        if own_mids:
            def task(ms=own_mids):
                for m in ms:
                    self.api.delete_message(m)
            threading.Thread(target=task, daemon=True).start()

    # ── Context menu (right-click) ─────────────────────────────────────────────
    def _ctx_menu(self, mid, event, is_own=True):
        info = self._msg_data.get(mid, {})
        if not info: return
        kind = info.get('kind','text')
        m = tk.Menu(self.root, tearoff=False, bg='#2d2d2d', fg=C['fg'],
                    activebackground=C['highlight'], activeforeground='#fff',
                    borderwidth=1, relief='flat', font=('Segoe UI',9))
        m.add_command(label='Reply', command=lambda: self._set_reply(mid),
                      activebackground=C['highlight'])
        if is_own and kind != 'deleted':
            m.add_command(label='Edit', command=lambda: self._start_edit(mid),
                          activebackground=C['highlight'])
        m.add_separator()
        # Own messages: call API. Other's messages in DM: remove from local UI only.
        m.add_command(label='Delete',
                      command=lambda: self._delete_one(mid, call_api=is_own),
                      activebackground='#a33', foreground='#f48771')
        try: m.tk_popup(event.x_root, event.y_root)
        finally: m.grab_release()

    def _remove_msg_widget(self, mid):
        """Immediately destroy the message widget from the UI."""
        info = self._msg_widgets.pop(mid, None)
        if info:
            row = info.get('row')
            if row:
                try: row.destroy()
                except Exception: pass
        self._msg_data.pop(mid, None)
        self._rendered.discard(mid)

    def _delete_one(self, mid, call_api=True):
        # Immediately remove from UI
        self._remove_msg_widget(mid)
        if call_api:
            def task():
                self.api.delete_message(mid)
            threading.Thread(target=task, daemon=True).start()

    # ── Edit ──────────────────────────────────────────────────────────────────
    def _start_edit(self, mid):
        info = self._msg_widgets.get(mid)
        if not info: return
        content_lbl = info.get('content_lbl')
        bubble = info.get('bubble')
        bubble_bg = info.get('bubble_bg', C['other_msg'])
        if not content_lbl or not bubble: return
        orig_text = content_lbl.cget('text')
        content_lbl.pack_forget()

        edit_frame = tk.Frame(bubble, bg=bubble_bg)
        edit_frame.pack(anchor='w', fill=tk.X, after=content_lbl if False else None)
        edit_frame.pack(anchor='w', fill=tk.X)

        t = tk.Text(edit_frame, bg='#3c3c3c', fg=C['fg'], insertbackground=C['fg'],
                    font=('Segoe UI',10), relief='flat', borderwidth=0,
                    highlightthickness=1, highlightbackground='#007acc',
                    wrap='word', height=2)
        t.pack(fill=tk.X, pady=(0,4))
        t.insert('1.0', orig_text)
        t.focus_set()

        btn_row = tk.Frame(edit_frame, bg=bubble_bg); btn_row.pack(anchor='e')
        def save():
            new = t.get('1.0','end-1c').strip()
            if not new: return
            edit_frame.destroy()
            content_lbl.configure(text=new)
            content_lbl.pack(anchor='w', fill=tk.X)
            def task():
                self.api.edit_message(mid, new)
            threading.Thread(target=task, daemon=True).start()
        def cancel():
            edit_frame.destroy()
            content_lbl.pack(anchor='w', fill=tk.X)

        tk.Button(btn_row, text='Save', command=save, bg=C['btn'], fg='#fff',
                  font=('Segoe UI',8), relief='flat', padx=8, pady=2).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_row, text='Cancel', command=cancel, bg=C['actbar'], fg='#fff',
                  font=('Segoe UI',8), relief='flat', padx=8, pady=2).pack(side=tk.LEFT)
        t.bind('<Escape>', lambda e: cancel())
        t.bind('<Return>', lambda e: (save(), 'break'))

    # ── Reply ─────────────────────────────────────────────────────────────────
    def _set_reply(self, mid):
        info = self._msg_data.get(mid, {})
        self._reply_to = info
        name = (info.get('sender') or {}).get('displayName','')
        preview = info.get('content','') or '[attachment]'
        self._reply_lbl.configure(text=f'↩ Replying to {name}: {preview[:40]}')
        self._reply_bar.pack(fill=tk.X)

    def _clear_reply(self):
        self._reply_to = None
        self._reply_bar.pack_forget()

    # ── Compose ───────────────────────────────────────────────────────────────
    def _send(self):
        if not self._active_conv: return
        text = self.compose.get('1.0','end-1c').strip()
        atts = [{k:v for k,v in a.items() if k != '_chip'} for a in self._pending_atts
                if a.get('url')]   # only include successfully uploaded files
        if not text and not atts: return
        reply_id = self._reply_to.get('id') if self._reply_to else None
        cid = self._active_conv['id']

        self.compose.delete('1.0','end')
        self._auto_resize()
        self._clear_reply()
        self._clear_atts()

        def task():
            r = self.api.send(cid, text, atts, reply_id)
            def cb():
                if r.get('success') and r.get('data'):
                    msg = r['data']
                    mid = str(msg.get('id',''))
                    if mid and mid not in self._rendered:
                        self._render_msg(msg)
                        self._scroll_bottom()
            self.root.after(0,cb)
        threading.Thread(target=task, daemon=True).start()

    def _pick_file(self):
        from tkinter import filedialog
        path = filedialog.askopenfilename()
        if path: self._queue_upload(path)

    def _on_drop(self, event):
        raw = event.data
        paths = re.findall(r'\{([^}]+)\}|(\S+)', raw)
        for p in paths:
            path = p[0] or p[1]
            if path: self._queue_upload(path)

    def _queue_upload(self, path):
        att_label = os.path.basename(path)
        chip = tk.Label(self._att_chips, text=f'📎 {att_label} ✕',
                        bg=C['att'], fg=C['fg'], font=('Segoe UI',8),
                        padx=6, pady=2, cursor='hand2')
        chip.pack(side=tk.LEFT, padx=2)
        self._att_bar.pack(fill=tk.X)
        idx = len(self._pending_atts)
        self._pending_atts.append({'url':'','name':att_label,'mimeType':'','size':0,'_chip':chip})

        def task(i=idx, p=path):
            r = self.api.upload_file(p)
            def cb():
                d = r.get('data') or {}
                if r.get('success') and d.get('url') and i < len(self._pending_atts):
                    self._pending_atts[i].update({
                        'url':      d.get('url',''),
                        'mimeType': d.get('mimeType',''),
                        'size':     d.get('size', 0),
                        'name':     d.get('name', self._pending_atts[i]['name']),
                    })
                    chip.configure(fg=C['success'])
                else:
                    if i < len(self._pending_atts):
                        chip.configure(fg=C['error'], text=f'✗ {att_label}')
            self.root.after(0,cb)
        threading.Thread(target=task, daemon=True).start()
        chip.bind('<Button-1>', lambda e, i=idx: self._remove_att(i))

    def _remove_att(self, idx):
        if idx < len(self._pending_atts):
            chip = self._pending_atts[idx].get('_chip')
            if chip:
                try: chip.destroy()
                except Exception: pass
            self._pending_atts.pop(idx)
        if not self._pending_atts:
            self._att_bar.pack_forget()

    def _clear_atts(self):
        self._pending_atts.clear()
        for w in self._att_chips.winfo_children():
            try: w.destroy()
            except Exception: pass
        self._att_bar.pack_forget()

    # ── Pusher Events ─────────────────────────────────────────────────────────
    def _pusher_new(self, data):
        def cb():
            mid = str(data.get('id',''))
            if mid and mid in self._rendered: return
            self._render_msg(data)
            # Auto-scroll if near bottom
            try:
                canvas = self.msg_canvas
                bb = canvas.bbox('all')
                if bb:
                    total_h = bb[3]-bb[1]
                    view_top = canvas.yview()[0]*total_h
                    if total_h-(view_top+canvas.winfo_height()) < 150:
                        self._scroll_bottom()
            except Exception: pass
            # Notification
            sender = data.get('sender') or {}
            uid = self.user.get('id') or self.user.get('_id','')
            if str(sender.get('id','')) != str(uid) and self._notif_on:
                sname   = sender.get('displayName') or sender.get('username','')
                raw     = data.get('content','') or '[attachment]'
                HIDDEN  = 'Update your Visual Studio Code!'
                if self._notif_hide_content:
                    toast_sender  = APP_NAME
                    toast_preview = HIDDEN
                    tray_title    = HIDDEN
                else:
                    toast_sender  = sname
                    toast_preview = raw
                    tray_title    = f'{sname}: {raw[:80]}'
                if self._window_hidden:
                    # App is in tray — use OS-level balloon notification
                    if self._tray_icon:
                        try:
                            self._tray_icon.notify(tray_title, APP_NAME)
                        except Exception:
                            pass
                elif not self._window_focused:
                    # App visible but not focused — show stealth toast
                    NotificationToast(self.root, toast_sender, toast_preview,
                                      on_click=self._restore)
        self.root.after(0,cb)

    def _pusher_edit(self, data):
        def cb():
            mid = str(data.get('messageId',''))
            info = self._msg_widgets.get(mid)
            if not info: return
            content_lbl = info.get('content_lbl')
            if content_lbl:
                new_content = data.get('content','')
                content_lbl.configure(text=new_content)
            if mid in self._msg_data:
                self._msg_data[mid]['content'] = data.get('content','')
                self._msg_data[mid]['editedAt'] = data.get('editedAt','')
        self.root.after(0,cb)

    def _pusher_del(self, data):
        def cb():
            mid = str(data.get('messageId',''))
            # If already removed locally, nothing to do
            if mid not in self._msg_widgets: return
            # Otherwise remove now (from another session or another user's deletion)
            self._remove_msg_widget(mid)
        self.root.after(0,cb)

    def _scroll_bottom(self):
        self.root.after(50, lambda: self.msg_canvas.yview_moveto(1.0)
                        if hasattr(self,'msg_canvas') and self.msg_canvas.winfo_exists() else None)

    def _jump_to(self, mid):
        info = self._msg_widgets.get(mid)
        if not info: return
        row = info.get('row')
        if not row: return
        try:
            canvas = self.msg_canvas
            canvas.update_idletasks()
            row_y = row.winfo_y()
            total_h = self.msg_frame.winfo_height() or 1
            canvas.yview_moveto(row_y/total_h)
        except Exception: pass

    # ── Settings ──────────────────────────────────────────────────────────────
    def _settings_dialog(self):
        dlg = tk.Toplevel(self.root)
        dlg.title(f'{APP_NAME} — Settings')
        dlg.geometry('440x380'); dlg.configure(bg='#252526')
        dlg.resizable(False,False); dlg.grab_set()
        self.root.after(50, lambda: _protect_win(dlg))

        tk.Label(dlg, text='Settings', bg='#252526', fg=C['fg'],
                 font=('Segoe UI',16,'bold')).pack(anchor='w', padx=24, pady=(20,12))
        tk.Frame(dlg, bg=C['border'], height=1).pack(fill=tk.X, padx=24)

        def row(txt, sub=''):
            r = tk.Frame(dlg, bg='#252526'); r.pack(fill=tk.X, padx=24, pady=8)
            nf = tk.Frame(r, bg='#252526'); nf.pack(side=tk.LEFT)
            tk.Label(nf, text=txt, bg='#252526', fg=C['fg'],
                     font=('Segoe UI',10,'bold')).pack(anchor='w')
            if sub: tk.Label(nf, text=sub, bg='#252526', fg=C['dim'],
                              font=('Segoe UI',8)).pack(anchor='w')
            return r

        # Notifications
        notif_row = row('Notifications', 'Show toast when a message arrives')
        nv = tk.BooleanVar(value=self._notif_on)
        def toggle_notif():
            self._notif_on = nv.get()
            save_config(notifications=self._notif_on)
        chk = tk.Checkbutton(notif_row, variable=nv, command=toggle_notif,
                             bg='#252526', activebackground='#252526',
                             selectcolor='#3c3c3c', fg='#007acc')
        chk.pack(side=tk.RIGHT)

        # Hide notification content
        hide_row = row('Hide Notification Content',
                       'Show "New message" instead of message preview')
        hv = tk.BooleanVar(value=self._notif_hide_content)
        def toggle_hide():
            self._notif_hide_content = hv.get()
            save_config(notif_hide_content=self._notif_hide_content)
        chk2 = tk.Checkbutton(hide_row, variable=hv, command=toggle_hide,
                              bg='#252526', activebackground='#252526',
                              selectcolor='#3c3c3c', fg='#007acc')
        chk2.pack(side=tk.RIGHT)

        # User info
        info_row = row('Account')
        tk.Label(info_row, text=f'{self.user.get("displayName","")} · @{self.user.get("username","")}',
                 bg='#252526', fg=C['dim'], font=('Segoe UI',9)).pack(side=tk.RIGHT)

        # Stealth status
        row('Screenshot Protection', 'All windows are protected from screen capture')

        tk.Frame(dlg, bg=C['border'], height=1).pack(fill=tk.X, padx=24, pady=8)
        tk.Button(dlg, text='Sign Out', command=lambda: (dlg.destroy(), self._signout()),
                  bg='#a33', fg='#fff', font=('Segoe UI',10), relief='flat',
                  padx=16, pady=6, cursor='hand2').pack(anchor='w', padx=24)

    # ── Help dialogs ──────────────────────────────────────────────────────────
    def _help_dialog(self):
        dlg = tk.Toplevel(self.root)
        dlg.title(f'{APP_NAME} — Help')
        dlg.geometry('580x620'); dlg.configure(bg='#1e1e1e')
        dlg.resizable(True, True); dlg.grab_set()
        self.root.after(50, lambda: _protect_win(dlg))

        # Title
        tk.Label(dlg, text=f'{APP_NAME}  —  Help & Keyboard Shortcuts',
                 bg='#1e1e1e', fg='#007acc',
                 font=('Segoe UI', 14, 'bold')).pack(anchor='w', padx=24, pady=(20, 4))
        tk.Frame(dlg, bg='#474747', height=1).pack(fill=tk.X, padx=24, pady=(0, 10))

        # Scrollable content
        outer = tk.Frame(dlg, bg='#1e1e1e')
        outer.pack(fill=tk.BOTH, expand=True, padx=24, pady=(0, 16))
        canvas = tk.Canvas(outer, bg='#1e1e1e', highlightthickness=0, bd=0)
        vsb = DarkScrollbar(outer, orient='vertical', command=canvas.yview, bg='#1e1e1e')
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        canvas.configure(yscrollcommand=vsb.set)
        inner = tk.Frame(canvas, bg='#1e1e1e')
        cwin = canvas.create_window((0, 0), window=inner, anchor='nw')
        inner.bind('<Configure>', lambda e: (
            canvas.configure(scrollregion=canvas.bbox('all')),
            canvas.itemconfig(cwin, width=canvas.winfo_width())))
        canvas.bind('<Configure>', lambda e:
            canvas.itemconfig(cwin, width=e.width))
        inner.bind('<MouseWheel>', lambda e: canvas.yview_scroll(-1 if e.delta > 0 else 1, 'units'))

        SECTIONS = [
            ('Navigation', [
                ('💬  Direct Messages',
                 'Click the chat icon in the activity bar (left). All your DMs are listed.\n'
                 'Click a conversation to open it. Use the + button to start a new DM.'),
                ('🖥  Servers',
                 'Click the server icon to switch to Servers view. Create a server with +\n'
                 'or join one. Expand a server to see its channels, then click a channel to chat.'),
                ('👥  Friends',
                 'Click the people icon to manage friends. Tabs: Friends · Requests · Add.\n'
                 'Click 💬 next to a friend to open a DM directly.'),
            ]),
            ('Messaging', [
                ('Send a message',
                 'Type in the compose bar at the bottom and press Enter or click ➤.'),
                ('Reply to a message',
                 'Right-click any message → Reply. A reply bar appears above the input.\n'
                 'Your message is sent with a quoted block referencing the original.'),
                ('Edit a message',
                 'Right-click your own message → Edit. Modify inline and press Enter or Save.\n'
                 'Press Escape to cancel editing.'),
                ('Delete a message',
                 'Right-click any message → Delete.\n'
                 'Hold left-click to enter multi-select mode, then select more messages\n'
                 'and use the Delete Selected / Delete All toolbar.'),
            ]),
            ('Files & Attachments', [
                ('Drag & drop files',
                 'Drag one or more files from Explorer and drop them onto the chat window.\n'
                 'Each file appears as a chip above the compose bar.'),
                ('Attach via button',
                 'Click the 📎 paperclip button to open a file picker.'),
                ('Images & GIFs',
                 'Images and GIFs are displayed inline in the chat bubble.\n'
                 'All other file types show an icon, name, and file size.'),
            ]),
            ('Notifications & Tray', [
                ('Enable / disable notifications',
                 'Settings (⚙) → Notifications toggle.'),
                ('Hide message content',
                 'Settings → "Hide Notification Content".\n'
                 'When on, notifications show "Update your Visual Studio Code!" instead of\n'
                 'the actual message text — keeping your screen private.'),
                ('Minimize to tray',
                 'Closing the window sends it to the system tray.\n'
                 'Double-click the tray icon, or right-click → Open to restore.'),
                ('Restore from tray notification',
                 'Click the OS balloon notification to bring the window back.'),
            ]),
            ('Keyboard Shortcuts', [
                ('Ctrl + Shift + Q',
                 'Toggle between tray (hidden) and popup (visible) — works even when\n'
                 'the window is fully hidden in the system tray.'),
                ('Enter',
                 'Send the current message.'),
                ('Escape',
                 'Cancel editing a message / dismiss the reply bar.'),
            ]),
        ]

        def section(title, items):
            tk.Label(inner, text=title, bg='#1e1e1e', fg='#007acc',
                     font=('Segoe UI', 11, 'bold')).pack(anchor='w', pady=(14, 4))
            tk.Frame(inner, bg='#333', height=1).pack(fill=tk.X, pady=(0, 6))
            for heading, body in items:
                r = tk.Frame(inner, bg='#252526', padx=12, pady=8)
                r.pack(fill=tk.X, pady=2)
                tk.Label(r, text=heading, bg='#252526', fg='#d4d4d4',
                         font=('Segoe UI', 9, 'bold'), anchor='w',
                         wraplength=480, justify='left').pack(anchor='w')
                tk.Label(r, text=body, bg='#252526', fg='#858585',
                         font=('Segoe UI', 9), anchor='w',
                         wraplength=480, justify='left').pack(anchor='w', pady=(2, 0))

        for title, items in SECTIONS:
            section(title, items)

        tk.Button(dlg, text='Close', command=dlg.destroy,
                  bg='#0e639c', fg='#fff', font=('Segoe UI', 10),
                  relief='flat', padx=20, pady=6, cursor='hand2').pack(pady=(0, 16))

    def _about_dialog(self):
        dlg = tk.Toplevel(self.root)
        dlg.title(f'About {APP_NAME}')
        dlg.geometry('360x220'); dlg.configure(bg='#1e1e1e')
        dlg.resizable(False, False); dlg.grab_set()
        self.root.after(50, lambda: _protect_win(dlg))
        tk.Label(dlg, text=APP_NAME, bg='#1e1e1e', fg='#007acc',
                 font=('Segoe UI', 18, 'bold')).pack(pady=(32, 4))
        tk.Label(dlg, text='Real-time messenger powered by TalentCodeHub',
                 bg='#1e1e1e', fg='#858585', font=('Segoe UI', 9)).pack()
        tk.Label(dlg, text='talentcodehub.com',
                 bg='#1e1e1e', fg='#4fc1ff', font=('Segoe UI', 9)).pack(pady=(4, 0))
        tk.Frame(dlg, bg='#474747', height=1).pack(fill=tk.X, padx=32, pady=20)
        tk.Button(dlg, text='Close', command=dlg.destroy,
                  bg='#0e639c', fg='#fff', font=('Segoe UI', 10),
                  relief='flat', padx=20, pady=6, cursor='hand2').pack()

    # ── Entry point helpers ────────────────────────────────────────────────────
    def _show_messenger(self):
        for w in self.main.winfo_children(): w.destroy()
        self._build_actbar()
        self.sidebar = tk.Frame(self.main, bg=C['sidebar'], width=256)
        self.sidebar.pack(side=tk.LEFT, fill=tk.Y); self.sidebar.pack_propagate(False)
        self._build_chat_area()
        self._switch('dm')


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    root = TkinterDnD.Tk() if HAS_DND else tk.Tk()
    App(root)
    root.mainloop()
