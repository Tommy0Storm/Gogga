#!/bin/bash
# Fix .next folder permissions
# Run with: sudo ./fix-permissions.sh

echo "Removing root-owned .next folder..."
rm -rf .next .next-root-broken
echo "Done! Now run: pnpm dev"
