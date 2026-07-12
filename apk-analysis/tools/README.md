# Image Docker `apk-analysis:local`

Porte-outils pour l'analyse **statique** d'APK. Contient : `jadx`, `dex2jar`
(`d2j-dex2jar`), `aapt`, `unzip`, `ripgrep`, JDK 21. Exécution **non-root**
(`analyst`, uid 1000) ; à l'usage, le conteneur est lancé `--network none` avec
l'APK monté en lecture seule (voir `scripts/run-in-container.sh`).

## Construire l'image (build manuel par défaut)

```bash
docker build -t apk-analysis:local apk-analysis/tools
```

Le skill ne construit **jamais** l'image sans demande explicite. `scripts/check-tools.sh`
affiche cette commande quand l'image manque.

## Versions pinnées

| Outil | Version | Source |
|---|---|---|
| jadx | 1.5.6 | `github.com/skylot/jadx` release `v1.5.6` |
| dex2jar | 2.4 | `github.com/pxb1988/dex2jar` release `v2.4` |
| aapt | paquet Ubuntu jammy | `apt` |

Les checksums SHA-256 sont pinnés dans le `Dockerfile` (`ARG *_SHA256`). Le build
échoue si un téléchargement ne correspond pas (défense contre un asset altéré ou
une page d'erreur HTML servie à la place du zip).

## Mettre à jour une version pinnée

1. Récupérer la nouvelle version et recalculer le checksum :
   ```bash
   V=1.5.7   # exemple
   curl -sL -o /tmp/jadx.zip "https://github.com/skylot/jadx/releases/download/v${V}/jadx-${V}.zip"
   sha256sum /tmp/jadx.zip
   ```
2. Reporter `JADX_VERSION` / `JADX_SHA256` (ou les `DEX2JAR_*`) dans le `Dockerfile`.
3. Reconstruire l'image.

## Notes

- Pas d'`ENTRYPOINT` exécutant l'APK : l'image est un porte-outils, jamais un runtime.
- Docker bride le dynamique (USB device, frida-server, AVD) — sans impact ici, le
  dynamique étant hors périmètre automatisé (voir `references/`).
