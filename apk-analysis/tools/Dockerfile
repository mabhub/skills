# Image hôte d'outils pour apk-analysis — analyse STATIQUE uniquement.
# Non-root, sans ENTRYPOINT exécutant l'APK : c'est un porte-outils, pas un runtime d'app.
# Construction (build manuel par défaut) :
#   docker build -t apk-analysis:local apk-analysis/tools
FROM eclipse-temurin:21-jdk-jammy

# Versions pinnées + checksums SHA-256 (recalculer via tools/README.md pour mettre à jour).
ARG JADX_VERSION=1.5.6
ARG JADX_SHA256=545ea2be9c242511bc145755cf4bda2485ade42966e096f8b4d3da2a230e8974
ARG DEX2JAR_VERSION=2.4
ARG DEX2JAR_SHA256=ee7c45eb3c1d2474a6145d8d447e651a736a22d9664b6d3d3be5a5a817dda23a

RUN apt-get update && apt-get install -y --no-install-recommends \
      unzip ripgrep wget ca-certificates aapt \
    && rm -rf /var/lib/apt/lists/*

# jadx (release pinnée, checksum vérifié)
RUN wget -q "https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip" -O /tmp/jadx.zip \
    && echo "${JADX_SHA256}  /tmp/jadx.zip" | sha256sum -c - \
    && mkdir -p /opt/jadx \
    && unzip -q /tmp/jadx.zip -d /opt/jadx \
    && ln -s /opt/jadx/bin/jadx /usr/local/bin/jadx \
    && rm /tmp/jadx.zip

# dex2jar (fallback de décompilation, release pinnée, checksum vérifié)
RUN wget -q "https://github.com/pxb1988/dex2jar/releases/download/v${DEX2JAR_VERSION}/dex-tools-v${DEX2JAR_VERSION}.zip" -O /tmp/dex2jar.zip \
    && echo "${DEX2JAR_SHA256}  /tmp/dex2jar.zip" | sha256sum -c - \
    && unzip -q /tmp/dex2jar.zip -d /opt \
    && mv "/opt/dex-tools-v${DEX2JAR_VERSION}" /opt/dex2jar \
    && chmod +x /opt/dex2jar/*.sh \
    && ln -s /opt/dex2jar/d2j-dex2jar.sh /usr/local/bin/d2j-dex2jar \
    && rm /tmp/dex2jar.zip

# Utilisateur non-root
RUN useradd -m -u 1000 analyst
WORKDIR /work
USER analyst
