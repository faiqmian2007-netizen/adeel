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

const PORT = process.env.PORT || 4000;
const BASE_PATH = process.env.BASE_PATH || ''; // For sub-directory deployments if needed

// Trust proxy (for AWS/production)
app.set('trust proxy', 1);

// Security headers
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

// CORS
app.use(cors());

// Body parsers for APIs
app.use('/api/auth', express.json({ limit: '10mb' }));
app.use('/api/admin', express.json({ limit: '10mb' }));
app.use('/api/cookies', express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for APIs
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Static file headers (MIME types, cache)
app.use((req, res, next) => {
  if (req.url.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  } else if (req.url.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  } else if (req.url.match(/\.(png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  } else if (req.url.match(/\.(html|htm)$/)) {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Serve static files (CSS, JS, images, HTML)
const staticOptions = {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
};

if (BASE_PATH) {
  app.use(BASE_PATH, express.static(path.join(__dirname, 'public'), staticOptions));
} else {
  app.use(express.static(path.join(__dirname, 'public'), staticOptions));
}

// Explicit CSS/JS routes for external compatibility
app.get('/css/:filename', (req, res) => {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'css', req.params.filename));
});
app.get('/js/:filename', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'js', req.params.filename));
});

// HTML page routes
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/admin', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Example: Serve other HTML pages dynamically if needed
const extraHtmlPages = [
  'dashboard', 'login', 'register', 'cookie-check', 'approval', 'create-server', 'create-post-server'
];
extraHtmlPages.forEach(page =>
  app.get(`/${page}`, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  })
);

// Make io accessible in routes
app.set('io', io);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server Manager API is running', timestamp: new Date().toISOString() });
});

// Import and use API routes
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

  socket.on('authenticate', (token) => {
    try {
      const { verifyToken } = require('./middleware/auth');
      const decoded = verifyToken(token);
      socket.userId = decoded.userId;
      socket.join(`user-${decoded.userId}`);
      console.log(`User ${decoded.userId} authenticated and joined room`);
    } catch {
      socket.emit('authError', 'Invalid token');
    }
  });

  socket.on('joinServerRoom', (serverId) => {
    if (socket.userId) {
      socket.join(`server-${serverId}`);
      console.log(`User ${socket.userId} joined server room: ${serverId}`);
    }
  });

  socket.on('leaveServerRoom', (serverId) => {
    socket.leave(`server-${serverId}`);
    console.log('User left server room:', serverId);
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
