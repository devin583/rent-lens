#!/bin/bash
set -e

cd "$(dirname "$0")"

APP_URL="http://127.0.0.1:5173/"
EXTENSION_DIR="$(pwd)/extension"

echo "Starting Rent Lens..."
echo

install_node() {
  echo "Node.js 20 or newer is required."
  if command -v brew >/dev/null 2>&1; then
    echo "Homebrew detected. Installing Node.js with Homebrew..."
    brew install node
  else
    echo "Homebrew is not installed."
    echo "Opening the Node.js download page. Install Node.js 20 LTS or newer, then run this file again."
    open "https://nodejs.org/"
    echo
    read -r -p "Press Enter to close this window."
    exit 1
  fi
}

if ! command -v node >/dev/null 2>&1; then
  install_node
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Current Node.js version: $(node -v)"
  install_node
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is missing. Reinstall Node.js from https://nodejs.org/ and run this file again."
  open "https://nodejs.org/"
  echo
  read -r -p "Press Enter to close this window."
  exit 1
fi

echo "Environment OK:"
echo "  Node $(node -v)"
echo "  npm $(npm -v)"
echo

if [ ! -d "node_modules" ]; then
  echo "Installing project dependencies. This may take a few minutes..."
  npm install
  echo
else
  echo "Dependencies already installed."
  echo
fi

mkdir -p data

echo "The web app will open automatically: $APP_URL"
echo
echo "Browser extension note:"
echo "  Browsers do not allow local extensions to be installed automatically by a script."
echo "  This script will open the extension folder and browser extension page."
echo "  In Chrome or Edge, enable Developer mode, choose Load unpacked, then select:"
echo "  $EXTENSION_DIR"
echo

(
  sleep 4
  open "$APP_URL"
  sleep 1
  open "$EXTENSION_DIR"
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -a "Google Chrome" "chrome://extensions"
  elif [ -d "/Applications/Microsoft Edge.app" ]; then
    open -a "Microsoft Edge" "edge://extensions"
  fi
) &

npm run dev
