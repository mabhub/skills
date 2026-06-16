# Forge — GitLab / GitHub

Conventions de mise en forme spécifiques aux commentaires, descriptions, issues,
MR/PR et tickets de forge. S'ajoutent aux règles génériques du `SKILL.md`.

La logique commune : les moteurs de forge **autolinkent** certaines syntaxes (refs,
mentions) uniquement en **texte brut**. Les passer entre backticks les fige en code
littéral et casse le lien, la notification croisée et l'affichage d'état.

## Références de tickets — JAMAIS de backticks

Les références internes ne doivent **PAS** être encadrées de backticks :

- issues : `#12` → écrire **#12**
- MR / PR : `!16` → écrire **!16**
- cross-projet : `group/projet#12`, `group/projet!16` → texte brut
- commits, `@user` → texte brut

GitLab/GitHub n'auto-relient que les références en texte brut. Entre backticks,
elles restent du code sans lien cliquable → perte de navigation, pas de mention
"mentionné dans" sur la cible, pas d'état (ouvert/fermé) affiché inline.

En cas de doute : **une référence de forge → pas de backtick** ; un identifiant
technique (chemin, fonction, Sentry `TERRALEGOAPI-3`) → backtick OK.

## Mentions d'utilisateurs

Les mentions `@user` en **texte brut**, sans backticks. Ex. **@bal**, **@jpo**, **@yfo**.
(Backtickées, elles ne notifient pas la personne.)

## Notes d'attention — blocs d'alerte

Préférer un **bloc d'alerte** à une ligne `⚠️ …` en gras inline :

```markdown
> [!warning] ⚠️ Titre court
> Contenu de l'avertissement en blockquote.
```

Types disponibles sur GitLab : `[!note]`, `[!tip]`, `[!important]`, `[!warning]`, `[!caution]`.
(GitHub utilise la même syntaxe `> [!TYPE]`, en majuscules.)

## Titres de tickets — infinitif

Rédiger les titres d'issues comme une **phrase infinitive commençant par un verbe
d'action** : "Corriger X", "Mettre en place Y", "Basculer Z", "Documenter…",
"Évaluer…". Le ticket se lit directement comme une action à mener.

Éviter les titres-constat qui énoncent un problème ("Workers gunicorn tués sur X",
"Erreur 429 sur Y").

Avant `glab issue create` / `gh issue create` : vérifier que le `--title` commence
par un verbe à l'infinitif.

## Cases à cocher

`- [ ]` / `- [x]` pour les critères d'acceptation restants / faits dans les
descriptions de tickets et MR/PR.

## Sécurité (rappel, hors style)

Ne jamais coller un secret en clair (clé d'API, token, mot de passe) dans une note,
description ou commit de forge, même si la valeur apparaît déjà ailleurs. Tronquer
(`ge-2914…`) et pointer vers la source authentifiée. L'approbation "poster le
commentaire" n'autorise pas l'exposition du secret.
