// Dashboard management
class Dashboard {
    constructor() {
        this.socket = io();
        this.servers = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        // Require authentication
        if (!Auth.requireAuth()) return;

        // Check if user is approved
        this.checkApprovalStatus();
        
        this.setupEventListeners();
        this.authenticateSocket();
        this.loadUserProfile();
        this.loadServers();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('logoutBtn').addEventListener('click', () => {
            new Auth().logout();
        });

        document.getElementById('createServerBtn').addEventListener('click', () => {
            this.showServerSelectionModal();
        });

        // Server selection modal handlers
        document.getElementById('closeServerSelection')?.addEventListener('click', () => {
            this.hideServerSelectionModal();
        });

        document.getElementById('messengerServerOption')?.addEventListener('click', () => {
            window.location.href = 'create-server.html';
        });

        document.getElementById('postServerOption')?.addEventListener('click', () => {
            window.location.href = 'create-post-server.html';
        });

        document.getElementById('cookieCheckBtn').addEventListener('click', () => {
            window.location.href = 'cookie-check.html';
        });

        // Server filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Socket event listeners
        this.socket.on('serverStatusUpdate', (data) => {
            this.handleServerStatusUpdate(data);
        });

        this.socket.on('serverDeleted', (data) => {
            this.handleServerDeleted(data);
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.authenticateSocket();
        });

        this.socket.on('authError', (error) => {
            console.error('Socket authentication error:', error);
            new Auth().logout();
        });
    }

    authenticateSocket() {
        const token = localStorage.getItem('authToken');
        if (token) {
            this.socket.emit('authenticate', token);
        }
    }

    loadUserProfile() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        if (userData.name && userData.email) {
            document.getElementById('welcomeText').textContent = `Welcome, ${userData.name}`;
            document.getElementById('userName').textContent = userData.name;
            document.getElementById('userEmail').textContent = userData.email;
            
            // Generate initials
            const initials = userData.name.split(' ')
                .map(name => name[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            document.getElementById('userInitials').textContent = initials;
        }
    }

    async checkApprovalStatus() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            
            // If user is not approved, redirect to approval page
            if (userData.isApproved === false || userData.isApproved === undefined) {
                // Fetch fresh user data from server to double-check
                const token = localStorage.getItem('authToken');
                const response = await fetch('/api/auth/profile', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    
                    if (!data.user.isApproved) {
                        window.location.href = 'approval.html';
                        return;
                    }
                } else {
                    // If profile fetch fails, redirect to login
                    new Auth().logout();
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking approval status:', error);
            // If there's an error, redirect to approval page to be safe
            window.location.href = 'approval.html';
        }
    }

    async loadServers() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/servers', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.servers = data.servers;
                this.updateServerStats();
                this.renderServers();
            } else {
                throw new Error('Failed to load servers');
            }
        } catch (error) {
            console.error('Error loading servers:', error);
            this.showNotification('Failed to load servers', 'error');
        }
    }

    updateServerStats() {
        const totalServers = this.servers.length;
        const runningServers = this.servers.filter(s => s.status === 'running').length;
        
        document.getElementById('serverCount').textContent = totalServers;
        document.getElementById('runningCount').textContent = runningServers;
    }

    renderServers() {
        const serversGrid = document.getElementById('serversGrid');
        const emptyState = document.getElementById('emptyState');
        
        // Filter servers
        const filteredServers = this.servers.filter(server => {
            if (this.currentFilter === 'all') return true;
            return server.status === this.currentFilter;
        });

        if (filteredServers.length === 0) {
            emptyState.classList.remove('hidden');
            serversGrid.innerHTML = '';
            serversGrid.appendChild(emptyState);
            return;
        }

        emptyState.classList.add('hidden');
        
        serversGrid.innerHTML = filteredServers.map(server => this.createServerCard(server)).join('');
        
        // Add event listeners to server action buttons
        this.attachServerActionListeners();
    }

    createServerCard(server) {
        const statusClass = server.status === 'running' ? 'running' : 'stopped';
        const statusText = server.status.charAt(0).toUpperCase() + server.status.slice(1);
        const serverTypeIcon = server.serverType === 'post' ? '📝' : '💬';
        const serverTypeText = server.serverType === 'post' ? 'Post Server' : 'Messenger Server';
        const targetInfo = server.serverType === 'post' 
            ? `<p><strong>Post ID:</strong> ${server.postId || 'N/A'}</p>`
            : `<p><strong>Group TID:</strong> ${server.groupTid || 'N/A'}</p>`;
        
        return `
            <div class="server-card" data-server-id="${server.id}">
                <div class="server-header">
                    <div>
                        <div class="server-name">${server.name}</div>
                        <div class="server-type">${serverTypeIcon} ${serverTypeText}</div>
                        <div class="server-status ${statusClass}">${statusText}</div>
                    </div>
                </div>
                
                <div class="server-info">
                    ${targetInfo}
                    <p><strong>Speed:</strong> ${Math.round(server.speed/1000)}s between ${server.serverType === 'post' ? 'comments' : 'messages'}</p>
                    ${server.targetName ? `<p><strong>Target Name:</strong> ${server.targetName}</p>` : ''}
                    <p><strong>Created:</strong> ${new Date(server.createdAt).toLocaleDateString()}</p>
                    ${server.lastActivity ? `<p><strong>Last Activity:</strong> ${new Date(server.lastActivity).toLocaleString()}</p>` : ''}
                </div>
                
                <div class="server-actions">
                    ${server.status === 'stopped' 
                        ? `<button class="btn primary" data-action="start" data-server-id="${server.id}">Start</button>`
                        : `<button class="btn warning" data-action="stop" data-server-id="${server.id}">Stop</button>`
                    }
                    <button class="btn secondary" data-action="restart" data-server-id="${server.id}">Restart</button>
                    <button class="btn secondary" data-action="logs" data-server-id="${server.id}">View Logs</button>
                    <button class="btn danger" data-action="delete" data-server-id="${server.id}">Delete</button>
                </div>
            </div>
        `;
    }

    attachServerActionListeners() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const serverId = e.target.dataset.serverId;
                this.handleServerAction(action, serverId, e.target);
            });
        });
    }

    async handleServerAction(action, serverId, buttonEl) {
        const originalText = buttonEl.textContent;
        buttonEl.disabled = true;
        buttonEl.textContent = 'Loading...';

        try {
            const token = localStorage.getItem('authToken');
            
            switch (action) {
                case 'start':
                case 'stop':
                case 'restart':
                    await this.performServerAction(action, serverId, token);
                    break;
                case 'logs':
                    this.openLogsView(serverId);
                    break;
                case 'delete':
                    if (confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
                        await this.deleteServer(serverId, token);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error performing ${action}:`, error);
            this.showNotification(`Failed to ${action} server`, 'error');
        } finally {
            buttonEl.disabled = false;
            buttonEl.textContent = originalText;
        }
    }

    async performServerAction(action, serverId, token) {
        const response = await fetch(`/api/servers/${serverId}/${action}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            this.showNotification(`Server ${action}ed successfully`, 'success');
            // Server status will be updated via socket
        } else {
            throw new Error(`Failed to ${action} server`);
        }
    }

    async deleteServer(serverId, token) {
        const response = await fetch(`/api/servers/${serverId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            this.showNotification('Server deleted successfully', 'success');
            // Server will be removed from UI via socket
        } else {
            throw new Error('Failed to delete server');
        }
    }

    openLogsView(serverId) {
        // Get token from parent window to pass to popup
        const token = localStorage.getItem('authToken');
        if (!token) {
            this.showNotification('Authentication required. Please login again.', 'error');
            return;
        }
        
        // Show console in dashboard instead of new window
        this.showEmbeddedConsole(serverId, token);
    }

    showEmbeddedConsole(serverId, token) {
        const consoleSection = document.getElementById('consoleSection');
        const consoleTitle = document.getElementById('consoleTitle');
        const consoleStatus = document.getElementById('consoleStatus');
        const logsContainer = document.getElementById('logsContainer');
        
        // Show console section
        consoleSection.classList.remove('hidden');
        consoleTitle.textContent = `Server ${serverId} Console`;
        consoleStatus.textContent = 'connecting...';
        consoleStatus.className = 'console-status disconnected';
        
        // Clear previous logs
        logsContainer.innerHTML = '<div class="log-loading"><div class="spinner"></div><span>Loading logs...</span></div>';
        
        // Setup console controls if not already done
        this.setupConsoleControls();
        
        // Connect to live logs
        this.connectToLiveLogs(serverId, token);
    }

    setupConsoleControls() {
        const clearBtn = document.getElementById('consoleClearBtn');
        const closeBtn = document.getElementById('consoleCloseBtn');
        
        // Remove existing listeners to prevent duplicates
        clearBtn.removeEventListener('click', this.clearConsole);
        closeBtn.removeEventListener('click', this.closeConsole);
        
        // Add event listeners
        clearBtn.addEventListener('click', () => this.clearConsole());
        closeBtn.addEventListener('click', () => this.closeConsole());
    }

    clearConsole() {
        const logsContainer = document.getElementById('logsContainer');
        logsContainer.innerHTML = '<div class="log-entry info"><span class="timestamp">' + new Date().toLocaleTimeString() + '</span>Console cleared</div>';
    }

    closeConsole() {
        const consoleSection = document.getElementById('consoleSection');
        consoleSection.classList.add('hidden');
        
        // Disconnect from live logs if connected
        if (this.logsSocket) {
            this.logsSocket.disconnect();
            this.logsSocket = null;
        }
    }

    connectToLiveLogs(serverId, token) {
        const consoleStatus = document.getElementById('consoleStatus');
        const logsContainer = document.getElementById('logsContainer');
        
        try {
            // Create new socket for logs
            this.logsSocket = io();
            
            this.logsSocket.on('connect', () => {
                console.log('Connected to logs server');
                consoleStatus.textContent = 'connected';
                consoleStatus.className = 'console-status connected';
                
                // Authenticate  
                this.logsSocket.emit('authenticate', token);
                this.logsSocket.emit('joinServerRoom', serverId);
                
                // Load previous logs
                this.loadPreviousLogs(serverId, token);
            });

            this.logsSocket.on('disconnect', () => {
                console.log('Disconnected from logs server');
                consoleStatus.textContent = 'disconnected';
                consoleStatus.className = 'console-status disconnected';
            });

            this.logsSocket.on('serverLog', (logData) => {
                this.addLogEntry(logData);
            });

            this.logsSocket.on('authError', (error) => {
                console.error('Logs socket authentication error:', error);
                this.addLogEntry({
                    type: 'error',
                    message: 'Authentication failed',
                    timestamp: new Date()
                });
            });

        } catch (error) {
            console.error('Error connecting to logs:', error);
            consoleStatus.textContent = 'error';
            consoleStatus.className = 'console-status disconnected';
        }
    }

    async loadPreviousLogs(serverId, token) {
        const logsContainer = document.getElementById('logsContainer');
        
        try {
            const response = await fetch(`/api/servers/${serverId}/logs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const logs = await response.json();
                logsContainer.innerHTML = ''; // Clear loading
                
                if (logs.logs && logs.logs.length === 0) {
                    this.addLogEntry({
                        type: 'info',
                        message: '🚀 Console ready! Live logs will appear when server starts.',
                        timestamp: new Date()
                    });
                } else if (logs.logs && logs.logs.length > 0) {
                    logs.logs.forEach(log => this.addLogEntry(log));
                } else {
                    this.addLogEntry({
                        type: 'info',
                        message: '📡 Console initialized. Live logs will appear when server starts.',
                        timestamp: new Date()
                    });
                }
            } else {
                throw new Error('Failed to load previous logs');
            }
        } catch (error) {
            console.error('Error loading previous logs:', error);
            logsContainer.innerHTML = '';
            this.addLogEntry({
                type: 'info',
                message: '📡 Console initialized. Live logs will appear when server starts.',
                timestamp: new Date()
            });
        }
    }

    addLogEntry(logData) {
        const logsContainer = document.getElementById('logsContainer');
        const logEntry = document.createElement('div');
        
        // Determine log type from message content
        let logType = logData.type || 'info';
        if (logData.message.toLowerCase().includes('error')) {
            logType = 'error';
        } else if (logData.message.toLowerCase().includes('warning') || logData.message.toLowerCase().includes('warn')) {
            logType = 'warning';
        } else if (logData.message.toLowerCase().includes('success') || logData.message.toLowerCase().includes('started')) {
            logType = 'success';
        }
        
        logEntry.className = `log-entry ${logType}`;
        
        const timestamp = new Date(logData.timestamp).toLocaleTimeString();
        logEntry.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            ${logData.message}
        `;
        
        logsContainer.appendChild(logEntry);
        
        // Auto-scroll to bottom
        logsContainer.scrollTop = logsContainer.scrollHeight;
        
        // Limit logs to prevent memory issues (keep last 500 entries)
        const logEntries = logsContainer.querySelectorAll('.log-entry');
        if (logEntries.length > 500) {
            logEntries[0].remove();
        }
    }

    // Server management methods continue below...

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.renderServers();
    }

    handleServerStatusUpdate(data) {
        // Update server in local array
        const serverIndex = this.servers.findIndex(s => s.id === data.serverId);
        if (serverIndex !== -1) {
            this.servers[serverIndex].status = data.status;
            this.servers[serverIndex].lastActivity = new Date().toISOString();
            this.updateServerStats();
            this.renderServers();
        }
    }

    handleServerDeleted(data) {
        // Remove server from local array
        this.servers = this.servers.filter(s => s.id !== data.serverId);
        this.updateServerStats();
        this.renderServers();
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        const icon = notification.querySelector('.notification-icon');
        const messageEl = notification.querySelector('.notification-message');
        
        icon.textContent = type === 'success' ? '✅' : '❌';
        messageEl.textContent = message;
        notification.className = `notification ${type}`;
        
        // Show notification
        setTimeout(() => {
            notification.classList.remove('hidden');
        }, 100);
        
        // Hide after 4 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 4000);
    }

    showServerSelectionModal() {
        document.getElementById('serverSelectionModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    hideServerSelectionModal() {
        document.getElementById('serverSelectionModal').classList.add('hidden');
        document.body.style.overflow = 'auto'; // Restore scrolling
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});