function setupMazeSocketHandlers(io, mazeManager) {
    const mazeNamespace = io.of('/maze');

    mazeNamespace.on('connection', (socket) => {
        let currentGame = null;
        let playerId = null;

        socket.on('join_game', ({ gameId, role }) => {
            if (role === 'viewer') {
                socket.join(`game:${gameId}`);
                // Send full game state to viewer
                const game = mazeManager.games.get(gameId);
                if (game) {
                    socket.emit('game_state', game);
                }
            } else {
                // Handle player join
                playerId = socket.id;
                currentGame = mazeManager.joinGame(gameId, playerId);
                if (currentGame) {
                    socket.join(`game:${gameId}`);
                    mazeNamespace.to(`game:${gameId}`).emit('player_joined', {
                        playerId,
                        gameState: currentGame
                    });
                }
            }
        });

        socket.on('move', ({ direction }) => {
            if (!currentGame || !playerId) return;
            // TODO: Implement movement logic
        });

        socket.on('place_trap', () => {
            if (!currentGame || !playerId) return;
            // TODO: Implement trap placement logic
        });

        socket.on('disconnect', () => {
            // Handle player disconnect
            if (currentGame && playerId) {
                // TODO: Implement disconnect logic
            }
        });
    });
}

module.exports = setupMazeSocketHandlers;