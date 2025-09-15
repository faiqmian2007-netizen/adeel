const { login } = require('ws3-fca');
const fs = require('fs').promises;
const path = require('path');

class FacebookBot {
    constructor(serverId, config, onLog, onError) {
        this.serverId = serverId;
        this.config = config;
        this.onLog = onLog;
        this.onError = onError;
        this.api = null;
        this.isRunning = false;
        this.messageInterval = null;
        this.messages = [];
        this.currentMessageIndex = 0;
        
        // Multi-cookie management
        this.currentActiveCookies = [];
        this.currentBackupCookies = [];
        this.cookieFailureCounts = [];
        this.currentCookieIndex = 0;
        
        // Send lock to prevent overlapping sends
        this.isSending = false;
    }

    async start() {
        try {
            this.onLog('🔄 Starting Facebook bot...', 'info');
            
            // Load messages
            await this.loadMessages();

            // Handle both single cookie and multi-cookie scenarios with advanced system
            let cookieData = this.config.facebookCookie;
            
            if (this.config.isMultiCookie && Array.isArray(cookieData)) {
                this.onLog(`🍪 Multi-cookie mode: ${cookieData.length} cookies provided`, 'info');
                
                // Setup advanced cookie management system
                await this.setupAdvancedCookieSystem(cookieData);
                
                // Use first active cookie to start
                cookieData = this.currentActiveCookies[0];
                this.onLog(`📊 Active cookies: ${this.currentActiveCookies.length}, Backup cookies: ${this.currentBackupCookies.length}`, 'info');
            } else {
                cookieData = cookieData.trim();
                this.onLog('📝 Processing single Facebook cookie...', 'info');
                
                // For single cookies, setup simple system
                this.currentActiveCookies = [cookieData];
                this.currentBackupCookies = [];
                this.cookieFailureCounts = [0];
                this.currentCookieIndex = 0;
            }

            // Login to Facebook
            this.onLog('🔑 Logging into Facebook...', 'info');
            
            await new Promise((resolve, reject) => {
                // Pass cookie string directly to ws3-fca
                login(cookieData, (err, api) => {
                    if (err) {
                        this.onError(`Facebook login failed: ${err.message}`);
                        return reject(err);
                    }

                    this.api = api;
                    this.onLog('✅ Successfully logged into Facebook!', 'success');
                    
                    // Set options
                    api.setOptions({
                        logLevel: "silent",
                        forceLogin: true,
                        autoMarkDelivery: false,
                        autoMarkRead: false,
                        selfListen: false
                    });

                    resolve();
                });
            });

            // Start message sending
            this.isRunning = true;
            this.startMessageSending();
            const speedInSeconds = Math.round(this.config.speed / 1000);
            this.onLog(`🚀 Bot started! Sending messages every ${speedInSeconds} seconds`, 'success');
            
        } catch (error) {
            this.onError(`Failed to start bot: ${error.message}`);
            throw error;
        }
    }




    async loadMessages() {
        try {
            // Check if messages are provided directly (from paste content)
            if (this.config.messages && Array.isArray(this.config.messages)) {
                this.messages = this.config.messages.filter(msg => msg.trim().length > 0);
                this.onLog(`📝 Loaded ${this.messages.length} messages from content`, 'info');
            } else if (this.config.messageFile) {
                // Load from file (traditional method)
                const filePath = path.resolve(this.config.messageFile);
                const fileContent = await fs.readFile(filePath, 'utf8');
                
                // Split by lines and filter empty lines
                this.messages = fileContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                    
                this.onLog(`📄 Loaded ${this.messages.length} messages from file`, 'info');
            } else {
                throw new Error('No messages provided - either messageFile or messages array required');
            }

            if (this.messages.length === 0) {
                throw new Error('No valid messages found');
            }
            
        } catch (error) {
            throw new Error(`Failed to load messages: ${error.message}`);
        }
    }

    parseCookieString(cookieString) {
        try {
            const cookies = [];
            const pairs = cookieString.split(';');
            
            for (const pair of pairs) {
                const [name, value] = pair.split('=').map(s => s.trim());
                if (name && value) {
                    cookies.push({
                        key: name,
                        value: value,
                        domain: '.facebook.com',
                        path: '/',
                        hostOnly: false,
                        creation: new Date(),
                        lastAccessed: new Date()
                    });
                }
            }

            // Check for required cookies
            const requiredCookies = ['c_user', 'xs'];
            const foundCookies = cookies.map(c => c.key);
            
            for (const required of requiredCookies) {
                if (!foundCookies.includes(required)) {
                    throw new Error(`Missing required cookie: ${required}`);
                }
            }

            return cookies;
        } catch (error) {
            throw new Error(`Invalid cookie format: ${error.message}`);
        }
    }

    startMessageSending() {
        if (!this.isRunning || this.messages.length === 0) return;

        this.messageInterval = setInterval(async () => {
            // Prevent overlapping sends with lock
            if (this.isSending) {
                this.onLog('⏳ Previous message still sending, skipping this interval...', 'warning');
                return;
            }
            
            try {
                this.isSending = true;
                await this.sendNextMessage();
            } catch (error) {
                this.onError(`Message sending error: ${error.message}`);
            } finally {
                this.isSending = false;
            }
        }, this.config.speed);
    }

    async sendNextMessage() {
        if (!this.isRunning || !this.api) return;

        const message = this.messages[this.currentMessageIndex];
        
        try {
            this.onLog(`📤 Sending message ${this.currentMessageIndex + 1}/${this.messages.length}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`, 'info');
            
            await new Promise((resolve, reject) => {
                this.api.sendMessage(message, this.config.groupTid, (err, messageInfo) => {
                    if (err) {
                        reject(new Error(err.message || 'Failed to send message'));
                        return;
                    }
                    
                    resolve(messageInfo);
                });
            });

            this.onLog(`✅ Message sent successfully!`, 'success');
            
            // Move to next message
            this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messages.length;
            
            // If we've sent all messages, restart from beginning
            if (this.currentMessageIndex === 0) {
                this.onLog(`🔄 Completed all messages, restarting from beginning...`, 'info');
            }
            
        } catch (error) {
            this.onError(`Failed to send message: ${error.message}`);
            
            // Use advanced cookie management if available
            if (this.currentActiveCookies && this.currentActiveCookies.length > 0) {
                this.cookieFailureCounts[this.currentCookieIndex]++;
                this.onLog(`❌ Cookie ${this.currentCookieIndex + 1} failed. Failure count: ${this.cookieFailureCounts[this.currentCookieIndex]}`, 'warning');

                // Try backup if cookie failed too many times
                if (this.cookieFailureCounts[this.currentCookieIndex] >= 3 && this.currentBackupCookies.length > 0) {
                    this.onLog('🔄 Trying backup cookie due to repeated failures...', 'warning');
                    await this.replaceCookieWithBackup();
                } else if (this.currentActiveCookies.length > 1) {
                    this.onLog('🔄 Switching to next active cookie...', 'warning');
                    await this.switchToNextCookie();
                } else {
                    this.onError('🚨 All cookies exhausted. Stopping bot...');
                    this.stop();
                }
            }
        }
    }

    stop() {
        this.isRunning = false;
        
        if (this.messageInterval) {
            clearInterval(this.messageInterval);
            this.messageInterval = null;
        }

        if (this.api) {
            try {
                this.api.logout();
            } catch (error) {
                console.error('Error during logout:', error);
            }
            this.api = null;
        }

        this.onLog('🛑 Bot stopped', 'warning');
    }

    restart() {
        this.onLog('🔄 Restarting bot...', 'info');
        this.stop();
        
        // Wait a moment before restarting
        setTimeout(() => {
            this.start().catch(error => {
                this.onError(`Restart failed: ${error.message}`);
            });
        }, 2000);
    }

    async setupAdvancedCookieSystem(allCookies) {
        // Get active cookie count from config (default to 1 if not specified)
        const activeCookieCount = Math.min(
            this.config.activeCookieCount || 1,
            allCookies.length
        );
        
        // Split cookies into active and backup
        this.currentActiveCookies = allCookies.slice(0, activeCookieCount);
        this.currentBackupCookies = allCookies.slice(activeCookieCount);
        
        // Initialize failure counts for active cookies
        this.cookieFailureCounts = new Array(this.currentActiveCookies.length).fill(0);
        this.currentCookieIndex = 0;
        
        this.onLog(`🎯 Cookie distribution: ${this.currentActiveCookies.length} active, ${this.currentBackupCookies.length} backup`, 'info');
    }

    async replaceCookieWithBackup() {
        if (this.currentBackupCookies.length === 0) {
            this.onLog('⚠️ No backup cookies available for replacement', 'warning');
            return false;
        }

        // Get backup cookie
        const backupCookie = this.currentBackupCookies.shift();
        
        // Replace current active cookie
        const oldCookie = this.currentActiveCookies[this.currentCookieIndex];
        this.currentActiveCookies[this.currentCookieIndex] = backupCookie;
        this.cookieFailureCounts[this.currentCookieIndex] = 0; // Reset failure count
        
        // Move old cookie to end of backup list
        this.currentBackupCookies.push(oldCookie);
        
        this.onLog(`🔄 Replaced failed cookie with backup. Active: ${this.currentActiveCookies.length}, Backup: ${this.currentBackupCookies.length}`, 'info');
        
        // CRITICAL: Logout and re-login with new cookie
        try {
            if (this.api) {
                this.api.logout(() => {});
                this.api = null;
            }
            
            await this.loginWithCurrentCookie();
            this.onLog('✅ Successfully logged in with backup cookie', 'success');
            return true;
        } catch (error) {
            this.onLog(`❌ Backup cookie login failed: ${error.message}`, 'error');
            this.cookieFailureCounts[this.currentCookieIndex]++;
            return false;
        }
    }

    async switchToNextCookie() {
        if (this.currentActiveCookies.length <= 1) {
            this.onLog('⚠️ Only one active cookie available, cannot switch', 'warning');
            return false;
        }

        // Move to next active cookie
        this.currentCookieIndex = (this.currentCookieIndex + 1) % this.currentActiveCookies.length;
        
        this.onLog(`🔄 Switched to next active cookie (${this.currentCookieIndex + 1}/${this.currentActiveCookies.length})`, 'info');
        
        // CRITICAL: Logout and re-login with new active cookie
        try {
            if (this.api) {
                this.api.logout(() => {});
                this.api = null;
            }
            
            await this.loginWithCurrentCookie();
            this.onLog('✅ Successfully logged in with next active cookie', 'success');
            return true;
        } catch (error) {
            this.onLog(`❌ Next active cookie login failed: ${error.message}`, 'error');
            this.cookieFailureCounts[this.currentCookieIndex]++;
            return false;
        }
    }

    async loginWithCurrentCookie() {
        const cookieData = this.currentActiveCookies[this.currentCookieIndex];
        
        this.onLog(`🔑 Attempting login with cookie ${this.currentCookieIndex + 1}...`, 'info');
        
        return new Promise((resolve, reject) => {
            login(cookieData, (err, api) => {
                if (err) {
                    this.onLog(`❌ Login failed: ${err.message}`, 'error');
                    return reject(err);
                }

                this.api = api;
                
                // Set options
                api.setOptions({
                    logLevel: "silent",
                    forceLogin: true,
                    autoMarkDelivery: false,
                    autoMarkRead: false,
                    selfListen: false
                });

                this.onLog(`✅ Login successful with cookie ${this.currentCookieIndex + 1}!`, 'success');
                resolve();
            });
        });
    }

    getStatus() {
        const basicStatus = {
            isRunning: this.isRunning,
            messagesLoaded: this.messages.length,
            currentMessageIndex: this.currentMessageIndex,
            isLoggedIn: !!this.api
        };

        // Add cookie management status if using multi-cookie
        if (this.currentActiveCookies && this.currentActiveCookies.length > 0) {
            basicStatus.cookieManagement = {
                activeCookies: this.currentActiveCookies.length,
                backupCookies: this.currentBackupCookies ? this.currentBackupCookies.length : 0,
                currentCookieIndex: this.currentCookieIndex,
                failureCounts: this.cookieFailureCounts
            };
        }

        return basicStatus;
    }
}

module.exports = FacebookBot;