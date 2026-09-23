# Importer des EPUB épars

Déroulé détaillé. Chaque étape d'écriture (5 et suivantes) n'a lieu qu'après
validation explicite du lot correspondant.

## 1. Recenser

```bash
find / -xdev -iname '*.epub' -not -path '<bibliothèque>/*' -print0 2>/dev/null \
  | xargs -0 ls -la > <work_dir>/epub-epars.txt   # écrire dans un fichier, puis compter
```

Exclure la bibliothèque elle-même, ses sauvegardes, la corbeille, les autres
bibliothèques Calibre déclarées dans `exclude_libraries`.

## 2. Trier livre / article / notice

`match_library.py <dossiers…> --csv <work_dir>/import-candidats.csv` donne pour chaque
fichier le titre, les auteurs, le nombre de mots et des indices :

- **articles web** : nom horodaté (`…2021-03-04T10-22Z).epub`), quelques milliers de mots,
  auteur = site ;
- **notices et échantillons** : guide d'un logiciel, `welcome.epub` d'une liseuse,
  livre d'exemple, fichier de test ;
- **livres**.

Le tri final est une proposition à l'utilisateur, pas une décision.

## 3. Confronter à la base

Même sortie : `EN BASE`, `AUTEUR≠`, `PROCHE`, `NOUVEAU`. Relire les `PROCHE` et `AUTEUR≠`
à la main (homonymes, traductions). Consulter la section « Faux doublons » du fichier
d'état.

## 4. Arbitrer les doublons

Pour chaque candidat déjà en base :
`epub_quality.py --compare <candidat> <epub en base>` (retrouver le chemin avec
`epub_quality.py --ids <id>`), puis arbitrage par réparabilité
(references/reparabilite.md). Issues possibles :

- base conservée (prose identique ou base meilleure) → candidat à la corbeille ;
- candidat meilleur → **remplacement du fichier** (`calibredb add_format <id>`), ancien
  fichier copié dans `trash/` ;
- ni l'un ni l'autre (défauts irréparables différents) → question à l'utilisateur.

**Rapport** : tableau candidats × verdict × recommandation, cas nets d'abord. Attendre
la validation.

## 5. Ajouter (lot validé)

```bash
python3 scripts/preflight.py --write && python3 scripts/backup_lot.py AJOUT-EPUB
max=$(sqlite3 -readonly <lib>/metadata.db 'select max(id) from books')
calibredb add --library-path <lib> --title … --authors … --languages fra <fichier>.epub
sqlite3 -readonly <lib>/metadata.db "select id, title from books where id > $max"
```

Purger les résidus d'acheteur dans le même lot (references/residus-acheteur.md).

## 6. Corriger les séquelles de `calibredb add`

Pour chaque nouvel id, relire et corriger (voir references/pieges.md § calibredb) :
auteur et `author_sort` (sur les deux tables), titre et casse, `title_sort` à article
rejeté, étiquettes réintroduites hors vocabulaire, série parasite ou manquante (et son
index), éditeur à adresse postale. Une **décision nouvelle** (ordre de numérotation
d'une série, création d'une étiquette) se pose en question, elle ne se prend pas seule.

## 7. Pages et mots

`countpages_compute.py OUT --ids <nouveaux ids>`, puis `countpages_apply.py OUT --ids …`
(dry-run, puis `--apply` après validation). Ne jamais laisser le fichier de résultats
couvrir plus large que les ids du lot.

## 8. Clore le lot

- `calibredb backup_metadata --all`, puis `opf_crosscheck.py` : 100 % attendu ;
- `unzip -t` sur chaque EPUB ajouté ou remplacé ; `scan_residus.py --ids …` : 0 résidu ;
- compter les livres (avant + ajoutés = après).

## 9. Originaux à la corbeille

Une fois intégrés (ou écartés comme doublons), mettre les fichiers d'origine à la
corbeille, **jamais `rm`** : `gio trash <fichier>` (dossier en lecture seule :
`chmod u+w` puis rétablir). Cela évite de refaire les vérifications au prochain
balayage. Laisser en place ce que l'utilisateur a choisi de garder (articles, notices)
et le noter dans le fichier d'état.
