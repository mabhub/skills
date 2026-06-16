---
name: markdown-style-fr
description: >
  Conventions de mise en forme Markdown (et pseudo-Markdown) pour les textes
  rédigés en français : commentaires et descriptions de forge (GitLab, GitHub),
  notes Obsidian, docs, READMEs, messages de tickets/MR/PR. Utiliser AVANT de
  proposer ou poster tout contenu Markdown : applique flèches → de conséquence,
  un-fait-par-ligne, backticks réservés au code, guillemets droits, évite
  tirets cadratin et point-virgules, respecte le wrapping existant de la source.
  Trigger phrases : "commente cette MR/PR", "rédige cette issue", "poste ce
  commentaire GitLab", "écris cette note Obsidian", "mets en forme ce markdown",
  "style markdown", "formate ce commentaire", "rédige cette description".
---

# Markdown Style FR

Conventions de **mise en forme** des textes Markdown / pseudo-Markdown rédigés en
français. Traite la *présentation* (forme typographique, structure visuelle), pas
le fond ni les tics d'écriture (voir [Skills complémentaires](#skills-complémentaires)).

Déduites des retouches cosmétiques répétées de l'utilisateur sur des commentaires
de forge et des notes. À appliquer à toute proposition de contenu Markdown avant
de la soumettre pour validation ou de la poster.

## Règles génériques

Ces règles valent pour tout Markdown, quelle que soit la cible (forge, Obsidian, doc).

1. **Flèche `→` pour enchaîner une conséquence ou une précision**, à la place
   d'une virgule, d'un point-virgule ou de parenthèses.
   Ex. "même clé conservée → aucune migration", "429 disparus → quota relevé".

2. **Un fait par ligne** sur les blocs denses. Casser un long paragraphe avec un
   **saut de ligne dur** (deux espaces en fin de ligne, soit `  \n`) plutôt qu'une
   phrase fleuve. Chaque ligne porte une idée, le bloc reste scannable.

3. **Backticks réservés au code et assimilé** uniquement :
   - noms de service / domaine : `geocode.earth`, `private.coffee`
   - chemins, fonctions, symboles : `geocode_earth.py:20`, `handle_call`
   - identifiants techniques : Sentry `TERRALEGOAPI-3`, exceptions `SystemExit`
   - commandes, snippets, valeurs littérales

   Ne **jamais** mettre entre backticks : du texte courant, un libellé produit,
   une mention d'utilisateur, une référence de forge (voir `references/gitlab.md`).

4. **Guillemets droits `"..."`** pour les citations techniques courtes inline
   (`"plus aucun 429"`) et les libellés produit ("Medium", "Critique"). Pas de
   guillemets français (les chevrons `«` `»`) sauf si la cible l'impose explicitement.

5. **Éviter les tirets cadratin (`—`) et les point-virgules (`;`)**, peu courants
   à l'usage. Préférer, selon le cas : un `-`, des parenthèses, une flèche `→`, ou
   simplement deux phrases. (Règle plus stricte ici que dans `stop-slop-fr`, qui
   tolère un cadratin par paragraphe.)

6. **Cases à cocher** `- [ ]` / `- [x]` pour les listes de critères, d'étapes ou
   d'actions restantes/faites.

7. **Wrapping de la source `.md`** : ne **pas** imposer de wordwrap à un contenu
   destiné à un moteur de rendu (commentaire de forge, note Obsidian, doc publiée) —
   une ligne logique = une ligne, le rendu gère le retour visuel. Exceptions : on
   met à jour un contenu déjà wrappé (suivre le wrapping existant), ou un linter du
   projet l'impose.
   En revanche, un fichier de **doc de travail lu et non rendu** (SKILL.md,
   references, README versionné) peut rester wrappé à ~80 colonnes : diffs git plus
   propres, sens identique pour le LLM qui refusionne les lignes au parsing.

## Cibles spécifiques

La forme exacte dépend du moteur de rendu. Charger la référence correspondante :

- **GitLab / GitHub / forge** (commentaires, descriptions, issues, MR/PR, tickets) :
  références non-backtickées et autolinkées, blocs d'alerte, mentions, titres de
  tickets, format des messages de mise à jour. Voir [references/gitlab.md](references/gitlab.md).

- **Obsidian / coffre de notes** : gestion des retours à la ligne (préservés tels
  quels), callouts. Voir [references/obsidian.md](references/obsidian.md).

## Contrôles rapides

Avant de livrer du Markdown :

- Une virgule / un point-virgule / une parenthèse qui introduit une conséquence ? → tester la flèche `→`.
- Un paragraphe de 3+ phrases collées ? → un fait par ligne, sauts durs `  \n`.
- Des backticks sur autre chose que du code ? → les retirer (texte, libellé, mention, réf de forge).
- Un tiret cadratin `—` ou un point-virgule `;` ? → remplacer par `-`, `(...)`, `→`, ou deux phrases.
- Des guillemets français (chevrons `«` `»`) sur une citation technique ou un libellé ? → passer en `"..."`.
- Un wordwrap dur ajouté à une source qui n'en avait pas ? → l'enlever.
- Cible forge ? → vérifier `references/gitlab.md` (refs sans backticks, alertes, mentions).

## Skills complémentaires

Chaîne éditoriale recommandée, du fond vers la forme :

1. `llm-output-hygiene-fr` — hygiène épistémique : calibrer la certitude, marquer
   la provenance, vérifier l'anti-confabulation, compresser. *Ce qu'on dit.*
2. `stop-slop-fr` — supprimer les tics d'écriture IA dans la prose. *Comment on le dit.*
3. `markdown-style-fr` (cette skill) — mettre en forme le Markdown. *Comment on le présente.*

Les trois sont orthogonales : appliquer dans cet ordre quand on rédige un texte
Markdown destiné à un humain.
