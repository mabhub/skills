# Analyse dynamique — Frida (comment instrumenter le runtime)

> Ce pan est **documentaire**. Le skill `apk-analysis` ne lance **jamais** Frida ni
> frida-server. À mener manuellement, sur un **émulateur/device jetable rooté**.

Là où l'émulateur répond à « où exécuter », Frida répond à « **comment instrumenter le
code en cours d'exécution** » : accrocher des méthodes, lire/modifier leurs arguments et
valeurs de retour, contourner des protections. Utile quand le statique bute sur du
chiffrement, de l'offuscation runtime, ou du certificate pinning.

## Prérequis (hors périmètre automatisé)

- Émulateur/device **rooté et jetable**.
- `frida-server` poussé et lancé sur le device ; `frida-tools` côté hôte.
  ```bash
  # versions à faire correspondre (device <-> hôte)
  adb push frida-server /data/local/tmp/ && adb shell "chmod 755 /data/local/tmp/frida-server"
  adb shell "/data/local/tmp/frida-server &"
  frida-ps -U   # liste les process, confirme la connexion
  ```

## Cas d'usage typiques

### Bypass du SSL / certificate pinning
Débloque la capture proxy (voir `dynamic-analysis-emulator.md`) quand l'app épingle son certificat.
```bash
# script communautaire universel
frida -U -f <package> -l frida-android-sslpinning-bypass.js --no-pause
```

### Capturer des valeurs déchiffrées / signées
Accrocher la méthode qui construit une requête ou signe un payload, juste après déchiffrement :
```js
Java.perform(function () {
  const C = Java.use('com.example.crypto.Signer')
  C.sign.overload('java.lang.String').implementation = function (data) {
    console.log('[sign] in =', data)          // valeur en clair AVANT signature
    const out = this.sign(data)
    console.log('[sign] out =', out)
    return out
  }
})
```

### Tracer les appels réseau au niveau OkHttp/Retrofit
Accrocher `okhttp3.Request$Builder.url` ou l'`Interceptor` pour lister les URLs réelles,
y compris celles construites dynamiquement (invisibles au grep statique).

## Garde-fous

- **Device/émulateur jetable rooté uniquement** — jamais un téléphone personnel.
- Ne pas exfiltrer ni reproduire en clair les secrets observés (tokens, clés) : les
  signaler par nature et emplacement, comme en statique.
- Le skill documente Frida mais ne l'exécute pas. L'opérateur mène l'instrumentation.
