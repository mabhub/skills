# Obfuscation — R8/ProGuard et récupération de noms

L'obfuscation renomme classes, méthodes et champs en identifiants courts (`a`, `b`, `a.b.c`)
pour gêner la rétro-ingénierie. Comprendre son niveau oriente toute l'analyse : un inventaire
API sur code fortement obfusqué demandera plus d'interprétation (et parfois du dynamique).

## Signatures d'obfuscation

- **R8** (défaut moderne d'Android Gradle) et **ProGuard** (historique) : renommage +
  raccourcissement + suppression de code mort. `fingerprint.sh` pose une heuristique
  (`obfuscation: likely-r8` si beaucoup de classes à nom d'une lettre).
- Indices : arborescence `a/a/a.java`, méthodes `a()`, `b()`, chaînes concaténées/chiffrées,
  disparition des noms de packages métier.

## Récupération de noms Kotlin (`recover-kotlin-names.sh`)

R8 renomme les classes **mais** le compilateur Kotlin laisse souvent des métadonnées de debug
qui trahissent les noms d'origine :

- **`@DebugMetadata`** (sur les `ContinuationImpl` des coroutines `suspend`) porte
  `f = "FichierOriginal.kt"`, `m = "nomMéthode"`, `c = "classe.originale"`.
- **`@SourceDebugExtension` / SMAP** embarque `SMAP\n<FichierOriginal.kt>\n…`.

Le script mappe le nom de fichier `.java` obfusqué → le nom Kotlin d'origine. C'est partiel
(seules les classes portant ces annotations sont couvertes) mais souvent suffisant pour
retrouver les Repository/ViewModel/UseCase clés.

## Limites

- **Noms totalement strippés** : si le build supprime aussi les métadonnées Kotlin
  (`-keepattributes` non conservé, apps Java pures), la récupération renvoie `[]`.
  → basculer sur l'analyse par **comportement** (quelles APIs, quels flux) plutôt que par nom.
- **Chaînes chiffrées** : les URLs/clés construites à l'exécution échappent au grep statique
  → analyse dynamique (proxy émulateur, hooks Frida).
- **Obfuscation native (`.so`)** : le code natif obfusqué relève d'un autre outillage
  (Ghidra/IDA, hors périmètre de ce skill statique JVM).

## Réflexe

Toujours croiser `fingerprint.json` (niveau d'obfuscation) avec `name-map.json` (ce qu'on a pu
récupérer) avant de conclure sur la logique métier : un inventaire d'endpoints reste fiable
même quand les noms de classes sont perdus, car les URLs et annotations Retrofit survivent
généralement à R8.
