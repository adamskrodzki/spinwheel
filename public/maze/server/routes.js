const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const createGameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many games created from this IP, please try again after a minute.' }
});

function setupMazeRoutes(app, mazeManager) {
  // Serve the game creation page
  app.get('/maze/create', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'creator.html'));
  });

  // Create a new game instance
  app.post('/maze/create', createGameLimiter, (req, res) => {
    const config = {
      cookiesToWin: parseInt(req.body.cookiesToWin) || 10,
      trapCooldown: parseInt(req.body.trapCooldown) || 10,
      activeCookies: parseInt(req.body.activeCookies) || 5,
      mazeSize: parseInt(req.body.mazeSize) || 15,
      lives: parseInt(req.body.lives) || 3,
      viewRadius: parseInt(req.body.viewRadius) || 5
    };

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

  // Get game configuration
  app.get('/maze/game-config/:gameId', (req, res) => {
    const { gameId } = req.params;
    const game = mazeManager.getGame(gameId);

    if (game) {
      res.json({
        config: game.config,
        state: game.state,
        playerCount: game.players.length
      });
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  });

  // Serve the viewer page
  app.get('/maze/view/:gameId', (req, res) => {
    const { gameId } = req.params;
    if (mazeManager.getGame(gameId)) {
      res.sendFile(path.join(__dirname, '..', 'viewer.html'));
    } else {
      res.status(404).send('Game not found');
    }
  });

  // Serve player pages
  app.get('/maze/player1/:gameId', (req, res) => {
    const { gameId } = req.params;
    if (mazeManager.getGame(gameId)) {
      res.sendFile(path.join(__dirname, '..', 'player.html'));
    } else {
      res.status(404).send('Game not found');
    }
  });

  app.get('/maze/player2/:gameId', (req, res) => {
    const { gameId } = req.params;
    if (mazeManager.getGame(gameId)) {
      res.sendFile(path.join(__dirname, '..', 'player.html'));
    } else {
      res.status(404).send('Game not found');
    }
  });
}

module.exports = setupMazeRoutes;