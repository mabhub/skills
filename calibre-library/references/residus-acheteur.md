# Résidus d'acheteur et DRM

Tout identifiant pouvant relier un fichier à un **acheteur** ou à une **vente** est
retiré, des métadonnées Calibre comme de l'intérieur des fichiers. Ces identifiants
n'apportent rien à la lecture ni au classement et persistent silencieusement après
import.

## Porteurs connus

| Porteur | Origine | Contenu typique | Traitement |
|---|---|---|---|
| `iTunesMetadata.plist` (et `-original`) | Apple Books | `unique-id`, `package-file-hash`, `downloadId`, identifiant de compte | supprimer |
| `META-INF/rights.xml` | Kobo, Adobe ADEPT | horodatage d'achat, licence | supprimer (s'il accompagne un DRM Adobe, le livre est chiffré : voir plus bas) |
| `iTunesArtwork` | Apple Books | image de couverture | pas un identifiant ; résidu Apple, à signaler et laisser à l'utilisateur |
| tatouage social | libraires | e-mail, n° de commande, « acheté par » dans le texte | retirer les passages concernés (`scan_residus.py --deep` les signale) |
| `dc:identifier` propriétaire, tags ou commentaires de store | imports | id de commande ou de compte | retirer du champ Calibre et de l'OPF interne |

**Ne jamais afficher la valeur** de ces identifiants (dans un rapport, une commande, un
diff) : signaler seulement leur présence et le porteur.

## `META-INF/encryption.xml` : polices ou DRM ?

Ce fichier n'est **pas** en soi un DRM. Regarder les `CipherReference URI=` :

- toutes les URI visent des polices (`.ttf`, `.otf`, `.woff`) avec l'algorithme
  `http://www.idpf.org/2008/embedding` ou `http://ns.adobe.com/pdf/enc#RC` → simple
  **obfuscation de polices**, inoffensive, rien à faire ;
- des URI visent du contenu (`.xhtml`, images) → **DRM réel** (Adobe ADEPT, souvent avec
  `rights.xml`) : texte illisible hors de l'écosystème. `sinf.xml` indique FairPlay (Apple).

- aucune `CipherReference` (`<encryption/>` vide) → rien n'est chiffré.

`epub_quality.py` et `scan_residus.py` font ce classement (`encryption:vide`,
`encryption:polices`, `encryption:polices?` pour un algorithme inhabituel,
`encryption:DRM`). Ne pas refaire ce scan en shell : une boucle `find` + `unzip -Z1`
a manqué deux fichiers sur onze là où le parcours Python de la table `data` les trouve.

## Procédure de purge (validée lot par lot comme toute écriture)

1. `scan_residus.py` (bibliothèque) ou `--paths` (candidats à l'import) → liste des porteurs.
2. `backup_lot.py PURGE-RESIDUS --trash <epub>…` → base sauvegardée et EPUB d'origine copiés.
3. Pour chaque EPUB, sur une **copie de travail** :
   `zip -d copie.epub 'iTunesMetadata.plist' 'META-INF/rights.xml'` (noms exacts listés
   par le scan).
4. Contrôler la copie : `unzip -t` propre ; `mimetype` toujours première entrée
   (`unzip -Z1 copie.epub | head -1`) et non compressé ; OPF intact.
5. Réinjecter : `calibredb add_format <id> copie.epub` (remplace par défaut, **pas** de
   `--replace`), stderr visible, code retour vérifié.
6. Relancer `scan_residus.py --ids …` : 0 résidu attendu.
7. `calibredb backup_metadata --all`, `opf_crosscheck.py`.

À l'import de nouveaux livres, purger **avant** ou **immédiatement après** l'ajout, dans
le même lot : un livre ne doit pas entrer en bibliothèque avec ses résidus.
