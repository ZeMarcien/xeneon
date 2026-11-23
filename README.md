# Widgets iCUE pour Xeneon Edge

Widgets personnalisés pour l'écran CORSAIR XENEON EDGE (iCUE 5, Windows).

- [`mon-monitoring/`](mon-monitoring/) — courbe d'un capteur sur échelle fixe 0–100 %,
  historique réglable de 1 à 5 minutes, couleur de courbe configurable.

- [`mon-monitoring2/`](mon-monitoring2/) — « Mon Monitoring 2 » (v1.2.0) : courbe d'un capteur
  (échelle 0–100), historique réglable 1–5 min, ligne du haut (10 %) avec nom personnalisé
  à gauche et valeur à droite (même taille), couleurs et bornes affichées configurables.

## Installation

```bash
icuewidget validate mon-monitoring
icuewidget package mon-monitoring
```

puis double-clic sur le fichier `.icuewidget` généré (ou copie du dossier dans
`C:\Program Files\Corsair\Corsair iCUE5 Software\widgets\`).
