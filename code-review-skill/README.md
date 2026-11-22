# code-review-skill

Audit proactif d'un code existant (projet entier, zone ou branche) : code smells, duplications, risques, sur-ingénierie. Chaque finding est vérifié avant d'être écrit, et ceux de sur-ingénierie passent un test de falsification. Le skill produit un rapport priorisé. Les corrections viennent ensuite, avec l'accord de l'utilisateur.

Le mode d'emploi est dans `SKILL.md`. Ce fichier sert seulement à choisir entre ce skill et la revue intégrée de Claude Code.

## Face à `/code-review` (intégré à Claude Code)

| | `code-review-skill` | `/code-review` |
|---|---|---|
| Cible | Code existant : projet, dossier ou branche | Diff courant, PR, branche ou chemin |
| Ce qu'il cherche | Qualité et structure : duplications, complexité injustifiée, risques, documentation périmée | Bugs de correction, à un niveau d'effort choisi (`low` à `max`, `ultra` dans le cloud) |
| Sortie | Rapport priorisé, corrections avec accord | Findings, publiables en commentaires de PR (`--comment`) ou appliqués directement (`--fix`) |
| Coût | Une passe guidée dans la session | Plus coûteux en tokens dès que l'effort monte (constat d'usage, pas mesuré) |

### Constat sur un cas réel

Les deux revues ont été passées sur le même code de [tx](https://github.com/mabhub/tx) (scripts shell de gestion de sessions tmux) le 2026-11-05, `/code-review` en effort modéré :

- **Trouvé seulement par `/code-review`** → une attente restante dans la fermeture des sessions, un problème de quoting dans un script de test
- **Trouvé seulement par `code-review-skill`** → un message trompeur affiché avant `kill-session`, une section du README périmée
- **Faux positif de `/code-review`** → localisation des mois avec `LC_ALL=C printf` (vérifié faux)

Aucun recouvrement sur ce cas : les deux revues se complètent, ce qui colle avec leurs objets respectifs (bugs d'un côté, qualité et cohérence de l'autre). Ce n'est qu'un cas, sur un petit projet shell : à confirmer sur d'autres.

### Quand utiliser lequel

- Audit d'un projet ou d'une branche, recherche de dette ou de sur-ingénierie → `code-review-skill`
- Revue d'un diff avant commit ou d'une PR, recherche de bugs → `/code-review`
- Code qui compte vraiment (avant publication, après une grosse série de changements) → les deux, l'un après l'autre
