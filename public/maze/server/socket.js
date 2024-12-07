function setupMazeSocketHandlers(io, mazeManager) {
    const mazeNamespace = io.of('/maze');
    const connectedClients = new Set(); // Store client roles and game IDs
    const disconnectTimers = new Map();
    const gameIntervals = new Map(); // Store game-specific intervals
    const playerSockets = new Map(); // Track socket instances per player

    function cleanupGame(gameId) {
        // Clear all disconnect timers for the game's players
        const game = mazeManager.getGame(gameId);
        if (game) {
            game.players.forEach(player => {
                if (disconnectTimers.has(player.id)) {
                    clearTimeout(disconnectTimers.get(player.id));
                    disconnectTimers.delete(player.id);
                }
                // Clean up player socket listeners
                const socket = playerSockets.get(player.id);
                if (socket) {
                    socket.removeAllListeners('move');
                    socket.removeAllListeners('place_trap');
                    socket.removeAllListeners('collectCookie');
                    socket.removeAllListeners('playAgain');
                    playerSockets.delete(player.id);
                }
            });
        }

        // Clear game-specific intervals
        if (gameIntervals.has(gameId)) {
            const intervals = gameIntervals.get(gameId);
            intervals.forEach(interval => clearInterval(interval));
            gameIntervals.delete(gameId);
        }
    }

    function broadcastGameState(game) {
        if (!game) return;
        
        // Check if game is over using the game's method
        if (game.isGameOver()) {
            game.state = 'finished';
        }
        
        // Broadcast to all clients in the game room
        mazeNamespace.to(`game:${game.id}`).emit('game_state', game);
    }

    function broadcastStats() {
        mazeNamespace.emit('stats_update', {
            playersOnline: playerSockets.size,
            gamesPlayed: mazeManager.games.size
        });
    }

    mazeNamespace.on('connection', (socket) => {
        connectedClients.add(socket.handshake.address);
        broadcastStats();

        let currentGame = null;
        let playerId = socket.id;
        let role = null;

        const gameInterval = setInterval(() => {
            if (currentGame) {
                broadcastGameState(currentGame);
            }
        }, 100);

        gameIntervals.set(socket.id, [gameInterval]);

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
                    playerSockets.set(socket.id, socket);
                    broadcastStats();
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
            connectedClients.delete(socket.handshake.address);
            broadcastStats();

            if (currentGame && role === 'player') {
                const player = currentGame.players.find(p => p.id === playerId);
                if (player) {
                    // Store the disconnect time
                    player.disconnectTime = Date.now();
                    
                    // Clear any existing timer for this player
                    if (disconnectTimers.has(playerId)) {
                        clearTimeout(disconnectTimers.get(playerId));
                    }
                    
                    // Give a 30-second grace period for reconnection
                    const disconnectTimer = setTimeout(() => {
                        const game = mazeManager.getGame(currentGame.id);
                        if (game) {
                            const player = game.players.find(p => p.id === playerId);
                            if (player && player.disconnectTime) {
                                // If player hasn't reconnected within grace period
                                if (Date.now() - player.disconnectTime >= 30000) {
                                    console.log(`Player ${playerId} removed from game ${game.id} after disconnect timeout`);
                                    
                                    // If game was in progress, declare other player as winner
                                    if (game.state === 'playing') {
                                        game.state = 'finished';
                                        const remainingPlayer = game.players.find(p => p.id !== playerId);
                                        if (remainingPlayer) {
                                            game.winner = remainingPlayer.id;
                                            game.winReason = 'opponent_disconnected';
                                            console.log(`Player ${remainingPlayer.id} wins due to opponent disconnect`);
                                        }
                                    }
                                    
                                    // Remove the player and clean up
                                    game.players = game.players.filter(p => p.id !== playerId);
                                    disconnectTimers.delete(playerId);
                                    playerSockets.delete(playerId);
                                    
                                    // If this was the last player, clean up the entire game
                                    if (game.players.length === 0) {
                                        cleanupGame(game.id);
                                    }
                                    
                                    broadcastGameState(game);
                                }
                            }
                        }
                    }, 30000);
                    
                    // Store the timer reference in our separate map
                    disconnectTimers.set(playerId, disconnectTimer);
                }
            }
            
            // Clean up game interval
            const intervals = gameIntervals.get(socket.id);
            if (intervals) {
                intervals.forEach(interval => clearInterval(interval));
                gameIntervals.delete(socket.id);
            }
        });

        socket.on('playAgain', () => {
            if (!currentGame) return;
            
            // Clean up all game-related resources
            cleanupGame(currentGame.id);

            // Reset game state
            currentGame.state = 'waiting';
            currentGame.winner = null;
            currentGame.winReason = null;
            currentGame.players.forEach(player => {
                player.score = 0;
                player.lives = currentGame.config.lives;
                player.position = null;
                player.trapped = false;
                player.trapTime = null;
                delete player.disconnectTime;
                
                // Re-register socket for the new game
                const playerSocket = playerSockets.get(player.id);
                if (playerSocket) {
                    playerSockets.set(player.id, playerSocket);
                }
            });

            // Reset maze and cookies
            currentGame.maze = mazeManager.generateMaze(currentGame.config.mazeSize);
            currentGame.cookies = mazeManager.generateCookies(currentGame.maze, currentGame.config.activeCookies);
            currentGame.startTime = null;

            broadcastGameState(currentGame);
        });

        // Clean up when game ends normally
        socket.on('gameEnd', () => {
            if (currentGame) {
                cleanupGame(currentGame.id);
            }
        });
    });
}

module.exports = setupMazeSocketHandlers;