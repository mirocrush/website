#!/bin/bash
# Build script for TalentCodeHub Desktop Client .deb package
set -e

# ── Configuration ──────────────────────────────────────────────────
APP_NAME="talentcodehub"
APP_VERSION="1.0.0"
ARCH="all"
MAINTAINER="TalentCodeHub <support@talentcodehub.com>"
DESCRIPTION="TalentCodeHub Desktop Client - Sign in and fetch GitHub issues with your associated prompt."
DEPENDS="python3, python3-tk, python3-requests, python3-pexpect"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PKG_DIR="$BUILD_DIR/${APP_NAME}_${APP_VERSION}_${ARCH}"
DEB_OUT="$SCRIPT_DIR/${APP_NAME}_${APP_VERSION}_${ARCH}.deb"

echo "==> Cleaning previous build..."
rm -rf "$BUILD_DIR"

# ── Package directory structure ────────────────────────────────────
echo "==> Creating package structure..."
mkdir -p "$PKG_DIR/DEBIAN"
mkdir -p "$PKG_DIR/usr/bin"
mkdir -p "$PKG_DIR/usr/lib/$APP_NAME"
mkdir -p "$PKG_DIR/usr/share/applications"

# ── Copy application source ────────────────────────────────────────
echo "==> Copying application files..."
cp "$SCRIPT_DIR/src/app.py" "$PKG_DIR/usr/lib/$APP_NAME/app.py"

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

# ── DEBIAN/postinst (run after install) ───────────────────────────
cat > "$PKG_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
chmod 644 /usr/lib/talentcodehub/app.py
EOF
chmod 755 "$PKG_DIR/DEBIAN/postinst"

# ── Desktop entry (shows app in application menu) ─────────────────
cat > "$PKG_DIR/usr/share/applications/$APP_NAME.desktop" << EOF
[Desktop Entry]
Name=TalentCodeHub
Comment=Sign in and fetch GitHub issues
Exec=$APP_NAME
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
echo "To install, run:"
echo "  sudo dpkg -i $DEB_OUT"
echo ""
echo "To uninstall, run:"
echo "  sudo dpkg -r $APP_NAME"
