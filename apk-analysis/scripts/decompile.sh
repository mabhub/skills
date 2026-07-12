#!/usr/bin/env bash
set -euo pipefail

# Phase 1 — Décompilation via jadx (fallback dex2jar si jadx ne produit rien).
# Usage : decompile.sh <apk-path> <output-dir>
# Produit : <output-dir>/decompile/ (sources) + <output-dir>/decompile-meta.json
#           (affiche le chemin du dossier decompile/).
here="$(cd "$(dirname "$0")" && pwd)"
run="$here/run-in-container.sh"

if [[ "$#" -ne 2 ]]; then
  echo "Usage: decompile.sh <apk-path> <output-dir>" >&2
  exit 1
fi
apk="$1"; out="$2"
[[ -f "$apk" ]] || { echo "APK introuvable: $apk" >&2; exit 1; }
mkdir -p "$out"

# jadx : on ne fait PAS confiance à l'exit code seul (jadx renvoie souvent !=0 sur
# erreurs partielles tout en produisant des sources). Le succès = fichiers .java produits.
# --no-debug-info NON activé volontairement : les annotations de métadonnées Kotlin
# (@DebugMetadata) doivent survivre pour la récupération de noms (Phase 2).
set +e
jadx_log="$("$run" "$apk" "$out" -- \
  sh -c 'rm -rf /work/out/decompile; jadx -q -d /work/out/decompile /work/input.apk 2>&1' )"
jadx_exit=$?
set -e

java_count="$(find "$out/decompile" -name '*.java' 2>/dev/null | wc -l | tr -d ' ')"
engine="jadx"
warnings='[]'

if [[ "$java_count" -eq 0 ]]; then
  # Fallback dex2jar : convertit les .dex en .jar (pas de sources Java lisibles,
  # mais permet une inspection ultérieure). On le signale dans warnings.
  warnings='["jadx a produit 0 source ; fallback dex2jar (jar seulement, pas de .java)"]'
  engine="dex2jar"
  set +e
  "$run" "$apk" "$out" -- \
    sh -c 'mkdir -p /work/out/decompile && d2j-dex2jar -f -o /work/out/decompile/classes.jar /work/input.apk 2>&1'
  set -e
fi

success=$([[ "$java_count" -gt 0 ]] && echo true || echo false)

jq -n \
  --arg engine "$engine" \
  --argjson sourceFileCount "$java_count" \
  --argjson success "$success" \
  --argjson warnings "$warnings" \
  --argjson jadxExit "$jadx_exit" \
  '{engine:$engine, sourceFileCount:$sourceFileCount, success:$success,
    jadxExit:$jadxExit, warnings:$warnings}' \
  > "$out/decompile-meta.json"

echo "$out/decompile"
