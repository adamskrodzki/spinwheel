const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "spinwheel-qwbu.onrender.com",
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

const wheelsFilePath = path.join(__dirname, 'public', 'spinwheel', 'wheels.json');
const wheelManager = new WheelManager(io, wheelsFilePath, fs);

const mazeManager = new MazeManager(io);

setupSpinwheelRoutes(app, wheelManager);
setupSocketHandlers(io, wheelManager);

setupMazeRoutes(app, mazeManager);
setupMazeSocketHandlers(io, mazeManager);

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wheelManager.saveWheels();
  process.exit();
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});