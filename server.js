// server.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
  }
});
const path = require('path');

// In-memory storage for wheel configurations and spin states
const wheels = {};

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies (for API endpoints)
app.use(express.json());

// API endpoint to create a new wheel
app.post('/create-wheel', (req, res) => {
  const { segments } = req.body;

  if (!segments || !Array.isArray(segments) || segments.length < 2) {
    return res.status(400).json({ error: 'Invalid segments. Provide an array with at least two segments.' });
  }

  const wheelId = uuidv4();
  wheels[wheelId] = {
    segments,
    isSpinning: false
  };

  res.json({ wheelId });
});

// Serve the creator page
app.get('/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'creator.html'));
});

// API endpoint to get wheel configuration
app.get('/wheel-config/:wheelId', (req, res) => {
    const { wheelId } = req.params;
    const wheel = wheels[wheelId];
  
    if (wheel) {
      res.json({ segments: wheel.segments });
    } else {
      res.status(404).json({ error: 'Wheel not found' });
    }
  });

// Handle client connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a specific wheel room
  socket.on('joinWheel', (wheelId) => {
    if (wheels[wheelId]) {
      socket.join(wheelId);
      console.log(`Socket ${socket.id} joined wheel ${wheelId}`);
      // Send current wheel state to the newly connected client
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

    // After the duration, mark the wheel as not spinning
    setTimeout(() => {
      wheel.isSpinning = false;
      // Optionally, broadcast the result
      io.to(wheelId).emit('spinEnded', spinData);
    }, spinData.duration * 1000); // Convert to milliseconds
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Function to generate random spin parameters
function generateSpinParameters(numSegments) {
  const spins = Math.floor(Math.random() * 5) + 5; // Random spins between 5 and 9
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

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
