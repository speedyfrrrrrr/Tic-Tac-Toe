const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io - allow cross-origin requests from frontend
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000']; // Default for local development

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS middleware for Express (for any HTTP requests)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.static('public'));

// Game rooms storage
const rooms = new Map();
const players = new Map(); // socketId -> player info

// Game state management
class GameRoom {
  constructor(id, isPublic, creatorId) {
    this.id = id;
    this.isPublic = isPublic;
    this.creatorId = creatorId;
    this.players = [];
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.status = 'waiting'; // waiting, playing, finished
    this.winner = null;
    this.moves = 0;
  }

  addPlayer(socketId, playerName) {
    if (this.players.length >= 2) return false;
    
    const playerSymbol = this.players.length === 0 ? 'X' : 'O';
    this.players.push({
      socketId,
      name: playerName,
      symbol: playerSymbol
    });

    if (this.players.length === 2) {
      this.status = 'playing';
    }

    return true;
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.socketId !== socketId);
    if (this.players.length === 0) {
      this.status = 'waiting';
      this.reset();
    }
  }

  makeMove(index, socketId) {
    if (this.status !== 'playing') return false;
    if (this.board[index] !== null) return false;

    const player = this.players.find(p => p.socketId === socketId);
    if (!player || player.symbol !== this.currentPlayer) return false;

    this.board[index] = this.currentPlayer;
    this.moves++;

    // Check for winner
    this.winner = this.checkWinner();
    if (this.winner || this.moves === 9) {
      this.status = 'finished';
    } else {
      this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
    }

    return true;
  }

  checkWinner() {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (this.board[a] && 
          this.board[a] === this.board[b] && 
          this.board[a] === this.board[c]) {
        return this.board[a];
      }
    }

    return null;
  }

  reset() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.status = this.players.length === 2 ? 'playing' : 'waiting';
    this.winner = null;
    this.moves = 0;
  }

  getPublicInfo() {
    return {
      id: this.id,
      isPublic: this.isPublic,
      playersCount: this.players.length,
      status: this.status
    };
  }
}

// Helper functions
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPublicRooms() {
  return Array.from(rooms.values())
    .filter(room => room.isPublic && room.status === 'waiting')
    .map(room => room.getPublicInfo());
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-lobby', (playerName) => {
    players.set(socket.id, { name: playerName, roomId: null });
    socket.emit('public-rooms', getPublicRooms());
  });

  socket.on('create-room', ({ isPublic, playerName }) => {
    const roomId = generateRoomId();
    const room = new GameRoom(roomId, isPublic, socket.id);
    
    room.addPlayer(socket.id, playerName);
    rooms.set(roomId, room);
    
    socket.join(roomId);
    const player = players.get(socket.id);
    if (player) {
      player.roomId = roomId;
    }

    socket.emit('room-created', { roomId, isPublic });
    
    if (isPublic) {
      io.emit('public-rooms', getPublicRooms());
    }

    updateRoomState(roomId);
  });

  socket.on('join-room', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    if (room.status === 'playing' || room.status === 'finished') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    room.addPlayer(socket.id, playerName);
    socket.join(roomId);
    
    const player = players.get(socket.id);
    if (player) {
      player.roomId = roomId;
    }

    socket.emit('room-joined', { roomId });
    updateRoomState(roomId);
    
    if (room.isPublic) {
      io.emit('public-rooms', getPublicRooms());
    }
  });

  socket.on('make-move', ({ roomId, index }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.makeMove(index, socket.id)) {
      updateRoomState(roomId);
    }
  });

  socket.on('request-rematch', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'finished') return;

    const player = players.get(socket.id);
    if (player) {
      player.readyForRematch = true;
    }

    if (room.players.length === 2) {
      const allReady = room.players.every(p => 
        players.get(p.socketId)?.readyForRematch
      );
      
      if (allReady) {
        room.reset();
        room.players.forEach(p => {
          const pl = players.get(p.socketId);
          if (pl) pl.readyForRematch = false;
        });
        updateRoomState(roomId);
      } else {
        socket.to(roomId).emit('rematch-requested');
      }
    }
  });

  socket.on('leave-room', () => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;

    const room = rooms.get(player.roomId);
    if (room) {
      room.removePlayer(socket.id);
      socket.leave(player.roomId);

      updateRoomState(player.roomId);

      if (room.players.length === 0) {
        rooms.delete(player.roomId);
      }

      if (room.isPublic) {
        io.emit('public-rooms', getPublicRooms());
      }
    }

    player.roomId = null;
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player && player.roomId) {
      const room = rooms.get(player.roomId);
      if (room) {
        room.removePlayer(socket.id);
        updateRoomState(player.roomId);

        if (room.players.length === 0) {
          rooms.delete(player.roomId);
        } else {
          if (room.isPublic) {
            io.emit('public-rooms', getPublicRooms());
          }
        }
      }
    }

    players.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });

  function updateRoomState(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const state = {
      board: room.board,
      currentPlayer: room.currentPlayer,
      status: room.status,
      winner: room.winner,
      players: room.players.map(p => ({
        name: p.name,
        symbol: p.symbol,
        isCurrentPlayer: p.symbol === room.currentPlayer
      })),
      isDraw: room.moves === 9 && !room.winner
    };

    io.to(roomId).emit('game-state', state);
  }
});

// Use port assigned by hosting environment, fallback to 3000 for local development
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Open http://localhost:${PORT} in your browser`);
  }
});

