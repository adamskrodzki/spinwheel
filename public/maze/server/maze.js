const { v4: uuidv4 } = require('uuid');

class MazeManager {
    constructor(io, gamesFilePath, fs) {
        this.io = io;
        this.gamesFilePath = gamesFilePath;
        this.fs = fs;
        this.games = this.loadGames();
        this.defaultConfig = {
            cookiesToWin: 50,
            trapCooldown: 3000,
            activeCookies: 5,
            mazeSize: 30,
            lives: 3,
            viewRadius: 5
        };

        // Auto-save games periodically
        setInterval(() => this.saveGames(), 60000);
    }

    loadGames() {
        try {
            if (!this.fs.existsSync(this.gamesFilePath)) {
                return new Map();
            }
            const data = this.fs.readFileSync(this.gamesFilePath);
            const gamesObj = JSON.parse(data);
            // Convert object to Map and ensure each game has the isGameOver function
            const games = new Map();
            for (const [id, game] of Object.entries(gamesObj)) {
                games.set(id, this.ensureGameMethods(game));
            }
            return games;
        } catch (err) {
            console.error('Error loading maze games:', err);
            return new Map();
        }
    }

    // Helper method to ensure game object has all required methods
    ensureGameMethods(game) {
        game.isGameOver = function() {
            return this.state === 'finished' || 
                   this.players.some(p => p.score >= this.config.cookiesToWin) ||
                   this.players.some(p => p.lives <= 0);
        };
        return game;
    }

    saveGames() {
        try {
            // First convert Map to an object and create a deep copy
            const gamesObj = {};
            for (const [id, game] of this.games) {
                // Deep copy the game object
                gamesObj[id] = JSON.parse(JSON.stringify(game));
                // Clear the dynamic properties
                gamesObj[id].players = [];
                gamesObj[id].cookies = [];
                gamesObj[id].trapCookies = [];
                gamesObj[id].state = 'waiting';
            }
            
            const data = JSON.stringify(gamesObj, null, 2);
            this.fs.writeFileSync(this.gamesFilePath, data);
        } catch (err) {
            console.error('Error saving maze games:', err);
        }
    }

    createGame(config = {}) {
        const gameId = uuidv4();
        const gameConfig = { ...this.defaultConfig, ...config };

        console.log(`Created game ${gameId} with config:`, gameConfig);
        
        const game = {
            id: gameId,
            config: gameConfig,
            players: [],
            cookies: [],
            trapCookies: [],
            state: 'waiting',
            maze: this.generateMaze(gameConfig.mazeSize),
            createdAt: Date.now()
        };

        // Add methods to game object
        this.ensureGameMethods(game);

        // Generate initial cookies after maze is created
        game.cookies = this.generateInitialCookies(game);
        
        this.games.set(gameId, game);
        this.saveGames();
        
        return gameId;
    }

    getGame(gameId) {
        return this.games.get(gameId) || null;
    }

    cleanupOldGames() {
        const now = Date.now();
        const TWO_HOURS = 2 * 60 * 60 * 1000;

        for (const [gameId, game] of this.games.entries()) {
            if (now - game.createdAt > TWO_HOURS) {
                this.games.delete(gameId);
            }
        }
        this.saveGames();
    }

    generateMaze(size) {
        // Add 2 to size to ensure proper borders (1 extra on each side)
        const adjustedSize = (size % 2 === 0 ? size + 1 : size) + 2;
        
        // Initialize maze with walls, including extra border
        const maze = Array.from({ length: adjustedSize }, (_, i) => 
            Array(adjustedSize).fill(1)
        );

        const directions = [
            { dr: -2, dc: 0 }, // Up
            { dr: 2, dc: 0 },  // Down
            { dr: 0, dc: -2 }, // Left
            { dr: 0, dc: 2 }   // Right
        ];

        // Stack-based iterative implementation for better randomization
        function carvePath(startR, startC) {
            const stack = [{r: startR, c: startC}];
            maze[startR][startC] = 0;

            while (stack.length > 0) {
                const current = stack[stack.length - 1];
                const {r, c} = current;

                // Get all valid neighbors
                const validNeighbors = directions
                    .map(({dr, dc}) => ({
                        r: r + dr,
                        c: c + dc,
                        dr,
                        dc
                    }))
                    .filter(({r, c}) => 
                        r > 1 && r < adjustedSize - 2 && 
                        c > 1 && c < adjustedSize - 2 && 
                        maze[r][c] === 1
                    );

                if (validNeighbors.length > 0) {
                    // Choose random neighbor
                    const idx = Math.floor(Math.random() * validNeighbors.length);
                    const {r: nr, c: nc, dr, dc} = validNeighbors[idx];
                    
                    // Carve passage
                    maze[r + dr/2][c + dc/2] = 0;
                    maze[nr][nc] = 0;
                    
                    // Add to stack
                    stack.push({r: nr, c: nc});
                } else {
                    // Backtrack
                    stack.pop();
                }
            }
        }

        // Start from multiple points to create a more complex maze
        const numStartPoints = Math.floor((adjustedSize - 2) / 10) + 2;
        for (let i = 0; i < numStartPoints; i++) {
            const startR = 2 + 2 * Math.floor(Math.random() * ((adjustedSize - 5) / 2));
            const startC = 2 + 2 * Math.floor(Math.random() * ((adjustedSize - 5) / 2));
            if (maze[startR][startC] === 1) {
                carvePath(startR, startC);
            }
        }

        // Ensure start and end positions are accessible and have proper space
        // Player 1 start (top-left)
        maze[2][2] = 0;
        // Player 2 end (bottom-right)
        maze[adjustedSize-3][adjustedSize-3] = 0;

        // Connect disconnected regions
        for (let r = 2; r < adjustedSize - 2; r += 2) {
            for (let c = 2; c < adjustedSize - 2; c += 2) {
                if (maze[r][c] === 1) {
                    // If we find an isolated wall, connect it to a neighboring path
                    const neighbors = [
                        {r: r-1, c}, {r: r+1, c},
                        {r, c: c-1}, {r, c: c+1}
                    ].filter(({r, c}) => 
                        r > 1 && r < adjustedSize - 2 && 
                        c > 1 && c < adjustedSize - 2 && 
                        maze[r][c] === 0
                    );

                    if (neighbors.length > 0) {
                        const {r: nr, c: nc} = neighbors[Math.floor(Math.random() * neighbors.length)];
                        maze[r][c] = 0;
                        maze[(r + nr) / 2][(c + nc) / 2] = 0;
                    }
                }
            }
        }

        // Add a few strategic loops to make navigation more interesting
        const numLoops = Math.floor((adjustedSize - 2) / 12);
        for (let i = 0; i < numLoops; i++) {
            const r = 2 + 2 * Math.floor(Math.random() * ((adjustedSize - 5) / 2));
            const c = 2 + 2 * Math.floor(Math.random() * ((adjustedSize - 5) / 2));
            
            if (maze[r][c] === 1) {
                const wallCount = [
                    maze[r-1][c], maze[r+1][c],
                    maze[r][c-1], maze[r][c+1]
                ].filter(cell => cell === 1).length;
                
                // Only create a loop if it won't create a large open area
                if (wallCount >= 3) {
                    maze[r][c] = 0;
                }
            }
        }

        // Return maze without the extra border cells
        return maze.slice(1, -1).map(row => row.slice(1, -1));
    }

    generateInitialCookies(game) {
        const cookies = [];
        const { mazeSize, activeCookies } = game.config;
        
        while (cookies.length < activeCookies) {
            const x = Math.floor(Math.random() * (mazeSize - 2)) + 1;
            const y = Math.floor(Math.random() * (mazeSize - 2)) + 1;
            
            // Check if position is valid (not a wall and not already a cookie)
            if (game.maze[y][x] === 0 && !cookies.some(c => c.x === x && c.y === y)) {
                cookies.push({ x, y });
            }
        }
        
        return cookies;
    }

    addPlayer(gameId, playerId) {
        const game = this.getGame(gameId);
        if (!game || game.players.length >= 2) return null;

        const isFirstPlayer = game.players.length === 0;
        const position = isFirstPlayer ? 
            { x: 1, y: 1 } : // Player 1 starts top-left
            { x: game.config.mazeSize - 1, y: game.config.mazeSize - 1 }; // Player 2 starts bottom-right

        const player = {
            id: playerId,
            position,
            score: 0,
            lives: game.config.lives,
            lastTrapTime: 0
        };

        game.players.push(player);

        if (game.players.length === 2) {
            game.state = 'playing';
        }

        this.saveGames();
        return player;
    }

    movePlayer(gameId, playerId, direction) {
        const game = this.getGame(gameId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return false;

        const newPosition = { ...player.position };
        switch (direction) {
            case 'up':
                newPosition.y--;
                break;
            case 'down':
                newPosition.y++;
                break;
            case 'left':
                newPosition.x--;
                break;
            case 'right':
                newPosition.x++;
                break;
            default:
                return false;
        }

        // Check if new position is valid
        if (this.isValidMove(game, newPosition)) {
            player.position = newPosition;
            this.checkCookieCollection(game, player);
            this.saveGames();
            return true;
        }

        return false;
    }

    isValidMove(game, position) {
        return position.x >= 0 && 
               position.x < game.config.mazeSize &&
               position.y >= 0 && 
               position.y < game.config.mazeSize &&
               game.maze[position.y][position.x] === 0;
    }

    checkCookieCollection(game, player) {
        // Check normal cookies
        const cookieIndex = game.cookies.findIndex(
            c => c.x === player.position.x && c.y === player.position.y
        );

        if (cookieIndex !== -1) {
            game.cookies.splice(cookieIndex, 1);
            player.score++;
            this.addNewCookie(game);

            if (player.score >= game.config.cookiesToWin) {
                game.state = 'finished';
            }
            this.saveGames();
        }

        // Check trap cookies
        const trapIndex = game.trapCookies.findIndex(
            t => t.x === player.position.x && t.y === player.position.y
        );

        if (trapIndex !== -1) {
            game.trapCookies.splice(trapIndex, 1);
            player.lives--;

            if (player.lives <= 0) {
                game.state = 'finished';
            }
            this.saveGames();
        }
    }

    addNewCookie(game) {
        while (game.cookies.length < game.config.activeCookies) {
            const x = Math.floor(Math.random() * (game.config.mazeSize - 2)) + 1;
            const y = Math.floor(Math.random() * (game.config.mazeSize - 2)) + 1;

            if (game.maze[y][x] === 0 && 
                !game.cookies.some(c => c.x === x && c.y === y) &&
                !game.trapCookies.some(t => t.x === x && t.y === y) &&
                !game.players.some(p => p.position.x === x && p.position.y === y)) {
                game.cookies.push({ x, y });
            }
        }
        this.saveGames();
    }

    placeTrap(gameId, playerId) {
        const game = this.getGame(gameId);
        if (!game) return false;

        const player = game.players.find(p => p.id === playerId);
        if (!player) return false;

        const now = Date.now();
        if (now - player.lastTrapTime < game.config.trapCooldown) {
            return false;
        }

        // Check if position is already occupied
        const position = player.position;
        if (game.cookies.some(c => c.x === position.x && c.y === position.y) ||
            game.trapCookies.some(t => t.x === position.x && t.y === position.y)) {
            return false;
        }

        game.trapCookies.push({
            x: position.x,
            y: position.y,
            placedTime: now,
            placedBy: playerId
        });

        player.lastTrapTime = now;
        this.saveGames();
        return true;
    }
}

module.exports = { MazeManager };