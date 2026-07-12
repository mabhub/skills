# Spécificités par framework

Le champ `framework` de `fingerprint.json` conditionne la stratégie de découverte API :
le pipeline jadx (JVM) est pertinent pour le natif Android, moins pour les apps dont la
logique vit ailleurs (Dart, JS, .NET). Repères par framework.

## Natif (Java/Kotlin)

Cas nominal du skill. La logique et les appels réseau sont dans le DEX → jadx les décompile,
`find-api-calls.sh` extrait Retrofit/OkHttp/Ktor/Volley/Apollo, `recover-kotlin-names.sh`
récupère les noms. Rien de spécial à faire.

## Flutter

- Marqueur : `assets/flutter_assets/`, `lib/*/libapp.so`, `libflutter.so`.
- La logique métier est **compilée en natif** dans `libapp.so` (Dart AOT) → **invisible à jadx**.
  Le DEX ne contient qu'un fin bootstrap.
- Découverte API : le grep statique JVM ne verra pas les endpoints. Options :
  - **reFlutter** (repackage l'app pour dumper le trafic Dart),
  - analyse dynamique via **proxy émulateur** (les appels HTTP restent observables au réseau),
  - `strings` sur `libapp.so` pour des URLs en dur.

## React Native

- Marqueur : `assets/index.android.bundle`, `libreactnativejni.so`.
- La logique est en **JavaScript** dans le bundle. Si le bundle est en clair (JS), l'extraire
  et le grep directement (URLs, `fetch(`, `axios`). S'il est en **Hermes** (bytecode),
  utiliser `hermes-dec` / `hbctool` pour désassembler avant de chercher les endpoints.
- jadx ne sert qu'à confirmer le pont natif ; l'API est dans le bundle.

## Cordova / Ionic

- Marqueur : `assets/www/` (HTML/JS/CSS d'une webapp embarquée).
- L'API est dans le JS de `assets/www/` → extraire le zip et grep les appels `fetch`/`XHR`/
  `$http`. jadx est quasi inutile ici.

## Xamarin / .NET MAUI

- Marqueur : `assemblies/*.dll`, `libmonodroid.so`.
- La logique est en **CIL .NET** dans les DLL (parfois compressées `assemblies.blob`).
  → décompiler avec **ILSpy / dnSpy** après extraction, pas avec jadx.
- Les endpoints (HttpClient) sont dans les DLL applicatives.

## Réflexe

Lire `fingerprint.json` **avant** d'investir dans la décompilation JVM : si `framework` n'est
pas `native`, le gros de la logique est hors du DEX et le pipeline statique de ce skill ne
suffit pas seul — ce fichier indique l'outil complémentaire adapté.
