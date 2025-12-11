#!/bin/bash
# GoggaTalk - Terminal Voice Chat Launcher
# 
# Usage: ./run_gogga_talk.sh [--tier jive|jigga] [--debug]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for GOOGLE_API_KEY
if [ -z "$GOOGLE_API_KEY" ]; then
    echo "❌ GOOGLE_API_KEY environment variable not set"
    echo ""
    echo "Set it with:"
    echo "  export GOOGLE_API_KEY='your-api-key'"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    exit 1
fi

# Check/install dependencies
echo "🔍 Checking dependencies..."
pip3 install -q google-genai pyaudio rich 2>/dev/null || {
    echo "⚠️  Installing dependencies..."
    pip3 install google-genai pyaudio rich
}

# Run GoggaTalk
echo ""
echo "🎙️  Starting GoggaTalk..."
echo ""
python3 gogga_talk.py "$@"
