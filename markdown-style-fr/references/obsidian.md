# Obsidian — coffre de notes

Conventions spécifiques aux notes rédigées pour un coffre Obsidian. S'ajoutent aux
règles génériques du `SKILL.md`.

## Retours à la ligne — préservés tels quels

Obsidian **préserve les retours à la ligne simples** dans son rendu (contrairement
au Markdown CommonMark, qui les fond). Donc :

- Ne **pas** wrapper le texte en dur pour "ranger" la source : un retour à la
  ligne simple introduit une vraie rupture visuelle à l'affichage.
- Écrire une ligne logique par ligne, laisser la note refléter la structure voulue.
- Pas besoin des deux espaces de fin de ligne (`  \n`) pour forcer un saut : un
  simple retour suffit dans Obsidian (mais les deux espaces peuvent être préservés pour assurer une portabilité).

C'est cohérent avec la règle générique "ne pas imposer de wordwrap à la source" :
sur une note Obsidian, un wrap dur introduit en plus des coupures de ligne parasites
au rendu.

## Callouts

Obsidian supporte la même syntaxe de callouts que GitHub/GitLab :

```markdown
> [!note] Titre
> Contenu.
```

Types : `[!note]`, `[!tip]`, `[!warning]`, `[!important]`, `[!info]`, `[!todo]`,
`[!quote]`, etc. Pliables avec `> [!note]-` (fermé) ou `> [!note]+` (ouvert).

## Liens internes

Liens de coffre en `[[nom-de-note]]` (wikilinks), pas en lien Markdown classique,
pour rester cohérent avec le graphe Obsidian.
