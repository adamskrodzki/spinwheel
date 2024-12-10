const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const { WheelManager } = require('./public/spinwheel/server/wheel');
const setupSpinwheelRoutes = require('./public/spinwheel/server/routes');
const setupSocketHandlers = require('./public/spinwheel/server/socket');
const { MazeManager } = require('./public/maze/server/maze');
const setupMazeRoutes = require('./public/maze/server/routes');
const setupMazeSocketHandlers = require('./public/maze/server/socket');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'assets')));

const wheelsFilePath = path.join(__dirname, 'data', 'spinwheel', 'wheels.json');
const gamesFilePath = path.join(__dirname, 'data', 'maze', 'games.json');

console.log('Wheels file path:', wheelsFilePath);
console.log('Games file path:', gamesFilePath);

const wheelManager = new WheelManager(io, wheelsFilePath, fs);
const mazeManager = new MazeManager(io, gamesFilePath, fs);

// Clean up old games periodically
setInterval(() => mazeManager.cleanupOldGames(), 30 * 60 * 1000); // Every 30 minutes

setupSpinwheelRoutes(app, wheelManager);
setupSocketHandlers(io, wheelManager);

setupMazeRoutes(app, mazeManager);
setupMazeSocketHandlers(io, mazeManager);

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wheelManager.saveWheels();
  mazeManager.saveGames();
  process.exit();
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});