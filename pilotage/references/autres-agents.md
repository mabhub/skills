# Autres agents que Claude Code

Le dossier `.pilotage/`, les statuts, le point d'étape, la reprise et toutes les
commandes du script sauf `contexte` marchent avec tout agent qui lance des commandes
shell et modifie des fichiers. Trois parties dépendent de Claude Code :

- **Commandes** : employer les équivalents de l'agent pour vider le contexte (`/clear`,
  souvent « nouvelle session »), le résumer (`/compact`) et invoquer le skill
  (`/pilotage`). S'il n'a pas d'équivalent de `/compact`, recommander point d'étape puis
  nouvelle session.
- **Mesure** : `contexte` ne lit que les transcripts de Claude Code. Ailleurs, il
  l'indique ; prendre la taille affichée par l'agent s'il en donne une, sinon l'estimer
  (longueur de l'échange, fichiers lus, grosses sorties) et l'écrire comme telle dans la
  recommandation (`Contexte : ~150K (estimé)`).
- **Veille** : elle repose sur les hooks de Claude Code. `contexte` affiche
  `Veille cache : sans objet hors Claude Code`.

Les seuils de taille et la durée du cache (1 h) sont ceux de Claude Code avec les modèles
d'Anthropic. Le raisonnement reste valable ailleurs (coût qui croît avec la longueur,
reprise plus chère une fois le cache expiré) ; adapter les chiffres à la fenêtre de
contexte et au cache du fournisseur.
