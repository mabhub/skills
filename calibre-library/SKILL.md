---
name: calibre-library
description: >
  Garde-fous et méthode pour toute intervention sur une bibliothèque Calibre :
  lecture du fichier d'état, diagnostic en lecture seule de metadata.db, rapport,
  validation lot par lot, sauvegarde, écriture (calibredb, outils mcp__calibre__*),
  resynchronisation des OPF, vérification. Couvre import d'EPUB épars, doublons,
  métadonnées (casse des titres, auteurs, séries, étiquettes, éditeurs, tri),
  pages/mots Count Pages, purge des identifiants d'acheteur (iTunesMetadata.plist,
  rights.xml). À charger AVANT toute lecture ou écriture touchant une bibliothèque
  Calibre, quel que soit le dossier de départ, dès qu'apparaissent calibredb,
  calibre-debug, metadata.db, metadata.opf ou un outil mcp__calibre__*. Trigger
  phrases : "ma bibliothèque Calibre", "importe ces epub", "ajoute ces livres",
  "doublons de livres", "corrige les métadonnées", "séries", "étiquettes",
  "éditeurs", "compte les pages", "calibre library", "ebook duplicates",
  "fix book metadata", "import epubs into calibre".
---

# Bibliothèque Calibre — garde-fous et méthode

Une bibliothèque Calibre accumule des années de décisions invisibles dans les données :
doublons arbitrés, faux doublons séparés exprès, vocabulaire d'étiquettes choisi. Une
session qui écrit sans les connaître défait ce travail, et une erreur d'écriture se
propage silencieusement dans les OPF et les sauvegardes. Ce skill impose donc un ordre :
**lire l'état, diagnostiquer, rapporter, faire valider, sauvegarder, appliquer, vérifier,
consigner** — quel que soit le dossier d'où la session est partie.

Les scripts sont dans `scripts/` (chemins relatifs au dossier du skill) et sont en
**lecture seule par défaut**.

## Avant toute action

1. **`python3 scripts/preflight.py`** — résout la bibliothèque (config ou
   `$CALIBRE_LIBRARY_PATH`), affiche compteurs, fichier d'état, GUI ouvert ou non,
   espace disque, colonnes Count Pages. Si la bibliothèque n'est pas résolue ou est
   déclarée exclue, s'arrêter et demander.
2. **Lire en entier `<bibliothèque>/.calibre-library-state.md`** (chemin affiché par
   preflight) : état courant, décisions d'arbitrage à ne pas rejouer, **faux doublons à
   ne jamais fusionner**, chantiers ouverts, anomalies connues. S'il n'existe pas, le
   dire à l'utilisateur ; il sera créé en fin de chantier (`references/fichier-etat.md`).
3. Lire la référence utile au chantier (table en fin de fichier) **avant** de concevoir
   un diagnostic : la plupart des pièges y sont déjà documentés.

## Garde-fous de sécurité

Non négociables. Chacun répond à un incident réel.

- **Aucune écriture sans validation explicite du lot en cours.** Diagnostic → rapport →
  « ok » de l'utilisateur → application. La validation d'un lot ne vaut pas pour le
  suivant. Une décision nouvelle (ordre d'une série, création d'une étiquette, choix
  entre deux exemplaires imparfaits) est une **question**, pas une initiative.
  Écriture = tout ce qui modifie la base, un fichier de la bibliothèque, ou supprime
  quoi que ce soit (`calibredb add/set_metadata/remove/add_format`, outils MCP
  d'écriture, SQL, `new_api`).
- **GUI Calibre fermé** avant toute écriture : `python3 scripts/preflight.py --write`
  (échoue si `pgrep -x calibre` trouve le GUI ou si un `backup_metadata` tourne).
  Sinon, demander à l'utilisateur de le fermer.
- **Sauvegarde avant chaque lot** : `python3 scripts/backup_lot.py <LOT>` →
  `<backup_dir>/metadata-PRE-<LOT>-<date>.db`, jamais dans le scratchpad ou `/tmp`.
  Tout fichier de livre remplacé ou supprimé est d'abord copié :
  `backup_lot.py <LOT> --trash <chemin>…` → `<backup_dir>/trash/<LOT>/`.
- **Identifiants d'acheteur** : purger `iTunesMetadata.plist` et `rights.xml` (dans
  `META-INF/` chez Adobe, à la racine chez Kobo) à chaque ajout ou remplacement, dans
  le même lot (`references/residus-acheteur.md`).
  `META-INF/encryption.xml` n'est pas un DRM s'il ne vise que des polices : le classer
  par ses URI, ne pas le « purger ». **Ne jamais afficher la valeur** d'un identifiant
  d'acheteur (compte, e-mail, n° de commande) : seulement sa présence.
- **Ne jamais masquer la sortie d'erreur d'une écriture** (`2>&1 | grep -v … | tail`) :
  un `add_format --replace` inexistant a ainsi échoué en silence. Filtrer le bruit connu
  ligne à ligne (`SyntaxWarning`, trace DeDRM), vérifier le code retour, relire le
  résultat en base.
- **Après chaque lot** : `calibredb backup_metadata --all` (GUI fermé) puis
  `python3 scripts/opf_crosscheck.py` jusqu'à 100 % de concordance. Sans cela, un
  `restore_database` restaurerait l'état d'avant le chantier.
- **Vérification post-application** : compter (livres, liens, orphelins avant/après),
  relire les champs écrits, `unzip -t` sur chaque EPUB touché.
- **Suppression hors bibliothèque : `gio trash`, jamais `rm`.** Dans la bibliothèque :
  `calibredb remove` après copie dans `trash/`. Ne jamais supprimer les éléments
  `.calibre-*` que « Vérifier la bibliothèque » signale à la racine.
- **Livrables** (rapports, CSV de revue) dans `work_dir` (config) ou à un endroit que
  l'utilisateur a indiqué ; ne jamais annoncer un fichier resté dans le scratchpad.
- **Fin de chantier : mettre à jour le fichier d'état** (compteurs revérifiés, chantier,
  décisions, anomalies). Il reste local : il décrit le contenu de la bibliothèque.
- **Mémoire** : ce qui concerne la bibliothèque va dans le fichier d'état, pas dans une
  mémoire liée au dossier courant de la session.

## Cycle d'un lot

```
diagnostic (SQLite readonly, scripts) ─► rapport ─► validation explicite
      ▲                                                     │
      │                                                     ▼
 fichier d'état ◄─ vérification ◄─ backup_metadata --all ◄─ preflight --write
 (fin de chantier)   + crosscheck        ◄─ application ◄─ backup_lot.py <LOT>
```

**Diagnostic** : `sqlite3 -readonly <lib>/metadata.db` (ou `lib_config.connect_ro`),
jamais `list_books` paginé. Mesurer tout détecteur heuristique sur une vérité connue
avant de s'y fier (`references/pieges.md` § Détecteurs).

**Rapport** : chiffres, tableau des cas, **recommandation explicite** (« je recommande
X parce que Y »), questions précises. Cas évidents d'abord, groupés ; cas à arbitrer
ensuite, un par un. Pour une revue en masse, un **CSV amendable** (`id, auteur, champ
actuel, proposition, source`) que l'utilisateur corrige et qui est appliqué tel quel.
Donner plus d'explication sur tout point technique qui conditionne une décision.

## Choisir l'outil d'écriture

| Outil | Pour | Limites |
|---|---|---|
| `mcp__calibre__*` | écritures unitaires, fusions multi-formats (`merge_duplicate_group`) | GUI fermé, handshake plan → confirm ; `update_metadata` refuse `series_index` sans `series` ; `remove_book` un par un |
| `calibredb` | ajouts, `set_metadata -f`, `add_format`, `remove`, `backup_metadata` | GUI fermé ; séquelles de `add` ; pas de `--replace` ; stderr bruité |
| `calibre-debug` + `db(lib).new_api` | écritures en masse (`set_field` avec dict id → valeur) | GUI fermé ; gère triggers et dirtied |
| SQL direct (Python) | cas que les autres refusent (index de série orphelin, casse seule d'un nom `COLLATE NOCASE`) | déclarer `title_sort` ; comparer des **ids**, jamais des noms ; n'alimente pas `metadata_dirtied` → `backup_metadata --all` obligatoire |

## Déroulés types

**Importer des EPUB épars** (`references/import-epub.md`) : recenser (`find` vers un
fichier) → trier livre / article / notice et confronter à la base
(`match_library.py --csv`) → arbitrer chaque doublon (`epub_quality.py --compare`,
réparabilité) → rapport, validation → `backup_lot.py`, `calibredb add`, ids relus en
SQL → purge des résidus → correction des séquelles de `add` → pages/mots sur les seuls
nouveaux ids → `backup_metadata --all`, crosscheck, `unzip -t` → originaux à la
corbeille (`gio trash`).

**Arbitrer des doublons** (`references/reparabilite.md`) : détecter par titre normalisé
et empreinte de prose, pas seulement `find_duplicates` → écarter les faux doublons du
fichier d'état → comparer le contenu réel → trancher par niveau de réparabilité (3 :
OCR, mojibake ; images ; 2 : typographie ; 1 : markup ; 0 : ids, non discriminant) →
reporter les bonnes métadonnées sur le survivant → copier le perdant dans `trash/` →
supprimer.

**Corriger des métadonnées** (`references/casse-titres.md`, `references/pieges.md`) :
casse via Wikipédia FR avec garde d'identité, repli typographique qui s'abstient sur les
noms propres ; séries extraites des titres (`- Tome N` conservé sans sous-titre propre) ;
`title_sort` à article rejeté ; `author_sort` sur les deux tables ; fusions de tags,
auteurs, séries, éditeurs **par ids** (`COLLATE NOCASE`) ; éditeur de la version
numérisée ; attribution automatique marquée pour revue ; respecter le vocabulaire et
les arbitrages du fichier d'état.

**Calculer pages et mots** : `calibre-debug scripts/countpages_compute.py -- OUT.jsonl
--ids …` (ou `--missing`), puis `calibre-debug scripts/countpages_apply.py -- OUT.jsonl
--ids …` en dry-run, puis `--apply` après validation. Colonnes lues dans les réglages du
plugin (les lookup names peuvent être inversés) ; les résultats à 0 mot (BD, images) ne
sont jamais écrits ; les valeurs existantes ne sont remplacées qu'avec `--overwrite`.

## Configuration

Facultative, jamais versionnée, hors du dossier du skill (survit aux réinstallations) :
`$CALIBRE_LIBRARY_SKILL_CONFIG`, sinon `~/.config/calibre-library-skill/config.json`.
Modèle : `config/config.example.json`.

| Clé | Rôle | Défaut |
|---|---|---|
| `library` | bibliothèque cible | `$CALIBRE_LIBRARY_PATH` (variable du serveur MCP) |
| `exclude_libraries` | autres bibliothèques à ne jamais viser | `[]` |
| `backup_dir` | sauvegardes par lot et `trash/` | `{library}/.calibre-mcp-backups` |
| `archive_dir` | archives complètes (idéalement sur un autre disque) | aucun |
| `work_dir` | rapports et CSV de revue | aucun : demander |

Le fichier d'état n'est pas configurable : `<library>/.calibre-library-state.md`.

## Scripts

| Script | Rôle | Écrit ? |
|---|---|---|
| `preflight.py [--write]` | config, état, compteurs, GUI, espace | non |
| `backup_lot.py LOT [--trash …]` | sauvegarde de la base + copies avant remplacement/suppression | dans `backup_dir` seulement |
| `epub_quality.py FICHIERS / --ids / --compare A B` | métriques de réparabilité, résidus, empreinte, comparaison | non |
| `scan_residus.py [--ids / --paths] [--deep]` | porteurs d'identifiants d'acheteur et DRM | non |
| `match_library.py CHEMINS [--csv]` | candidats à l'import vs base, titre/auteur normalisés | non (sauf le CSV demandé) |
| `opf_crosscheck.py [--ids] [--fields]` | concordance base ↔ `metadata.opf`, colonnes perso comprises | non |
| `countpages_compute.py` (calibre-debug) | pages/mots via le plugin Count Pages | non (JSONL de résultats) |
| `countpages_apply.py` (calibre-debug) | écriture des pages/mots | seulement avec `--apply` |

## Références

| Fichier | Lire quand |
|---|---|
| `references/pieges.md` | avant tout script ou commande d'écriture ; en cas d'erreur inattendue |
| `references/reparabilite.md` | pour choisir entre deux exemplaires |
| `references/casse-titres.md` | pour toute correction de titre, de série extraite ou de tri |
| `references/residus-acheteur.md` | à l'import, au remplacement d'un fichier, sur un `encryption.xml` |
| `references/import-epub.md` | pour intégrer des EPUB trouvés hors bibliothèque |
| `references/fichier-etat.md` | pour créer ou mettre à jour le fichier d'état |
