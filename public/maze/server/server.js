const { v4: uuidv4 } = require('uuid');

class MazeManager {
    constructor(io, gamesFilePath, fs) {
        this.io = io;
        this.gamesFilePath = gamesFilePath;
        this.fs = fs;
        this.games = this.loadGames();
        this.defaultConfig = {
            cookiesToWin: 10,
            trapCooldown: 10,
            activeCookies: 5,
            mazeSize: 15,
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
            // Convert object to Map
            return new Map(Object.entries(gamesObj));
        } catch (err) {
            console.error('Error loading maze games:', err);
            return new Map();
        }
    }

    saveGames() {
        try {
            // Convert Map to object for JSON serialization
            const gamesObj = Object.fromEntries(this.games);
            const data = JSON.stringify(gamesObj);
            this.fs.writeFileSync(this.gamesFilePath, data);
        } catch (err) {
            console.error('Error saving maze games:', err);
        }
    }

    createGame(config = {}) {
        const gameId = uuidv4();
        const gameConfig = { ...this.defaultConfig, ...config };
        
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
        // Simple maze generation for now - we can improve this later
        const maze = Array(size).fill().map(() => Array(size).fill(1));
        
        // Create a border path
        for (let i = 0; i < size; i++) {
            maze[1][i] = 0; // Top path
            maze[size-2][i] = 0; // Bottom path
            maze[i][1] = 0; // Left path
            maze[i][size-2] = 0; // Right path
        }

        // Add some random paths
        for (let i = 2; i < size-2; i++) {
            for (let j = 2; j < size-2; j++) {
                if (Math.random() < 0.7) {
                    maze[i][j] = 0;
                }
            }
        }

        // Ensure starting positions are clear
        maze[1][1] = 0; // Player 1 start
        maze[size-2][size-2] = 0; // Player 2 start

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
        if (now - player.lastTrapTime < game.config.trapCooldown * 1000) {
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