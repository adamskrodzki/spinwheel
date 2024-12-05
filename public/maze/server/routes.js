function setupMazeRoutes(app, mazeManager) {
    // Create a new game
    app.post('/maze/create', (req, res) => {
        const config = req.body;
        const gameId = mazeManager.createGame(config);
        res.json({
            gameId,
            urls: {
                viewer: `/maze/view/${gameId}`,
                player1: `/maze/player1/${gameId}`,
                player2: `/maze/player2/${gameId}`
            }
        });
    });

    // Serve game pages
    app.get('/maze/view/:gameId', (req, res) => {
        res.sendFile('viewer.html', { root: './public/maze' });
    });

    app.get('/maze/player1/:gameId', (req, res) => {
        res.sendFile('player.html', { root: './public/maze' });
    });

    app.get('/maze/player2/:gameId', (req, res) => {
        res.sendFile('player.html', { root: './public/maze' });
    });
}

module.exports = setupMazeRoutes;