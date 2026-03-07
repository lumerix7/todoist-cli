#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SOURCE="$ROOT_DIR/skill"
SKILL_NAME="todoist-cli"

display_path() {
  local value="$1"
  if [[ "$value" == "$HOME"* ]]; then
    printf '~%s' "${value#$HOME}"
  else
    printf '%s' "$value"
  fi
}

resolve_default_targets() {
  if command -v openclaw >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    openclaw agents list --json 2>/dev/null \
      | awk 'BEGIN {capture=0} /^\[$/ {capture=1} capture {print; if (/^\]$/) exit}' \
      | jq -r '.[].workspace + "/skills"' \
      | awk 'NF' \
      | sort -u
    return 0
  fi
  return 1
}

usage() {
  cat <<'USAGE'
Usage: ./install-skill.sh [options] [target ...]

Install the todoist-cli skill into one or more OpenClaw workspace skills directories.

Options:
  -y, --yes   Skip confirmation prompt
  -h, --help  Show this help

Arguments:
  target      A skills directory to install into, for example: ~/my-workspace/skills

Notes:
  - If no targets are passed, the script tries to discover OpenClaw workspace skill directories.
  - Automatic discovery uses openclaw + jq when available.
USAGE
}

if [[ ! -d "$SKILL_SOURCE" ]]; then
  echo "Missing skill source directory: $SKILL_SOURCE" >&2
  exit 1
fi

AUTO_CONFIRM=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      AUTO_CONFIRM=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

TARGETS=("$@")
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  mapfile -t TARGETS < <(resolve_default_targets || true)
fi

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "No skill targets provided, and no default OpenClaw workspaces could be resolved." >&2
  echo "Automatic discovery uses openclaw + jq when available." >&2
  echo "Pass explicit targets, for example:" >&2
  echo "  ./install-skill.sh ~/some-workspace/skills" >&2
  exit 1
fi

echo "Skill source: $(display_path "$SKILL_SOURCE")"
echo "Install targets:"
for target in "${TARGETS[@]}"; do
  echo "  - $(display_path "$target")"
done

if [[ $AUTO_CONFIRM -ne 1 ]]; then
  read -r -n 1 -p "Install $SKILL_NAME skill to these targets? [y/N] " reply
  echo
  if [[ ! "$reply" =~ [Yy] ]]; then
    echo "Aborted."
    exit 1
  fi
fi

for target in "${TARGETS[@]}"; do
  mkdir -p "$target"
  rm -rf "$target/$SKILL_NAME"
  cp -R "$SKILL_SOURCE" "$target/$SKILL_NAME"
  chmod +x "$target/$SKILL_NAME/scripts/todoist"
  echo "Installed skill to $(display_path "$target")/$SKILL_NAME"
done
