const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const capsuleRoutes = require('./routes/capsules');
const memoryRoutes = require('./routes/memories');
const uploadRoutes = require('./routes/upload');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

// Import socket handlers
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = createServer(app);

// === 🔐 CORS configuration ===
const corsOptions = {
  origin: 'https://memory-client-neon.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // Apply CORS middleware
app.options('*', cors(corsOptions)); // Handle preflight requests globally

// === ⚡ Socket.io setup ===
const io = new Server(server, {
  cors: {
    origin: 'https://memory-client-neon.vercel.app',
    methods: ['GET', 'POST'],
  },
});

// === 🔐 Security middleware ===
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// === 🚨 Rate limiting ===
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// === 🧠 Body parsing ===
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === 🔗 Attach socket.io to requests ===
app.use((req, res, next) => {
  req.io = io;
  next();
});

// === 📘 Swagger UI ===
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Memoryscape API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      deepLinking: true,
    },
  })
);

// === 🏠 Root endpoint ===
app.get('/', (req, res) => {
  res.json({
    message: 'Memoryscape API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// === 📦 Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/capsules', authenticateToken, capsuleRoutes);
app.use('/api/memories', authenticateToken, memoryRoutes);
app.use('/api/upload', authenticateToken, uploadRoutes);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     description: Check if the server is running and healthy
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T12:00:00.000Z"
 *                 uptime:
 *                   type: number
 *                   example: 3600
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// === ❌ Error handling middleware ===
app.use(errorHandler);

// === 🔌 Socket.io connection handling ===
socketHandler(io);

// === 🌐 Database connection ===
const connectDB = require('./config/database');
connectDB();

// === 🧼 Graceful shutdown ===
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

// === 🚀 Start the server ===
const PORT = process.env.PORT || 8800;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📱 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`
  );
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
