#!/usr/bin/env bash
# setup-dev.sh
# Pour les mainteneurs : remplace les stubs dicos par des symlinks
# vers le repo privé epure-chrome, puis les marque skip-worktree
# pour que git ignore localement le typechange.
#
# Usage :
#   ./setup-dev.sh
#
# Prérequis :
#   - avoir cloné epure-chrome en sibling : ~/code/Tioneb12/epure-chrome/
#   - les vrais dicos sont attendus dans epure-chrome/dicts/*.js
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DICTS_DIR="$REPO_ROOT/content/filters/dictionaries"
PRIVATE_REPO="$REPO_ROOT/../epure-chrome/dicts"

if [ ! -d "$PRIVATE_REPO" ]; then
  echo "X epure-chrome/dicts introuvable."
  echo "Clone le repo privé en sibling :"
  echo "  git clone git@github.com:Tioneb12/epure-chrome.git $REPO_ROOT/../epure-chrome"
  exit 1
fi

DICTS=(
  broetry-dict.js
  engagement-bait-dict.js
  generic-content-dict.js
  humble-brag-dict.js
  promo-dict.js
  signal-score-dict.js
  structural-dict.js
)

echo "Installation des symlinks dicos dans $DICTS_DIR"
echo ""

for f in "${DICTS[@]}"; do
  SRC="$PRIVATE_REPO/$f"
  DST="$DICTS_DIR/$f"

  if [ ! -f "$SRC" ]; then
    echo "  MANQUANT : $SRC"
    exit 1
  fi

  # Suppression du stub, création du symlink relatif, skip-worktree
  rm -f "$DST"
  ln -s "../../../../epure-chrome/dicts/$f" "$DST"
  (cd "$REPO_ROOT" && git update-index --skip-worktree "content/filters/dictionaries/$f")
  echo "  OK $f -> symlink + skip-worktree"
done

echo ""
echo "Symlinks installés. Recharge l'extension dans chrome://extensions"
echo ""
echo "Pour revenir aux stubs (rollback) :"
echo "  git update-index --no-skip-worktree content/filters/dictionaries/*-dict.js"
echo "  git checkout content/filters/dictionaries/"
