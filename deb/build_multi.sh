#!/bin/bash
# Build script for TalentCodeHub Multi-Worker Desktop Client .deb package
set -e

# ── Configuration ──────────────────────────────────────────────────
APP_NAME="talentcodehub"
APP_VERSION="2.0.0"
ARCH="all"
MAINTAINER="TalentCodeHub <support@talentcodehub.com>"
DESCRIPTION="TalentCodeHub Desktop Client - Multi-worker PR preparation and interaction tool."
DEPENDS="python3, python3-tk, python3-requests, python3-pexpect, python3-psutil, tmux"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PKG_DIR="$BUILD_DIR/${APP_NAME}_${APP_VERSION}_${ARCH}"
DEB_OUT="$SCRIPT_DIR/${APP_NAME}_${APP_VERSION}_${ARCH}.deb"

# ── Preflight checks ────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/app.py" ]; then
    echo "ERROR: app.py not found in $SCRIPT_DIR"
    exit 1
fi

if ! command -v dpkg-deb &>/dev/null; then
    echo "ERROR: dpkg-deb not found. Install with: sudo apt install dpkg"
    exit 1
fi

echo "==> Cleaning previous build..."
rm -rf "$BUILD_DIR"

# ── Package directory structure ────────────────────────────────────
echo "==> Creating package structure..."
mkdir -p "$PKG_DIR/DEBIAN"
mkdir -p "$PKG_DIR/usr/bin"
mkdir -p "$PKG_DIR/usr/lib/$APP_NAME"
mkdir -p "$PKG_DIR/usr/share/applications"
mkdir -p "$PKG_DIR/usr/share/pixmaps"
mkdir -p "$PKG_DIR/usr/share/icons/hicolor/256x256/apps"

# ── Copy application files ─────────────────────────────────────────
echo "==> Copying application files..."
cp "$SCRIPT_DIR/app.py" "$PKG_DIR/usr/lib/$APP_NAME/app.py"

# Copy icon if it exists (optional)
if [ -f "$SCRIPT_DIR/talent-icon.png" ]; then
    cp "$SCRIPT_DIR/talent-icon.png" "$PKG_DIR/usr/lib/$APP_NAME/talent-icon.png"
    cp "$SCRIPT_DIR/talent-icon.png" "$PKG_DIR/usr/share/pixmaps/$APP_NAME.png"
    cp "$SCRIPT_DIR/talent-icon.png" "$PKG_DIR/usr/share/icons/hicolor/256x256/apps/$APP_NAME.png"
fi

# ── Create launcher script ─────────────────────────────────────────
cat > "$PKG_DIR/usr/bin/$APP_NAME" << 'EOF'
#!/bin/bash
exec python3 /usr/lib/talentcodehub/app.py "$@"
EOF
chmod 755 "$PKG_DIR/usr/bin/$APP_NAME"

# ── DEBIAN/control ─────────────────────────────────────────────────
cat > "$PKG_DIR/DEBIAN/control" << EOF
Package: $APP_NAME
Version: $APP_VERSION
Architecture: $ARCH
Maintainer: $MAINTAINER
Depends: $DEPENDS
Section: utils
Priority: optional
Description: $DESCRIPTION
EOF

# ── DEBIAN/preinst (kill running app before install/upgrade) ───────
cat > "$PKG_DIR/DEBIAN/preinst" << 'EOF'
#!/bin/bash
pkill -f "talentcodehub/app.py" 2>/dev/null || true
sleep 1
exit 0
EOF
chmod 755 "$PKG_DIR/DEBIAN/preinst"

# ── DEBIAN/prerm (kill running app before removal) ────────────────
cat > "$PKG_DIR/DEBIAN/prerm" << 'EOF'
#!/bin/bash
pkill -f "talentcodehub/app.py" 2>/dev/null || true
sleep 1
exit 0
EOF
chmod 755 "$PKG_DIR/DEBIAN/prerm"

# ── DEBIAN/postinst (fix permissions after install) ───────────────
cat > "$PKG_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
chmod 644 /usr/lib/talentcodehub/app.py
if [ -f /usr/lib/talentcodehub/talent-icon.png ]; then
    chmod 644 /usr/lib/talentcodehub/talent-icon.png
fi
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || true
fi
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database /usr/share/applications 2>/dev/null || true
fi
exit 0
EOF
chmod 755 "$PKG_DIR/DEBIAN/postinst"

# ── Desktop entry ─────────────────────────────────────────────────
cat > "$PKG_DIR/usr/share/applications/$APP_NAME.desktop" << EOF
[Desktop Entry]
Name=TalentCodeHub
Comment=Multi-worker PR preparation and interaction
Exec=$APP_NAME
Icon=$APP_NAME
Terminal=false
Type=Application
Categories=Development;Utility;
EOF

# ── Build the .deb ────────────────────────────────────────────────
echo "==> Building .deb package..."
dpkg-deb --build --root-owner-group "$PKG_DIR" "$DEB_OUT"

echo ""
echo "Build complete: $DEB_OUT"
echo ""
echo "To install:   sudo dpkg -i $DEB_OUT"
echo "To upgrade:   sudo dpkg -i $DEB_OUT"
echo "To remove:    sudo dpkg -r $APP_NAME"
echo ""
