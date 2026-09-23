# Casse et structure des titres (français)

## Référence

1. **Wikipédia FR** fait foi pour le titre d'une œuvre. La BnF est écartée : elle se
   contredit sur un même titre d'une notice à l'autre.
2. **Garde** : la recherche Wikipédia renvoie le meilleur résultat, pas forcément la même
   œuvre (un titre français peut renvoyer l'article de l'original anglais). N'accepter la
   casse que si le titre de l'article est **identique au titre en base, aux accents et à
   la casse près**. Un « échec » de l'API est souvent un article inexistant, pas une
   limite de débit.
3. **Repli** : code typographique français (Lexique des règles typographiques en usage à
   l'Imprimerie nationale) :
   - majuscule au premier mot ;
   - si ce premier mot est un article défini, majuscule aussi au premier substantif et
     aux adjectifs qui le précèdent (`Le Petit Prince`, `La Guerre des mondes`) ;
   - **le repli s'abstient dès qu'un nom propre est en jeu**, sinon il produit
     `La Guerre de troie` ou `La Pierre de Lune`. Une liste de noms propres construite
     à partir du texte des livres eux-mêmes est plus fiable qu'un petit lexique.
4. Titres en anglais : casse de l'édition originale, ne pas appliquer la règle française.

## Structure

- **Série fusionnée dans le titre** (`TITRE - NOM DE SÉRIE - Tome II`) : extraire titre,
  série et index plutôt que de corriger seulement la casse. À traiter comme un lot à part.
- **Parenthèses et tirets sont le plus souvent légitimes** (~90 %) : ce sont des
  sous-titres d'œuvre (`Titre - Scènes de la vie de province`), pas une structure à démonter.
- **Tome dans le titre** : quand un volume de série n'a pas de sous-titre propre,
  conserver `- Tome N` dans le titre. Sinon N volumes portent le même titre, ce qui
  recrée de faux doublons.
- **Faux doublons de titre** (traductions, volumes, homonymes) : lever l'ambiguïté dans
  le titre (`Titre (trad. X)`) et les consigner dans le fichier d'état, section
  « Faux doublons ».
- Après tout lot de titres, **chercher les collisions** : deux livres au même titre
  normalisé révèlent souvent un doublon passé inaperçu.

## Tri de titre (`title_sort`)

- Convention usuelle en français : **article rejeté** (`Petit Prince, Le`,
  `Étranger, L'`). Mesurer la convention dominante de la bibliothèque avant d'écrire
  (`select sort from books where title like 'Le %'`) et s'y conformer.
- `calibredb add` et `set_metadata -f title:` ne la recalculent pas : poser `-f sort:`
  explicitement à chaque ajout ou changement de titre.

## Revue en masse

Produire un CSV `id, auteur, titre actuel, titre proposé, série, index, source`
(Wikipédia / repli / manuel) que l'utilisateur amende directement ; appliquer ensuite le
CSV amendé tel quel, puis rechercher les collisions de titres.
