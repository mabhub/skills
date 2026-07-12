#!/usr/bin/env bash
set -euo pipefail

# Phase 2 — Récupération de noms Kotlin obfusqués (R8) via les métadonnées de debug.
# Usage : recover-kotlin-names.sh <output-dir>   (lit <output-dir>/decompile/)
# Produit : <output-dir>/name-map.json
#   Tableau {obfuscated, recovered, source, evidence:{file,line}}.
#   Si aucune métadonnée (noms totalement strippés) -> [] et exit 0 (pas une erreur).
if [[ "$#" -ne 1 ]]; then
  echo "Usage: recover-kotlin-names.sh <output-dir>" >&2
  exit 1
fi
out="$1"
src="$out/decompile"
[[ -d "$src" ]] || { echo "Dossier décompilé introuvable: $src (lancer decompile.sh d'abord)" >&2; exit 1; }

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

emit() { # obfuscated recovered source file line
  jq -nc \
    --arg obfuscated "$1" --arg recovered "$2" --arg source "$3" \
    --arg file "$4" --argjson line "$5" \
    '{obfuscated:$obfuscated, recovered:$recovered, source:$source,
      evidence:{file:$file, line:$line}}' >> "$tmp"
}

# @DebugMetadata(f = "OriginalFileName.kt", ...) porte le nom de fichier source d'origine.
# La classe obfusquée = le nom du fichier .java qui contient l'annotation.
{ grep -rEn 'DebugMetadata\(' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  recovered="$(printf '%s' "$content" | grep -oE 'f *= *"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
  [[ -n "$recovered" ]] || continue
  obf="$(basename "$file" .java)"
  emit "$obf" "$recovered" "DebugMetadata" "${file#"$out"/}" "$line"
done

# @SourceDebugExtension / SMAP : contient "SMAP\n<OriginalName.kt>\n..."
{ grep -rEn 'SourceDebugExtension' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  # Format SMAP : "SMAP\n<FileName.kt>\n..." — le nom suit le premier \n littéral.
  recovered="$(printf '%s' "$content" | grep -oE 'SMAP\\n[A-Za-z0-9_]+\.kt' | head -1 | sed -E 's/^SMAP\\n//')"
  [[ -n "$recovered" ]] || recovered="$(printf '%s' "$content" | grep -oE '[A-Za-z0-9_]+\.kt' | head -1 | sed -E 's/^n//')"
  [[ -n "$recovered" ]] || continue
  obf="$(basename "$file" .java)"
  emit "$obf" "$recovered" "SourceDebugExtension" "${file#"$out"/}" "$line"
done

if [[ -s "$tmp" ]]; then
  jq -s 'unique_by([.obfuscated,.recovered])' "$tmp" > "$out/name-map.json"
else
  echo '[]' > "$out/name-map.json"
fi

echo "$out/name-map.json"
