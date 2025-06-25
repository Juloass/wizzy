# Wizzy 🎮🎵

**Wizzy** est une plateforme de quiz interactive conçue pour **Twitch**, inspirée par la frustration de voir certaines extensions disparaître ou évoluer de façon non souhaitée. L’idée est née en suivant le streamer **Oasix\_**, déçu que son extension de quiz ne fonctionne plus, et déterminé à offrir une alternative fiable et simple d'utilisation.

---

## 📁 Structure du monorepo

Ce monorepo utilise `pnpm` et les workspaces pour organiser tous les composants du projet.

```
wizzy/
├── client/      # Code de l’extension Twitch (frontend viewers)
├── server/      # Serveur WebSocket pour la synchronisation des parties
├── shared/      # Types partagés, constantes, schéma Prisma
└── web/         # Dashboard Next.js pour les streamers
```

---

## 🧹 Composants

### `client/` — **Twitch Extension Overlay (Viewer Side)**

- Interface affichée en overlay sur Twitch.
- Permet aux spectateurs de participer en temps réel.
- Communique avec le serveur via WebSocket.

### `server/` — **Serveur WebSocket**

- Gère les connexions des viewers et du dashboard streamer.
- Authentifie les utilisateurs via JWT Twitch.
- Gère les rooms et la logique de partie (join, start, answer, etc.).

### `shared/` — **Types, Prisma, Constantes**

- Contient les types TypeScript partagés entre projets.
- Contient le schéma Prisma et le client PostgreSQL.
- Exporte les constantes globales et types d'événements socket.

### `web/` — **Dashboard Streamer (Next.js)**

- Interface de création et gestion des quiz.
- Auth via Twitch OAuth.
- Ajout de questions avec audio (ex: blindtests).
- Contrôle de la partie en direct (via WebSocket).

---

## 🎵 Fonctionnalités principales

- Quiz et blindtests avec audio d’intro et de révélation.
- Interface streamer pensée pour la simplicité.
- Compatibilité Twitch Extension Overlay.
- Communication en temps réel via WebSocket.

---

## ⚖️ Stack technique

- **Frontend** : Twitch Extensions (client), Next.js (web)
- **Backend** : Express + Socket.io
- **Base de données** : PostgreSQL + Prisma

---

## 🚧 En cours
