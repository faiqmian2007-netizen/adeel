const { v4: uuidv4 } = require('uuid');
const FacebookBot = require('../services/FacebookBot');
const FacebookPostBot = require('../services/FacebookPostBot');

class Server {
  constructor(userId, config) {
    this.id = uuidv4();
    this.userId = userId;
    this.name = config.name || `Server ${Date.now()}`;
    this.serverType = config.serverType || 'messenger'; // 'messenger' or 'post'
    this.facebookCookie = config.facebookCookie;
    this.isMultiCookie = config.isMultiCookie || false;
    this.activeCookieCount = config.activeCookieCount || 1; // for multi-cookie management
    this.groupTid = config.groupTid; // for messenger servers
    this.postId = config.postId; // for post servers
    this.messageFile = config.messageFile;
    this.messages = config.messages || [];
    this.targetName = config.targetName || null;
    this.speed = config.speed || 1000; // milliseconds between messages
    this.status = 'stopped'; // stopped, running, error
    this.createdAt = new Date();
    this.lastActivity = null;
    this.logs = [];
    this.bot = null;
    this.io = null; // Socket.IO instance for real-time updates
  }

  setSocketIO(io) {
    this.io = io;
  }

  async start() {
    try {
      this.status = 'starting';
      this.lastActivity = new Date();
      
      if (this.serverType === 'post') {
        this.addLog('🔄 Starting Facebook post server...', 'info');
        this.broadcastUpdate();

        // Create and start Facebook post bot
        this.bot = new FacebookPostBot(
          this.id,
          {
            facebookCookie: this.facebookCookie,
            isMultiCookie: this.isMultiCookie,
            activeCookieCount: this.activeCookieCount,
            postId: this.postId,
            messageFile: this.messageFile,
            messages: this.messages,
            targetName: this.targetName,
            speed: this.speed
          },
          (message, type) => this.addLog(message, type),
          (error) => this.handleError(error)
        );

        await this.bot.start();
        this.addLog('✅ Post server started successfully and posting comments!', 'success');
      } else {
        this.addLog('🔄 Starting Facebook messaging server...', 'info');
        this.broadcastUpdate();

        // Create and start Facebook messenger bot
        this.bot = new FacebookBot(
          this.id,
          {
            facebookCookie: this.facebookCookie,
            isMultiCookie: this.isMultiCookie,
            groupTid: this.groupTid,
            messageFile: this.messageFile,
            messages: this.messages,
            targetName: this.targetName,
            speed: this.speed
          },
          (message, type) => this.addLog(message, type),
          (error) => this.handleError(error)
        );

        await this.bot.start();
        this.addLog('✅ Server started successfully and sending messages!', 'success');
      }
      
      this.status = 'running';
      this.broadcastUpdate();
      
    } catch (error) {
      this.status = 'error';
      this.addLog(`❌ Failed to start server: ${error.message}`, 'error');
      this.broadcastUpdate();
      throw error;
    }
  }

  stop() {
    this.status = 'stopped';
    this.lastActivity = new Date();
    
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
    }
    
    this.addLog('🛑 Server stopped', 'warning');
    this.broadcastUpdate();
  }

  async restart() {
    this.addLog('🔄 Restarting server...', 'info');
    this.stop();
    
    // Wait a moment before restarting
    setTimeout(async () => {
      try {
        await this.start();
      } catch (error) {
        this.addLog(`❌ Restart failed: ${error.message}`, 'error');
      }
    }, 2000);
  }

  handleError(error) {
    this.status = 'error';
    this.addLog(`❌ Error: ${error}`, 'error');
    this.broadcastUpdate();
  }

  addLog(message, type = 'info') {
    const logEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      message,
      type, // info, error, warning, success
    };
    
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
    
    // Broadcast log to real-time listeners
    if (this.io) {
      this.io.to(`server-${this.id}`).emit('serverLog', logEntry);
    }
    
    return logEntry;
  }

  broadcastUpdate() {
    if (this.io) {
      this.io.to(`user-${this.userId}`).emit('serverStatusUpdate', {
        serverId: this.id,
        status: this.status,
        lastActivity: this.lastActivity
      });
    }
  }

  getRecentLogs(limit = 50) {
    return this.logs.slice(-limit);
  }

  toJSON() {
    const botStatus = this.bot ? this.bot.getStatus() : null;
    
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      serverType: this.serverType,
      status: this.status,
      speed: this.speed,
      isMultiCookie: this.isMultiCookie,
      activeCookieCount: this.activeCookieCount,
      groupTid: this.groupTid,
      postId: this.postId,
      targetName: this.targetName,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      logsCount: this.logs.length,
      botStatus: botStatus
    };
  }
}

// Temporary in-memory storage (replace with database later)
class ServerStorage {
  constructor() {
    this.servers = new Map();
  }

  create(userId, config) {
    const server = new Server(userId, config);
    this.servers.set(server.id, server);
    return server;
  }

  findById(id) {
    return this.servers.get(id);
  }

  findByUserId(userId) {
    return Array.from(this.servers.values()).filter(server => server.userId === userId);
  }

  updateServer(id, updates) {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error('Server not found');
    }

    Object.assign(server, updates);
    return server;
  }

  deleteServer(id) {
    return this.servers.delete(id);
  }

  getAllServers() {
    return Array.from(this.servers.values());
  }
}

module.exports = { Server, ServerStorage };