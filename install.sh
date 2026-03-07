#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/todoist-cli"
CONFIG_PATH="$CONFIG_DIR/config.json"
PACKAGE_NAME="@efficiency/todoist-cli"
AUTO_YES=0

usage() {
  cat <<EOF
Usage: ./install.sh [options]

Options:
  -y, --yes   Install the CLI globally without prompting
  -h, --help  Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      AUTO_YES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

echo "Installing npm dependencies..."
npm install

INSTALL_GLOBAL="n"
if [[ "$AUTO_YES" -eq 1 ]]; then
  INSTALL_GLOBAL="y"
else
  read -r -n 1 -p "Install @efficiency/todoist-cli globally as todoist-cli? [y/N] " INSTALL_GLOBAL
  echo
fi

if [[ "$INSTALL_GLOBAL" =~ ^[Yy]$ ]]; then
  GLOBAL_NODE_MODULES="$(npm root -g)"
  GLOBAL_PACKAGE_PATH="$GLOBAL_NODE_MODULES/$PACKAGE_NAME"
  PACKAGE_TARBALL=""

  if [[ -L "$GLOBAL_PACKAGE_PATH" ]]; then
    echo "Removing existing global link at $GLOBAL_PACKAGE_PATH..."
    npm uninstall -g "$PACKAGE_NAME"
  fi

  echo "Packing @efficiency/todoist-cli for copy-style global install..."
  PACKAGE_TARBALL="$(npm pack --quiet)"

  echo "Installing @efficiency/todoist-cli globally as todoist-cli..."
  npm install -g "./$PACKAGE_TARBALL"
  rm -f "./$PACKAGE_TARBALL"
else
  echo "Skipped global install. Run 'npm install -g .' later if needed."
fi

echo "Ensuring config directory exists..."
mkdir -p "$CONFIG_DIR"

if [[ ! -f "$CONFIG_PATH" ]]; then
  cp "$ROOT_DIR/config.example.json" "$CONFIG_PATH"
  echo "Created $CONFIG_PATH from config.example.json"
else
  echo "Config already exists at $CONFIG_PATH"
fi

cat <<EOF

Install complete.

Next:
1. Edit $CONFIG_PATH and set your Todoist token.
2. Test:
   todoist-cli whoami
   todoist-cli today
EOF
