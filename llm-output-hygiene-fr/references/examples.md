# Exemples avant/après

Cas concrets de sortie LLM brute (« sloppypasta ») et leur version après application du skill : calibrage de certitude, marquage de provenance, vérification, compression, delta humain.

## Exemple 1 : Mail à un manager

**Avant (sortie LLM brute, collée telle quelle) :**

> Bonjour,
>
> Suite à notre échange concernant la migration vers PostgreSQL 16, je tenais à vous faire un retour structuré sur les enjeux de cette transition.
>
> PostgreSQL 16, sorti en septembre 2023, apporte des améliorations significatives notamment en matière de réplication logique, de performance des requêtes parallèles (jusqu'à 30% d'amélioration sur certains workloads), et de sécurité avec le support natif de SCRAM-SHA-256. La communauté recommande largement cette version pour les nouveaux déploiements.
>
> Pour notre infrastructure, je préconise une migration en trois phases : d'abord les environnements de développement, puis la pré-production, et enfin la production avec une fenêtre de maintenance de 4 heures. Cette approche, conforme aux meilleures pratiques de l'industrie, minimise les risques.
>
> Je reste à votre disposition pour en discuter.
>
> Cordialement,

**Problèmes :**
- Date de sortie (« septembre 2023 ») non vérifiée.
- Chiffre « 30% » sans source.
- « SCRAM-SHA-256 » présenté comme nouveauté de 16 — suspect (existe depuis 10).
- « 4 heures » sortie de nulle part.
- Ton expert sur des éléments non vérifiés.
- Aucun delta humain.
- Long à lire pour peu d'information actionnable.

**Après :**

> Bonjour,
>
> Sur la migration PostgreSQL 16 dont on a parlé : j'ai regardé les notes de version (lien : […]). Les points qui me semblent pertinents pour nous sont la réplication logique et l'amélioration des requêtes parallèles. Le gain de perf annoncé varie selon les workloads — je n'ai pas de chiffre vérifié pour notre cas.
>
> Mon avis : faire le passage d'abord en dev, voir si on rencontre des soucis sur nos requêtes lourdes (rapport mensuel, export client), puis passer pré-prod et prod. Pour la fenêtre de prod, je préfère qu'on cale ça avec [ops] sur la base de la taille actuelle de la DB plutôt que de poser un chiffre maintenant.
>
> Question ouverte : est-ce qu'on a une raison de viser 16 spécifiquement ou est-ce qu'on peut attendre 17 ?
>
> Benjamin

**Corrections :** chiffres non vérifiés retirés, fait douteux supprimé, faux registre expert remplacé par avis personnel sourcé, delta humain (« mon avis », « je préfère », « question ouverte »), longueur divisée par deux.

---

## Exemple 2 : Commentaire de Merge Request

**Avant :**

> Cette implémentation présente plusieurs problèmes critiques. Premièrement, l'utilisation de `Array.prototype.flat()` sans spécifier de profondeur est un anti-pattern reconnu qui peut causer des problèmes de performance sur les structures imbriquées profondément. Deuxièmement, la gestion d'erreur via `try/catch` autour de l'appel asynchrone est insuffisante et ne respecte pas les conventions de la codebase. Je recommande d'utiliser un wrapper `safeAsync` comme cela est fait partout ailleurs dans le projet. Enfin, l'absence de tests unitaires sur cette fonction est bloquante.

**Problèmes :**
- « `Array.prototype.flat()` sans profondeur est un anti-pattern » — c'est faux, le défaut à 1 est documenté et standard.
- « comme cela est fait partout ailleurs dans le projet » — non vérifié, le wrapper `safeAsync` peut ne pas exister.
- Ton uniforme « critique / bloquant » sans nuance.

**Après :**

> Trois remarques :
>
> 1. `flat()` sans argument utilise une profondeur de 1 — vérifie que c'est bien ce que tu veux ici, vu que `data` peut contenir des sous-tableaux à 2 niveaux dans le cas du flux d'import (cf. `importFixtures.ts`).
> 2. Sur la gestion d'erreur : je vois ailleurs dans `src/api/` un pattern `safeAsync(...)` — est-ce que c'est applicable ici ? Si tu confirmes que ce n'est pas adapté, ton `try/catch` me va.
> 3. Pas de test sur cette fonction — bloquant pour moi sur ce module vu sa criticité. Un cas nominal + un cas d'erreur réseau suffirait.
>
> Le reste me semble bien.

**Corrections :** affirmation fausse retirée, « partout ailleurs » remplacé par une référence vérifiable + question ouverte, hiérarchisation (le test est vraiment bloquant, le reste est négociable), delta humain (« me va », « me semble bien »).

---

## Exemple 3 : Message Slack

**Avant (532 caractères) :**

> Hello l'équipe ! 👋 Je voulais partager avec vous une réflexion intéressante concernant notre stratégie d'observabilité. En effet, après avoir étudié les différentes solutions disponibles sur le marché, il apparaît que OpenTelemetry s'impose désormais comme le standard de facto, étant adopté par plus de 80% des entreprises du Fortune 500. Sa compatibilité native avec Prometheus, Jaeger et Datadog en fait un choix particulièrement pertinent pour nos cas d'usage. Qu'en pensez-vous ?

**Problèmes :**
- Chiffre « 80% du Fortune 500 » non sourcé.
- Ton « article LinkedIn » sur Slack.
- Question vague (« qu'en pensez-vous ? ») sans point de décision concret.
- Lecture > écriture.

**Après (147 caractères) :**

> Question équipe : on bascule l'observabilité sur OpenTelemetry ? Compatible avec ce qu'on a (Prom, Jaeger). J'ai pas creusé la migration, juste un sondage avant de me lancer.

**Corrections :** chiffre non sourcé retiré, ton conversationnel, question concrète, delta humain (« j'ai pas creusé, juste un sondage »), longueur divisée par 3.

---

## Exemple 4 : Paragraphe de doc technique

**Avant :**

> Le système de cache utilise Redis 7.2 avec la stratégie LRU pour optimiser les performances. La TTL par défaut est fixée à 3600 secondes, ce qui correspond aux meilleures pratiques de l'industrie. Le cache supporte jusqu'à 10 000 opérations par seconde et garantit une cohérence éventuelle avec la base de données primaire grâce à un mécanisme d'invalidation basé sur des événements pub/sub.

**Problèmes :**
- « 7.2 », « 3600 », « 10 000 ops/sec » : chiffres présentés comme faits, jamais vérifiés.
- « meilleures pratiques de l'industrie » : argument d'autorité vide.
- « garantit une cohérence éventuelle » : affirmation forte, à vérifier.

**Après :**

> Le cache utilise Redis (version dans `docker-compose.yml`) avec la politique d'éviction `allkeys-lru` (cf. `redis.conf`). La TTL par défaut est définie dans `config/cache.ts` (variable `DEFAULT_TTL`).
>
> L'invalidation passe par le canal pub/sub `cache:invalidate` ; les producteurs sont listés dans `src/cache/invalidators/`. La cohérence avec la base primaire est *éventuelle* : un lecteur peut voir une valeur stale entre l'écriture en base et la propagation de l'invalidation. Pour les lectures qui doivent être strictement à jour, voir le helper `readThrough()`.
>
> Pas de chiffre de débit mesuré côté équipe — si vous avez besoin d'un ordre de grandeur, lancez le bench dans `bench/cache.bench.ts`.

**Corrections :** chiffres remplacés par des pointeurs vers la source de vérité (le code), affirmation de cohérence précisée et accompagnée de l'échappatoire, absence de mesure indiquée explicitement avec une voie de recours.

---

## Méta-pattern

Une bonne réécriture **augmente parfois la longueur** quand elle ajoute la provenance — mais elle réduit la **charge de vérification** côté lecteur. Le critère n'est pas « combien de caractères » mais « combien de minutes le lecteur doit dépenser pour faire confiance au message ».

Un texte plus long avec des pointeurs précis bat un texte plus court mais non vérifiable.
