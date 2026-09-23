# Fichier d'état de la bibliothèque

`<bibliothèque>/.calibre-library-state.md` est la **mémoire de la bibliothèque** : ce qui
a été fait, décidé, et ce qu'il ne faut pas refaire. Il vit à la racine de la
bibliothèque pour qu'il voyage avec elle et entre dans ses sauvegardes, et pour que
chaque bibliothèque ait le sien.

Le skill porte les **règles** ; ce fichier porte l'**état** (volatile). Ne pas y
recopier les règles du skill, ne pas mettre d'état dans le skill.

## Quand le lire, quand l'écrire

- **Lire en entier avant toute action**, même un diagnostic : il liste les arbitrages à
  ne pas rejouer et les faux doublons à ne jamais fusionner.
- **Mettre à jour en fin de chantier** (et après chaque lot important) : compteurs
  revérifiés en base, chantier terminé avec ses chiffres, décisions rendues, anomalies
  découvertes. Un compteur périmé induit en erreur.
- **S'il n'existe pas**, le créer en fin de chantier à partir du modèle ci-dessous.

## Modèle

```markdown
# Bibliothèque Calibre — état et historique

## État au AAAA-MM-JJ

*Compteurs vérifiés contre metadata.db le AAAA-MM-JJ.*

| | |
|---|---|
| Livres | … |
| Auteurs | … |
| Séries | … |
| Étiquettes | … |
| Éditeurs | … |

## Décisions d'arbitrage — à ne pas rejouer

| Sujet | Décision | Statut (acquis / à reconsidérer / ouvert) |
|---|---|---|

## Faux doublons — à ne jamais fusionner

| Livres (ids) | Nature (traductions, volumes, homonymes…) |
|---|---|

## Chantiers ouverts

## Anomalies connues, non résolues

## Chantiers terminés

### <Chantier> — <résultat chiffré> (AAAA-MM-JJ)

Portée, méthode, lots appliqués, effets de bord, vérifications (OPF concordants x/x).

## Sauvegardes

Archive complète, sauvegardes par lot (`metadata-PRE-<LOT>-<date>.db`), `trash/`.
```

## Confidentialité

Ce fichier décrit la composition de la bibliothèque (titres, auteurs, anomalies). Il
reste local : ne pas le publier, ne pas le coller dans un service externe.
