#!/usr/bin/env bash
set -euo pipefail

# Phase 2 — Extraction de strings notables, avec masquage des valeurs sensibles.
# Usage : extract-strings.sh <output-dir>   (lit <output-dir>/decompile/)
# Produit : <output-dir>/strings.json
#   Tableau {category, value_or_masked, evidence:{file,line}}.
#   category ∈ url | endpoint | api-key | token | secret | other.
#   Les valeurs ressemblant à un secret sont MASQUÉES (<redacted:len=N>), jamais en clair.
if [[ "$#" -ne 1 ]]; then
  echo "Usage: extract-strings.sh <output-dir>" >&2
  exit 1
fi
out="$1"
src="$out/decompile"
[[ -d "$src" ]] || { echo "Dossier décompilé introuvable: $src (lancer decompile.sh d'abord)" >&2; exit 1; }

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

emit() { # category value file line
  jq -nc \
    --arg category "$1" --arg value "$2" --arg file "$3" --argjson line "$4" \
    '{category:$category, value_or_masked:$value, evidence:{file:$file, line:$line}}' >> "$tmp"
}

# --- URLs (gardées en clair : ce sont des endpoints, pas des secrets) ---
{ grep -rEn '"https?://[^"]+"' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  url="$(printf '%s' "$content" | grep -oE 'https?://[^"]+' | head -1)"
  # Masque un token éventuel embarqué dans l'URL.
  url="$(printf '%s' "$url" | sed -E 's/([?&](token|api_key|apikey|access_token|key|secret|password|bearer)=)[^"&[:space:]]+/\1<redacted>/gI')"
  emit "url" "$url" "${file#"$out"/}" "$line"
done

# --- Affectations secret-looking : api_key/secret/token/password = "..." -> MASQUÉ ---
{ grep -rEni '(api[_-]?key|secret|token|password|bearer)["[:space:]]*[:=][[:space:]]*"[^"]{8,}"' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  val="$(printf '%s' "$content" | grep -oE '"[^"]{8,}"' | head -1 | sed -E 's/^"|"$//g')"
  [[ -n "$val" ]] || continue
  # Catégorise par mot-clé, MAIS ne reproduit jamais la valeur.
  cat="secret"
  printf '%s' "$content" | grep -qiE 'api[_-]?key' && cat="api-key"
  printf '%s' "$content" | grep -qiE '\btoken\b|bearer' && cat="token"
  emit "$cat" "<redacted:len=${#val}>" "${file#"$out"/}" "$line"
done

# --- Blobs base64/hex longs (>=32) hors URL -> MASQUÉS (secret probable) ---
{ grep -rEno '"[A-Za-z0-9+/]{32,}={0,2}"' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  val="$(printf '%s' "$content" | sed -E 's/^"|"$//g')"
  # Ignore ce qui ressemble à un chemin/URL déjà couvert.
  printf '%s' "$val" | grep -q '/' && continue
  emit "secret" "<redacted:len=${#val}>" "${file#"$out"/}" "$line"
done

if [[ -s "$tmp" ]]; then
  jq -s 'unique_by([.category,.value_or_masked,.evidence.file,.evidence.line])' "$tmp" > "$out/strings.json"
else
  echo '[]' > "$out/strings.json"
fi

echo "$out/strings.json"
