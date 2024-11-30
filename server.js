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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wheelsFilePath = path.join(__dirname, 'public', 'spinwheel', 'wheels.json');
const wheelManager = new WheelManager(io, wheelsFilePath, fs);

setupSpinwheelRoutes(app, wheelManager);
setupSocketHandlers(io, wheelManager);

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wheelManager.saveWheels();
  process.exit();
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});