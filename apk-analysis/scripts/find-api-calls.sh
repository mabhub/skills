#!/usr/bin/env bash
set -euo pipefail

# Phase 2 — Extraction des endpoints API multi-stack (grep, robuste sur code décompilé).
# Usage : find-api-calls.sh <output-dir>   (lit <output-dir>/decompile/)
# Produit : <output-dir>/api-raw.json  (tableau {stack,method,path,host,evidence,raw}).
if [[ "$#" -ne 1 ]]; then
  echo "Usage: find-api-calls.sh <output-dir>" >&2
  exit 1
fi
out="$1"
src="$out/decompile"
[[ -d "$src" ]] || { echo "Dossier décompilé introuvable: $src (lancer decompile.sh d'abord)" >&2; exit 1; }

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# Masque une valeur de token dans une query string (jamais reproduite en clair).
# Ex : ?token=ABC123 -> ?token=<redacted>
mask() {
  sed -E 's/([?&](token|api_key|apikey|access_token|key|secret|password|bearer)=)[^"&[:space:]]+/\1<redacted>/gI'
}

# NDJSON accumulé dans $tmp, une ligne = un objet.
emit() { # stack method path host file line raw
  jq -nc \
    --arg stack "$1" --arg method "$2" --arg path "$3" --arg host "$4" \
    --arg file "$5" --argjson line "$6" --arg raw "$7" \
    '{stack:$stack,
      method:(if $method=="" then null else $method end),
      path:(if $path=="" then null else $path end),
      host:(if $host=="" then null else $host end),
      evidence:{file:$file,line:$line}, raw:$raw}' >> "$tmp"
}

# --- Retrofit : @GET("/path"), @POST("..."), etc. (méthode + path) ---
{ grep -rEn '@(GET|POST|PUT|DELETE|PATCH|HEAD)\s*\(\s*"[^"]*"' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  method="$(printf '%s' "$content" | grep -oE '@(GET|POST|PUT|DELETE|PATCH|HEAD)' | head -1 | tr -d '@')"
  path="$(printf '%s' "$content" | grep -oE '"[^"]*"' | head -1 | tr -d '"')"
  raw="$(printf '%s' "$content" | sed -E 's/^[[:space:]]+//' | mask)"
  emit "retrofit" "$method" "$path" "" "${file#"$out"/}" "$line" "$raw"
done

# --- OkHttp : .url("https://...") ---
{ grep -rEn '\.url\(\s*"https?://[^"]+"' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  url="$(printf '%s' "$content" | grep -oE 'https?://[^"]+' | head -1)"
  host="$(printf '%s' "$url" | sed -E 's#^https?://([^/]+).*#\1#')"
  path="$(printf '%s' "$url" | sed -E 's#^https?://[^/]+##')"
  raw="$(printf '%s' "$content" | sed -E 's/^[[:space:]]+//' | mask)"
  emit "okhttp" "" "$path" "$host" "${file#"$out"/}" "$line" "$raw"
done

# --- Ktor : client.get/post/... ---
{ grep -rEn '\b(client|httpClient)\.(get|post|put|delete)\s*[<(]' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  method="$(printf '%s' "$content" | grep -oE '\.(get|post|put|delete)' | head -1 | tr -d '.' | tr '[:lower:]' '[:upper:]')"
  raw="$(printf '%s' "$content" | sed -E 's/^[[:space:]]+//' | mask)"
  emit "ktor" "$method" "" "" "${file#"$out"/}" "$line" "$raw"
done

# --- Volley : StringRequest / JsonObjectRequest ---
{ grep -rEn '\b(StringRequest|JsonObjectRequest|JsonArrayRequest)\b' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  raw="$(printf '%s' "$content" | sed -E 's/^[[:space:]]+//' | mask)"
  emit "volley" "" "" "" "${file#"$out"/}" "$line" "$raw"
done

# --- Apollo / GraphQL : .query( / .mutation( ---
{ grep -rEn '\.(query|mutate|mutation)\s*\(' "$src" 2>/dev/null | grep -i apollo || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  raw="$(printf '%s' "$content" | sed -E 's/^[[:space:]]+//' | mask)"
  emit "apollo" "" "" "" "${file#"$out"/}" "$line" "$raw"
done

# --- URLs en dur (hardcoded) ---
{ grep -rEn '"https?://[A-Za-z0-9._~:/?#@!$&'"'"'()*+,;=%-]+"' "$src" 2>/dev/null || true; } | while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; content="${rest#*:}"
  url="$(printf '%s' "$content" | grep -oE 'https?://[^"]+' | head -1)"
  host="$(printf '%s' "$url" | sed -E 's#^https?://([^/]+).*#\1#')"
  path="$(printf '%s' "$url" | sed -E 's#^https?://[^/]+##')"
  raw="$(printf '%s' "$url" | mask)"
  emit "hardcoded-url" "" "$path" "$host" "${file#"$out"/}" "$line" "$raw"
done

# Consolidation NDJSON -> tableau JSON, dédup sur {stack,method,path,host}.
if [[ -s "$tmp" ]]; then
  jq -s 'unique_by([.stack,.method,.path,.host])' "$tmp" > "$out/api-raw.json"
else
  echo '[]' > "$out/api-raw.json"
fi

echo "$out/api-raw.json"
