const express = require('express');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const createWheelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many wheels created from this IP, please try again after a minute.' }
});

function setupRoutes(app, wheelManager) {
  app.post('/spinwheel/create-wheel', createWheelLimiter, (req, res) => {
    let { segments } = req.body;

    if (!segments || !Array.isArray(segments) || segments.length < 2) {
      return res.status(400).json({ error: 'Invalid segments. Provide an array with at least two segments.' });
    }

    segments = segments.map(seg => sanitizeHtml(seg));
    const wheelId = uuidv4();
    wheelManager.wheels[wheelId] = wheelManager.createWheel(segments);
    wheelManager.saveWheels();

    res.json({ wheelId });
  });

  app.get('/spinwheel/wheel-config/:wheelId', (req, res) => {
    const { wheelId } = req.params;
    const wheel = wheelManager.wheels[wheelId];

    if (wheel) {
      res.json({
        segments: wheel.segments,
        colors: wheel.colors,
        currentAngle: wheel.currentAngle
      });
    } else {
      res.status(404).json({ error: 'Wheel not found' });
    }
  });

  app.get('/spinwheel/create', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'creator.html'));
  });

  app.get('/spinwheel/wheel/:wheelId', (req, res) => {
    const { wheelId } = req.params;
    if (wheelManager.wheels[wheelId]) {
      res.sendFile(path.join(__dirname, '..', 'viewer.html'));
    } else {
      res.status(404).send('Wheel not found');
    }
  });
}

module.exports = setupRoutes;