# Skribbl.io

A real-time multiplayer drawing and guessing game inspired by [skribbl.io](https://skribbl.io). Players join private rooms, take turns drawing a secret word on a shared whiteboard, and compete to guess what others are drawing.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router 6, Axios, Socket.io Client, Fabric.js |
| **Backend** | Node.js, Express 5, Socket.io, MongoDB (Mongoose), JWT, bcrypt |
| **Real-time** | Socket.io for game phases, chat, scoring, and live canvas sync |

---

## Project Structure

```
skribbl.io/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── pages/          # Auth, Lobby, Waiting, Game
│       ├── components/     # Whiteboard, WordDisplay, PhaseOverlay
│       ├── context/        # AuthContext, SocketContext
│       └── lib/            # Axios API client
└── server/                 # Express + Socket.io backend
    └── src/
        ├── socket/         # Game logic & real-time events
        ├── controllers/    # User & room REST handlers
        ├── routes/         # API routes
        ├── model/          # Mongoose User model
        ├── middleware/     # JWT verification
        └── utils/          # Word pool, helpers
```

---

## Features

### Authentication
- User registration and login with email + password
- Passwords hashed with bcrypt
- JWT access + refresh tokens (httpOnly cookies + Bearer header fallback)
- Protected REST routes via `VerifyJWT` middleware

### Lobby & Rooms
- **Create room** — auto-generated 6-character room code, configurable rounds (1 / 2 / 3 / 5 / 8)
- **Join room** — enter a room code and display name
- **Waiting room** — live player list (polled every 2.5s), copy room code, host starts when ≥ 2 players

### Game Phases
1. **Starting** — 5-second countdown before the first round
2. **Word Selection** — drawer picks 1 of 3 random words (10s timeout, auto-picks if time runs out)
3. **Drawing / Guessing** — drawer draws on the whiteboard; guessers see letter dashes and submit guesses (~100s)
4. **Show Result** — word revealed, points tallied (10s)
5. **Game End** — final leaderboard when all rounds complete

### Whiteboard (Fabric.js)
- Real-time collaborative drawing synced via Socket.io
- Server holds authoritative `canvasObjects` state per room
- Drawer tools: color palette, brush sizes, undo last stroke, clear canvas
- Canvas clears automatically at the start of each drawing round
- Late joiners / reconnects can request full canvas state via `request-canvas-state`

### Chat & Guessing
- Separate chat and guess inputs
- Client-side guess validation — correct guess awards +100 points and locks inputs
- Correct guesses broadcast to all players without revealing the word in chat
- Drawer chat/guess locked while drawing

### Scoring
| Action | Points |
|---|---|
| Correct guess | +100 |
| Drawer bonus (end of round) | 30–80 based on % of players who guessed correctly |

Drawer bonus tiers: 100% → 80 pts · 90%+ → 70 · 70%+ → 60 · 50%+ → 50 ·  .30%+ → 40 · any correct → 30

### Smart Round Skip
When every non-drawer player guesses the word correctly, the round ends immediately — timers are cleared, the word is revealed, and the game advances to the result phase without waiting for the full drawing timer.

---

## Game Flow

```
Auth → Lobby (join or create room) → Waiting Room (host starts)
  → Starting (5s)
  → Word Selection (drawer picks, 10s)
  → Drawing / Guessing (~100s, or ends early if all guess)
  → Show Result (10s)
  → Next round OR Game End
```

---

## API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/users/register` | No | Create account |
| `POST` | `/api/users/login` | No | Login, set cookies |
| `POST` | `/api/users/logout` | Yes | Logout, clear cookies |
| `GET` | `/api/users/room-users?roomId=` | Yes | Players in room with points |
| `GET` | `/api/users/room-word?roomId=` | Yes | Current room word (backend only) |

---

## Socket Events

### Client → Server
| Event | Purpose |
|---|---|
| `create-room` | Host creates a room |
| `join-room` | Player joins a room |
| `leave-room` | Player leaves |
| `start-game` | Host starts with round count |
| `word-selected` | Drawer picks a word |
| `sent-message` | Chat / correct-guess marker |
| `score-update` | Update player points |
| `canvas-operation` | Add / remove / clear canvas objects |
| `request-canvas-state` | Request full canvas for sync |
| `word-guessed` | Notify server of a correct guess |

### Server → Client
| Event | Purpose |
|---|---|
| `Starting-Phase` | Pre-game countdown |
| `Word-Selection-Waiting` | Non-drawers wait while drawer picks |
| `Word-Selection-Phase` | Drawer sees 3 word choices |
| `Drawing-Phase` | Drawer sees the word |
| `Gussing-Phase` | Guessers see word length |
| `Correct-Word` | Word revealed |
| `Show-Result-Phase` | Round results |
| `Game-End-Phase` | Final standings |
| `canvas-operation` | Live drawing sync |
| `canvas-state` | Full canvas snapshot |
| `start-my-game` | Navigate all clients to game |
| `sent-message-recived` | Chat relay |
| `leave-room-mesaage` | Player left notification |

---

## Backend Fixes & Improvements

These were identified and resolved during development:

1. **`disconnecting` handler** — no longer crashes on player disconnect
2. **`initialCountDown()`** — game countdown now starts on `start-game`
3. **`idToSocketId` lookup** — uses `user.id` instead of whole user object
4. **`socket.to` → `io.to`** — host and drawer receive phase events correctly
5. **`setInterval` → `setTimeout`** — phase timers fire once with proper cleanup
6. **Drawer rotation** — `currentDrawerIndex` replaces broken `nextChance` logic
7. **`create-room` / `join-room`** — correct userId + roomId stored for disconnect handling
8. **`score-update`** — adds points instead of overwriting
9. **`Word-Selection-Waiting`** — broadcast so non-drawers reset between rounds
10. **`Gussing-Phase`** — uses `.except(drawerSocketId)` so drawer isn't reset as guesser
11. **Early round end** — skips to result when all players guess correctly
12. **Deployment env** — dev/prod URL switching via `ENV`, `CLIENT_DEV_URL`, `VITE_API_DEV_URL`

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/auth` | AuthPage | Login / register with glass UI |
| `/lobby` | LobbyPage | Display name, join with code or create room + rounds |
| `/room/:roomId/waiting` | WaitingPage | Room code, player list, host start button |
| `/room/:roomId/play` | GamePage | Full game — whiteboard, chat, guess, scoreboard, phase overlays |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance (local or Atlas)

### 1. Clone & install

```bash
git clone <repo-url>
cd skribbl.io

cd server && npm install
cd ../client && npm install
```

### 2. Environment variables

**`server/.env`**
```env
ENV=development
PORT=8000
MONGODB_URI=mongodb://localhost:27017/skribbl
ACCESS_TOKEN_SECRET=your_access_secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_refresh_secret
REFRESH_TOKEN_EXPIRY=10d
CLIENT_URL=http://localhost:5173
CLIENT_DEV_URL=http://localhost:5173
```

**`client/.env`**
```env
VITE_NODE_ENV=development
VITE_API_DEV_URL=http://localhost:8000
# Production (when deployed):
# VITE_NODE_ENV=production
# VITE_API_URL=https://your-api.example.com
```

### 3. Run locally

```bash
# Terminal 1 — backend (port 8000)
cd server
npm run dev

# Terminal 2 — frontend (port 5173)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), register an account, create or join a room, and play.

---

## Deployment Notes

- Set `ENV=production` on the server and configure `CLIENT_URL` to your deployed frontend origin
- Set `VITE_NODE_ENV=production` and `VITE_API_URL` on the client build
- Socket.io CORS uses `CLIENT_DEV_URL` in development and `CLIENT_URL` in production
- Cookies use `secure: true` and `sameSite: "none"` in production for cross-origin auth

---

## Known Limitations

- **In-memory rooms** — room state is lost on server restart; not persisted to MongoDB
- **No mid-game reconnect** — refreshing the page drops you from the room
- **Waiting room polling** — player list refreshes via REST every 2.5s instead of a live socket broadcast
- **Word pool** — ~100 static words in `server/src/utils/words.js`

---

## License

ISC
