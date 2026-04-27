---
name: llm-output-hygiene-fr
description: >
  Hygiène épistémique des sorties LLM avant transmission à un autre humain.
  Calibre la certitude, marque la provenance, détecte la confabulation,
  compresse les pavés. Utiliser AVANT d'envoyer un mail, un message Slack,
  un commentaire d'issue/MR, une doc, ou tout texte rédigé avec aide LLM.
  Trigger phrases : "envoie ce message", "rédige ce mail", "commente cette MR",
  "réponds à cette issue", "publie cette doc", "hygiène LLM",
  "calibre la certitude", "vérifie avant d'envoyer", "compresse avant envoi".
---

# LLM Output Hygiene FR

Filet de sécurité épistémique pour toute sortie LLM destinée à un autre humain. Pas un nettoyage stylistique (voir `stop-slop-fr` pour ça) : un contrôle de **fond** avant transmission.

## Pourquoi

Une sortie LLM brute pose trois problèmes pour le destinataire :

1. **Asymétrie d'effort** — l'écriture est gratuite, la lecture reste coûteuse. Un pavé non synthétisé fait porter le coût à l'autre.
2. **Sur-certitude** — le LLM écrit avec un ton d'expert même sur ce qu'il ne sait pas. Le lecteur ne peut plus distinguer le vérifié du plausible.
3. **Confabulation** — noms, chiffres, citations, signatures d'API peuvent être inventés sans signal extérieur.

Le destinataire est alors forcé de tout traiter comme non vérifié — une « taxe de vérification » qui s'ajoute à l'asymétrie d'effort, et qui érode la confiance accordée à l'expéditeur.

L'objectif de ce skill n'est **pas** de faire passer une sortie LLM pour humaine. C'est de rendre au lecteur les signaux qui lui permettent de calibrer sa propre vérification.

## Règles

1. **Calibrer la certitude.** Repérer chaque affirmation factuelle ; marquer celles qui ne sont pas vérifiées. Le ton autoritaire par défaut des LLM doit être désamorcé sur tout ce qui n'est pas sourcé. Voir [references/calibration.md](references/calibration.md).

2. **Marquer la provenance.** Distinguer : « j'ai vérifié », « LLM non vérifié », « selon la doc X », « non testé sur cet environnement », « hypothèse à valider ». Permet au lecteur de cibler son effort de vérification.

3. **Vérifier avant d'envoyer.** Checklist anti-confabulation : noms propres, chiffres, dates, citations, URLs, signatures d'API, noms de fonctions, flags CLI, faits historiques. Voir [references/checklist.md](references/checklist.md).

4. **Compresser avant de coller.** Si le texte prend plus de temps à lire qu'il n'en a pris à produire, il n'est pas prêt. Synthèse courte > pavé. Lien vers la source > reformulation plausible.

5. **Apporter un delta humain.** Avant d'envoyer, dire ce que **vous** validez, contestez, ou ajoutez par rapport à la sortie modèle. Ce delta — même court — restaure le « token d'humanité » et donne au lecteur un point d'appui pour répondre.

6. **Choisir le bon format.** Citation littérale > paraphrase qui peut dériver. Lien vers la source > reformulation. Liste de bullets > prose narrative quand l'information est structurée. Message court humain > pavé LLM.

7. **Refuser le faux registre expert.** Sur un sujet où vous n'êtes pas expert, écrire « je ne sais pas, le LLM suggère X — à vérifier » plutôt que de transmettre une réponse plausible avec un ton d'autorité.

## Contrôles rapides

Avant d'envoyer / publier / commenter :

- Une affirmation factuelle non sourcée ? La sourcer ou la marquer « à vérifier ».
- Un nom propre, un chiffre, une date, une citation ? Vérifier dans une source primaire.
- Une signature d'API, un nom de fonction, un flag CLI, un nom de package ? Vérifier dans la doc ou le code, jamais dans le souvenir du modèle.
- Une URL ? Tester qu'elle existe.
- Un pavé > 2 écrans ? Demander : ai-je synthétisé, ou collé ?
- Un ton d'expert sur un sujet où je ne suis pas expert ? Désamorcer.
- Le texte serait-il plus long à lire qu'il ne m'a pris à produire ? Compresser.
- Quelle est ma valeur ajoutée par rapport à la sortie brute ? Si aucune : ne pas envoyer, ou envoyer juste le lien vers la source.
- Une affirmation qui peut être fausse sans que personne ne le détecte avant longtemps ? Vérifier en priorité.

## Anti-patterns à éviter

- **Fausse modestie systématique.** Calibrer la certitude là où elle est due. Une affirmation vérifiée et exacte n'a pas besoin de « je crois que peut-être ». Mettre l'incertitude *sur ce qui est incertain*, pas sur tout par sécurité — ça brouille le signal.
- **Disclaimer générique en bas de message.** « Ce texte a été rédigé avec l'aide d'un LLM » ne dit rien d'utile. Préférer marquer la provenance au niveau de chaque affirmation à risque.
- **Refus de transmettre.** L'objectif n'est pas de bloquer toute sortie LLM, c'est de la transmettre proprement. Une sortie vérifiée, calibrée et compressée est légitime.

## Skill complémentaire

`llm-output-hygiene-fr` traite le **fond** (épistémique, factuel, communicationnel). Pour la **forme** (tics stylistiques LLM en français : formules pompeuses, rythme métronomique, nominalisations…), voir le skill `stop-slop-fr`. Séquence recommandée : d'abord `llm-output-hygiene-fr` (vérifier ce qu'on dit), ensuite `stop-slop-fr` (nettoyer comment on le dit).

## Exemples

Voir [references/examples.md](references/examples.md) pour des transformations avant/après sur des cas concrets (mail, commentaire de MR, message Slack, paragraphe de doc).

## Attribution

Inspiré de l'article *Stop Sloppypasta — Don't paste raw LLM output at people* (stopsloppypasta.ai), qui formalise les notions d'asymétrie d'effort, de dette cognitive et de taxe de vérification utilisées ici.
