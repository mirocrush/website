#!/bin/bash
# Build the TalentCodeHub .deb package
# Run from the deb/ directory: bash build.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
OUTPUT="$SCRIPT_DIR/talentcodehub_1.0.0_all.deb"

# Ensure correct permissions
chmod 755 "$BUILD_DIR/DEBIAN"
chmod 644 "$BUILD_DIR/DEBIAN/control"
chmod 755 "$BUILD_DIR/DEBIAN/postinst"
chmod 755 "$BUILD_DIR/usr/bin/talentcodehub"
chmod 755 "$BUILD_DIR/usr/share/talentcodehub/app.py"
chmod 644 "$BUILD_DIR/usr/share/applications/talentcodehub.desktop"

# Build the .deb
dpkg-deb --build "$BUILD_DIR" "$OUTPUT"

echo ""
echo "Package built: $OUTPUT"
echo "Install with:  sudo apt install ./$OUTPUT"
echo "             or: sudo dpkg -i $OUTPUT && sudo apt-get install -f"
