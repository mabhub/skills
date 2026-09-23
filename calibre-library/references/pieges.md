# Catalogue des pièges

Chaque piège a coûté au moins une passe ou des données. Classés par outil.

## Sommaire

- [calibredb](#calibredb)
- [Outils MCP calibre](#outils-mcp-calibre)
- [SQLite et metadata.db](#sqlite-et-metadatadb)
- [OPF et sauvegardes](#opf-et-sauvegardes)
- [Count Pages](#count-pages)
- [Contenu des EPUB](#contenu-des-epub)
- [Détecteurs heuristiques](#détecteurs-heuristiques)
- [Shell et environnement](#shell-et-environnement)
- [Interface Calibre](#interface-calibre)

## calibredb

- **Même ses commandes de lecture modifient `metadata.db`** : un simple `calibredb list`
  change l'empreinte du fichier (la base est ouverte en écriture). Un diagnostic
  réellement en lecture seule passe par `sqlite3 -readonly` / `mode=ro`, pas par
  `calibredb`.
- **Refuse d'écrire tant que le GUI est ouvert** (« Un autre programme calibre … est en
  cours d'exécution »). Vérifier avec `pgrep -x calibre` (voir Shell).
- **`add_format` n'a pas d'option `--replace`** : il remplace par défaut. Passer
  `--replace` provoque `no such option`. Si la sortie d'erreur est filtrée
  (`2>&1 | grep -v … | tail`), l'échec passe inaperçu et on croit la purge faite.
  → Ne jamais jeter stderr d'une écriture ; vérifier le code retour puis relire le résultat.
- **Trace `DeDRMError … DRM free perhaps?`** à chaque `add` quand le plugin DeDRM est
  installé : sans gravité, mais elle noie la sortie — les ids attribués n'apparaissent
  pas (`grep Added` ne renvoie rien). → Relire les ids en SQL
  (`select id, title from books where id > <max_id d'avant>`).
- **Bruit `SyntaxWarning` de plugins tiers** (ex. `kobobooks`) sur chaque appel. Le
  filtrer ligne à ligne (`grep -v SyntaxWarning`) seulement, jamais par `tail`.
- **`calibredb add` reprend mal les métadonnées de l'EPUB** — séquelles à corriger
  après chaque ajout :
  - auteur au format `Nom|Prénom` ou inversé, auteur fourre-tout `Various` ;
  - titre en capitales, casse anglaise (`Le Nom Dans La Phrase`) ;
  - `title_sort` **sans article rejeté** (`Le Roi…` au lieu de `Roi…, Le`) ou pollué
    (`… (Collection) (French Edition)`) ;
  - étiquettes du vocabulaire du store (BISAC : `Fiction`, `Nonfiction`, `General`…)
    ou d'anciennes formes supprimées lors d'un nettoyage (`SF`, `A_Lire`) — elles
    **réapparaissent** ;
  - série parasite, doublon d'une série existante sous un autre nom, ou livre de série
    sans série ;
  - éditeur avec adresse postale (`Éditions X 12, rue Exemple 75000 Paris`).
  → Options utiles dès l'ajout : `--title`, `--authors`, `--languages`, `--isbn`, `--tags`.
  Puis `set_metadata -f sort:"Titre, Le" -f tags:… -f publisher:…`.
- **`set_metadata -f title:` ne recalcule pas un tri à article rejeté** : poser
  `-f sort:` explicitement à chaque changement de titre.
- **Réintégrer un dossier « fantôme » par `add`** crée un NOUVEAU dossier : l'ancien
  reste sur le disque. Le copier dans `trash/` puis le retirer.
- **`embed_metadata` ≠ `backup_metadata`** : le premier réécrit l'OPF *interne* aux
  EPUB, le second régénère les `metadata.opf` posés à côté. Pour resynchroniser après
  des écritures, c'est `backup_metadata --all`.

## Outils MCP calibre

- Ils passent par `calibredb` : mêmes contraintes (GUI fermé), plus un handshake
  plan → confirm.
- **`update_metadata` refuse `series_index` sans `series`**, alors que c'est justement
  l'état incohérent à réparer (index orphelin). → SQL direct via Python (voir SQLite).
- **`remove_book` : un livre à la fois**, avec son handshake. Pour des dizaines de
  suppressions, scripter `calibredb remove` après copie des perdants dans `trash/`.
- **`merge_duplicate_group`** rapatrie bien les formats AZW3/MOBI sur l'exemplaire EPUB
  survivant (fusions multi-formats).
- **`find_duplicates` compare les titres au caractère près** : apostrophe droite ou
  typographique, accent manquant, tiret (`Porte Close` / `Porte-Close`) lui échappent. Une
  bibliothèque annoncée à 0 doublon en contenait encore 20 groupes après normalisation.
  → `scripts/match_library.py` et une empreinte de la prose (`epub_quality.py`).
- **`list_books` pagine par 50** : pour un diagnostic, lire `metadata.db` en SQLite
  readonly, bien plus rapide.

## SQLite et metadata.db

- **Lecture** : `sqlite3 -readonly` ou `file:…/metadata.db?mode=ro`. Insensible au GUI,
  mais **verrouillée pendant `backup_metadata --all`** (`database is locked`) : attendre.
- **Écriture directe** : le trigger appelle une fonction `title_sort` absente de
  `sqlite3` nu. Passer par Python en déclarant la fonction
  (`con.create_function('title_sort', 1, lambda s: s)`), ou mieux par
  `calibre-debug` + `db(lib).new_api`, qui gère triggers, dirtied et caches.
- **`tags.name`, `authors.name`, `series.name`, `publishers.name` sont `COLLATE
  NOCASE`.** Pour SQLite, `thriller` et `Thriller` sont le MÊME nom. Un script de
  fusion qui compare les chaînes en Python croit traiter deux entités, réinsère les
  liens dans la ligne qu'il va supprimer, puis la détruit : les livres perdent
  l'attribut. → Résoudre les deux noms en **ids** ; si l'id est le même, c'est un
  `UPDATE … SET name=?`, pas une fusion. Un dry-run qui compte les orphelins avant/après
  le détecte (il annonçait 862 livres sans tag au lieu de 831).
- **`author_sort` existe sur deux tables** : `authors.sort` (par auteur) et
  `books.author_sort` (par livre). Corriger l'un laisse l'autre ; c'est `books` que
  l'OPF exporte en `opf:file-as`. Vérifier les deux.
- **Les écritures SQL directes n'alimentent pas `metadata_dirtied`** : Calibre ne sait
  pas que les OPF sont périmés, et `backup_metadata` sans `--all` ne fait presque rien.
- Apostrophes dans les littéraux SQL (`d'un`) : utiliser des paramètres `?`, jamais la
  concaténation. Préfixer les colonnes dans les jointures (`lang_code` est ambigu entre
  `books_languages_link` et `languages`).
- La colonne de gauche de l'interface est un index d'affichage, **pas l'id**.

## OPF et sauvegardes

- Calibre écrit à deux endroits : `metadata.db` (source de vérité) et un `metadata.opf`
  par dossier (relu par `restore_database`). Des OPF désynchronisés font qu'une
  restauration **annule silencieusement** des jours de travail (des centaines d'OPF
  portaient encore une étiquette supprimée).
  → Après tout lot : `calibredb backup_metadata --all` (GUI fermé, ~5 min pour
  6000 livres) puis `scripts/opf_crosscheck.py` jusqu'à 100 % de concordance.
- Les colonnes personnalisées sont dans l'OPF en **JSON échappé HTML**
  (`calibre:user_metadata:#col`, clé `#value#`) : une regex sur le texte brut a signalé
  400 faux écarts.

## Count Pages

- **Les lookup names peuvent être inversés** : `#pagecount` peut contenir des mots.
  Les colonnes réellement utilisées sont dans les réglages du plugin
  (`preferences` → `namespaced:CountPagesPlugin:settings`, clés `customColumnPages` et
  `customColumnWords`). Les scripts les lisent là ; se fier au libellé affiché, jamais au
  lookup name.
- **Le plugin supprime le fichier qu'il analyse** : toujours lui passer une copie.
- Code du plugin dans `~/.config/calibre/plugins/Count Pages.zip`, utilisable hors GUI
  via `calibre-debug` ; sous `calibre-debug`, le pickling de multiprocessing exige
  `__main__.run = run`.
- **BD et livres sans texte** : le plugin renvoie 1-2 pages et 0 mot. Ne jamais écrire
  ces valeurs (filtre sur « 0 mot », pas sur « peu de pages » : un EPUB quasi vide mais
  textuel s'écrit tel quel).
- Les anciennes valeurs (autre version du plugin, Goodreads) ne sont pas reproductibles :
  ne pas les écraser sans décision.

## Contenu des EPUB

- Le texte peut être dans des fichiers `.xml`, pas seulement `.html` / `.xhtml` : se fier
  au manifeste de l'OPF (media-type `application/xhtml+xml`).
- Les entités `&rsquo;` sont des apostrophes valides, pas une corruption.
- `unzip -t` signale des anomalies de métadonnées ZIP (`WinNT security data missing`,
  drapeau UTF-8) sans impact sur le contenu : vérifier que le texte s'extrait avant de
  conclure à un fichier cassé.
- Après toute retouche d'un EPUB : `mimetype` en premier et non compressé, `unzip -t`
  propre, OPF lisible.

## Détecteurs heuristiques

- Une regex **insensible à la casse** pour trouver un éditeur dans le texte : `Masque` a
  matché « masque à gaz », `Seuil` « sur le seuil ». Exiger la majuscule initiale (un
  nom d'éditeur en porte toujours une dans une mention éditoriale) a fait passer la
  justesse de 89 % à 96 %.
- → **Mesurer un détecteur sur une vérité connue** avant de l'appliquer : prendre des
  livres dont le champ est déjà fiable, compter correct / faux / silencieux, annoncer
  la « justesse quand il propose ». Une attribution fausse est invisible et se propage ;
  un champ inchangé ne trompe personne.
- Normaliser un auteur en ignorant `père` / `fils` ou des particules a fusionné des
  séries d'auteurs distincts : auditer les séries multi-auteurs après toute extraction.
- Chaque détecteur de doublons a produit des faux positifs : traductions distinctes,
  volumes distincts, homonymes (deux romancières au même nom de famille). Comparer le
  contenu réel avant toute suppression.
- Estimer un gain (compression d'images) sur les plus gros fichiers le surestime
  (−47 % estimés, −8 % mesurés). Une recompression « sans perte » peut grossir un PNG :
  ne garder le résultat que s'il est plus petit ET identique au pixel près.

## Shell et environnement

- **`pgrep -f calibre` ne prouve pas que le GUI est ouvert** : il attrape les serveurs
  `calibre-mcp` et la commande elle-même. Utiliser `pgrep -x calibre`.
- `find … | xargs … | head` est tronqué par SIGPIPE : ce n'est pas un total. Écrire
  dans un fichier puis compter.
- `for f in $(find …)` casse sur les espaces : un scan écrit ainsi a conclu à « 0 EPUB
  concerné » alors qu'il en restait une dizaine. → `find -print0 | while IFS= read -r -d ''`
  ou parcourir la table `data` de la base (`scan_residus.py`).
- `gio trash` échoue (« Permission non accordée ») dans un dossier en lecture seule
  (`dr-x`, fréquent sur des archives de disques) : `chmod u+w dossier`, `gio trash`,
  puis rétablir `chmod u-w`.
- Selon le shell réellement utilisé par l'outil, `pipestatus` (zsh) peut être absent et
  `printf` avec décimales dépend de la locale (`LC_NUMERIC=C`).

## Interface Calibre

- **« Vérifier la bibliothèque » signale tout élément posé à la racine** (dossier de
  sauvegardes, fichier d'état `.calibre-library-state.md`) comme auteur/titre invalide.
  Ne jamais cocher ces éléments pour « Supprimer les éléments marqués » : on perdrait
  sauvegardes et historique.
