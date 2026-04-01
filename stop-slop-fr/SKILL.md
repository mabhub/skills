---
name: stop-slop-fr
description: >
  Supprime les tics d'écriture IA dans la prose française. Utiliser pour
  rédiger, réviser ou nettoyer tout texte en français afin d'éliminer les
  patterns prévisibles des LLM. Trigger phrases : "nettoie le texte",
  "enlève le slop", "déslopifie", "écris sans tics IA", "prose naturelle",
  "stop slop", "anti-slop".
---

# Stop Slop FR

Éliminer les patterns d'écriture IA prévisibles dans la prose française.

## Règles

1. **Couper les formules de remplissage.** Supprimer les ouvertures pompeuses, les béquilles d'emphase, les adverbes sentencieux, les connecteurs en excès. Voir [references/phrases.md](references/phrases.md).

2. **Casser les structures formulaïques.** Éviter les contrastes binaires, les listes négatives, la fragmentation dramatique, les faux questionnements rhétoriques, la fausse agence, la nominalisation excessive. Voir [references/structures.md](references/structures.md).

3. **Préférer la voix active.** Trouver l'acteur humain et en faire le sujet. Cibler la voix passive évasive (celle qui masque l'acteur) et la tournure pronominale évasive ("la question se pose"). La voix passive informative est acceptable ("La loi a été votée en 2024").

4. **Être précis.** Pas de déclaratifs vagues ("Les enjeux sont considérables"). Nommer la chose précise. Pas d'extrêmes paresseux ("tout le monde", "personne", "toujours", "jamais") sauf si factuellement exact.

5. **Mettre le lecteur dans la scène.** Pas de voix de narrateur distant ("On observe que", "Il est à noter que"). "Vous" bat "on" évasif. Les faits précis battent les abstractions.

6. **Varier le rythme.** Mixer les longueurs de phrases. Deux éléments battent trois. Finir les paragraphes différemment. Le tiret cadratin est toléré en usage modéré (un par paragraphe max).

7. **Faire confiance au lecteur.** Énoncer les faits directement. Pas de justification, de reformulation préemptive, de main tendue condescendante. Pas de "Comme chacun le sait", pas de "Il est bien évident que".

8. **Couper les phrases calibrées.** Si une phrase a l'air d'avoir été écrite pour LinkedIn, la réécrire.

## Contrôles rapides

Avant de livrer de la prose :

- Un adverbe en "-ment" ? Vérifier s'il apporte une information. Sinon, le couper.
- Une tournure impersonnelle ("il est", "il convient") ? Trouver le vrai sujet.
- Un objet inanimé qui agit ("le projet porte", "la décision ouvre") ? Nommer la personne.
- Un connecteur ("En effet", "Par ailleurs") ? Le lien logique est-il déjà évident ? Le couper si oui.
- Un "c'est... qui/que" ? Restructurer en syntaxe directe.
- Trois phrases consécutives de même longueur ? En casser une.
- Un paragraphe qui finit par une phrase-slogan ? Varier.
- Une ouverture pompeuse ("Force est de constater", "Il convient de souligner") ? Aller au fait.
- Un déclaratif vague ("Les enjeux sont majeurs") ? Nommer l'enjeu.
- Un métatexte ("Comme nous allons le voir", "Penchons-nous sur") ? Supprimer.
- Plus de deux connecteurs dans un paragraphe ? En éliminer.
- Une nominalisation ("la mise en place de", "la prise en compte de") ? Utiliser le verbe direct.

## Scoring

Noter de 1 à 10 sur chaque dimension :

| Dimension | Question |
|-----------|----------|
| Directivité | Affirmations ou annonces ? |
| Rythme | Varié ou métronomique ? |
| Confiance | Respecte l'intelligence du lecteur ? |
| Authenticité | Sonne humain ? |
| Densité | Quelque chose à couper ? |

En dessous de 35/50 : réviser.

## Exemples

Voir [references/examples.md](references/examples.md) pour les transformations avant/après.

## Attribution

Adapté de [stop-slop](https://github.com/hardikpandya/stop-slop) de Hardik Pandya (MIT License). Adaptation française : pas une traduction mais une réécriture pour les tics spécifiques du français IA.
