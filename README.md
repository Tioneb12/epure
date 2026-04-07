# Épure

**Un mode pour respirer.**

Extension Chrome qui curate votre feed LinkedIn. Épure n'est pas un bloqueur — c'est un curateur. Double approche : réduire le bruit ET faire émerger le signal.

100% local. Zéro collecte. Open source (GPL v3).

## Installation

1. Ouvrir `chrome://extensions/`
2. Activer le **Mode développeur** (toggle en haut à droite)
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `epure/`
5. Naviguer sur LinkedIn — Épure est actif

## Philosophie

- Filtrage probabiliste, réversible, personnalisable
- Vocabulaire neutre : "masqué (réglage)", pas de jugement
- Le signal est humble : "signal probable", jamais de certitude
- Aucun appel réseau — tout reste local dans le navigateur
- Aucune dépendance externe — vanilla JS, pas de bundler

## Filtres bruit (V1)

| Filtre | Détecte |
|--------|---------|
| Contenu générique | Templates marketing, expressions toutes faites |
| Broetry | Une phrase par ligne, effet dramatique |
| Engagement bait | "Commentez", "Likez si", sondages |
| Humble brag | Storytelling forcé, vanity metrics |
| Promo | Lead magnets, webinars, "DM me" |
| Structurel | Hashtags/emojis excessifs, posts courts, activité réseau |

Tous les filtres sont bilingues (FR + EN).

## Signal

Posts à valeur probable détectés via : données concrètes, substance, structure argumentative, absence de bruit, auteurs de confiance.

- Liseré doré discret sur les posts signal
- Micro-badge ✦ au hover
- Mode "Signal only" : Alt+S pour n'afficher que le signal

## Actions sur le bruit

- **Flouter** (défaut) : blur + bandeau avec "Afficher" / "Toujours afficher cet auteur"
- **Masquer** : hors flux visuel
- **Badge** : badge discret en bas du post

## Architecture

```
epure/
├── manifest.json
├── assets/fonts/                    # Variable fonts (Syne + Space Grotesk)
├── content/
│   ├── content.js                   # Point d'entrée
│   ├── observer.js                  # MutationObserver + debounce
│   ├── detector.js                  # Orchestrateur scoring
│   ├── highlighter.js               # Traitement visuel
│   ├── selectors.js                 # Sélecteurs DOM LinkedIn
│   ├── storage-helpers.js           # Helpers storage + normalisation auteurs
│   ├── content.css                  # Styles feed
│   └── filters/
│       ├── generic-content.js       # Filtre 1 : contenu générique
│       ├── broetry.js               # Filtre 2 : style haché
│       ├── engagement-bait.js       # Filtre 3 : piège à likes
│       ├── humble-brag.js           # Filtre 4 : fausse modestie
│       ├── promo.js                 # Filtre 5 : promotion
│       ├── structural.js            # Filtre 6 : structurel
│       ├── signal-score.js          # Scoring signal inversé
│       └── dictionaries/
│           ├── community-dict.js    # ← Dictionnaire communautaire (modifiable par PR)
│           └── *-dict.js            # Stubs — voir ci-dessous
├── popup/                           # Popup extension
├── background/                      # Service worker
├── icons/                           # Icônes SVG + PNG
└── utils/storage.js                 # Helpers chrome.storage
```

## Dictionnaires

Chaque filtre lit ses données (expressions, regex, listes de mots) depuis un fichier dictionnaire dans `content/filters/dictionaries/`.

**Sur ce repo public**, les 7 fichiers `*-dict.js` sont des **stubs vides** : ils exposent la bonne structure mais avec des tableaux `[]` et des regex `null`. L'extension se lance sans crash — les filtres retournent simplement un score de 0.

Les vrais dictionnaires sont privés. Ceci est voulu : les patterns de détection doivent rester efficaces, et les publier permettrait de les contourner trop facilement.

**Le dictionnaire communautaire** `community-dict.js` est, lui, bien réel. C'est le fichier que vous pouvez enrichir par Pull Request.

## Contribuer

### Via `community-dict.js`

Le moyen le plus simple de contribuer :

1. Fork ce repo
2. Éditez `content/filters/dictionaries/community-dict.js`
3. Ajoutez vos mots-clés dans `noise` (bruit) ou `signal` (qualité)
4. Ouvrez une Pull Request avec une justification

**Règles :**
- Phrases en minuscules, FR ou EN
- Pas de regex, uniquement des chaînes simples
- Un mot-clé = un pattern récurrent observé sur LinkedIn

### Bugs et suggestions

Ouvrez une issue sur ce repo. Épure est un side project — le temps est limité, mais chaque retour est bienvenu.

## Configuration

- **Popup** : toggles rapides, compteurs, sensibilité, mode d'affichage, poids des filtres
- **Options** : mots-clés custom (bruit + signal), whitelist auteurs, export/import config

## Stockage

- `chrome.storage.sync` : configuration (synchronisée entre appareils)
- `chrome.storage.local` : compteurs signal/bruit

## Raccourci clavier

`Alt+S` : basculer le mode Signal only

## Compatibilité

- Chrome 120+
- Manifest V3

## Vie privée

Zéro collecte de données. Aucun appel réseau. Tout reste dans votre navigateur. [Politique de confidentialité complète](privacy.html).

## Licence

[GNU GPL v3](LICENSE) — Libre de lire, modifier et redistribuer.

## Crédits

Une idée de [Tioneb12](https://github.com/Tioneb12), avec le soutien de [Slym B](https://github.com/slymb).
