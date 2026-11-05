# Historique git facultatif de `.pilotage/`

Un petit dépôt git imbriqué, `.pilotage/.git`, garde la trace de chaque version du suivi :
un journal tronqué par erreur se retrouve, une reprise sait quels commits du projet ont
eu lieu depuis le dernier point d'étape, et un `git clean -fdx` du projet ne supprime
plus le dossier (il faudrait `-ffdx`). Sans ce dépôt, le skill fonctionne comme avant.

À lire seulement si l'historique est actif (`contexte` affiche `Historique git : actif`)
ou si l'utilisateur le demande.

## Activation

- `pilotage.mjs init --git` crée le dépôt et commite tout l'existant (commit
  `État initial`). Possible à tout moment, y compris sur un `.pilotage/` ancien.
  `init --git --chantier <slug>` fait les deux d'un coup.
- Le mode est actif si et seulement si `.pilotage/.git` existe. Aucun autre réglage.
- Au premier `init`, le script affiche `Historique git possible : init --git …` quand
  git est disponible : c'est le signal pour le proposer, une fois (voir
  `references/ouvrir-clore.md`). Sans git, rien n'est proposé.
- `veille.log` est exclu du dépôt.

## Commits

Tous les messages sont générés par le script : Claude n'en rédige aucun, et un commit
ne coûte qu'un appel d'outil.

- **Fin de point d'étape** : `pilotage.mjs point <chantier>`, après l'écriture du suivi.
  Message `Point d'étape · <chantier>`, avec les trailers `Chantier`, `Projet-HEAD` et
  `Projet-branche` (état du projet à ce moment). Commit vide s'il n'y a rien de neuf,
  pour que le lien avec le code note le `HEAD` actuel.
- **Rattrapage** : au début de `contexte` et de `reprise`, ce qui a changé depuis est
  commité (`Rattrapage (<commande>) · <chantiers touchés>`), sans trailer.
- Commits sans hooks ni signature, avec l'identité git de l'utilisateur.

## Alerte de journal

Le journal ne se modifie qu'en ajout. Si un `journal.md` a perdu des lignes depuis le
dernier commit, `point` et le rattrapage affichent :

```
ALERTE : <chantier>/journal.md a perdu <n> ligne(s) (version précédente : lignes <plages>)
```

Le contenu des lignes perdues n'est jamais affiché (il pourrait contenir un secret). Le
commit a lieu quand même. Recopier l'alerte à l'utilisateur. Si la suppression n'était
pas voulue, retrouver l'ancienne version dans le commit qui précède celui de l'alerte :

```bash
git --git-dir .pilotage/.git --work-tree .pilotage show HEAD~1:<chantier>/journal.md
```

## Lien avec le code (rebases pris en compte)

Dans `reprise <chantier>`, quand le projet est sous git, la liste des commits du projet
depuis le dernier point d'étape **de ce chantier** remplace `git log -8` :

```
=== git — commits depuis le dernier point d'étape (<AAAA-MM-JJ HH:MM>, <sha7 projet>) ===
```

- Sans `point` encore fait pour ce chantier, le lien du commit `État initial` sert.
- Le lien est propre à chaque chantier : passer d'une branche à l'autre entre deux
  chantiers ne déclenche pas d'alerte.
- Si le `HEAD` noté n'est plus un ancêtre du `HEAD` actuel :
  `ALERTE : le HEAD du dernier point d'étape (…) n'est plus dans l'historique de …`.
  La liste est alors établie par date, donc approximative : après un rebase, les commits
  réécrits y figurent (leur date de commit a changé).
- 30 commits au plus, puis `… +<n> autres`. Liste vide : `(aucun commit)`.
- Sans lien utilisable (projet hors git, aucun commit du projet au moment du lien),
  `git log -8` reste.

## Consulter l'historique à la main

Toujours avec `--git-dir` et `--work-tree` explicites, pour ne jamais toucher au dépôt
du projet :

```bash
G="git --git-dir .pilotage/.git --work-tree .pilotage"
$G log --oneline                              # tous les commits du suivi
$G log -p -- <chantier>/plan.md               # évolution d'un plan
$G show <sha>:<chantier>/connaissances.md     # une version passée
```

Lire une version passée, oui. La restaurer : seulement à la demande de l'utilisateur.

## Purge d'un secret

Un secret commité reste dans tous les commits, même retiré du fichier. Pour l'effacer :

1. Retirer le secret des fichiers actuels (sinon la purge refuse).
2. Écrire un fichier de motifs **hors de `.pilotage/`** (sinon il serait commité ; la
   purge refuse aussi ce cas). Une ligne par valeur littérale, ou `regex:<motif>` en
   syntaxe JavaScript. Les lignes vides sont ignorées. Les lignes `==>`, `glob:`,
   `literal:`, une regex invalide ou qui correspond à la chaîne vide font refuser tout
   le fichier ; l'erreur donne le numéro de la ligne, jamais son contenu.
   - Une valeur littérale est écrite **par l'utilisateur**. Claude peut écrire un motif
     `regex:` (ce n'est pas le secret), mais **ne lit jamais le fichier** une fois
     l'utilisateur passé dessus.
3. `pilotage.mjs purge --motifs <fichier>` : rattrapage, réécriture de tout
   l'historique (`filter-branch`, chaque occurrence → `***REMOVED***`), nettoyage
   (`reflog expire`, `gc --prune=now`), puis vérification de tous les objets, même
   inaccessibles. Succès :
   `Purge : <n> objet(s) contenaient un motif · <c> commit(s) réécrit(s) · vérification OK · fichier de motifs supprimé`.
   Rien trouvé : `rien à réécrire`, fichier supprimé aussi. Échec de vérification :
   `ERREUR : vérification échouée …`, fichier conservé.

Limites :

- **La purge ne remplace pas la révocation** : un secret écrit quelque part doit être
  considéré comme exposé et changé.
- Les copies hors du dépôt imbriqué ne sont pas purgées : sauvegardes, dossiers
  synchronisés, transcripts de session.
- Dernier recours si la purge échoue : `rm -rf .pilotage/.git` puis `init --git`
  (l'historique est perdu, les fichiers actuels restent), avec l'accord de
  l'utilisateur.

## Identité ou git absents

- `init --git`, `point` et `purge` s'arrêtent avec une erreur claire
  (`ERREUR : identité git absente (user.name / user.email), aucun commit.` ou
  `git indisponible`). Corriger la config git de l'utilisateur, jamais imposer
  `-c user.*`.
- Le rattrapage de `contexte` et `reprise` n'est jamais bloquant :
  `Historique git : actif · rattrapage impossible (<raison>), suivi non commité`, puis
  la commande continue.

## Garde-fous

- Le script n'écrit que dans `.pilotage/.git` ; le dépôt du projet est seulement lu.
- Jamais de remote, jamais de push : le suivi reste local.
- Les sorties ne contiennent que des comptes, des noms de fichiers et des sha, jamais de
  contenu supprimé ni de motif.
