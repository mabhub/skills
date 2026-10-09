# Formats du dossier `.pilotage/`

À lire à l'ouverture d'un chantier, à la création d'un fichier complémentaire, ou en cas
de doute sur l'endroit où ranger une information.

## Sommaire

- Rôle de chaque fichier
- Une seule source par information
- Sections de `plan.md`
- `connaissances.md`
- Journal : statuts `[fait]` et `[décision·Claude]`
- Fichiers complémentaires (dont le registre d'essais)
- Specs et plans détaillés existants
- Nettoyage à chaque point d'étape

## Rôle de chaque fichier

| Fichier            | Contenu                                                                   | Écriture                           | Lecture                                                          |
|--------------------|---------------------------------------------------------------------------|------------------------------------|------------------------------------------------------------------|
| `INDEX.md`         | Une ligne par chantier : objectif, étape, date                            | Réécrit (Edit ciblé)               | Toujours, à la reprise                                           |
| `plan.md`          | État courant et ce qui s'impose maintenant                                | Réécrit section par section        | À la reprise du chantier                                         |
| `journal.md`       | Historique : constats, décisions, changements d'avis, pistes abandonnées  | **Ajout en fin seulement**         | Par la fin (`reprise` montre les 3 dernières entrées)            |
| `connaissances.md` | Synthèse par thème de ce qui est établi, sources externes datées          | Réécrit section par section        | Titres seulement à la reprise ; une section quand on en a besoin |
| `decisions/`       | Décisions avec contexte, options comparées, conditions de remise en cause | Une par fichier, statut mis à jour | Seulement si le plan ou le journal y renvoie et que c'est utile  |
| Autres             | Ce qui n'entre pas dans les précédents                                    | Selon la nature                    | Seulement si la tâche du moment en a besoin                      |

`plan.md` est la vue à jour, `journal.md` est la trace : sans journal, on perd le
pourquoi et les revirements ; sans plan, une reprise devrait relire tout le journal.
`connaissances.md` répond à « que sait-on ? », le journal à « que s'est-il passé ? ».

## Une seule source par information

Une information recopiée dans deux fichiers finit par diverger, et la reprise ne sait plus
laquelle croire.

- **L'avancement** ne vit que dans les cases du macro-plan de `plan.md`. Pas de second
  décompte dans le journal, un registre ou un fichier complémentaire.
- **Les règles en vigueur** ne vivent que dans « En vigueur » ; ailleurs, on y renvoie.
- **Un fait établi** vit dans `connaissances.md` ; le journal garde seulement la ligne
  datée de sa découverte.
- **En cas de contradiction** entre fichiers : `plan.md` > `journal.md` (entrée la plus
  récente) > `decisions/` > `connaissances.md` > fichiers complémentaires. Corriger le
  fichier en retard au point d'étape suivant, et signaler l'écart à l'utilisateur.

## Sections de `plan.md`

| Section                        | Contenu                                                                                                                                                                                                          |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| En-tête                        | Objectif ; **critère de fin**, de préférence une commande et le résultat attendu (`npm test` → 0 échec ; `curl …/health` → 200) ; dates                                                                          |
| Où on en est                   | Prose courte pour un chantier linéaire ; tableau « Axe \| État \| Reste à vérifier » quand il avance sur plusieurs fronts                                                                                        |
| Plan                           | Macro-plan à cocher. Une étape cochée a son `[fait]` au journal. Un arrêt pour relecture par l'utilisateur se marque `⏸ relecture`                                                                                |
| En vigueur                     | `[directive]` et `[décision·…]` actives, chacune avec un renvoi à sa source                                                                                                                                      |
| Hypothèses à vérifier          | `[hypothèse] … → vérifier par : … · bloque : <étape ou décision>`                                                                                                                                                 |
| En attente de l'utilisateur    | `[question]` à trancher, `[attente]` actions à faire de son côté                                                                                                                                                 |
| Reporté volontairement         | Ce qu'on a choisi de ne pas faire maintenant : quoi, pourquoi, ce qui déclencherait sa reprise. Distingue un choix assumé d'un oubli                                                                              |
| Pièges connus                  | Faux échecs et comportements trompeurs déjà rencontrés, avec la consigne (« 404 passagers du service X : relancer avant de conclure »). Évite de déboguer un faux problème après une reprise                    |
| Hors dépôt                     | Tout ce qui a changé hors de git (fichiers installés ou remplacés, configuration système, base, service distant, ressource temporaire à supprimer avec son échéance) : quoi, où, original, retour arrière           |
| Repères                        | Fichiers clés (`chemin:ligne`), commandes de vérification, procédures copiables, une ligne par fichier complémentaire (« ce qu'il contient → quand le lire »). `reprise` signale les chemins cités introuvables |

## `connaissances.md`

- Rangé **par thème**, réécrit au fil du travail (ce n'est pas un journal).
- Chaque **titre de section** dit son niveau de confiance et l'étendue de la preuve :
  « Format des fichiers X (confirmé : 40 fichiers relus et réécrits sans écart) »,
  « Ordre de chargement (déduit du code, non vérifié en exécution) ». `reprise` n'affiche
  que les titres : ils doivent suffire à savoir ce qui est acquis.
- Quand une section mélange les niveaux, un suffixe par élément : `[confirmé]`,
  `[source : doc officielle]`, `[déduit]`, `[non vérifié]`.
- Les faits qui changent vite (version, URL, quota, prix) portent leur date de
  vérification, et sont revérifiés avant de s'appuyer dessus si elle est ancienne.
- Section « Sources externes » : date, titre, URL, ce qu'on en retient.

## Journal : statuts `[fait]` et `[décision·Claude]`

Une entrée par point d'étape (ou par événement important), ajoutée en fin de fichier :

```
## 2026-10-09 15:40 — <titre court>
- [fait] Étape 2 : export CSV — preuve : `npm test -- export` 0 échec (12 avant) — commits abc1234..def5678
- [décision·Claude] Pagination par curseur plutôt que par offset — pourquoi : tri instable — coût si faux : faible (1 fonction)
- [constat] L'API renvoie 429 au-delà de 10 req/s (source : `scripts/sonde.sh`, sortie dans mesures/429.txt)
- [remplace] 2026-10-08 « format JSON » → CSV, à la demande de l'utilisateur
```

- `[fait]` : une étape terminée cite **la commande de vérification, son résultat, et les
  commits**. Sans preuve, ce n'est pas un `[fait]`, c'est une affirmation.
- `[décision·Claude]` indique le **coût si faux** (faible, moyen, élevé, et pourquoi).
  C'est ce qui dit quoi revérifier en priorité à la reprise. Un coût élevé justifie un
  fichier dans `decisions/` et, idéalement, une validation par l'utilisateur.
- La source d'un constat peut être un sous-agent (« source : relecture par un sous-agent,
  rapport résumé ici ») : préciser alors ce qu'il a vérifié.

## Fichiers complémentaires

Les fichiers de base sont un minimum, pas un cadre fermé. Quand un contenu alourdirait
le plan ou noierait le journal, lui donner son propre fichier ou dossier : inventaire à
cocher, mesures, notes de recherche, cartographie du code, matrice de compatibilité,
brouillon de message, compte rendu d'échange, scripts de contrôle… Nommer d'après le
contenu (`inventaire-endpoints.md`, `mesures/`, `controles/`), pas d'après la date.

- **Cité depuis « Repères »** de `plan.md`. Un fichier que rien ne cite est perdu.
  `reprise` liste ces fichiers avec leur taille, sans les afficher.
- **Mêmes statuts** que le reste dès qu'il contient des affirmations.
- **Décisions et changements d'avis restent dans le journal**, même s'ils le concernent.
- **Conserver les preuves** : un script ou une sortie qui a servi à établir un fait ou à
  valider une étape est copié dans `.pilotage/<chantier>/` (par exemple `controles/`),
  jamais laissé dans le scratchpad, qui disparaît avec la session.
- **Gros fichiers de données** : ne pas les lire en entier ; noter dans « Repères » la
  commande qui en extrait l'utile.
- Une partie qui a son propre plan devient un chantier séparé, relié au premier.
- Ce qui sert à plusieurs chantiers vit à la racine de `.pilotage/`, cité depuis `INDEX.md`.

### Registre d'essais

`pilotage.mjs modele <slug> essais`. Pour une migration, un déploiement, une
configuration, un essai manuel par l'utilisateur. La colonne « À observer » se remplit
**avant** l'essai : c'est la prédiction, elle empêche de réinterpréter le résultat après
coup. Chaque essai a sa colonne de retour arrière, et sa ligne dans « Hors dépôt » s'il
modifie quelque chose hors de git.

## Specs et plans détaillés existants

Un projet a souvent déjà une spec ou un plan d'exécution détaillé (par exemple dans
`docs/superpowers/`). Ne pas les recopier dans `.pilotage/` : `plan.md` y renvoie depuis
« Repères » et garde seulement le macro-plan. Une fois exécuté, un plan détaillé est
figé : c'est de l'historique, et les écarts se tracent au journal (`[remplace]`), pas en
le réécrivant.

## Nettoyage à chaque point d'étape

Une section « en attente » qui n'est plus vraie trompe la reprise autant qu'une
information manquante.

- Retirer de « Hypothèses à vérifier » ce qui a été vérifié (devenu constat ou abandonné).
- Retirer de « En attente de l'utilisateur » ce qui a été tranché ou fait.
- Une section vide porte « aucune » plutôt que de rester vide : on sait qu'elle a été
  revue.
- « Où on en est » reste court : les détails vont au journal ou dans un fichier
  complémentaire.
