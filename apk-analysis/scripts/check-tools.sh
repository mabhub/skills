#!/usr/bin/env bash
set -euo pipefail

# Détecte le mode d'exécution disponible et guide l'installation si besoin.
# Affiche MODE=container|image-missing|local|local-missing sur la 1re ligne.
IMAGE="apk-analysis:local"
tools_dir="$(cd "$(dirname "$0")/../tools" && pwd)"

if command -v docker >/dev/null 2>&1; then
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "MODE=container"
    echo "Prêt : image $IMAGE disponible (isolation Docker, recommandé)."
    exit 0
  fi
  echo "MODE=image-missing"
  echo "Docker présent mais image absente. Construire (build manuel par défaut) :"
  echo "  docker build -t $IMAGE $tools_dir"
  exit 0
fi

# Pas de Docker : mode local (sans isolation).
missing=()
for t in jadx d2j-dex2jar aapt; do
  command -v "$t" >/dev/null 2>&1 || missing+=("$t")
done

if [[ ${#missing[@]} -eq 0 ]]; then
  echo "MODE=local"
  echo "ATTENTION : exécution locale SANS isolation Docker (APK non confiné)."
  exit 0
fi

echo "MODE=local-missing"
echo "Outils manquants : ${missing[*]}"
echo "Recommandé : installer Docker puis construire l'image :"
echo "  docker build -t $IMAGE $tools_dir"
echo "Sinon, install locale : voir tools/README.md (jadx/dex2jar = release pinnée + checksum sha256)."
exit 1
