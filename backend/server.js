require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const routes = require('./routes');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 5002;
const HOST = process.env.HOST || '127.0.0.1';

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Initialize database
db.init();

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`Stock Prediction API running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Initialize scheduler for predictions
  scheduler.initializeScheduler();
});

server.on('error', (error) => {
  console.error(`Failed to start server on ${HOST}:${PORT}:`, error);
});

module.exports = app;
