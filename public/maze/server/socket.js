function setupMazeSocketHandlers(io, mazeManager) {
    const mazeNamespace = io.of('/maze');

    mazeNamespace.on('connection', (socket) => {
        let currentGame = null;
        let playerId = socket.id;
        let role = null;

        socket.on('join_game', ({ gameId }) => {
            const game = mazeManager.getGame(gameId);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            socket.join(`game:${gameId}`);

            // Determine player role based on connection
            if (game.players.length < 2) {
                role = game.players.length === 0 ? 'player1' : 'player2';
                const player = mazeManager.addPlayer(gameId, playerId);
                if (player) {
                    currentGame = game;
                    mazeNamespace.to(`game:${gameId}`).emit('game_state', game);
                    if (game.players.length === 2) {
                        // Emit single play link for both players
                        const playLink = `/maze/player/${gameId}`;
                        mazeNamespace.to(`game:${gameId}`).emit('play_link', playLink);
                    }
                } else {
                    socket.emit('error', { message: 'Could not join game' });
                }
            } else {
                socket.emit('error', { message: 'Game is full' });
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