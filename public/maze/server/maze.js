class MazeManager {
    constructor(io) {
        this.io = io;
        this.games = new Map();
        this.defaultConfig = {
            cookiesToWin: 10,
            trapCooldown: 10,
            activeCookies: 5,
            mazeSize: 15,
            lives: 3,
            viewRadius: 5
        };
    }

    createGame(config = {}) {
        const gameId = this.generateGameId();
        const gameConfig = { ...this.defaultConfig, ...config };
        
        this.games.set(gameId, {
            id: gameId,
            config: gameConfig,
            players: [],
            cookies: [],
            trapCookies: [],
            state: 'waiting', // waiting, playing, finished
            maze: this.generateMaze(gameConfig.mazeSize)
        });
        
        return gameId;
    }

    generateGameId() {
        return Math.random().toString(36).substring(2, 8);
    }

    generateMaze(size) {
        // TODO: Implement maze generation algorithm
        return Array(size).fill().map(() => Array(size).fill(1));
    }

    joinGame(gameId, playerId) {
        const game = this.games.get(gameId);
        if (!game) return null;
        if (game.players.length >= 2) return null;
        
        game.players.push({
            id: playerId,
            position: { x: 1, y: 1 },
            score: 0,
            lives: game.config.lives,
            lastTrapTime: 0
        });
        
        return game;
    }

    // Add more game management methods here
}

module.exports = { MazeManager };