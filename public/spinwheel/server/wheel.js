const predefinedColors = [
  '#CC4422', '#22CC44', '#2244CC', '#B39900', '#774488',
  '#CC6600', '#118877', '#993322', '#226699', '#11AA55'
];

function generateSpinParameters(numSegments) {
  const spins = Math.floor(Math.random() * 3) + 5;
  const duration = 5;
  const stopSegment = Math.floor(Math.random() * numSegments) + 1;
  const segmentAngle = 360 / numSegments;
  const stopAngle = 360 - ((stopSegment - 1) * segmentAngle) + (segmentAngle / 2);

  return { spins, duration, stopAngle, winningSegment: stopSegment };
}

class WheelManager {
  constructor(io, wheelsFilePath, fs) {
    this.io = io;
    this.wheelsFilePath = wheelsFilePath;
    this.fs = fs;
    this.wheels = this.loadWheels();
  }

  loadWheels() {
    try {
      const data = this.fs.readFileSync(this.wheelsFilePath);
      return JSON.parse(data);
    } catch (err) {
      console.error('Error loading spinwheel configurations:', err);
      return {};
    }
  }

  saveWheels() {
    try {
      const data = JSON.stringify(this.wheels);
      this.fs.writeFileSync(this.wheelsFilePath, data);
    } catch (err) {
      console.error('Error saving wheel configurations:', err);
    }
  }

  createWheel(segments) {
    const colors = segments.map((_, index) => predefinedColors[index % predefinedColors.length]);
    return {
      segments,
      colors,
      isSpinning: false,
      currentAngle: 0
    };
  }

  handleSpin(socket, wheelId) {
    const wheel = this.wheels[wheelId];

    if (!wheel) {
      socket.emit('error', 'Wheel not found');
      return;
    }

    if (wheel.isSpinning) {
      socket.emit('error', 'Wheel is currently spinning');
      return;
    }

    wheel.isSpinning = true;
    const spinData = generateSpinParameters(wheel.segments.length);
    this.io.to(wheelId).emit('spin', spinData);

    setTimeout(() => {
      wheel.isSpinning = false;
      wheel.currentAngle = (wheel.currentAngle + (spinData.spins * 2 * Math.PI) + (spinData.stopAngle * Math.PI / 180)) % (2 * Math.PI);
      this.io.to(wheelId).emit('currentAngle', wheel.currentAngle);
      this.io.to(wheelId).emit('spinEnded', spinData);
      this.saveWheels();
    }, spinData.duration * 1000);
  }

  handleJoinWheel(socket, wheelId) {
    if (this.wheels[wheelId]) {
      socket.join(wheelId);
      console.log(`Socket ${socket.id} joined wheel ${wheelId}`);
      socket.emit('currentAngle', this.wheels[wheelId].currentAngle);
    } else {
      socket.emit('error', 'Wheel not found');
    }
  }
}

module.exports = { WheelManager, predefinedColors };