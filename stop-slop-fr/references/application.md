# Appliquer sans abîmer

Chaque tic décrit un choix par défaut du modèle. Une personne peut faire n'importe lequel de ces choix exprès. Ce fichier dit quand ne pas corriger et comment travailler sur un fichier.

## Force des tics

**Forts : corriger dès la première occurrence.** Un rédacteur attentif les emploie rarement exprès.

- Contraste binaire et liste négative ("Ce n'est pas X, c'est Y"), y compris scindé en deux phrases.
- Phrase-slogan qui répète le paragraphe, fragments en rafale, phrase qui commente l'exemple qu'on vient de lire.
- Élan avant le point : ouverture pompeuse, métatexte, franchise mise en scène ("Soyons honnêtes", "Disons-le clairement").
- Objection sans objecteur ("Entendons-nous bien", "On pourrait être tenté de").
- Résidu de chatbot ("N'hésitez pas", "J'espère que cela vous aide").

**Faibles seuls : agir seulement s'ils s'accumulent** dans le même passage, ou s'ils accompagnent un tic fort. Adverbe en "-ment", connecteur, voix passive, tiret, triplet, construction clivée ("c'est… qui/que"), nominalisation, précaution ("peut-être", "plutôt"), description du document par lui-même.

Plusieurs tics faibles différents dans un paragraphe pèsent plus qu'un même tic répété.

## Quand ne pas agir

Laisser la formule telle quelle :

- dans une citation, un titre d'œuvre, un nom propre ;
- dans un passage qui parle de la formule au lieu de l'employer (comme ce fichier) ;
- dans une formule de politesse ou une signature de courrier ("Bien cordialement", "Dites-moi si ça vous va") : elles existaient avant les chatbots. Seulement dans un courrier ou un message : dans un article, une doc ou un rapport, "N'hésitez pas si vous avez des questions" reste un résidu de chatbot ;
- dans un texte écrit avant fin 2022, qui n'est pas d'un LLM.

Garder ce qui porte la voix de l'auteur, sauf si ça brouille le sens :

- un détail précis et insolite (une adresse réelle, une citation bizarre, "l'avocat qui travaillait au-dessus de chez mon dentiste") ;
- l'ambivalence non résolue ("c'est plutôt bien, mais quelque chose me gêne et je n'arrive pas à dire quoi") ;
- les références datées : argot, mèmes, private jokes d'une époque ou d'un milieu ;
- un choix à la première personne que l'auteur peut justifier ;
- un vrai aparté, une parenthèse, une autocorrection.

## Registre familier

Un message informel (chat, commentaire, avis énervé, coup de gueule) est souvent déjà humain. Minuscules, abréviations ("stp", "dsl"), fragments, ponctuation expressive ("Nul. Nul. Nul.") font partie du registre : les laisser.

- Un seul tic ne suffit pas. Résidu de chatbot seul : le retirer, sans toucher au reste.
- Deux tics distincts font de tout le texte une cible de réécriture.
- Garder l'intensité : "dégueulasse" reste "dégueulasse", "j'ai redémarré" reste "j'ai redémarré".
- Aucun tic : rendre le texte inchangé, et le dire.

## Échantillon de l'utilisateur

Si l'utilisateur fournit un texte de sa main, le lire d'abord et en reprendre la longueur des phrases, le vocabulaire, la ponctuation, les débuts de phrase et les transitions. L'échantillon prime sur les règles, y compris celle des tirets : s'il en met trois par paragraphe, en garder à peu près autant.

Sans échantillon, suivre le genre du texte. Billet, essai, texte personnel : garder les opinions, les doutes, l'humour. Texte technique, juridique ou de référence : neutre et simple.

## Contrôle après réécriture

Comparer la version finale au texte d'origine :

- aucun fait, nom, chiffre, date, citation, lien ou classement perdu ou modifié ;
- aucune simultanéité ("pendant que", "en même temps") ni causalité inventée ou supprimée ;
- les coupes les plus risquées : triplets réduits, précautions retirées, listes à intitulés transformées en prose.

Une affirmation perdue est une erreur, sauf si une règle demandait de la couper (importance gonflée, phrase-slogan).

Ne pas combler un passage vague par un détail inventé : si une phrase exige une précision qu'on n'a pas, la demander ou écrire une phrase plus simple.

## Mode fichier

Quand l'utilisateur désigne un fichier :

1. Relire le fichier entier depuis le disque, même s'il a été écrit dans la session ; un long fichier se lit par morceaux jusqu'à avoir tout couvert.
2. Ne modifier que la prose. Blocs de code, code en ligne, commandes, chemins, frontmatter YAML, données, cibles de liens : intacts.
3. Écrire seulement la version finale dans le fichier.
4. Indiquer combien de sections ont été relues et nommer celles qui n'ont pas pu l'être.

Dans une tâche plus large (message de commit, description de MR, doc), rendre seulement le texte final, sans liste de corrections.
