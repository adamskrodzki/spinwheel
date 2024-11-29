const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const path = require('path');
const fs = require('fs');

// Path to the persistent storage file for spinwheel
const wheelsFilePath = path.join(__dirname, 'public', 'spinwheel', 'wheels.json');

// Load wheel configurations from persistent storage
let wheels = {};
try {
  const data = fs.readFileSync(wheelsFilePath);
  wheels = JSON.parse(data);
  console.log("Loading spinwheels: " + JSON.stringify(wheels))
} catch (err) {
  console.error('Error loading spinwheel configurations:', err);
  // If there's an error, start with an empty object
}

// Path to the persistent storage file for maze games
const mazeGamesFilePath = path.join(__dirname, 'public', 'maze', 'games.json');

// Load maze game configurations from persistent storage
let mazeGames = {};
try {
  const data = fs.readFileSync(mazeGamesFilePath);
  mazeGames = JSON.parse(data);
  console.log("Loading maze games: " + JSON.stringify(mazeGames));
} catch (err) {
  console.error('Error loading maze game configurations:', err);
  // If there's an error, start with an empty object
}


// Middleware to parse JSON bodies
app.use(express.json());

// Rate limiter for creating wheels (max 10 requests per minute per IP)
const createWheelLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many wheels created from this IP, please try again after a minute.' }
});

// Predefined list of darker colors for segments
const predefinedColors = [
  '#CC4422', // Darker Red
  '#22CC44', // Darker Green
  '#2244CC', // Darker Blue
  '#B39900', // Darker Yellow
  '#774488', // Darker Purple
  '#CC6600', // Darker Orange
  '#118877', // Darker Teal
  '#993322', // Darker Dark Red
  '#226699', // Darker Light Blue
  '#11AA55'  // Darker Light Green
];

// API endpoint to create a new wheel
app.post('/spinwheel/create-wheel', createWheelLimiter, (req, res) => {
  let { segments } = req.body;

  if (!segments || !Array.isArray(segments) || segments.length < 2) {
    return res.status(400).json({ error: 'Invalid segments. Provide an array with at least two segments.' });
  }

  // Sanitize each segment to prevent XSS
  segments = segments.map(seg => sanitizeHtml(seg));

  // Assign colors to segments
  const colors = segments.map((seg, index) => predefinedColors[index % predefinedColors.length]);

  const wheelId = uuidv4();
  wheels[wheelId] = {
    segments,
    colors,
    isSpinning: false,
    currentAngle: 0 // Initialize currentAngle to 0
  };

  // Save the updated wheels object to persistent storage
  saveWheels();

  res.json({ wheelId });
});

// API endpoint to get wheel configuration
app.get('/spinwheel/wheel-config/:wheelId', (req, res) => {
  const { wheelId } = req.params;
  console.log("Fetching" + wheelId)
  const wheel = wheels[wheelId];

  if (wheel) {
    res.json({
      segments: wheel.segments,
      colors: wheel.colors,
      currentAngle: wheel.currentAngle // Include currentAngle
    });
  } else {
    res.status(404).json({ error: 'Wheel not found' });
  }
});

// Serve the creator page
app.get('/spinwheel/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spinwheel', 'creator.html'));
});

// Serve the viewer page
app.get('/spinwheel/wheel/:wheelId', (req, res) => {
  const { wheelId } = req.params;
  if (wheels[wheelId]) {
    res.sendFile(path.join(__dirname, 'public', 'spinwheel', 'viewer.html'));
  } else {
    res.status(404).send('Wheel not found');
  }
});

// Maze application routes
app.post('/maze/create', (req, res) => {
  const gameId = uuidv4();
  const { X, T, K, mazeSize } = req.body;

  const gameState = {
    gameId,
    X,
    T,
    K,
    mazeSize,
    players: [],
    cookies: [],
    traps: [],
    gameStarted: false,
    gameEnded: false,
    winner: null
  };

  mazeGames[gameId] = gameState;
  // Initial cookie spawning
  for (let i = 0; i < K; i++) {
    spawnCookie(gameState);
  }
  saveMazeGames();

  const viewerUrl = `/maze/view/${gameId}`;
  res.json({ gameId, viewerUrl });
});

app.get('/maze/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'maze', 'creator.html'));
});

app.get('/maze/view/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'maze', 'viewer.html'));
});

app.get('/maze/player1/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'maze', 'player.html'));
});

app.get('/maze/player2/:gameId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'maze', 'player.html'));
});

app.get('/maze', (req, res) => {
  res.send('Maze application coming soon!');
});


// Serve other static files (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Handle client connections via Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinGame', ({ gameId, player }) => {
    if (!mazeGames[gameId]) {
      socket.emit('error', 'Game not found');
      return;
    }
    mazeGames[gameId].players.push(player);
    socket.join(gameId);
    io.to(gameId).emit('gameStatus', mazeGames[gameId]);
    if (mazeGames[gameId].players.length === 2) {
      mazeGames[gameId].gameStarted = true;
      io.to(gameId).emit('gameStarted');
    }
    const playerUrl = `/maze/player${mazeGames[gameId].players.indexOf(player) + 1}/${gameId}`;
    socket.emit('redirect', playerUrl);
    saveMazeGames();
  });

  socket.on('getGameStatus', gameId => {
    if (mazeGames[gameId]) {
      socket.emit('gameStatus', mazeGames[gameId]);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


// Function to generate deterministic spin parameters
function generateSpinParameters(numSegments) {
  const spins = Math.floor(Math.random() * 3) + 5;
  const duration = 5;
  const stopSegment = Math.floor(Math.random() * numSegments) + 1;
  const segmentAngle = 360 / numSegments;
  const stopAngle = 360 - ((stopSegment - 1) * segmentAngle) + (segmentAngle / 2);

  return {
    spins,
    duration,
    stopAngle,
    winningSegment: stopSegment
  };
}

// Function to save the wheels object to persistent storage
function saveWheels() {
  try {
    const data = JSON.stringify(wheels);
    fs.writeFileSync(wheelsFilePath, data);
  } catch (err) {
    console.error('Error saving wheel configurations:', err);
  }
}

// Function to save the maze games object to persistent storage
function saveMazeGames() {
  try {
    const data = JSON.stringify(mazeGames);
    fs.writeFileSync(mazeGamesFilePath, data);
  } catch (err) {
    console.error('Error saving maze game configurations:', err);
  }
}

// Helper function to spawn a cookie at a random position
function spawnCookie(gameState) {
  const mazeSize = gameState.mazeSize || 10; // Default maze size
  const x = Math.floor(Math.random() * mazeSize);
  const y = Math.floor(Math.random() * mazeSize);
  gameState.cookies.push({ x, y });
}

// Gracefully handle server termination (e.g., Ctrl+C)
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  saveWheels();
  saveMazeGames();
  process.exit();
});

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
