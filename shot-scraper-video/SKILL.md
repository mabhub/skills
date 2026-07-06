---
name: shot-scraper-video
description: Enregistrer une vidéo de démo d'une application web à partir d'un storyboard YAML, via l'outil shot-scraper (commande "video", shot-scraper 1.10 ou supérieur). Utiliser ce skill dès que l'utilisateur demande une "démo vidéo", un "screencast", une "vidéo de démonstration", veut "enregistrer une session navigateur", mentionne shot-scraper, storyboard.yml, ou veut prouver visuellement le fonctionnement d'une fonctionnalité web qui vient d'être développée. S'applique aussi quand un agent de code doit produire une preuve vidéo de son travail sur une appli web (routine de clics, remplissage de formulaire, navigation). Ne pas utiliser pour des captures d'écran statiques (shot-scraper multi/shot) ni pour du scraping de données.
---

# shot-scraper video — cadre d'exécution

Ce skill définit **comment exécuter** `shot-scraper video` de façon reproductible et sans installation polluante de l'environnement de l'utilisateur — pas la syntaxe complète du storyboard, qui est déjà auto-documentée par l'outil lui-même.

## Où trouver la syntaxe (ne pas la dupliquer ici)

- `shot-scraper video --help` — conçu par son auteur pour être suffisant à un agent pour écrire un storyboard correct (structure top-level, clés de scène, liste des actions). Toujours lancer cette commande en premier dans l'environnement choisi ci-dessous avant d'écrire un `storyboard.yml`.
- Doc de référence complète si besoin d'exemples supplémentaires : https://shot-scraper.datasette.io/en/stable/video.html
- Dépôt source : https://github.com/simonw/shot-scraper

Squelette minimal à titre de repère (pas exhaustif, voir `--help` pour tout le reste) :
```yaml
output: demo.webm
url: http://localhost:8000/
server: "npm run dev"   # lancé automatiquement, arrêté en fin de run
viewport: {width: 1280, height: 720}
cursor: true
wait_for: "text=Bienvenue"
scenes:
  - name: Étape 1
    do:
      - click: "#some-button"
      - pause: 1
```

`server:` est la clé à privilégier pour démontrer une appli qui vient d'être développée (voir "Pièges connus"). `sh:` et `python:` existent aussi en top-level et par scène pour exécuter respectivement une commande shell ou du code Python autour de l'enregistrement — utile pour préparer des données de démo, mais voir les garde-fous ci-dessous avant de les utiliser avec un storyboard non maîtrisé.

## Version minimale requise

**Playwright ≥ 1.61.0** (donc `shot-scraper` ≥ 1.10, qui l'embarque). Les versions antérieures enregistrent des cadres blancs parasites au démarrage et limitent la vidéo à 800 px de large — ce n'est pas un simple détail cosmétique, c'est cassé en dessous. Vérifier avec `uvx --from shot-scraper shot-scraper --version` (ou l'équivalent dans le container choisi) avant de lancer un enregistrement si la version n'est pas garantie par ailleurs.

## Principe : pas d'installation persistante

`shot-scraper video` dépend de Playwright et de ses binaires navigateur (~300 Mo+), et optionnellement de `ffmpeg` pour la conversion en MP4. On évite d'installer tout ça globalement sur la machine de l'utilisateur. Deux approches, à choisir selon le contexte :

| Contexte | Approche recommandée |
|---|---|
| Poste de dev avec `uv` déjà présent, exécutions répétées | `uvx` (garde le cache des navigateurs entre les runs) |
| Isolation maximale, CI, ou pas de `uv`/Python géré localement | Container Docker éphémère (`--rm`) |

### Option A — `uv` / `uvx` (par défaut)

Les binaires Playwright sont mis en cache dans `~/.cache/ms-playwright` (hors du venv éphémère de `uvx`), donc l'installation des navigateurs ne se refait qu'une fois :

```bash
# une seule fois : installe les binaires navigateurs (persistent hors venv)
uvx --from shot-scraper shot-scraper install

# exécution du storyboard
uvx --from shot-scraper shot-scraper video storyboard.yml --mp4
```

Variante `pipx` si `uv` n'est pas disponible mais `pipx` oui :
```bash
pipx run shot-scraper install
pipx run shot-scraper video storyboard.yml --mp4
```

Si `ffmpeg` n'est pas installé sur la machine, `--mp4` échoue proprement (le `.webm` est quand même produit) — installer `ffmpeg` via le gestionnaire de paquets du système, ou omettre `--mp4` et convertir a posteriori.

### Option B — Container Docker éphémère

Utiliser l'image officielle Playwright (navigateurs déjà installés, pas de téléchargement à chaque run). Vérifier la version de Playwright utilisée par shot-scraper et aligner le tag d'image en conséquence.

```bash
docker run --rm \
  -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright/python:v1.61.0-jammy \
  bash -c "pip install --quiet shot-scraper && \
           apt-get update -qq && apt-get install -y -qq ffmpeg && \
           shot-scraper video storyboard.yml --mp4"
```

Points d'attention :
- `-v "$PWD":/work` monte le répertoire courant : le `storyboard.yml`, un éventuel `--auth auth.json`, et le fichier vidéo produit doivent tous être accessibles via ce volume.
- Si le storyboard cible une app tournant en local sur la machine hôte (via `server:` ou une URL `localhost`), ajouter `--network host` (Linux) ou utiliser `host.docker.internal` (Docker Desktop macOS/Windows) à la place de `localhost` dans le storyboard.
- Pour éviter de réinstaller `ffmpeg`/`shot-scraper` à chaque run, on peut construire une image dédiée une fois (`Dockerfile` avec ces deux lignes `RUN`) plutôt que les réinstaller inline — utile si le storyboard est exécuté fréquemment (ex. CI).

## Déroulé conseillé pour l'agent

1. Choisir l'environnement (tableau ci-dessus) selon ce qui est disponible/souhaité.
2. Lancer `shot-scraper video --help` dans cet environnement pour récupérer la syntaxe à jour (elle peut évoluer entre versions).
3. Écrire le `storyboard.yml` en s'appuyant sur ce `--help` et, si besoin de plus de détails, sur la doc en ligne listée plus haut.
4. Exécuter avec `--mp4` si un fichier MP4 est souhaité, sinon le `.webm` suffit.
5. Restituer le fichier produit à l'utilisateur.

## Garde-fous de sécurité

### Restriction des URLs

- **Autorisé sans confirmation** : `localhost`, `127.0.0.1`, `0.0.0.0`, `*.localhost`, ou une URL de dev fournie explicitement par l'utilisateur.
- **Avec confirmation explicite** : toute URL de production ou de service tiers — afficher l'URL complète et demander l'approbation avant d'écrire un storyboard qui la cible.
- **Interdit** : sites bancaires, portails d'authentification OAuth tiers, interfaces d'administration cloud (AWS Console, GCP, Azure).

### `sh:` / `python:` du storyboard = exécution de code arbitraire

Ces clés (top-level ou par scène) exécutent respectivement une commande shell ou du code Python dans l'environnement d'enregistrement. Si le `storyboard.yml` provient d'une source non maîtrisée (ex. fourni par l'utilisateur sans relecture, ou récupéré d'un dépôt tiers), le relire avant exécution comme n'importe quel script — ne pas le lancer aveuglément, surtout hors conteneur Docker éphémère.

### `auth.json` et secrets

- Le fichier d'authentification Playwright (`-a/--auth`) contient des cookies de session en clair. Ne jamais utiliser un `auth.json` capturé sur un compte de production — utiliser un compte de test dédié.
- Ne jamais faire écrire son contenu dans les logs, la sortie de commande, ou le storyboard lui-même.
- Le traiter avec la même prudence qu'un fichier de credentials : pas de commit, pas de partage hors du besoin d'exécution.

## Pièges connus

- `--mp4` nécessite `ffmpeg` installé dans l'environnement d'exécution (conteneur ou machine hôte) — sinon le `.webm` est produit mais la commande sort en erreur.
- Le viewport par défaut est 1280×720 ; le préciser explicitement si la démo doit correspondre à un format cible (ex. réseaux sociaux).
- Pour une app nécessitant une authentification, utiliser `-a/--auth auth.json` (fichier de contexte d'authentification Playwright), à monter/copier dans l'environnement d'exécution comme le storyboard lui-même.
- Si l'app à démontrer tourne sur un serveur de dev à lancer pour l'occasion, préférer la clé top-level `server:` du storyboard plutôt qu'un serveur lancé manuellement en parallèle — il est démarré et arrêté automatiquement avec le run.
