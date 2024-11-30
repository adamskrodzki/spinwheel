function setupSocketHandlers(io, wheelManager) {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinWheel', (wheelId) => {
      wheelManager.handleJoinWheel(socket, wheelId);
    });

    socket.on('spin', ({ wheelId }) => {
      wheelManager.handleSpin(socket, wheelId);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
}

module.exports = setupSocketHandlers;