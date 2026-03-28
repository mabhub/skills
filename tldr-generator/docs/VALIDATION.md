# Critères de validation des TL;DR

Ce document détaille les critères de qualité pour valider un TL;DR avant publication.

## Checklist de validation

### ✅ Front-matter

- [ ] Champ `created` présent et identique à l'original
- [ ] Champ `source` présent avec URL correcte
- [ ] Champ `author` présent
- [ ] Tags pertinents ajoutés (minimum 3, maximum 10)
- [ ] Champs optionnels ajoutés si pertinent (`type`, `themes`)
- [ ] Syntaxe YAML valide

### ✅ Longueur et temps de lecture

- [ ] Nombre de mots < 750 (objectif strict)
- [ ] Temps de lecture estimé < 3 minutes
- [ ] Pas de redondances ou longueurs injustifiées
- [ ] Réduction suffisante par rapport à l'original (pas de limite min)

**Calcul temps de lecture :**
- Français : ~250 mots/minute
- 750 mots = 3 minutes maximum

### ✅ Complétude informationnelle

- [ ] Réponse aux questions de base : Qui ? Quoi ? Quand ? Où ? Pourquoi ? Comment ?
- [ ] Message principal de l'article clairement identifiable
- [ ] Dates importantes préservées
- [ ] Noms propres (personnes, organisations, lieux) corrects
- [ ] Chiffres et statistiques clés maintenus
- [ ] Citations marquantes incluses (reformulées si besoin)
- [ ] Liens essentiels préservés
- [ ] Contexte suffisant pour compréhension autonome

### ✅ Structure et organisation

- [ ] Titre clair avec mention "TL;DR"
- [ ] Résumé exécutif en début (2-3 paragraphes)
- [ ] Sections logiquement organisées
- [ ] Hiérarchie des titres cohérente (H2, H3)
- [ ] Progression claire (chronologique, thématique, ou logique)
- [ ] Utilisation appropriée de listes à puces vs paragraphes

### ✅ Style rédactionnel

- [ ] Langue : français correct et fluide
- [ ] Équilibre : ni trop haché (listes uniquement) ni trop verbeux
- [ ] Ton cohérent avec l'article original
- [ ] Phrases complètes et bien construites
- [ ] Transitions fluides entre sections
- [ ] Pas de jargon inutile (sauf si technique et nécessaire)
- [ ] Clarté : compréhensible sans lire l'original

### ✅ Fidélité à l'original

- [ ] Pas de déformation du message
- [ ] Pas d'ajout d'opinions personnelles
- [ ] Nuances importantes préservées
- [ ] Contexte respecté
- [ ] Aucune information inventée
- [ ] Citations correctement attribuées

### ✅ Qualité technique Markdown

- [ ] Syntaxe Markdown valide
- [ ] Formatage cohérent (gras, italique, listes)
- [ ] Liens fonctionnels
- [ ] Encodage UTF-8
- [ ] Pas d'erreurs de formatage visibles

## Critères par type d'article

### Articles techniques/documentation

- [ ] Terminologie technique préservée avec exactitude
- [ ] Concepts clés expliqués brièvement
- [ ] Spécifications importantes maintenues
- [ ] Cas d'usage identifiés
- [ ] Limitations mentionnées si pertinentes

### Articles de presse/actualité

- [ ] Chronologie claire des événements
- [ ] Acteurs principaux identifiés avec leurs rôles
- [ ] Contexte politique/social/économique posé
- [ ] Réactions/positions des parties prenantes
- [ ] Conséquences/implications énoncées

### Articles d'analyse/essai

- [ ] Thèse de l'auteur clairement énoncée
- [ ] Arguments principaux résumés (3-5 max)
- [ ] Preuves/exemples clés mentionnés
- [ ] Nuances et contre-arguments abordés
- [ ] Conclusion de l'auteur préservée

### Newsletters/multi-sujets

- [ ] Tous les sujets principaux couverts
- [ ] Proportion adéquate entre sujets
- [ ] Fil conducteur identifiable
- [ ] Transitions entre sujets
- [ ] Pas de sujet majeur omis

## Métriques quantitatives

### Calcul de réduction

**Formule :**
```
Taux de réduction = ((mots_original - mots_tldr) / mots_original) × 100
```

**Attendus :**
- Articles courts (< 1000 mots) : réduction 20-40%
- Articles moyens (1000-3000 mots) : réduction 40-70%
- Articles longs (> 3000 mots) : réduction 70-90%

**Important :** Pas de limite maximale de réduction. Un article de 5000 mots peut avoir un TL;DR de 500 mots (90% de réduction) si toutes les infos clés sont préservées.

### Densité informationnelle

**Calcul approximatif :**
- Compter les "faits" (dates, noms, chiffres, événements, concepts)
- Vérifier que min. 80% des faits importants sont présents dans le TL;DR

### Lisibilité

**Tests simples :**
- Longueur moyenne des phrases < 25 mots
- Paragraphes < 150 mots
- Pas plus de 3 niveaux de hiérarchie (H1, H2, H3)

## Erreurs courantes à éviter

### ❌ Erreurs de contenu

- **Trop synthétique** : manque d'informations essentielles
- **Trop verbeux** : dépasse 750 mots sans justification
- **Déséquilibré** : trop de détails sur partie mineure, pas assez sur l'essentiel
- **Incomplet** : omet des acteurs/faits/arguments majeurs
- **Imprécis** : dates floues, chiffres arrondis excessivement
- **Déformant** : change le sens ou le ton de l'original

### ❌ Erreurs de style

- **Tout en listes** : aucun paragraphe rédigé
- **Aucune liste** : texte compact difficile à scanner
- **Répétitif** : même information formulée plusieurs fois
- **Jargon excessif** : termes techniques non expliqués
- **Ton inadapté** : familier pour article formel, ou inversement

### ❌ Erreurs de structure

- **Pas de résumé exécutif** : plonge directement dans les détails
- **Désorganisé** : sauts illogiques entre sujets
- **Hiérarchie confuse** : mauvaise utilisation des niveaux de titres
- **Pas de progression** : information dispersée sans fil conducteur

### ❌ Erreurs techniques

- **Front-matter invalide** : syntaxe YAML incorrecte
- **Liens cassés** : URLs mal formées
- **Formatage inconsistant** : mélange de styles
- **Encodage** : caractères spéciaux mal encodés

## Validation automatique

Le script `validate_tldr.py` vérifie automatiquement :

1. **Nombre de mots** : compte total et alerte si > 750
2. **Temps de lecture** : calcul et alerte si > 3 min
3. **Front-matter** : validation YAML et présence champs requis
4. **Longueur sections** : détection paragraphes trop longs
5. **Liens** : vérification syntaxe (pas de test HTTP)
6. **Encodage** : détection problèmes UTF-8

**Usage :**
```bash
python tldr-generator/scripts/validate_tldr.py "article.tldr.md"
```

**Sortie attendue :**
```
✅ Validation réussie
   - Mots: 642/750
   - Temps de lecture: 2.6 min
   - Front-matter: valide
   - Structure: correcte
   
⚠️  Avertissements (non bloquants):
   - Paragraphe ligne 45: 167 mots (recommandé < 150)
```

## Validation humaine finale

Même avec validation automatique, vérifier manuellement :

1. **Lecture complète** : le TL;DR est-il compréhensible seul ?
2. **Comparaison** : les infos clés de l'original sont-elles présentes ?
3. **Fluidité** : la lecture est-elle agréable ?
4. **Pertinence** : structure adaptée au type d'article ?

**Question ultime :** Un lecteur qui lit uniquement le TL;DR comprend-il :
- De quoi parle l'article ?
- Pourquoi c'est important ?
- Quels sont les faits/idées/arguments principaux ?
- Quelle conclusion en tirer ?

Si oui aux 4 questions → validation OK ✅
