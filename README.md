# Homepage 360 🚀

**Homepage 360** est un tableau de bord personnel moderne, modulaire et entièrement personnalisable, conçu pour centraliser vos raccourcis, vos flux d'actualités et vos outils du quotidien dans une interface élégante et fluide.

![Aperçu du projet](icon-512.png)

## ✨ Caractéristiques

- 🧩 **Interface Modulaire** : Organisez vos raccourcis par zones thématiques.
- 🖱️ **Drag & Drop** : Réorganisez vos blocs et vos zones par simple glisser-déposer (propulsé par SortableJS).
- 📰 **Flux RSS Intégrés** : Suivez vos sites préférés directement depuis votre dashboard.
- 🌦️ **Météo en Temps Réel** : Widget météo avec détection automatique de position ou sélection manuelle.
- 📝 **Notes Rapides** : Un widget de prise de notes persistant pour ne rien oublier.
- 📱 **PWA (Progressive Web App)** : Installez l'application sur votre bureau ou mobile et profitez d'un support hors-ligne.
- 🎨 **Personnalisation Avancée** :
    - Mode Sombre / Clair.
    - Fonds d'écran personnalisés.
    - Design "Glassmorphism" moderne.
- 💾 **Persistance & Portabilité** :
    - Sauvegarde automatique dans le `localStorage`.
    - Export et Import de votre configuration au format JSON.
- ⌨️ **Raccourcis Clavier** : Navigation optimisée (ex: `/` pour rechercher).
- 👤 **Gestion de Profils** : Créez différents profils pour vos contextes (Travail, Maison, etc.).

## 🚀 Installation locale

Aucune installation complexe n'est requise. Le projet utilise du JavaScript natif (ES6 Modules).

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/votre-compte/homepage360.git
   ```
2. Ouvrez `index.html` dans votre navigateur ou utilisez un serveur local (recommandé pour les modules JS) :
   ```bash
   npx serve .
   ```

## 🛠️ Technologies utilisées

- **Frontend** : HTML5, CSS3 (Vanilla), JavaScript (ES6 Modules).
- **Bibliothèques** :
  - [SortableJS](https://sortablejs.github.io/Sortable/) pour le glisser-déposer.
  - [Lucide Icons](https://lucide.dev/) pour l'iconographie.
- **Stockage** : LocalStorage API.
- **PWA** : Service Workers & Web Manifest.

## 📂 Structure du projet

- `/js` : Code source modulaire (Store, UI, RSS, Widgets, etc.).
- `/directives` : Documentation interne et roadmap du projet.
- `index.html` : Point d'entrée principal.
- `style.css` : Styles globaux et variables de thème.
- `sw.js` : Service Worker pour la gestion du cache et du mode hors-ligne.
- `manifest.json` : Configuration PWA.

## ⌨️ Raccourcis utiles

| Touche | Action |
| :--- | :--- |
| `/` | Rechercher un raccourci |
| `N` | Ajouter un nouveau bloc |
| `Z` | Ajouter une nouvelle zone |
| `T` | Changer le thème (Sombre/Clair) |
| `R` | Rafraîchir les flux RSS |
| `Alt + N` | Afficher/Masquer les notes rapides |
| `H` | Afficher l'aide des raccourcis |
| `Esc` | Fermer les fenêtres modales |

---

Développé avec ❤️ pour une productivité à 360°.
