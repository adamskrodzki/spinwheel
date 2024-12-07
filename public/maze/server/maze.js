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
            // Convert Map to object for JSON serialization
            const gamesObj = Object.fromEntries(this.games);
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
        // Create maze with walls (1) and ensure border is always walls
        const maze = Array.from({ length: size }, (_, i) => 
            Array(size).fill(1).map((_, j) => 
                (i === 0 || i === size-1 || j === 0 || j === size-1) ? 1 : 1
            )
        );

        const directions = [
            { dr: -2, dc: 0 }, // Up
            { dr: 2, dc: 0 },  // Down
            { dr: 0, dc: -2 }, // Left
            { dr: 0, dc: 2 }   // Right
        ];

        const carvePath = (r, c) => {
            maze[r][c] = 0; // Mark as path
            
            // Shuffle directions randomly
            const shuffledDirections = [...directions]
                .sort(() => Math.random() - 0.5);

            for (const { dr, dc } of shuffledDirections) {
                const nr = r + dr, nc = c + dc; // Neighbor cell
                // Ensure we don't carve into border walls
                if (nr > 1 && nr < size - 2 && nc > 1 && nc < size - 2 && maze[nr][nc] === 1) {
                    maze[r + dr/2][c + dc/2] = 0; // Remove wall between cells
                    carvePath(nr, nc);
                }
            }
        };

        // Start carving from (1, 1)
        carvePath(1, 1);

        // Ensure starting positions are clear
        maze[1][1] = 0; // Player 1 start
        maze[size-2][size-2] = 0; // Player 2 start

        // Create a winding path between start and end that respects walls
        let currentRow = 1;
        let currentCol = 1;
        const endRow = size - 2;
        const endCol = size - 2;
        
        while (currentRow < endRow || currentCol < endCol) {
            // Randomly choose whether to move horizontally or vertically when both are possible
            if (currentRow < endRow && currentCol < endCol) {
                if (Math.random() < 0.5) {
                    maze[currentRow + 1][currentCol] = 0;
                    currentRow++;
                } else {
                    maze[currentRow][currentCol + 1] = 0;
                    currentCol++;
                }
            } else if (currentRow < endRow) {
                maze[currentRow + 1][currentCol] = 0;
                currentRow++;
            } else if (currentCol < endCol) {
                maze[currentRow][currentCol + 1] = 0;
                currentCol++;
            }
        }

        // Add a small number of strategic shortcuts without creating large open areas
        const numShortcuts = Math.floor(size / 6); // Reduced number of shortcuts
        for (let i = 0; i < numShortcuts; i++) {
            const r = Math.floor(Math.random() * (size - 4)) + 2;
            const c = Math.floor(Math.random() * (size - 4)) + 2;
            
            // Only create a shortcut if surrounded by walls to prevent large open areas
            if (maze[r-1][c-1] === 1 && maze[r-1][c+1] === 1 && 
                maze[r+1][c-1] === 1 && maze[r+1][c+1] === 1) {
                maze[r][c] = 0;
            }
        }

        return maze;
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
            { x: game.config.mazeSize - 2, y: game.config.mazeSize - 2 }; // Player 2 starts bottom-right

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