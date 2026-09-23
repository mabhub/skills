# Arbitrer entre exemplaires par réparabilité

Pour choisir entre deux exemplaires d'un même livre, ordonner les critères par
**difficulté de correction a posteriori**, pas par catégorie. Un défaut irréparable
pèse plus lourd que n'importe quelle accumulation de défauts réparables par script.

| Niveau | Défauts | Réparable ? | Métriques (`epub_quality.py`) |
|---|---|---|---|
| 3 | césures OCR (`pouvaient- ils`), mojibake, caractères illisibles, mots tronqués | non : exige d'interpréter le sens (`alarrne` → `alarme` ?) | `ocr_hyph`, `mojibake`, `xmlerr` |
| — | images manquantes, appareil critique amputé | non : on ne recrée pas une illustration ni des notes | `img`, `toc`, `--compare` (images d'un seul côté) |
| 2 | apostrophes droites, guillemets absents, ligatures `œ` | difficilement : un script confond élisions et citations | `apos%`, `nbsp%` |
| 1 | styles inline, `<font>`, spans, `<p>` vides, CSS lourde | oui : suppression déterministe | `style`, `font`, `empty_p` |
| 0 | ids Calibre, nommage interne des fichiers, date d'ajout | **non discriminant** | — |

## Règles d'application

- Descendre au niveau suivant **seulement en cas d'égalité stricte**, avec une
  tolérance de 10-15 % pour ignorer le bruit statistique.
- Si aucun niveau ne départage, le choix est **indifférent** : le dire, ne pas inventer
  un critère (surtout pas l'id ou l'ancienneté).
- **Le fichier prime sur les métadonnées** : un titre ou une série se corrigent, une
  césure OCR non. Mais si l'exemplaire gardé porte des métadonnées moins bonnes,
  reporter les bonnes (titre, casse, série, étiquettes, éditeur) sur le survivant avant
  de supprimer l'autre, pour ne pas défaire un chantier antérieur.
- **Contenu d'abord** : comparer la prose (`epub_quality.py --compare A B` donne le
  pourcentage de mots communs et l'égalité d'empreinte). Moins de ~2 % d'écart : même
  texte, l'arbitrage porte sur la qualité. Au-delà : peut-être une autre traduction, un
  autre volume, une édition augmentée → ce n'est plus un doublon, remonter à
  l'utilisateur.
- **Quand chaque exemplaire a un défaut irréparable différent** (l'un typographiquement
  propre mais amputé, l'autre complet mais sale), ne pas trancher : exposer le dilemme,
  proposer les voies (corriger la typographie du complet, fusionner les deux).
- **Résidus d'acheteur** : à contenu égal, préférer l'exemplaire sans résidu ; si les
  deux en portent, purger (references/residus-acheteur.md), ne pas se contenter de
  choisir.
- **DRM réel** (`encryption:DRM`) : exemplaire illisible hors de son écosystème,
  presque toujours perdant ; vérifier qu'il n'est pas le seul porteur du texte.

## Présentation à l'utilisateur

Tableau par groupe : ids, métriques décisives, niveau qui tranche, recommandation. Les
cas nets d'abord, groupés en un lot ; les cas à arbitrer ensuite, un par un, avec la
question précise posée.
