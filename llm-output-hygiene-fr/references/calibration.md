# Calibrer la certitude en français

Vocabulaire pour marquer le niveau de certitude d'une affirmation. Le ton par défaut d'un LLM est l'autorité ; ce vocabulaire la désamorce **là où c'est dû**, sans verser dans la fausse modestie systématique.

## Échelle de certitude

| Niveau | Marqueur français | Quand l'utiliser |
|--------|-------------------|------------------|
| Vérifié | Affirmation directe, sans hedge | J'ai vu la source primaire (doc, code, test, mesure) |
| Source secondaire | « Selon X… », « D'après la doc Y… » | J'ai vu une source qui rapporte le fait, pas la source primaire |
| Probable | « Probablement », « il semble que », « a priori » | Forte présomption, pas de vérification |
| Hypothèse | « Je pense que », « il me semble que » | Intuition à valider |
| À vérifier | « À vérifier », « non vérifié », « le LLM suggère X » | Affirmation reprise du LLM sans vérification |
| Inconnu | « Je ne sais pas », « pas trouvé » | À préférer à une réponse plausible inventée |

## Marqueurs de provenance

Préciser **d'où** vient l'information :

- « Selon la doc officielle de [X]… »
- « D'après le code de `module/file.py:42`… »
- « Testé localement sur [version] »
- « Non testé — suggestion du LLM à valider »
- « D'après mes souvenirs, à confirmer »
- « Cf. [lien] »

## Désamorcer le ton expert

Patterns LLM typiques et leur version calibrée :

| Pattern LLM (autoritaire) | Version calibrée |
|---------------------------|------------------|
| « La meilleure approche est X » | « X marche dans les cas que j'ai vus. Pour ton cas spécifique, à valider. » |
| « Il faut absolument utiliser Y » | « Y est ce que je recommanderais par défaut, sauf si [contre-indication]. » |
| « Cette fonction renvoie un Promise<T> » (non vérifié) | « D'après la signature, ça renvoie un Promise<T> — à confirmer dans la doc. » |
| « En 2024, l'outil X a été remplacé par Y » | « Le LLM dit que X a été remplacé par Y en 2024. Je n'ai pas vérifié. » |
| « C'est un anti-pattern bien connu » | « C'est généralement déconseillé pour [raison concrète]. » |
| « La documentation indique clairement que… » | Citer la doc, ou retirer « clairement ». |

## Anti-patterns de calibrage

À éviter :

- **Fausse modestie systématique.** Mettre « je crois que » devant chaque phrase brouille le signal. Réserver les hedges aux affirmations réellement incertaines.
- **Hedge contagieux.** Une fois qu'on commence à hedger, ne pas continuer par habitude sur les phrases suivantes qui sont, elles, vérifiées.
- **Disclaimer global en bas.** « Vérifiez ces informations avant utilisation » au pied du message ne remplace pas le marquage par affirmation. Il dilue la responsabilité au lieu de la cibler.
- **Hedge passif-agressif.** « Il *semblerait* que ta fonction *pourrait* avoir un bug » : si on a vérifié, on l'affirme. Si on n'a pas vérifié, on dit pourquoi on soupçonne.

## Exemple de calibrage différentiel

**Avant (ton LLM uniforme) :**
> Le module `auth` utilise JWT avec une rotation des clés toutes les 24h. Cette approche est conforme aux standards OWASP et garantit une sécurité optimale. Pour l'intégrer, il suffit d'appeler `auth.rotate()` dans votre middleware.

**Après (calibrage différentiel) :**
> Le module `auth` utilise JWT (vu dans `src/auth/jwt.ts`). La rotation à 24h est mentionnée dans le README mais je n'ai pas vérifié qu'elle est effectivement active. Le LLM affirme que c'est conforme OWASP — à confirmer si c'est un point bloquant. Pour l'appel, `auth.rotate()` n'apparaît pas dans le code que j'ai lu : à chercher dans la doc ou demander à l'auteur du module.

Le second message est plus long, mais il dit au lecteur **où regarder** s'il veut vérifier — c'est précisément ce qui réduit la taxe de vérification.
