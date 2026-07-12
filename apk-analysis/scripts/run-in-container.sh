#!/usr/bin/env bash
set -euo pipefail

# Exécute une commande dans l'image apk-analysis:local, en isolation.
# Usage : run-in-container.sh <apk-path> <output-dir> -- <cmd> [args...]
#   - APK monté en lecture seule sur /work/input.apk
#   - output-dir monté en écriture sur /work/out
#   - conteneur --network none --rm, utilisateur non-root
IMAGE="apk-analysis:local"

if [[ "$#" -lt 4 || "$3" != "--" ]]; then
  echo "Usage: run-in-container.sh <apk-path> <output-dir> -- <cmd> [args...]" >&2
  exit 1
fi

apk="$1"; out="$2"; shift 3   # retire apk, out et le "--"

if [[ ! -f "$apk" ]]; then
  echo "APK introuvable: $apk" >&2
  exit 1
fi
mkdir -p "$out"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  tools_dir="$(cd "$(dirname "$0")/../tools" && pwd)"
  echo "Image $IMAGE absente. Construire avec :" >&2
  echo "  docker build -t $IMAGE $tools_dir" >&2
  exit 2
fi

apk_dir="$(cd "$(dirname "$apk")" && pwd)"
apk_name="$(basename "$apk")"
out_abs="$(cd "$out" && pwd)"

exec docker run --rm --network none \
  -v "${apk_dir}/${apk_name}":/work/input.apk:ro \
  -v "${out_abs}":/work/out \
  "$IMAGE" "$@"
