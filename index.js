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

const PORT = process.env.PORT || 5000;
const BASE_PATH = process.env.BASE_PATH || '';

// Middleware
app.set('trust proxy', 1); // Trust first proxy for rate limiting

// AWS deployment friendly configuration
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Production helmet configuration - more permissive for AWS but still secure
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        baseUri: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
} else {
  // Development helmet configuration
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
}

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

// Static file headers and MIME types - simplified for AWS deployment
app.use((req, res, next) => {
  // Log only static file requests to reduce noise
  if (req.url.includes('/css/') || req.url.includes('/js/') || req.url.endsWith('.css') || req.url.endsWith('.js')) {
    console.log(`📁 Static file request: ${req.method} ${req.url}`);
  }
  
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Set proper MIME types for CSS and JS files
  if (req.url.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  } else if (req.url.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  } else if (req.url.match(/\.(png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year for images
  } else if (req.url.match(/\.(html|htm)$/)) {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Serve static files with proper configuration for AWS deployment
const staticOptions = {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Force proper MIME types for CSS and JS files
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    
    // Add additional headers for better compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
};

// Always serve static files from root for AWS compatibility
app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// If BASE_PATH is set, also serve from base path
if (BASE_PATH) {
  app.use(BASE_PATH, express.static(path.join(__dirname, 'public'), staticOptions));
}

// AWS deployment backup routes - completely bypass middleware
app.get('/css/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'public', 'css', filename);
  const fs = require('fs');
  
  console.log(`🎨 Direct CSS route hit: ${filename}`);
  console.log(`🎨 File path: ${filePath}`);
  console.log(`🎨 File exists: ${fs.existsSync(filePath)}`);
  
  // Clear all headers and set fresh ones
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  
  if (fs.existsSync(filePath)) {
    // Read file directly and send as text
    try {
      const cssContent = fs.readFileSync(filePath, 'utf8');
      console.log(`🎨 CSS file read successfully, length: ${cssContent.length}`);
      res.send(cssContent);
    } catch (error) {
      console.error(`🎨 Error reading CSS file:`, error);
      res.status(500).send('Error reading CSS file');
    }
  } else {
    console.log(`🎨 CSS file not found: ${filePath}`);
    res.status(404).send('CSS file not found');
  }
});

app.get('/js/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'public', 'js', filename);
  const fs = require('fs');
  
  console.log(`⚡ Direct JS route hit: ${filename}`);
  console.log(`⚡ File path: ${filePath}`);
  console.log(`⚡ File exists: ${fs.existsSync(filePath)}`);
  
  // Clear all headers and set fresh ones
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  
  if (fs.existsSync(filePath)) {
    // Read file directly and send as text
    try {
      const jsContent = fs.readFileSync(filePath, 'utf8');
      console.log(`⚡ JS file read successfully, length: ${jsContent.length}`);
      res.send(jsContent);
    } catch (error) {
      console.error(`⚡ Error reading JS file:`, error);
      res.status(500).send('Error reading JS file');
    }
  } else {
    console.log(`⚡ JS file not found: ${filePath}`);
    res.status(404).send('JS file not found');
  }
});

// Backup routes for static files with different paths
app.get('/static/css/:filename', (req, res) => {
  console.log(`🔄 Backup CSS route hit: ${req.params.filename}`);
  req.url = `/css/${req.params.filename}`;
  req.params.filename = req.params.filename;
  return app._router.handle(req, res);
});

app.get('/static/js/:filename', (req, res) => {
  console.log(`🔄 Backup JS route hit: ${req.params.filename}`);
  req.url = `/js/${req.params.filename}`;
  req.params.filename = req.params.filename;
  return app._router.handle(req, res);
});

// HTML processing function to fix asset paths for AWS deployment
function processHtmlForDeployment(htmlContent) {
  if (!BASE_PATH) return htmlContent;
  
  console.log(`🔧 Processing HTML with BASE_PATH: ${BASE_PATH}`);
  
  // Replace absolute asset paths with BASE_PATH-prefixed paths
  const basePath = BASE_PATH.startsWith('/') ? BASE_PATH : `/${BASE_PATH}`;
  
  // Fix CSS links
  htmlContent = htmlContent.replace(
    /href=["']\/css\//g, 
    `href="${basePath}/css/`
  );
  
  // Fix JS script sources
  htmlContent = htmlContent.replace(
    /src=["']\/js\//g, 
    `src="${basePath}/js/`
  );
  
  // Fix Socket.IO path
  htmlContent = htmlContent.replace(
    /src=["']\/socket\.io\//g, 
    `src="${basePath}/socket.io/`
  );
  
  // Add base tag for relative paths (if not already present)
  if (!htmlContent.includes('<base href=')) {
    const baseTag = `\n    <base href="${basePath}/">`;
    const headEndIndex = htmlContent.indexOf('</head>');
    
    if (headEndIndex !== -1) {
      htmlContent = htmlContent.slice(0, headEndIndex) + baseTag + htmlContent.slice(headEndIndex);
    }
  }
  
  console.log(`✅ HTML processed successfully with BASE_PATH`);
  return htmlContent;
}

// Enhanced HTML route serving with BASE_PATH support
function serveHtmlFile(filename) {
  return (req, res) => {
    const filePath = path.join(__dirname, 'public', filename);
    const fs = require('fs');
    
    console.log(`📄 Serving HTML file: ${filename} with BASE_PATH: ${BASE_PATH}`);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    try {
      let htmlContent = fs.readFileSync(filePath, 'utf8');
      
      // Process HTML for AWS deployment
      htmlContent = processHtmlForDeployment(htmlContent);
      
      res.send(htmlContent);
    } catch (error) {
      console.error(`Error reading HTML file ${filename}:`, error);
      res.status(404).send('Page not found');
    }
  };
}

// HTML routes - both at root and under BASE_PATH for AWS compatibility
const htmlRoutes = [
  { path: '/', file: 'index.html' },
  { path: '/admin', file: 'admin.html' },
  { path: '/login', file: 'login.html' },
  { path: '/register', file: 'register.html' },
  { path: '/dashboard', file: 'dashboard.html' },
  { path: '/create-server', file: 'create-server.html' },
  { path: '/create-post-server', file: 'create-post-server.html' },
  { path: '/cookie-check', file: 'cookie-check.html' },
  { path: '/approval', file: 'approval.html' }
];

// Mount HTML routes at root level
htmlRoutes.forEach(route => {
  app.get(route.path, serveHtmlFile(route.file));
});

// Mount HTML routes under BASE_PATH if specified (for AWS subpath deployment)
if (BASE_PATH) {
  console.log(`🔧 Mounting HTML routes under BASE_PATH: ${BASE_PATH}`);
  htmlRoutes.forEach(route => {
    const fullPath = `${BASE_PATH}${route.path}`;
    app.get(fullPath, serveHtmlFile(route.file));
    console.log(`📄 Route mounted: ${fullPath} -> ${route.file}`);
  });
}

// Make io accessible to routes
app.set('io', io);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server Manager API is running', timestamp: new Date().toISOString() });
});

// Comprehensive debug endpoint for AWS deployment troubleshooting
app.get('/api/debug', (req, res) => {
  const fs = require('fs');
  const publicPath = path.join(__dirname, 'public');
  const cssPath = path.join(publicPath, 'css');
  const jsPath = path.join(publicPath, 'js');
  
  try {
    const styleCSS = path.join(cssPath, 'style.css');
    const appJS = path.join(jsPath, 'app.js');
    
    res.json({
      server: {
        port: PORT,
        basePath: BASE_PATH,
        env: process.env.NODE_ENV || 'development',
        platform: process.platform,
        nodeVersion: process.version,
        isProduction: process.env.NODE_ENV === 'production'
      },
      paths: {
        __dirname: __dirname,
        publicPath: publicPath,
        cssPath: cssPath,
        jsPath: jsPath,
        styleCSS: styleCSS,
        appJS: appJS
      },
      directories: {
        publicExists: fs.existsSync(publicPath),
        cssExists: fs.existsSync(cssPath),
        jsExists: fs.existsSync(jsPath),
        cssFiles: fs.existsSync(cssPath) ? fs.readdirSync(cssPath) : [],
        jsFiles: fs.existsSync(jsPath) ? fs.readdirSync(jsPath) : []
      },
      fileChecks: {
        styleCSSExists: fs.existsSync(styleCSS),
        styleCSSSize: fs.existsSync(styleCSS) ? fs.statSync(styleCSS).size : 0,
        appJSExists: fs.existsSync(appJS),
        appJSSize: fs.existsSync(appJS) ? fs.statSync(appJS).size : 0
      },
      headers: {
        host: req.get('host'),
        userAgent: req.get('user-agent'),
        origin: req.get('origin'),
        referer: req.get('referer'),
        acceptEncoding: req.get('accept-encoding'),
        connection: req.get('connection')
      },
      testUrls: {
        css: `http://${req.get('host')}/css/style.css`,
        js: `http://${req.get('host')}/js/app.js`,
        testCSS: `http://${req.get('host')}/api/test-css`,
        backupCSS: `http://${req.get('host')}/static/css/style.css`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
});

// Simple CSS test endpoint
app.get('/api/test-css', (req, res) => {
  const cssFile = path.join(__dirname, 'public', 'css', 'style.css');
  const fs = require('fs');
  
  if (fs.existsSync(cssFile)) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(cssFile);
  } else {
    res.status(404).json({ error: 'CSS file not found', path: cssFile });
  }
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
