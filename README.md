# Multiplayer Tic-Tac-Toe Game

A real-time multiplayer Tic-Tac-Toe game built with Node.js, Express, and Socket.io. Players can create public or private game rooms and play against each other in real-time.

## Features

- 🎮 Real-time multiplayer gameplay
- 🌐 Public game rooms (visible to all players)
- 🔒 Private game rooms (join by room ID)
- 👥 Player matching system
- 🔄 Rematch functionality
- 📱 Responsive design

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Deployment (Cross-Origin Setup)

### Backend (Render/Heroku/etc.)

1. Set environment variable `ALLOWED_ORIGINS` with your frontend domain(s):
   ```
   ALLOWED_ORIGINS=https://your-username.github.io,https://yourdomain.com
   ```
   Multiple origins can be separated by commas.

2. The server will automatically use the `PORT` environment variable assigned by your hosting platform.

### Frontend (GitHub Pages)

1. In `public/index.html`, uncomment and set the backend URL:
   ```html
   <script>
       window.BACKEND_URL = 'https://your-app.onrender.com';
   </script>
   ```

2. The client will connect to your backend server across different domains.

**Note**: For local development, if frontend and backend are on the same origin, you don't need to set `BACKEND_URL` (it defaults to same origin).

## How to Play

1. **Enter Lobby**: Enter your name and click "Enter Lobby"

2. **Create a Game**:
   - **Public Game**: Creates a game visible to all players in the lobby
   - **Private Game**: Creates a game that requires a room ID to join (share the room ID with a friend)

3. **Join a Game**:
   - Enter a room ID to join a private game, or
   - Click on a public game from the list

4. **Play**: Take turns making moves. The first player is X, the second is O.

5. **Rematch**: After a game ends, either player can request a rematch. Both players must agree to start a new game.

## Technology Stack

- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Frontend**: HTML, CSS, JavaScript
- **Styling**: Custom CSS with responsive design

## Project Structure

```
TicTacToe/
├── server.js          # Server and game logic
├── package.json       # Dependencies
├── public/            # Client-side files
│   ├── index.html    # Main HTML
│   ├── style.css     # Styling
│   └── client.js     # Client-side JavaScript
└── README.md         # Documentation
```

## Game Rules

- Standard Tic-Tac-Toe rules apply
- First player to get 3 in a row (horizontal, vertical, or diagonal) wins
- If the board is filled with no winner, it's a draw
- Players take turns automatically based on game state

## License

MIT

