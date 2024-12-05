function setupMazeSocketHandlers(io, mazeManager) {
    const mazeNamespace = io.of('/maze');

    mazeNamespace.on('connection', (socket) => {
        let currentGame = null;
        let playerId = socket.id;

        socket.on('join_game', ({ gameId, role }) => {
            const game = mazeManager.getGame(gameId);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            socket.join(`game:${gameId}`);

            if (role === 'viewer') {
                // Send full game state to viewer
                socket.emit('game_state', game);
            } else {
                // Handle player join
                const player = mazeManager.addPlayer(gameId, playerId);
                if (player) {
                    currentGame = game;
                    mazeNamespace.to(`game:${gameId}`).emit('game_state', game);
                } else {
                    socket.emit('error', { message: 'Could not join game' });
                }
            }
        });

        socket.on('move', ({ direction }) => {
            if (!currentGame || !playerId) return;

            if (mazeManager.movePlayer(currentGame.id, playerId, direction)) {
                mazeNamespace.to(`game:${currentGame.id}`).emit('game_state', currentGame);
            }
        });

        socket.on('place_trap', () => {
            if (!currentGame || !playerId) return;

            if (mazeManager.placeTrap(currentGame.id, playerId)) {
                mazeNamespace.to(`game:${currentGame.id}`).emit('game_state', currentGame);
            }
        });

        socket.on('disconnect', () => {
            if (currentGame && playerId) {
                const player = currentGame.players.find(p => p.id === playerId);
                if (player) {
                    // Handle player disconnect
                    currentGame.players = currentGame.players.filter(p => p.id !== playerId);
                    if (currentGame.state === 'playing') {
                        currentGame.state = 'finished';
                    }
                    mazeNamespace.to(`game:${currentGame.id}`).emit('game_state', currentGame);
                }
            }
        });
    });
}

module.exports = setupMazeSocketHandlers;