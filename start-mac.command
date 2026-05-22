#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Starting Rent Lens..."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install Node.js 20 or newer first: https://nodejs.org/"
  echo
  read -r -p "Press Enter to close this window."
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Your Node.js version is too old."
  echo "Current: $(node -v)"
  echo "Please install Node.js 20 or newer: https://nodejs.org/"
  echo
  read -r -p "Press Enter to close this window."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies. This may take a few minutes..."
  npm install
  echo
fi

echo "Opening http://127.0.0.1:5173/"
(sleep 4 && open "http://127.0.0.1:5173/") &

npm run dev
