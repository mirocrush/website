import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import ctypes, ctypes.wintypes, re, os

WDA_EXCLUDEFROMCAPTURE = 0x00000011

# ── VS Code Dark+ Palette ──────────────────────────────────────────────────────
C = {
    'bg':           '#1e1e1e',
    'sidebar':      '#252526',
    'activitybar':  '#333333',
    'tab_active':   '#1e1e1e',
    'tab_inactive': '#2d2d2d',
    'statusbar':    '#007acc',
    'fg':           '#d4d4d4',
    'line_num_fg':  '#858585',
    'selection':    '#264f78',
    'cur_line':     '#2a2d2e',
    'border':       '#474747',
    'icon':         '#858585',
    'icon_active':  '#ffffff',
    'highlight':    '#094771',
    'hover':        '#2a2d2e',
    'tab_top':      '#007acc',   # active tab top border
}

SYN = {
    'keyword':    '#569cd6',
    'string':     '#ce9178',
    'comment':    '#6a9955',
    'number':     '#b5cea8',
    'function':   '#dcdcaa',
    'classname':  '#4ec9b0',
    'decorator':  '#dcdcaa',
    'builtin':    '#4ec9b0',
    'self_kw':    '#9cdcfe',
}

KW = {'False','None','True','and','as','assert','async','await','break','class',
      'continue','def','del','elif','else','except','finally','for','from',
      'global','if','import','in','is','lambda','nonlocal','not','or','pass',
      'raise','return','try','while','with','yield'}

BUILTINS = {'print','len','range','type','int','str','float','list','dict','set',
            'tuple','bool','open','input','super','enumerate','zip','map','filter',
            'sorted','reversed','abs','max','min','sum','any','all','isinstance',
            'hasattr','getattr','setattr','dir','vars','repr','format'}

FILE_ICONS = {'.py':'🐍','.js':'📜','.ts':'📘','.html':'🌐','.css':'🎨',
              '.json':'{}','.md':'📝','.txt':'📄','.png':'🖼','.jpg':'🖼',
              '.gif':'🖼','.svg':'🎭','.sh':'⬢','.bat':'⬢','.yml':'⚙',
              '.yaml':'⚙','.env':'🔒','.gitignore':'🚫'}


# ── Custom Dark Scrollbar ──────────────────────────────────────────────────────
class DarkScrollbar(tk.Canvas):
    """Thin VS Code-style scrollbar using Canvas."""
    THUMB   = '#424242'
    THUMB_H = '#686868'
    SIZE    = 10

    def __init__(self, parent, orient='vertical', command=None, **kwargs):
        kw = dict(bg=C['bg'], highlightthickness=0, bd=0)
        if orient == 'vertical':
            kw['width'] = self.SIZE
        else:
            kw['height'] = self.SIZE
        super().__init__(parent, **kw, **kwargs)
        self.orient     = orient
        self.command    = command
        self._pos       = (0.0, 1.0)
        self._hovering  = False
        self._drag_off  = None

        self.bind('<Configure>',   lambda e: self._draw())
        self.bind('<ButtonPress-1>',  self._click)
        self.bind('<B1-Motion>',      self._drag)
        self.bind('<MouseWheel>',     self._wheel)
        self.bind('<Enter>', lambda e: self._hover(True))
        self.bind('<Leave>', lambda e: self._hover(False))

    def set(self, lo, hi):
        self._pos = (float(lo), float(hi))
        self._draw()

    def _draw(self):
        self.delete('all')
        lo, hi = self._pos
        if hi - lo >= 1.0:
            return
        color = self.THUMB_H if self._hovering else self.THUMB
        if self.orient == 'vertical':
            H = self.winfo_height() or 1
            W = self.winfo_width()
            y0, y1 = lo * H + 1, hi * H - 1
            if y1 - y0 < 16: y1 = y0 + 16
            self.create_rectangle(2, y0, W - 2, y1, fill=color, outline='', tags='t')
        else:
            W = self.winfo_width() or 1
            H = self.winfo_height()
            x0, x1 = lo * W + 1, hi * W - 1
            if x1 - x0 < 16: x1 = x0 + 16
            self.create_rectangle(x0, 2, x1, H - 2, fill=color, outline='', tags='t')

    def _hover(self, state):
        self._hovering = state
        self._draw()

    def _click(self, ev):
        lo, hi = self._pos
        if self.orient == 'vertical':
            total = self.winfo_height()
            t0, t1 = lo * total, hi * total
            if t0 <= ev.y <= t1:
                self._drag_off = ev.y - t0
            else:
                self.command and self.command('moveto', ev.y / total)
        else:
            total = self.winfo_width()
            t0, t1 = lo * total, hi * total
            if t0 <= ev.x <= t1:
                self._drag_off = ev.x - t0
            else:
                self.command and self.command('moveto', ev.x / total)

    def _drag(self, ev):
        if self._drag_off is None:
            return
        if self.orient == 'vertical':
            frac = (ev.y - self._drag_off) / (self.winfo_height() or 1)
        else:
            frac = (ev.x - self._drag_off) / (self.winfo_width() or 1)
        self.command and self.command('moveto', frac)

    def _wheel(self, ev):
        self.command and self.command('scroll', -1 if ev.delta > 0 else 1, 'units')


# ── Line Number Canvas ─────────────────────────────────────────────────────────
class LineNumbers(tk.Canvas):
    def __init__(self, parent, editor):
        super().__init__(parent, width=52, bg=C['bg'],
                         highlightthickness=0, bd=0)
        self.editor = editor
        for ev in ('<KeyRelease>', '<ButtonRelease>', '<Configure>'):
            editor.bind(ev, lambda e: self.redraw())
        editor.bind('<MouseWheel>', lambda e: self.after(10, self.redraw))

    def redraw(self):
        self.delete('all')
        cur_line = int(self.editor.index(tk.INSERT).split('.')[0])
        i = self.editor.index('@0,0')
        while True:
            info = self.editor.dlineinfo(i)
            if not info:
                break
            y, linenum = info[1], int(str(i).split('.')[0])
            color = '#c6c6c6' if linenum == cur_line else C['line_num_fg']
            self.create_text(46, y + 2, anchor='ne', text=str(linenum),
                             fill=color, font=('Consolas', 11))
            next_i = self.editor.index(f'{i}+1line')
            if next_i == i:
                break
            i = next_i


# ── Tab Data Object ────────────────────────────────────────────────────────────
class Tab:
    def __init__(self, name='untitled-1', content='', filepath=None):
        self.name     = name
        self.content  = content
        self.filepath = filepath
        self.modified = False
        self.frame    = None   # tk Frame in tab bar
        self.lbl      = None   # name Label


# ── Main Application ───────────────────────────────────────────────────────────
class VSCodeEditor:
    def __init__(self, root):
        self.root = root
        self.root.title('Visual Studio Code')
        self.root.geometry('1280x760')
        self.root.configure(bg=C['bg'])
        self.root.minsize(800, 500)

        # Hide window, apply dark titlebar before showing — prevents white flash
        self.root.withdraw()
        self.root.update_idletasks()
        self._dark_titlebar()
        self._load_icon()
        self.root.deiconify()

        self.tabs:       list[Tab] = []
        self.active_tab: Tab | None = None
        self.sidebar_on  = True

        self._styles()
        self._menubar()
        self._layout()
        self._statusbar()
        self._bindings()

        self.new_tab()
        self.root.after(200, self._protect)

    # ── Styles ─────────────────────────────────────────────────────────────────
    def _styles(self):
        s = ttk.Style()
        s.theme_use('clam')
        s.configure('Explorer.Treeview', background=C['sidebar'],
                    foreground=C['fg'], fieldbackground=C['sidebar'],
                    borderwidth=0, padding=0, rowheight=22,
                    font=('Segoe UI', 10), relief='flat')
        s.configure('Explorer.Treeview.Item', padding=0)
        s.layout('Explorer.Treeview', [('Treeview.treearea', {'sticky': 'nswe'})])
        s.map('Explorer.Treeview',
              background=[('selected', C['highlight'])],
              foreground=[('selected', '#ffffff')])

    # ── Menu bar (custom dark Frame — replaces native white menubar) ───────────
    def _menubar(self):
        MB_BG   = '#3c3c3c'
        MB_HOV  = '#505050'
        DROP_BG = '#252526'

        bar = tk.Frame(self.root, bg=MB_BG, height=30)
        bar.pack(fill=tk.X, side=tk.TOP)
        bar.pack_propagate(False)

        self._open_menu  = None   # currently visible tk.Menu
        self._open_btn   = None   # its trigger Label

        def _close_open():
            if self._open_menu:
                self._open_menu.unpost()
            if self._open_btn:
                self._open_btn.configure(bg=MB_BG)
            self._open_menu = None
            self._open_btn  = None

        def make_entry(label, items):
            m = tk.Menu(self.root, tearoff=False, bg=DROP_BG, fg=C['fg'],
                        activebackground=C['highlight'], activeforeground='#fff',
                        borderwidth=1, relief='flat',
                        activeborderwidth=0, font=('Segoe UI', 9))
            for item in items:
                if item == '---':
                    m.add_separator(background=C['border'])
                else:
                    m.add_command(label=item[0], command=item[1],
                                  activebackground=C['highlight'],
                                  activeforeground='#fff')

            btn = tk.Label(bar, text=label, bg=MB_BG, fg=C['fg'],
                           font=('Segoe UI', 9), padx=10, pady=5,
                           cursor='hand2')
            btn.pack(side=tk.LEFT)

            def show(ev, b=btn, menu=m):
                if self._open_menu is menu:
                    _close_open(); return
                _close_open()
                self._open_menu = menu
                self._open_btn  = b
                b.configure(bg=MB_HOV)
                menu.post(b.winfo_rootx(), b.winfo_rooty() + b.winfo_height())

            def enter(ev, b=btn):
                b.configure(bg=MB_HOV)
                # slide: if another menu is open, switch to this one
                if self._open_menu and self._open_menu is not m:
                    show(ev)

            def leave(ev, b=btn):
                if self._open_btn is not b:
                    b.configure(bg=MB_BG)

            btn.bind('<Button-1>', show)
            btn.bind('<Enter>',    enter)
            btn.bind('<Leave>',    leave)

        make_entry('File', [
            ('New File          Ctrl+N', self.new_tab),
            ('Open File…        Ctrl+O', self.open_file),
            '---',
            ('Save              Ctrl+S', self.save_file),
            ('Save As…   Ctrl+Shift+S', self.save_as),
            '---',
            ('Exit', self.root.quit),
        ])
        make_entry('Edit', [
            ('Undo        Ctrl+Z', lambda: self.editor.event_generate('<<Undo>>')),
            ('Redo        Ctrl+Y', lambda: self.editor.event_generate('<<Redo>>')),
            '---',
            ('Cut         Ctrl+X', lambda: self.editor.event_generate('<<Cut>>')),
            ('Copy        Ctrl+C', lambda: self.editor.event_generate('<<Copy>>')),
            ('Paste       Ctrl+V', lambda: self.editor.event_generate('<<Paste>>')),
            '---',
            ('Select All  Ctrl+A', lambda: self.editor.tag_add('sel','1.0',tk.END)),
        ])
        make_entry('View', [
            ('Toggle Sidebar   Ctrl+B', self.toggle_sidebar),
            ('Toggle Word Wrap', self.toggle_wrap),
        ])
        make_entry('Help', [
            ('About', lambda: None),
        ])

    # ── Layout ─────────────────────────────────────────────────────────────────
    def _layout(self):
        self.main = tk.Frame(self.root, bg=C['bg'])
        self.main.pack(fill=tk.BOTH, expand=True)

        self._activity_bar()

        self.content = tk.Frame(self.main, bg=C['bg'])
        self.content.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self._sidebar()
        self._editor_area()

    def _activity_bar(self):
        bar = tk.Frame(self.main, bg=C['activitybar'], width=48)
        bar.pack(side=tk.LEFT, fill=tk.Y)
        bar.pack_propagate(False)

        def icon_btn(parent, text, cmd=None, side=tk.TOP):
            lbl = tk.Label(parent, text=text, bg=C['activitybar'], fg=C['icon'],
                           font=('Segoe UI Symbol', 17), width=2, pady=8,
                           cursor='hand2')
            lbl.pack(side=side, pady=1)
            if cmd:
                lbl.bind('<Button-1>', lambda e: cmd())
            lbl.bind('<Enter>', lambda e, l=lbl: l.configure(fg=C['icon_active']))
            lbl.bind('<Leave>', lambda e, l=lbl: l.configure(fg=C['icon']))
            return lbl

        icon_btn(bar, '⬡', self.toggle_sidebar)
        icon_btn(bar, '⌕')
        icon_btn(bar, '⎇')
        icon_btn(bar, '⬡')
        icon_btn(bar, '⚙', side=tk.BOTTOM)

    def _sidebar(self):
        self.sidebar = tk.Frame(self.content, bg=C['sidebar'], width=230)
        self.sidebar.pack(side=tk.LEFT, fill=tk.Y)
        self.sidebar.pack_propagate(False)

        # Header
        tk.Label(self.sidebar, text='EXPLORER', bg=C['sidebar'],
                 fg=C['line_num_fg'], font=('Segoe UI', 9, 'bold'),
                 padx=12, pady=8, anchor='w').pack(fill=tk.X)

        # Open Editors section
        tk.Label(self.sidebar, text='▾  OPEN EDITORS', bg=C['sidebar'],
                 fg=C['line_num_fg'], font=('Segoe UI', 9), padx=12,
                 pady=2, anchor='w').pack(fill=tk.X)

        self.open_list = tk.Frame(self.sidebar, bg=C['sidebar'])
        self.open_list.pack(fill=tk.X)

        tk.Frame(self.sidebar, bg=C['border'], height=1).pack(fill=tk.X, pady=4)

        # Workspace section
        tk.Label(self.sidebar, text='▾  WORKSPACE', bg=C['sidebar'],
                 fg=C['line_num_fg'], font=('Segoe UI', 9), padx=12,
                 pady=2, anchor='w').pack(fill=tk.X)

        # File tree
        tf = tk.Frame(self.sidebar, bg=C['sidebar'])
        tf.pack(fill=tk.BOTH, expand=True)

        self.tree = ttk.Treeview(tf, style='Explorer.Treeview',
                                  show='tree', selectmode='browse')
        vsb = DarkScrollbar(tf, orient='vertical', command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.bind('<Double-1>', self._tree_open)
        self._tree_populate(os.getcwd())

    def _tree_populate(self, path):
        self.tree.delete(*self.tree.get_children())
        root_node = self.tree.insert('', 'end',
                                     text=f'📁 {os.path.basename(path) or path}',
                                     open=True, values=[path])
        try:
            entries = sorted(os.listdir(path), key=lambda e: (
                not os.path.isdir(os.path.join(path, e)), e.lower()))
            for name in entries[:80]:
                if name.startswith('.'):
                    continue
                fp = os.path.join(path, name)
                if os.path.isdir(fp):
                    self.tree.insert(root_node, 'end', text=f'📁 {name}', values=[fp])
                else:
                    icon = FILE_ICONS.get(os.path.splitext(name)[1].lower(), '📄')
                    self.tree.insert(root_node, 'end', text=f'{icon} {name}',
                                     values=[fp])
        except PermissionError:
            pass

    def _tree_open(self, event):
        sel = self.tree.selection()
        if sel:
            fp = self.tree.item(sel[0], 'values')
            if fp and os.path.isfile(fp[0]):
                self.open_file(fp[0])

    def _editor_area(self):
        self.editor_area = tk.Frame(self.content, bg=C['bg'])
        self.editor_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Tab bar
        self.tab_bar = tk.Frame(self.editor_area, bg=C['tab_inactive'], height=35)
        self.tab_bar.pack(fill=tk.X)
        self.tab_bar.pack_propagate(False)

        # Breadcrumb
        bc = tk.Frame(self.editor_area, bg='#252526', height=24)
        bc.pack(fill=tk.X)
        bc.pack_propagate(False)
        self.breadcrumb = tk.Label(bc, text='untitled-1', bg='#252526',
                                   fg='#cccccc', font=('Segoe UI', 9), padx=12)
        self.breadcrumb.pack(side=tk.LEFT, pady=3)

        # Editor + line numbers
        ec = tk.Frame(self.editor_area, bg=C['bg'])
        ec.pack(fill=tk.BOTH, expand=True)

        self.ln_frame = tk.Frame(ec, bg=C['bg'])
        self.ln_frame.pack(side=tk.LEFT, fill=tk.Y)

        vsb = DarkScrollbar(ec, orient='vertical')
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        hsb = DarkScrollbar(self.editor_area, orient='horizontal')
        hsb.pack(side=tk.BOTTOM, fill=tk.X, before=ec)

        self.editor = tk.Text(
            ec,
            bg=C['bg'], fg=C['fg'],
            insertbackground='#aeafad',
            selectbackground=C['selection'], selectforeground=C['fg'],
            font=('Consolas', 12), wrap=tk.NONE, undo=True,
            padx=10, pady=6, relief='flat', borderwidth=0,
            highlightthickness=0,
            yscrollcommand=self._yscroll, xscrollcommand=hsb.set,
            spacing1=2, spacing3=2, tabs=('4c',),
        )
        self.editor.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.command = self._sync_y
        hsb.command = self.editor.xview
        self._vsb = vsb

        self.line_numbers = LineNumbers(self.ln_frame, self.editor)
        self.line_numbers.pack(fill=tk.Y, expand=True)

        self._syn_tags()

    def _yscroll(self, *args):
        self._vsb.set(*args)
        self.line_numbers.redraw()

    def _sync_y(self, *args):
        self.editor.yview(*args)
        self.line_numbers.redraw()

    # ── Status bar ─────────────────────────────────────────────────────────────
    def _statusbar(self):
        SB   = '#1e1e1e'   # dark background
        DIV  = '#3a3a3a'   # subtle divider
        FNT  = ('Segoe UI', 9)

        sb = tk.Frame(self.root, bg=SB, height=22)
        sb.pack(side=tk.BOTTOM, fill=tk.X)
        sb.pack_propagate(False)

        def item(text, side=tk.LEFT, padx=10, **kw):
            lbl = tk.Label(sb, text=text, bg=SB, fg='#ffffff',
                           font=FNT, padx=padx, **kw)
            lbl.pack(side=side, fill=tk.Y)
            return lbl

        def div(side=tk.LEFT):
            tk.Frame(sb, bg=DIV, width=1).pack(side=side, fill=tk.Y, pady=2)

        # Left
        self.protect_lbl = item('⚡ Protected'); div()
        item('⎇  main'); div()

        # Right
        def rdiv(): div(tk.RIGHT)

        tk.Label(sb, text='Opacity', bg=SB, fg='#888888',
                 font=('Segoe UI', 8)).pack(side=tk.RIGHT, padx=(0, 2))
        self.opacity = tk.Scale(
            sb, from_=10, to=100, orient=tk.HORIZONTAL,
            command=self._set_opacity, length=220, showvalue=False,
            bg=SB, troughcolor='#3c3c3c',
            highlightthickness=0, sliderrelief='flat', bd=0,
            width=14, sliderlength=18,
        )
        self.opacity.set(100)
        self.opacity.pack(side=tk.RIGHT, pady=1, padx=2); rdiv()

        item('UTF-8', tk.RIGHT); rdiv()
        item('Python', tk.RIGHT); rdiv()
        self.pos_lbl = item('Ln 1, Col 1', tk.RIGHT); rdiv()

    # ── Key bindings ───────────────────────────────────────────────────────────
    def _bindings(self):
        self.root.bind('<Control-n>', lambda e: self.new_tab())
        self.root.bind('<Control-o>', lambda e: self.open_file())
        self.root.bind('<Control-s>', lambda e: self.save_file())
        self.root.bind('<Control-S>', lambda e: self.save_as())
        self.root.bind('<Control-b>', lambda e: self.toggle_sidebar())
        self.root.bind('<Control-w>', lambda e: self.close_tab(self.active_tab))
        self.root.bind('<Control-Left>',  lambda e: self._adjust_opacity(-5))
        self.root.bind('<Control-Right>', lambda e: self._adjust_opacity(+5))
        self.editor.bind('<KeyRelease>', self._on_key)
        self.editor.bind('<ButtonRelease>', self._on_click)
        self.editor.bind('<Tab>', self._tab_key)
        self.editor.bind('<Return>', self._return_key)

    # ── Tab management ─────────────────────────────────────────────────────────
    def new_tab(self, name=None, content='', filepath=None):
        n = name or f'untitled-{len(self.tabs)+1}'
        tab = Tab(n, content, filepath)
        self.tabs.append(tab)
        self._make_tab_btn(tab)
        self.switch_tab(tab)

    def _make_tab_btn(self, tab: Tab):
        frame = tk.Frame(self.tab_bar, bg=C['tab_inactive'], cursor='hand2')
        frame.pack(side=tk.LEFT)

        lbl = tk.Label(frame, text=tab.name, bg=C['tab_inactive'],
                       fg=C['line_num_fg'], font=('Segoe UI', 10),
                       padx=10, pady=6)
        lbl.pack(side=tk.LEFT)

        x = tk.Label(frame, text='×', bg=C['tab_inactive'], fg=C['line_num_fg'],
                     font=('Segoe UI', 12), padx=6)
        x.pack(side=tk.LEFT)

        # Active top border canvas
        top = tk.Canvas(frame, height=2, bg=C['tab_inactive'],
                        highlightthickness=0)
        top.place(relx=0, rely=0, relwidth=1, height=2)

        tab.frame = frame
        tab.lbl   = lbl
        tab._top  = top
        tab._x    = x

        for w in (frame, lbl, x):
            w.bind('<Button-1>', lambda e, t=tab: self.switch_tab(t))
        x.bind('<Button-1>', lambda e, t=tab: (self.close_tab(t), 'break'))

        def enter(t=tab):
            if t is not self.active_tab:
                t.frame.configure(bg=C['hover'])
                t.lbl.configure(bg=C['hover'])
                t._x.configure(bg=C['hover'])
        def leave(t=tab):
            bg = C['tab_active'] if t is self.active_tab else C['tab_inactive']
            t.frame.configure(bg=bg); t.lbl.configure(bg=bg); t._x.configure(bg=bg)

        for w in (frame, lbl, x):
            w.bind('<Enter>', lambda e, t=tab: enter(t))
            w.bind('<Leave>', lambda e, t=tab: leave(t))

        # Open editors sidebar list
        el = tk.Label(self.open_list, text=f'  📄 {tab.name}',
                      bg=C['sidebar'], fg=C['fg'], font=('Segoe UI', 9),
                      anchor='w', cursor='hand2', padx=8)
        el.pack(fill=tk.X)
        el.bind('<Button-1>', lambda e, t=tab: self.switch_tab(t))
        tab._explorer_lbl = el

    def switch_tab(self, tab: Tab):
        # Save previous content
        if self.active_tab:
            self.active_tab.content = self.editor.get('1.0', tk.END + '-1c')
            self._deactivate_tab(self.active_tab)

        self.active_tab = tab
        self.editor.delete('1.0', tk.END)
        self.editor.insert('1.0', tab.content)

        # Activate styling
        tab.frame.configure(bg=C['tab_active'])
        tab.lbl.configure(bg=C['tab_active'], fg='#ffffff')
        tab._x.configure(bg=C['tab_active'])
        tab._top.configure(bg=C['tab_top'])
        tab._top.place(relx=0, rely=0, relwidth=1, height=2)

        self.breadcrumb.configure(text=tab.filepath or tab.name)
        self._highlight_syn()
        self.line_numbers.redraw()
        self._cur_line()
        self.editor.focus_set()

    def _deactivate_tab(self, tab: Tab):
        tab.frame.configure(bg=C['tab_inactive'])
        tab.lbl.configure(bg=C['tab_inactive'], fg=C['line_num_fg'])
        tab._x.configure(bg=C['tab_inactive'])
        tab._top.configure(bg=C['tab_inactive'])

    def close_tab(self, tab: Tab):
        if not tab:
            return
        if len(self.tabs) == 1:
            # Reset instead of close
            self.tabs[0].name = 'untitled-1'
            self.tabs[0].content = ''
            self.tabs[0].filepath = None
            self.tabs[0].modified = False
            self.tabs[0].lbl.configure(text='untitled-1')
            self.editor.delete('1.0', tk.END)
            return

        idx = self.tabs.index(tab)
        tab.frame.destroy()
        tab._explorer_lbl.destroy()
        self.tabs.remove(tab)

        if self.active_tab is tab:
            self.active_tab = None
            next_tab = self.tabs[min(idx, len(self.tabs)-1)]
            self.switch_tab(next_tab)

    # ── Syntax highlighting ────────────────────────────────────────────────────
    def _syn_tags(self):
        for name, color in SYN.items():
            self.editor.tag_configure(name, foreground=color)
        self.editor.tag_configure('cur_line', background=C['cur_line'])

    def _highlight_syn(self):
        for tag in SYN:
            self.editor.tag_remove(tag, '1.0', tk.END)
        content = self.editor.get('1.0', tk.END)

        def apply(pattern, tag, flags=0):
            for m in re.finditer(pattern, content, flags):
                s = self._idx(m.start())
                e = self._idx(m.end())
                self.editor.tag_add(tag, s, e)

        apply(r'#[^\n]*',                                 'comment')
        apply(r'("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|'
              r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')', 'string')
        apply(r'\b\d+\.?\d*\b',                           'number')
        apply(r'\b(' + '|'.join(KW) + r')\b',            'keyword')
        apply(r'\b(' + '|'.join(BUILTINS) + r')\b',      'builtin')
        apply(r'\bself\b',                                'self_kw')
        apply(r'(?<=def )\w+',                            'function')
        apply(r'(?<=class )\w+',                          'classname')
        apply(r'@\w+',                                    'decorator')

    def _idx(self, offset):
        content = self.editor.get('1.0', tk.END)
        line = content[:offset].count('\n') + 1
        col  = offset - content[:offset].rfind('\n') - 1
        return f'{line}.{col}'

    # ── Editor events ──────────────────────────────────────────────────────────
    def _on_key(self, event=None):
        self._highlight_syn()
        self._cur_line()
        self._mark_modified()

    def _on_click(self, event=None):
        self._cur_line()
        self._update_pos()

    def _cur_line(self):
        self.editor.tag_remove('cur_line', '1.0', tk.END)
        ln = self.editor.index(tk.INSERT).split('.')[0]
        self.editor.tag_add('cur_line', f'{ln}.0', f'{ln}.end+1c')
        self.editor.tag_lower('cur_line')
        self._update_pos()

    def _update_pos(self):
        pos = self.editor.index(tk.INSERT)
        ln, col = pos.split('.')
        self.pos_lbl.configure(text=f'Ln {ln}, Col {int(col)+1}')

    def _mark_modified(self):
        if self.active_tab and not self.active_tab.modified:
            self.active_tab.modified = True
            self.active_tab.lbl.configure(text=f'● {self.active_tab.name}')

    def _tab_key(self, event):
        self.editor.insert(tk.INSERT, '    ')
        return 'break'

    def _return_key(self, event):
        line    = self.editor.get('insert linestart', 'insert')
        indent  = len(line) - len(line.lstrip())
        if line.rstrip().endswith(':'):
            indent += 4
        self.editor.insert(tk.INSERT, '\n' + ' ' * indent)
        return 'break'

    # ── File operations ────────────────────────────────────────────────────────
    def open_file(self, filepath=None):
        if not filepath:
            filepath = filedialog.askopenfilename(
                filetypes=[('Python','*.py'),('Text','*.txt'),('All','*.*')])
        if not filepath:
            return
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            self.new_tab(os.path.basename(filepath), content, filepath)
            self._tree_populate(os.path.dirname(filepath))
        except Exception as ex:
            messagebox.showerror('Error', str(ex))

    def save_file(self):
        if not self.active_tab:
            return
        if self.active_tab.filepath:
            self.active_tab.content = self.editor.get('1.0', tk.END + '-1c')
            with open(self.active_tab.filepath, 'w', encoding='utf-8') as f:
                f.write(self.active_tab.content)
            self.active_tab.modified = False
            self.active_tab.lbl.configure(text=self.active_tab.name)
        else:
            self.save_as()

    def save_as(self):
        if not self.active_tab:
            return
        fp = filedialog.asksaveasfilename(
            defaultextension='.py',
            filetypes=[('Python','*.py'),('Text','*.txt'),('All','*.*')])
        if fp:
            self.active_tab.filepath = fp
            self.active_tab.name     = os.path.basename(fp)
            self.active_tab.lbl.configure(text=self.active_tab.name)
            self.save_file()

    # ── View toggles ───────────────────────────────────────────────────────────
    def toggle_sidebar(self):
        if self.sidebar_on:
            self.sidebar.pack_forget()
        else:
            self.sidebar.pack(side=tk.LEFT, fill=tk.Y, before=self.editor_area)
        self.sidebar_on = not self.sidebar_on

    def toggle_wrap(self):
        mode = self.editor.cget('wrap')
        self.editor.configure(wrap=tk.NONE if mode == tk.WORD else tk.WORD)

    # ── Protection & Opacity ───────────────────────────────────────────────────
    def _set_opacity(self, v):
        self.root.attributes('-alpha', int(v) / 100)

    def _adjust_opacity(self, delta):
        val = max(10, min(100, self.opacity.get() + delta))
        self.opacity.set(val)
        self.root.attributes('-alpha', val / 100)

    def _dark_titlebar(self):
        """Apply Windows dark mode to the native title bar."""
        try:
            hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id()) or self.root.winfo_id()
            for attr in (20, 19):
                ctypes.windll.dwmapi.DwmSetWindowAttribute(
                    hwnd, attr,
                    ctypes.byref(ctypes.c_int(1)),
                    ctypes.sizeof(ctypes.c_int)
                )
        except Exception:
            pass

    def _load_icon(self):
        """Load VS Code icon from icon.ico if it exists."""
        ico = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.ico')
        if not os.path.exists(ico):
            # Try next to the exe (PyInstaller)
            ico = os.path.join(os.path.dirname(os.path.abspath(
                __import__('sys').executable)), 'icon.ico')
        try:
            self.root.iconbitmap(ico)
        except Exception:
            pass

    def _protect(self):
        hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id()) or self.root.winfo_id()
        ok   = ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
        self.protect_lbl.configure(
            text='⚡ Protected' if ok else '⚠ Not Protected',
            fg='#aaffaa' if ok else '#ffaaaa')


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    root = tk.Tk()
    VSCodeEditor(root)
    root.mainloop()
