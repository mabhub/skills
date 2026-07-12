#!/usr/bin/env bash
set -euo pipefail

# Phase 0 — Triage rapide de l'APK SANS décompiler.
# Usage : fingerprint.sh <apk-path> <output-dir>
# Produit : <output-dir>/fingerprint.json (et en affiche le chemin).
here="$(cd "$(dirname "$0")" && pwd)"
run="$here/run-in-container.sh"

if [[ "$#" -ne 2 ]]; then
  echo "Usage: fingerprint.sh <apk-path> <output-dir>" >&2
  exit 1
fi
apk="$1"; out="$2"
[[ -f "$apk" ]] || { echo "APK introuvable: $apk" >&2; exit 1; }
mkdir -p "$out"

# SHA-256 calculé côté HÔTE (provenance non déléguée au conteneur).
sha256="$(sha256sum "$apk" | awk '{print $1}')"

# Données brutes produites DANS le conteneur, capturées côté hôte.
badging="$("$run" "$apk" "$out" -- sh -c 'aapt dump badging /work/input.apk 2>/dev/null')"
ziplist="$("$run" "$apk" "$out" -- sh -c 'unzip -l /work/input.apk 2>/dev/null')"

# --- Extraction depuis le badging ---
package="$(printf '%s\n' "$badging" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1)"
versionName="$(printf '%s\n' "$badging" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p" | head -1)"
versionCode="$(printf '%s\n' "$badging" | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" | head -1)"
minSdk="$(printf '%s\n' "$badging" | sed -n "s/^sdkVersion:'\([^']*\)'.*/\1/p" | head -1)"

# Permissions -> tableau JSON
permissions_json="$(printf '%s\n' "$badging" \
  | sed -n "s/^uses-permission: name='\([^']*\)'.*/\1/p" \
  | jq -R . | jq -s .)"
[[ -n "$permissions_json" ]] || permissions_json='[]'

# --- Détection framework (marqueurs dans le zip) ---
framework="native"
if   printf '%s' "$ziplist" | grep -q 'assets/flutter_assets/';            then framework="flutter"
elif printf '%s' "$ziplist" | grep -qE 'assets/index.android.bundle|libreactnativejni.so'; then framework="react-native"
elif printf '%s' "$ziplist" | grep -qE 'assets/www/.*cordova|assets/www/cordova'; then framework="cordova"
elif printf '%s' "$ziplist" | grep -qE 'assemblies/|libmonodroid.so';      then framework="xamarin"
fi

# --- Stacks HTTP (marqueurs de classes empaquetées) ---
http_stacks=()
printf '%s' "$ziplist" | grep -q 'retrofit2/'          && http_stacks+=("retrofit")
printf '%s' "$ziplist" | grep -q 'okhttp3/'            && http_stacks+=("okhttp")
printf '%s' "$ziplist" | grep -q 'io/ktor/'            && http_stacks+=("ktor")
printf '%s' "$ziplist" | grep -q 'com/android/volley/' && http_stacks+=("volley")
printf '%s' "$ziplist" | grep -q 'com/apollographql/'  && http_stacks+=("apollo")
if [[ ${#http_stacks[@]} -gt 0 ]]; then
  http_stacks_json="$(printf '%s\n' "${http_stacks[@]}" | jq -R . | jq -s .)"
else
  http_stacks_json='[]'
fi

# --- Libs natives ---
native_libs_json="$(printf '%s\n' "$ziplist" \
  | sed -n 's|.*\(lib/[^/]*/[^ ]*\.so\).*|\1|p' \
  | sed 's|.*/||' | sort -u | jq -R . | jq -s .)"
[[ -n "$native_libs_json" ]] || native_libs_json='[]'

# --- Heuristique d'obfuscation : présence de classes à nom d'une lettre ---
obf_hits="$(printf '%s\n' "$ziplist" | grep -cE '/[a-z]/[a-z]\.(class|smali)?$' || true)"
if [[ "${obf_hits:-0}" -gt 5 ]]; then obfuscation="likely-r8"; else obfuscation="none-or-light"; fi

jq -n \
  --arg package "$package" \
  --arg versionName "$versionName" \
  --arg versionCode "$versionCode" \
  --arg minSdk "$minSdk" \
  --arg framework "$framework" \
  --arg obfuscation "$obfuscation" \
  --arg sha256 "$sha256" \
  --argjson permissions "$permissions_json" \
  --argjson httpStacks "$http_stacks_json" \
  --argjson nativeLibs "$native_libs_json" \
  '{package:$package, versionName:$versionName, versionCode:$versionCode,
    minSdk:$minSdk, framework:$framework, httpStacks:$httpStacks,
    nativeLibs:$nativeLibs, obfuscation:$obfuscation,
    permissions:$permissions, sha256:$sha256}' \
  > "$out/fingerprint.json"

echo "$out/fingerprint.json"
