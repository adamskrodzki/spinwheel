function setupMazeSocketHandlers(io, mazeManager) {
    const mazeNamespace = io.of('/maze');
    const connectedClients = new Map(); // Store client roles and game IDs

    mazeNamespace.on('connection', (socket) => {
        let currentGame = null;
        let playerId = socket.id;
        let role = null;

        function broadcastGameState(game) {
            if (!game) return;
            
            // Check if game is over using the game's method
            if (game.isGameOver()) {
                game.state = 'finished';
            }
            
            // Broadcast to all clients in the game room
            mazeNamespace.to(`game:${game.id}`).emit('game_state', game);
        }

        setInterval(() => {
            if (currentGame) {
                broadcastGameState(currentGame);
            }
        }, 100);

        socket.on('join_game', ({ gameId, role: requestedRole }) => {
            console.log(`Socket ${socket.id} joining game ${gameId} as ${requestedRole}`);
            const game = mazeManager.getGame(gameId);
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            socket.join(`game:${gameId}`);
            currentGame = game;
            role = requestedRole;

            if (role === 'player') {
                if (game.state === 'finished') {
                    socket.emit('error', { message: 'Game is already finished' });
                    return;
                }

                // Check for existing player first
                const existingPlayer = game.players.find(p => p.id === socket.id);
                if (existingPlayer) {
                    // This is a reconnecting player
                    playerId = socket.id;
                    socket.emit('player_assigned', { playerId });
                    broadcastGameState(game);
                    console.log(`Player ${socket.id} reconnected to game ${gameId}. Total players: ${game.players.length}`);
                    return;
                }
                
                // Check if game is full
                if (game.players.length >= 2) {
                    socket.emit('error', { message: 'Game is full' });
                    return;
                }

                // Add new player
                const player = mazeManager.addPlayer(gameId, playerId);
                if (player) {
                    // Notify the player they've been assigned
                    socket.emit('player_assigned', { 
                        playerId: socket.id,
                        playerNumber: game.players.length 
                    });
                    
                    // If game is now full, start the game
                    if (game.players.length === 2) {
                        game.state = 'playing';
                        game.startTime = Date.now();
                    }
                    
                    console.log(`Player ${socket.id} added to game ${gameId}. Total players: ${game.players.length}`);
                    broadcastGameState(game);
                } else {
                    socket.emit('error', { message: 'Could not join game' });
                }
            } else {
                // Viewer
                broadcastGameState(game);
            }
        });

        socket.on('move', ({ direction }) => {
            if (!currentGame || !playerId || role !== 'player') return;

            if (mazeManager.movePlayer(currentGame.id, playerId, direction)) {
                broadcastGameState(currentGame);
                
                // Check for game over after move
                if (currentGame.isGameOver()) {
                    mazeNamespace.to(`game:${currentGame.id}`).emit('game_over', currentGame);
                }
            }
        });

        socket.on('place_trap', () => {
            if (!currentGame || !playerId || role !== 'player') return;

            if (mazeManager.placeTrap(currentGame.id, playerId)) {
                broadcastGameState(currentGame);
            }
        });

        socket.on('reset_game', ({ gameId }) => {
            const game = mazeManager.getGame(gameId);
            if (!game) return;

            // Reset game state
            game.state = 'waiting';
            game.players = [];
            game.cookies = [];
            game.trapCookies = [];
            game.maze = mazeManager.generateMaze(game.config.mazeSize);
            game.cookies = mazeManager.generateInitialCookies(game);
            game.startTime = null;

            // Broadcast the reset state
            broadcastGameState(game);
        });

        socket.on('disconnect', () => {
            console.log(`Socket ${socket.id} disconnected`);
            if (currentGame && role === 'player') {
                const player = currentGame.players.find(p => p.id === playerId);
                if (player) {
                    // Store the disconnect time
                    player.disconnectTime = Date.now();
                    
                    // Give a 30-second grace period for reconnection
                    setTimeout(() => {
                        const game = mazeManager.getGame(currentGame.id);
                        if (game) {
                            const player = game.players.find(p => p.id === playerId);
                            if (player && player.disconnectTime) {
                                // If player hasn't reconnected within grace period
                                if (Date.now() - player.disconnectTime >= 30000) {
                                    console.log(`Player ${playerId} removed from game ${game.id} after disconnect timeout`);
                                    // Remove the player
                                    game.players = game.players.filter(p => p.id !== playerId);
                                    // If game was in progress, end it
                                    if (game.state === 'playing') {
                                        game.state = 'finished';
                                    }
                                    broadcastGameState(game);
                                }
                            }
                        }
                    }, 30000);
                    
                    broadcastGameState(currentGame);
                }
            }
            
            // Clean up connection tracking
            if (socket.handshake.address) {
                connectedClients.delete(socket.handshake.address);
            }
        });
    });
}

module.exports = setupMazeSocketHandlers;