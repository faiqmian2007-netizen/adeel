const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1); // Trust first proxy for rate limiting

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"]
    }
  }
}));

app.use(cors());

// JSON parsing for specific routes only (not for file uploads)
app.use('/api/auth', express.json({ limit: '10mb' }));
app.use('/api/admin', express.json({ limit: '10mb' }));
app.use('/api/cookies', express.json({ limit: '10mb' }));

// URL encoded for form data
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static('public'));

// Cache control headers for better performance
app.use((req, res, next) => {
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.set({
      'Cache-Control': 'public, max-age=31536000'
    });
  } else {
    res.set({
      'Cache-Control': 'no-cache'
    });
  }
  next();
});

// Basic route for testing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Make io accessible to routes
app.set('io', io);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server Manager API is running', timestamp: new Date().toISOString() });
});

// Import and use route handlers
const { router: authRouter } = require('./routes/auth');
const { router: serverRouter } = require('./routes/servers');
const { router: cookieRouter } = require('./routes/cookies');
const adminRouter = require('./routes/admin');

app.use('/api/auth', authRouter);
app.use('/api/servers', serverRouter);
app.use('/api/cookies', cookieRouter);
app.use('/api/admin', adminRouter);

// Socket.IO for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle user authentication for Socket.IO
  socket.on('authenticate', (token) => {
    try {
      const { verifyToken } = require('./middleware/auth');
      const decoded = verifyToken(token);
      socket.userId = decoded.userId;
      socket.join(`user-${decoded.userId}`);
      console.log(`User ${decoded.userId} authenticated and joined room`);
    } catch (error) {
      socket.emit('authError', 'Invalid token');
    }
  });

  // Handle joining server-specific rooms for live logs
  socket.on('joinServerRoom', (serverId) => {
    if (socket.userId) {
      socket.join(`server-${serverId}`);
      console.log(`User ${socket.userId} joined server room: ${serverId}`);
    }
  });

  socket.on('leaveServerRoom', (serverId) => {
    socket.leave(`server-${serverId}`);
    console.log(`User left server room: ${serverId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server Manager running on port ${PORT}`);
  console.log(`🌐 Server accessible on all network interfaces`);
  console.log(`📊 Ready for production deployment`);
});
