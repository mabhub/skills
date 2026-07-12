# Analyse dynamique — émulateur (où exécuter en sécurité)

> Ce pan est **documentaire**. Le skill `apk-analysis` ne pilote **jamais** un émulateur
> ni un device. À mener manuellement, dans un environnement **jetable**.

L'émulateur répond à une question que le statique ne couvre pas : **où faire tourner
l'app en sécurité pour observer son comportement réel**. Il complète la découverte API
statique en capturant le trafic *effectif* (y compris ce qui est construit dynamiquement
ou déchiffré à l'exécution).

## Principe : AVD jetable + snapshot

- Créer un **AVD dédié** (Android Virtual Device), jamais son téléphone personnel.
- Prendre un **snapshot propre** avant d'installer l'APK → restauration en un clic après analyse.
- Préférer une image **Google APIs** (pas Play Store) : root plus simple, pas de compte perso.
- Isoler le réseau de l'AVD ; ne jamais y saisir d'identifiants réels.

```bash
# Exemple de création (SDK Android requis, hors périmètre du skill)
avdmanager create avd -n analysis-throwaway -k "system-images;android-34;google_apis;x86_64"
emulator -avd analysis-throwaway -no-snapshot-load -writable-system
```

## Capturer le trafic API en live (proxy MITM)

Le cœur de l'intérêt : intercepter les appels HTTPS de l'app pour **valider et compléter**
l'inventaire API statique.

1. Lancer un proxy MITM : **mitmproxy** (`mitmweb`) ou **Burp Suite**.
2. Configurer le proxy Wi-Fi de l'AVD vers l'hôte (`10.0.2.2:8080` depuis l'émulateur).
3. Installer le **certificat CA** du proxy dans l'AVD (system store si `-writable-system`) :
   ```bash
   # empreinte + push du CA mitmproxy dans le magasin système
   hashed=$(openssl x509 -inform PEM -subject_hash_old -in ~/.mitmproxy/mitmproxy-ca-cert.cer | head -1)
   adb root && adb remount
   adb push ~/.mitmproxy/mitmproxy-ca-cert.cer /system/etc/security/cacerts/${hashed}.0
   adb shell chmod 644 /system/etc/security/cacerts/${hashed}.0
   adb reboot
   ```
4. Rejouer les parcours de l'app → le proxy liste tous les endpoints réellement appelés,
   avec méthode, headers, corps.

Si l'app fait du **certificate pinning**, le proxy voit les connexions échouer : passer par
Frida pour le bypass (voir `dynamic-analysis-frida.md`).

## Autres observations utiles

- `adb logcat` — logs applicatifs (souvent des URLs, des IDs, des messages d'erreur d'API).
- `adb shell run-as <package>` — inspecter `databases/`, `shared_prefs/`, fichiers créés
  (schémas de données, tokens en cache → **ne jamais reproduire un token en clair**).
- Capture paquet (`tcpdump` via `adb`) si le trafic n'est pas HTTP.

## Garde-fous

- **Émulateur jetable uniquement.** Jamais l'APK sur un device personnel ou de production.
- **Jamais d'identifiants réels** dans l'AVD d'analyse.
- Restaurer le snapshot propre après chaque session.
- Le skill n'automatise rien de tout ceci : ce fichier documente la méthode, l'opérateur l'exécute.
