#!/usr/bin/env bash
# setup-worktrees.sh — create one isolated git worktree per build lane.
#
# Run from the matt-grant repo root. Creates ../mg-lane-NN directories, each on
# its own branch off main, so up to 10 Claude Code sessions can build in parallel
# without sharing a checkout (the root cause of branch-flap).
#
# Usage:
#   bash scripts/setup-worktrees.sh          # create all lanes
#   bash scripts/setup-worktrees.sh 1 3      # create only lanes 1 and 3 (Wave 0)
#   bash scripts/setup-worktrees.sh --remove # remove all lane worktrees (keeps branches)
#
# Ownership for each lane is defined in LANES.md.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
PARENT="$(dirname "$REPO_ROOT")"
BASE_BRANCH="${BASE_BRANCH:-main}"

# lane number -> branch slug
declare -a LANES=(
  "01-foundation"
  "02-infra"
  "03-security"
  "04-email"
  "05-ops-compliance"
  "06-research"
  "07-map-targeting"
  "08-public-takeaction"
  "09-content-studio"
  "10-qa-ci"
)

slug_for() { echo "${LANES[$(( $1 - 1 ))]}"; }

remove_all() {
  for i in $(seq 1 ${#LANES[@]}); do
    local dir="$PARENT/mg-lane-$(printf '%02d' "$i")"
    if git worktree list | grep -q "$dir"; then
      echo "Removing worktree $dir"
      git worktree remove --force "$dir" || true
    fi
  done
  git worktree prune
  echo "Done. Branches were kept (delete with: git branch -D lane/<slug>)."
}

create_one() {
  local n="$1"
  local slug; slug="$(slug_for "$n")"
  local pad; pad="$(printf '%02d' "$n")"
  local dir="$PARENT/mg-lane-$pad"
  local branch="lane/$slug"

  if git worktree list | grep -q "$dir"; then
    echo "✓ lane $pad already exists at $dir"
    return
  fi
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$dir" "$branch"
  else
    git worktree add "$dir" -b "$branch" "$BASE_BRANCH"
  fi
  echo "✓ lane $pad → $dir   (branch $branch)"
}

main() {
  cd "$REPO_ROOT"
  if [[ "${1:-}" == "--remove" ]]; then remove_all; exit 0; fi

  # ensure base branch is current
  git fetch origin "$BASE_BRANCH" --quiet 2>/dev/null || true

  if [[ $# -gt 0 ]]; then
    for n in "$@"; do create_one "$n"; done
  else
    for i in $(seq 1 ${#LANES[@]}); do create_one "$i"; done
  fi

  echo
  echo "Worktrees ready under $PARENT/mg-lane-*"
  echo "Open one Claude Code session per directory. Start with lanes 01 and 03 (Wave 0),"
  echo "merge them to $BASE_BRANCH, then run the rest. Ownership: see LANES.md."
}

main "$@"
