# Checklist anti-confabulation

Liste des éléments d'une sortie LLM à vérifier en priorité avant transmission. Les LLM produisent le token suivant le plus probable — ce qui suffit à inventer noms, chiffres, citations et signatures avec un ton parfaitement assuré.

## Éléments à risque élevé

À vérifier systématiquement, même si le texte « sonne juste ».

### Identifiants nommés

- [ ] **Noms propres** (personnes, entreprises, projets) — le LLM peut inventer un auteur plausible.
- [ ] **Noms de packages / bibliothèques** — vérifier sur npm, PyPI, crates.io. Les LLM inventent régulièrement des packages plausibles (« slopsquatting »).
- [ ] **Noms de fonctions / méthodes / classes** — vérifier dans la doc ou le code. `array.first()` n'existe pas en JS standard.
- [ ] **Flags CLI** — vérifier avec `--help`. Les LLM inventent des flags cohérents avec la convention de l'outil.
- [ ] **Variables d'environnement** — vérifier dans la doc.
- [ ] **Endpoints d'API** — vérifier dans la doc OpenAPI / la collection Postman.

### Chiffres et dates

- [ ] **Chiffres précis** (statistiques, mesures, versions) — un LLM transforme « environ 80% » en « 83,7% » sans source.
- [ ] **Dates** — surtout les dates récentes ou futures, qui peuvent être hors cutoff.
- [ ] **Numéros de version** — vérifier le numéro courant sur le registre officiel.
- [ ] **Prix / coûts** — vérifier la grille tarifaire actuelle.

### Citations et références

- [ ] **Citations littérales** — vérifier mot pour mot. Les LLM paraphrasent une citation tout en gardant les guillemets.
- [ ] **URLs** — tester qu'elles existent et pointent où on l'attend. Les LLM construisent des URLs plausibles inventées.
- [ ] **Numéros d'issue / PR / RFC** — vérifier que le numéro existe et porte bien sur le sujet annoncé.
- [ ] **Références juridiques / normatives** — articles de loi, normes ISO, RFC. Vérifier le numéro et la portée.

### Affirmations techniques

- [ ] **Comportement décrit d'une API** — vérifier dans la doc, ou tester.
- [ ] **Compatibilité** (versions, OS, navigateurs) — vérifier la matrice de compatibilité officielle.
- [ ] **Performances annoncées** — chercher la source du benchmark, ou marquer « non mesuré ».
- [ ] **Sécurité** — un LLM peut affirmer qu'une approche est sécurisée par construction. Vérifier auprès d'une source d'autorité (OWASP, NIST, doc de l'outil).

## Signaux d'alerte

Indices qu'un passage mérite une vérification renforcée :

- **Précision suspecte** — chiffres à 3 décimales sans source, dates au jour près sur des faits anciens.
- **Détails périphériques abondants** — quand le LLM brode autour d'un fait central avec un ton expert.
- **Cohérence interne parfaite** — une explication trop bien ficelée peut être fabriquée.
- **Affirmation universelle** — « toujours », « jamais », « toutes les implémentations » : presque toujours faux ou trop fort.
- **Référence sans lien** — « comme l'a montré l'étude X » sans URL ni citation précise.
- **Conseil contraire à votre intuition** sans justification concrète — peut être correct, peut être confabulé.

## Méthode de vérification minimale

Si le temps manque, prioriser dans cet ordre :

1. **Tester localement** ce qui peut l'être (commande, signature, endpoint).
2. **Lire la source primaire** (doc officielle, code, RFC) plutôt qu'une page tierce.
3. **Vérifier le nom et l'existence** des entités citées (package, fonction, personne).
4. **Marquer comme non vérifié** ce que vous n'avez pas pu confirmer — explicitement, dans le texte.

## Quand renoncer

Si le coût de vérification dépasse la valeur du message :

- Réduire la portée du message (n'affirmer que ce qui est vérifié).
- Transmettre la sortie LLM **explicitement comme telle** : « Le LLM me suggère ceci, je n'ai pas vérifié — qu'en penses-tu ? »
- Ou ne pas envoyer.

Le pire choix est de transmettre du non vérifié avec un ton d'autorité.
