# Agent Skill : TL;DR Generator

Cette Agent Skill fournit à Claude les instructions, templates et outils pour générer des résumés TL;DR en français de haute qualité.

## Structure de la Skill

```
tldr-generator/
├── SKILL.md                 # Instructions principales et méthodologie
├── README.md                # Ce fichier
├── scripts/                 # Scripts exécutables
│   ├── analyze-article.mjs
│   ├── identify-articles.mjs
│   ├── validate-metrics.mjs
│   └── validate_tldr.py
├── tools/                   # Outils réutilisables
│   └── utils.mjs
└── docs/                    # Documentation additionnelle
    ├── TEMPLATES.md
    └── VALIDATION.md
```

## Utilisation

### Avec un agent compatible Agent Skills

L'agent chargera automatiquement cette Skill quand vous demanderez :

- "Génère le/un/les TLDR"
- "Résume cet article"
- "Crée un résumé de..."
- "Synthétise le contenu de..."

**L'agent suivra automatiquement :**

1. La méthodologie dans `SKILL.md`
2. Les templates appropriés dans `TEMPLATES.md`
3. Les critères de validation dans `VALIDATION.md`

### Chargement progressif

Selon l'architecture Agent Skills :

**Niveau 1 (démarrage)** : Métadonnées légères (~100 tokens)

- Nom : `tldr-generator`
- Description : quand l'utiliser

**Niveau 2 (déclenchement)** : Instructions complètes (<5k tokens)

- Lecture de `SKILL.md` quand TLDR demandé

**Niveau 3+ (selon besoin)** : Ressources additionnelles

- `TEMPLATES.md` : consulté pour choisir structure
- `VALIDATION.md` : consulté pour validation
- `validate_tldr.py` : exécuté pour checks automatiques

## Validation automatique

### Scripts JavaScript (rapides, aucune dépendance)

**identify-articles.mjs** - Liste articles nécessitant TL;DR

```bash
node tldr-generator/scripts/identify-articles.mjs [directory] [--json]
```

**analyze-article.mjs** - Analyse détaillée d'un article

```bash
node tldr-generator/scripts/analyze-article.mjs <article.md> [--json]
```

**validate-metrics.mjs** - Validation métriques TL;DR

```bash
node tldr-generator/scripts/validate-metrics.mjs <article.tldr.md> [--json]
```

Vérifications :

- ✅ Nombre de mots (max 750)
- ✅ Temps de lecture (max 3 min)
- ✅ Réduction par rapport à l'original
- ✅ Présence champs requis front-matter
- ✅ Nombre de tags

### Script Python (validation complète)

**validate_tldr.py** - Validation approfondie

```bash
python tldr-generator/scripts/validate_tldr.py "article.tldr.md"
```

### Vérifications effectuées

- ✅ Nombre de mots (max 750)
- ✅ Temps de lecture (max 3 min)
- ✅ Front-matter YAML valide
- ✅ Champs requis présents
- ✅ Structure du document
- ✅ Longueur des paragraphes
- ✅ Syntaxe des liens
- ✅ Encodage UTF-8

### Sortie exemple

```
✅ Validation réussie
   - Mots: 642/750
   - Temps de lecture: 2.6 min
   - Front-matter: valide
   - Structure: correcte
```

Ou avec avertissements :

```
⚠️  Avertissements (non bloquants):
   - Paragraphe ligne 45: 167 mots (recommandé < 150)
   - Peu de tags (2), recommandé: 3-10
```

## Templates disponibles

`TEMPLATES.md` contient des structures complètes pour :

1. **Articles techniques/documentation**
   - Résumé exécutif
   - Présentation
   - Architecture et fonctionnement
   - Cas d'usage et avantages
   - Limitations

2. **Articles de presse/actualité**
   - Résumé exécutif
   - Les faits
   - Contexte et enjeux
   - Réactions et positions
   - Implications et conséquences

3. **Articles d'analyse/essai**
   - Résumé exécutif
   - Thèse et problématique
   - Arguments principaux
   - Exemples et illustrations
   - Contre-arguments
   - Conclusion

4. **Newsletters/multi-sujets**
   - Résumé exécutif
   - Sections par sujet
   - Liens entre sujets
   - Synthèse

5. **Articles de recherche**
   - Résumé exécutif
   - Question de recherche
   - Méthodologie
   - Résultats principaux
   - Limitations
   - Implications

## Critères clés

**Longueur :** < 750 mots (~3 min de lecture)

**Style :** Équilibré entre :

- Paragraphes rédigés fluides
- Listes structurées pour faits/données

**Préservation :** Maximum d'informations de l'original

- Dates, noms, chiffres exacts
- Citations importantes
- Contexte essentiel
- Liens pertinents

**Réduction :** Pas de limite minimale

- Articles longs peuvent avoir 80-90% de réduction
- L'important : informations clés préservées

## Intégration dans workflow

### Identification des articles à traiter

```bash
node tldr-generator/scripts/identify-articles.mjs --json | jq .articles
```

### Génération avec agent

```
Génère le TLDR pour "article.md"
```

L'agent :

1. Charge automatiquement `SKILL.md`
2. Lit l'article source
3. Détermine le type d'article
4. Consulte `TEMPLATES.md` pour le template approprié
5. Génère le TLDR selon la méthodologie
6. Peut exécuter `validate_tldr.py` pour validation

### Post-génération

```bash
# Validation manuelle
python tldr-generator/scripts/validate_tldr.py "article.tldr.md"

# Vérifier absence d'articles manquants
node tldr-generator/scripts/identify-articles.mjs --json | jq '.articles | length'
# Devrait retourner 0
```

## Avantages de l'approche Skill

**vs README simple :**

- ✅ Chargement à la demande (économie tokens)
- ✅ Scripts exécutables (validation automatique)
- ✅ Templates structurés et accessibles
- ✅ Réutilisable automatiquement
- ✅ Modularité (mise à jour facile d'un composant)
- ✅ Pas de contexte penalty pour ressources non utilisées

**Efficacité tokens :**

- Métadonnées : ~100 tokens (toujours chargé)
- Instructions : ~2-3k tokens (quand déclenché)
- Templates : 0 tokens (lus seulement si besoin, via bash)
- Script validation : 0 tokens (exécuté, sortie seule retournée)

## Maintenance

### Mettre à jour la méthodologie

Éditer `SKILL.md`

### Ajouter un template

Éditer `TEMPLATES.md`, ajouter nouvelle section

### Ajuster critères de validation

Éditer `VALIDATION.md` et/ou `validate_tldr.py`

### Tester après modifications

```bash
# Générer un TLDR de test
# Puis valider
python tldr-generator/scripts/validate_tldr.py "test.tldr.md"
```

## Compatibilité

Cette Skill est compatible avec :

- Claude via API (avec headers bêta Skills)
- Claude Code (filesystem-based)
- Claude Agent SDK (`.claude/skills/`)
- Tout agent supportant le format Agent Skills

Pour utilisation hors agent Skills : lire directement les fichiers markdown.
