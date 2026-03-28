---
title: RDA Map-Stratégie de rendu cartographique
---
- 📅 Date : 2025-11-15
- 🔄 Version : 1.0
- 👥 Décision prise par : Équipe Architecture
- 🗳️ Proposition par : Équipe Frontend
- 👀 Revue par : Tech Lead, Product Owner

## Statut

Accepté

## Contexte

L'application de visualisation de trajectoires de ballons stratosphériques nécessite l'affichage de données cartographiques avec les contraintes suivantes :

- **Performance** : Temps de réponse < 2 secondes pour le chargement initial
- **Précision** : Affichage précis des trajectoires (±10 mètres)
- **Adaptabilité** : Support multi-devices (desktop, mobile, tablette)
- **Disponibilité** : Service 99.9% disponible
- **Efficacité** : Budget CDN limité à 500€/mois

Les utilisateurs doivent pouvoir :

- Visualiser simultanément plusieurs trajectoires de ballons
- Basculer entre différents fonds de carte (satellite, terrain, streets)
- Personnaliser le style d'affichage (couleurs, épaisseur des lignes)
- Zoomer jusqu'au niveau rue (zoom 18+)

Le volume de données attendu : 1000 trajectoires actives, 500 000 points GPS par jour.

## Options envisagées 💡

### Option 1 : Tuiles raster pré-générées

Utiliser des tuiles PNG/JPEG générées à l'avance et servies par un CDN.

👍 **Avantages** :

- Performance élevée (images statiques, cache CDN efficace)
- Compatible avec tous les navigateurs (y compris anciens)
- Technologie mature et éprouvée
- Pas de calcul côté client (économie batterie mobile)

🚫 **Inconvénients** :

- Taille de stockage importante (~500 GB pour tous les niveaux de zoom)
- Mise à jour des données complexe (régénération complète des tuiles)
- Pas de styling dynamique (un jeu de tuiles par style)
- Coût CDN élevé avec bande passante importante
- Qualité visuelle dégradée sur écrans haute résolution

### Option 2 : Tuiles vectorielles avec MapLibre GL JS

Utiliser des tuiles vectorielles (format MVT) avec rendu WebGL côté client.

👍 **Avantages** :

- Styling dynamique sans rechargement (changement de thème instantané)
- Taille de transfert réduite (~75% vs raster grâce à compression)
- Rendu fluide même avec données denses (GPU accéléré)
- Affichage net sur tous écrans (rendu vectoriel)
- Rotation et inclinaison 3D de la carte

🚫 **Inconvénients** :

- Nécessite WebGL (pas de support IE11)
- Complexité de mise en place initiale (serveur de tuiles)
- Courbe d'apprentissage pour l'équipe
- Consommation GPU plus élevée (impact batterie sur mobile ancien)
- Génération des tuiles vectorielles à mettre en place

### Option 3 : Rendu côté serveur à la demande

Générer des images à la volée côté serveur selon les requêtes utilisateur.

👍 **Avantages** :

- Flexibilité maximale (tout paramètre peut être personnalisé)
- Pas de stockage de tuiles (économie infrastructure)
- Compatible tous clients (simple image)
- Contrôle total du rendu

🚫 **Inconvénients** :

- Latence importante (génération à la demande)
- Charge serveur élevée (ne scale pas)
- Coût infrastructure serveur important
- Pas de cache efficace (chaque vue est unique)
- Mauvaise expérience utilisateur (lenteur, pas d'interactions fluides)

## Critères de décision ⚖️

Les critères suivants ont été utilisés, par ordre de priorité :

1. **Performance utilisateur** : Temps de chargement < 2s, interactions fluides
2. **Flexibilité du rendu** : Capacité à changer styles et affichage dynamiquement
3. **Coût d'exploitation** : Budget CDN + infrastructure < 500€/mois
4. **Maintenabilité** : Facilité de mise à jour et d'évolution
5. **Compatibilité** : Support navigateurs modernes (Chrome, Firefox, Safari, Edge dernières versions)

## Décision 🏆

Nous adoptons **l'Option 2 : Tuiles vectorielles avec MapLibre GL JS**.

Cette solution concilie performance et flexibilité. Les tuiles vectorielles permettent le styling dynamique côté client (changement de thème instantané) tout en conservant une taille de transfert réduite grâce à la compression Protocol Buffers.

**Justification technique** :

- **Performance** : Le rendu GPU via WebGL garantit 60 FPS même avec 1000 trajectoires affichées simultanément. Les tests de charge montrent un temps de chargement initial de 1.2s (bien en dessous des 2s requis).

- **Coût** : La réduction de ~75% de la bande passante vs tuiles raster permet de rester dans le budget de 500€/mois CDN, avec une marge de 40% pour la croissance.

- **Flexibilité** : Les utilisateurs peuvent basculer entre thèmes (clair/sombre) et ajuster les couleurs des trajectoires sans rechargement.

- **Écosystème** : MapLibre GL JS est open-source, activement maintenu (fork de Mapbox GL JS v1), et dispose d'une large communauté, réduisant les risques de dépendance.

## Conséquences

### Positives

- **UX améliorée** : Interactions fluides, styling instantané, animations smooth
- **Coûts optimisés** : Économie de 60% sur la bande passante vs solution raster initiale
- **Évolutivité** : Ajout facile de nouvelles couches de données (météo, zones réglementées)
- **Qualité visuelle** : Rendu net sur tous écrans, y compris Retina/4K
- **Portabilité** : MapLibre GL JS fonctionne sur desktop, mobile, tablette

### Négatives

- **Support navigateur** : Pas de support IE11 (acceptable vu les statistiques : <2% des utilisateurs)
- **Complexité initiale** : Configuration serveur de tuiles vectorielles (Tegola ou tileserver-gl)
- **Courbe d'apprentissage** : Formation équipe sur MapLibre GL JS API (estimé 2 semaines)
- **Dépendance GPU** : Sur mobiles anciens (<2018), performances réduites (fallback possible en tuiles raster)
- **Génération de tuiles** : Pipeline de génération des tuiles vectorielles à partir de PostGIS à mettre en place

### Impact sur l'architecture

- Ajout d'un serveur de tuiles vectorielles (Tegola)
- Utilisation de PostGIS pour préparation des données géographiques
- Mise en place d'un CDN pour distribuer les tuiles
- Bibliothèque MapLibre GL JS intégrée au frontend (~500 KB gzipped)

## Migration et réversibilité 🔄

### Plan de migration

1. **Phase 1 : Infrastructure (2 semaines)**
   - Configuration serveur Tegola
   - Mise en place pipeline PostGIS → Tuiles vectorielles
   - Configuration CDN CloudFlare

2. **Phase 2 : Intégration frontend (1 semaine)**
   - Installation MapLibre GL JS
   - Création composants carte de base
   - Tests cross-browser

3. **Phase 3 : Migration progressive des vues (3 semaines)**
   - Semaine 1 : Vue carte principale (80% du trafic)
   - Semaine 2 : Vue trajectoire détaillée
   - Semaine 3 : Vues secondaires et dashboard

4. **Phase 4 : Décommissionnement (1 semaine)**
   - Suppression ancien système raster
   - Nettoyage code legacy
   - Documentation finale

**Durée totale** : 7 semaines

### Rollback

Possibilité de revenir au système raster pendant 6 mois via feature flag (`ENABLE_VECTOR_TILES`).

**Conditions de rollback** :

- Bug critique non résolu en 48h
- Performance dégradée > 20% vs baseline
- Taux d'erreur client > 5%

**Coût estimé du rollback** : 2 jours de développement (réactivation ancien code + tests)

## Références et liens

- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js-docs/api/)
- [Spécification Mapbox Vector Tile](https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/)
- [Tegola - Vector Tile Server](https://tegola.io/)
- [Protocol Buffers](https://developers.google.com/protocol-buffers)

**RDA liés** :

- RDA Map-Choix du fond de carte
- RDA Data-Stockage des trajectoires GPS

**Technologies mentionnées** :

- MapLibre GL JS v3.6
- Tegola v0.18
- PostGIS 3.4
- Protocol Buffers (compression tuiles)
- CloudFlare CDN
