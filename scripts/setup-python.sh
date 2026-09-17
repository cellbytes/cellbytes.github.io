#!/bin/sh
# Build ./.venv from the helper scripts' PEP 723 metadata, for the editor.
#
# The scripts themselves run under `uv run --script`, which resolves their
# inline `dependencies` on its own and never looks here. ty does not: a script
# with inline metadata is its own single-file project with no environment, so
# without this venv every third-party import is reported unresolved in the
# editor. `.vscode/settings.json` points ty at it.
set -eu
cd "$(dirname "$0")/.."

uv venv .venv
for script in scripts/*.py; do
    grep -q '^# /// script' "$script" || continue
    uv export --script "$script" --no-hashes
done | grep -v '^#' | grep -v '^[[:space:]]*$' | uv pip install --python .venv -r -
