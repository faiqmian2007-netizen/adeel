const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { ServerStorage } = require('../models/Server');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const serverStorage = new ServerStorage();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || path.extname(file.originalname).toLowerCase() === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  }
});

// Support multiple file types
const multiUpload = upload.fields([{ name: 'messageFile', maxCount: 1 }, { name: 'cookieFile', maxCount: 1 }]);

// Get all servers for authenticated user
router.get('/', authenticate, (req, res) => {
  try {
    const servers = serverStorage.findByUserId(req.userId);
    res.json({ servers: servers.map(server => server.toJSON()) });
  } catch (error) {
    console.error('Get servers error:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Create new post server
router.post('/create-post', authenticate, multiUpload, async (req, res) => {
  try {
    const { facebookCookie, postId, speed, name, messageContent, targetName, serverType, activeCookieCount } = req.body;

    // Validation for basic fields
    if (!postId || !name) {
      return res.status(400).json({ error: 'Server name and Post ID are required' });
    }

    // Handle cookie data (single cookie or multi cookie file)
    let cookieData = null;
    let isMultiCookie = false;
    
    if (req.files && req.files.cookieFile) {
      // Multi-cookie file uploaded
      const cookieFilePath = req.files.cookieFile[0].path;
      const cookieFileContent = await fs.readFile(cookieFilePath, 'utf8');
      cookieData = cookieFileContent.split('\n').filter(cookie => cookie.trim()).map(cookie => cookie.trim());
      isMultiCookie = true;
      
      // Validate that we have at least one cookie
      if (cookieData.length === 0) {
        await fs.unlink(cookieFilePath).catch(console.error);
        return res.status(400).json({ error: 'Cookie file is empty or contains no valid cookies' });
      }
      
      // Clean up the temp file
      await fs.unlink(cookieFilePath).catch(console.error);
    } else if (facebookCookie) {
      // Single cookie provided
      cookieData = facebookCookie.trim();
      isMultiCookie = false;
    } else {
      return res.status(400).json({ error: 'Facebook cookie or cookie file is required' });
    }

    // Handle message data (file upload or paste content)
    let messageFilePath = null;
    let messages = [];
    
    if (req.files && req.files.messageFile) {
      // Message file uploaded
      messageFilePath = req.files.messageFile[0].path;
      const messageFileContent = await fs.readFile(messageFilePath, 'utf8');
      messages = messageFileContent.split('\n').filter(msg => msg.trim()).map(msg => msg.trim());
      
      // Clean up the temp file
      await fs.unlink(messageFilePath).catch(console.error);
    } else if (messageContent) {
      // Message content pasted
      messages = messageContent.split('\n').filter(msg => msg.trim()).map(msg => msg.trim());
    } else {
      return res.status(400).json({ error: 'Comment file or comment content is required' });
    }
    
    // Validate and clamp activeCookieCount for multi-cookie mode
    let finalActiveCookieCount = 1;
    if (isMultiCookie && Array.isArray(cookieData)) {
      const n = Number(activeCookieCount);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Active cookie count must be a positive integer (minimum 1)' });
      }
      finalActiveCookieCount = Math.min(n, cookieData.length);
    }
    
    // Don't add target name prefix here - let the bot handle it
    const serverConfig = {
      name: name || `Post Server ${Date.now()}`,
      serverType: 'post',
      facebookCookie: cookieData,
      isMultiCookie,
      activeCookieCount: finalActiveCookieCount,
      postId,
      messageFile: messageFilePath,
      messages,
      speed: parseInt(speed) || 1000,
      targetName: targetName || null
    };

    const server = serverStorage.create(req.userId, serverConfig);
    
    // Set Socket.IO instance for real-time updates
    server.setSocketIO(req.app.get('io'));
    
    // Auto-start the post server
    try {
      await server.start();
      res.status(201).json({
        message: 'Post server created and started successfully',
        server: server.toJSON()
      });
    } catch (startError) {
      console.error('Failed to start post server:', startError);
      res.status(201).json({
        message: 'Post server created but failed to start',
        server: server.toJSON(),
        startError: startError.message
      });
    }

  } catch (error) {
    console.error('Post server creation error:', error);
    res.status(500).json({ error: 'Failed to create post server: ' + error.message });
  }
});

// Create new messenger server
router.post('/', authenticate, multiUpload, async (req, res) => {
  try {
    const { facebookCookie, groupTid, speed, name, messageContent, targetName, activeCookieCount } = req.body;

    // Validation for basic fields
    if (!groupTid || !name) {
      return res.status(400).json({ error: 'Server name and Group TID are required' });
    }

    // Handle cookie data (single cookie or multi cookie file)
    let cookieData = null;
    let isMultiCookie = false;
    
    if (req.files && req.files.cookieFile) {
      // Multi-cookie file uploaded
      const cookieFilePath = req.files.cookieFile[0].path;
      const cookieFileContent = await fs.readFile(cookieFilePath, 'utf8');
      cookieData = cookieFileContent.split('\n').filter(cookie => cookie.trim()).map(cookie => cookie.trim());
      isMultiCookie = true;
      
      // Validate that we have at least one cookie
      if (cookieData.length === 0) {
        await fs.unlink(cookieFilePath).catch(console.error);
        return res.status(400).json({ error: 'Cookie file is empty or contains no valid cookies' });
      }
      
      // Clean up the temp file
      await fs.unlink(cookieFilePath).catch(console.error);
    } else if (facebookCookie) {
      // Single cookie provided
      cookieData = facebookCookie.trim();
      isMultiCookie = false;
    } else {
      return res.status(400).json({ error: 'Facebook cookie or cookie file is required' });
    }
    
    // Validate and clamp activeCookieCount for multi-cookie mode
    let finalActiveCookieCount = 1;
    if (isMultiCookie && Array.isArray(cookieData)) {
      const n = Number(activeCookieCount);
      if (!Number.isInteger(n) || n < 1) {
        finalActiveCookieCount = 1;
      } else {
        finalActiveCookieCount = Math.min(n, cookieData.length);
      }
    }

    // Handle message data (file upload or paste content)
    let messageFilePath = null;
    let messages = [];
    
    if (req.files && req.files.messageFile) {
      // Message file uploaded
      messageFilePath = req.files.messageFile[0].path;
      const messageFileContent = await fs.readFile(messageFilePath, 'utf8');
      messages = messageFileContent.split('\n').filter(msg => msg.trim()).map(msg => msg.trim());
    } else if (messageContent) {
      // Message content pasted
      messages = messageContent.split('\n').filter(msg => msg.trim()).map(msg => msg.trim());
    } else {
      return res.status(400).json({ error: 'Message file or message content is required' });
    }
    
    // Add target name prefix if provided (avoid duplicates)
    if (targetName && targetName.trim()) {
      const prefix = targetName.trim();
      messages = messages.map(msg => {
        // Check if message already starts with the target name
        const prefixWithColon = `${prefix}:`;
        if (msg.toLowerCase().startsWith(prefixWithColon.toLowerCase())) {
          return msg; // Already has prefix, don't add again
        }
        return `${prefix}: ${msg}`;
      });
    }

    const serverConfig = {
      name: name || `Server ${Date.now()}`,
      serverType: 'messenger', // Explicitly set as messenger server
      facebookCookie: cookieData,
      isMultiCookie,
      activeCookieCount: finalActiveCookieCount,
      groupTid,
      messageFile: messageFilePath,
      messages,
      speed: parseInt(speed) || 1000,
      targetName: targetName || null
    };

    const server = serverStorage.create(req.userId, serverConfig);
    
    // Set Socket.IO instance for real-time updates
    server.setSocketIO(req.app.get('io'));
    
    res.status(201).json({
      message: 'Server created successfully',
      server: server.toJSON()
    });

  } catch (error) {
    console.error('Server creation error:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// Get specific server
router.get('/:id', authenticate, (req, res) => {
  try {
    const server = serverStorage.findById(req.params.id);
    
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (server.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ server: server.toJSON() });
  } catch (error) {
    console.error('Get server error:', error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// Start server
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const server = serverStorage.findById(req.params.id);
    
    if (!server || server.userId !== req.userId) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Set Socket.IO instance if not already set
    if (!server.io) {
      server.setSocketIO(req.app.get('io'));
    }

    await server.start();

    res.json({ message: 'Server started successfully', server: server.toJSON() });
  } catch (error) {
    console.error('Start server error:', error);
    res.status(500).json({ error: error.message || 'Failed to start server' });
  }
});

// Stop server
router.post('/:id/stop', authenticate, (req, res) => {
  try {
    const server = serverStorage.findById(req.params.id);
    
    if (!server || server.userId !== req.userId) {
      return res.status(404).json({ error: 'Server not found' });
    }

    server.stop();

    res.json({ message: 'Server stopped successfully', server: server.toJSON() });
  } catch (error) {
    console.error('Stop server error:', error);
    res.status(500).json({ error: 'Failed to stop server' });
  }
});

// Restart server
router.post('/:id/restart', authenticate, async (req, res) => {
  try {
    const server = serverStorage.findById(req.params.id);
    
    if (!server || server.userId !== req.userId) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Set Socket.IO instance if not already set
    if (!server.io) {
      server.setSocketIO(req.app.get('io'));
    }

    await server.restart();

    res.json({ message: 'Server restarted successfully', server: server.toJSON() });
  } catch (error) {
    console.error('Restart server error:', error);
    res.status(500).json({ error: 'Failed to restart server' });
  }
});

// Delete server
router.delete('/:id', authenticate, (req, res) => {
  try {
    const server = serverStorage.findById(req.params.id);
    
    if (!server || server.userId !== req.userId) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Stop server first if running
    if (server.status === 'running') {
      server.stop();
    }

    serverStorage.deleteServer(req.params.id);
    
    // Emit real-time update
    req.app.get('io').to(`user-${req.userId}`).emit('serverDeleted', {
      serverId: req.params.id
    });

    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    console.error('Delete server error:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// Get server logs
router.get('/:id/logs', authenticate, (req, res) => {
  try {
    const server = serverStorage.findById(req.params.id);
    
    if (!server || server.userId !== req.userId) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const logs = server.getRecentLogs(limit);
    
    res.json({ logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = { router, serverStorage };