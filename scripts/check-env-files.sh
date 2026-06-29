#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

tracked_env_files="$(git ls-files '.env' '.env.*' | grep -v '^.env.example$' || true)"

if [[ -n "$tracked_env_files" ]]; then
  echo "Environment files must not be tracked by Git:"
  echo "$tracked_env_files"
  echo "Keep local values in .env and publish deploy values through GitHub Actions variables/secrets."
  exit 1
fi
