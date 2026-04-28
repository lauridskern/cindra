#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
forge_dir="$repo_root/vendor/forgecode"
patch_dir="$repo_root/patches/forgecode"

if [[ ! -d "$forge_dir" ]]; then
  echo "Forgecode vendor directory not found: $forge_dir" >&2
  exit 1
fi

if [[ ! -d "$patch_dir" ]]; then
  echo "Forgecode patch directory not found: $patch_dir" >&2
  exit 1
fi

shopt -s nullglob
patches=("$patch_dir"/*.patch)

if (( ${#patches[@]} == 0 )); then
  echo "No Forgecode patches found."
  exit 0
fi

cd "$repo_root"

for patch in "${patches[@]}"; do
  name="$(basename "$patch")"

  if git apply --reverse --check --directory=vendor/forgecode "$patch" >/dev/null 2>&1; then
    echo "Forgecode patch already applied: $name"
    continue
  fi

  if git apply --check --directory=vendor/forgecode "$patch" >/dev/null 2>&1; then
    git apply --directory=vendor/forgecode "$patch"
    echo "Applied Forgecode patch: $name"
    continue
  fi

  echo "Forgecode patch failed to apply: $name" >&2
  echo "The vendored Forgecode checkout may have changed. Rebase or drop this patch explicitly." >&2
  exit 1
done
