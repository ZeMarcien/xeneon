# Widgets iCUE pour Xeneon Edge

Widgets personnalisés pour l'écran CORSAIR XENEON EDGE (iCUE 5, Windows).

- [`mon-monitoring/`](mon-monitoring/) — courbe d'un capteur sur échelle fixe 0–100 %,
  historique réglable de 1 à 5 minutes, couleur de courbe configurable.

## Installation

```bash
icuewidget validate mon-monitoring
icuewidget package mon-monitoring
```

puis double-clic sur le fichier `.icuewidget` généré (ou copie du dossier dans
`C:\Program Files\Corsair\Corsair iCUE5 Software\widgets\`).
