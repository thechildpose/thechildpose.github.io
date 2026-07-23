#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

node scripts/sync-content.mjs

if [[ -z "$(git status --porcelain content)" ]]; then
  echo "No changes to publish."
  exit 0
fi

git add content
git commit -m "Sync published articles $(date '+%Y-%m-%d %H:%M')"
git push origin v5

echo "Published. Site will update in a minute or two at https://thechildpose.github.io/"
