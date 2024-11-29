const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // For production, restrict to your domain
    methods: ["GET", "POST"]
  }
});
const path = require('path');
const fs = require('fs');

// Path to the persistent storage file
const wheelsFilePath = path.join(__dirname, 'public', 'spinwheel', 'wheels.json');

// Load wheel configurations from persistent storage
let wheels = {};
try {
  const data = fs.readFileSync(wheelsFilePath);
  wheels = JSON.parse(data);
  console.log("Loading: "+JSON.stringify(wheels))
} catch (err) {
  console.error('Error loading wheel configurations:', err);
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
  console.log("Fetching"+wheelId)
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

// Maze application routes (skeleton)
app.get('/maze', (req, res) => {
  res.send('Maze application coming soon!');
});


// Serve other static files (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Handle client connections via Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a specific wheel room
  socket.on('joinWheel', (wheelId) => {
    if (wheels[wheelId]) {
      socket.join(wheelId);
      console.log(`Socket ${socket.id} joined wheel ${wheelId}`);
      // Send the currentAngle to the newly connected client
      socket.emit('currentAngle', wheels[wheelId].currentAngle);
    } else {
      socket.emit('error', 'Wheel not found');
    }
  });

  // Listen for 'spin' events from clients
  socket.on('spin', (data) => {
    const { wheelId } = data;
    const wheel = wheels[wheelId];

    if (!wheel) {
      socket.emit('error', 'Wheel not found');
      return;
    }

    if (wheel.isSpinning) {
      socket.emit('error', 'Wheel is currently spinning');
      return;
    }

    // Mark the wheel as spinning
    wheel.isSpinning = true;

    // Generate deterministic spin parameters
    const spinData = generateSpinParameters(wheel.segments.length);

    // Broadcast the spin event with spin data to all clients in the wheel room
    io.to(wheelId).emit('spin', spinData);

    // After the duration, mark the wheel as not spinning and update currentAngle
    setTimeout(() => {
      wheel.isSpinning = false;
      // Update currentAngle based on spinData
      wheel.currentAngle = (wheel.currentAngle + (spinData.spins * 2 * Math.PI) + (spinData.stopAngle * Math.PI / 180)) % (2 * Math.PI);
      // Broadcast the updated currentAngle to all clients
      io.to(wheelId).emit('currentAngle', wheel.currentAngle);
      // Optionally, broadcast the result
      io.to(wheelId).emit('spinEnded', spinData);
    }, spinData.duration * 1000); // Convert to milliseconds
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Function to generate deterministic spin parameters
function generateSpinParameters(numSegments) {
  const spins = Math.floor(Math.random() * 3) + 5; // Random spins between 5 and 7 for smoother animation
  const duration = 5; // 5 seconds
  const stopSegment = Math.floor(Math.random() * numSegments) + 1; // Segment number (1-indexed)
  const segmentAngle = 360 / numSegments;
  const stopAngle = 360 - ((stopSegment - 1) * segmentAngle) + (segmentAngle / 2); // Align to segment

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

// Gracefully handle server termination (e.g., Ctrl+C)
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  saveWheels();
  process.exit();
});

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
