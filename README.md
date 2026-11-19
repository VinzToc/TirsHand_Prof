# TirsHand Prof (espace professeur) 🤾

PWA intégrée à Mes Apps EPS. Identifiant d'application : `tirshand` (le même que l'appli élève [TirsHand](https://vinztoc.github.io/TirsHand_EPS/), pour réunir les données).
Déploiement : dépôt `TirsHand_Prof` → Settings → Pages → `main` / root → https://vinztoc.github.io/TirsHand_Prof/

## Fonctions
- **Match** : le professeur choisit la classe, l'équipe, l'adversaire et les joueurs, puis note chaque tir (zone, type, tireur, résultat). Chaque tir est enregistré sur la fiche du tireur dans Mes Apps EPS (`EPS.addLigne('tirshand', …)`, mode « lignes »).
- **Bilan** : carte de tirs de chaque match (saisi par le prof ou importé d'un fichier élève), réussite par type de tir et par joueur, projet tactique (lecture et écriture), co-évaluation du binôme, comparaison de deux matchs, suppression d'un match.
- **Suivi** : tableau de la classe (matchs, tirs, réussite, dernier projet), progression d'un élève, export .xlsx (fichier compilé ou feuille `tirshand` seule).
- **Import** : fichiers .xlsx exportés par les élèves depuis TirsHand (plusieurs à la fois), rattachés par nom, prénom et classe ; chargement de la liste d'élèves.
- **Vidéo** : image différée et ralenti, en mémoire vive uniquement (rien n'est enregistré).

## Fichiers
index.html · app.js · style.css · eps-core.js (v2.3, non modifié) · version.js · sw.js · manifest.webmanifest · icons/

Version : `version.js` (seul endroit à modifier ; il nomme aussi le cache hors ligne).
