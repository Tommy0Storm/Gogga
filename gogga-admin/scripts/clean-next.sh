#!/bin/sh
# Clean .next directory before dev to avoid permission issues
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -d "$PROJECT_DIR/.next" ]; then
    echo "Cleaning .next directory..."
    rm -rf "$PROJECT_DIR/.next" 2>/dev/null || {
        echo "Permission denied - trying with user ownership..."
        find "$PROJECT_DIR/.next" -type d -exec chmod u+rwx {} \; 2>/dev/null
        find "$PROJECT_DIR/.next" -type f -exec chmod u+rw {} \; 2>/dev/null
        rm -rf "$PROJECT_DIR/.next"
    }
fi
echo ".next cleaned"
