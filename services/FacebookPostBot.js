const axios = require('axios');
const fs = require('fs');

class FacebookPostBot {
    constructor(serverId, config, onLog, onError) {
        this.serverId = serverId;
        this.config = config;
        this.onLog = onLog;
        this.onError = onError;
        this.isRunning = false;
        this.commentInterval = null;
        this.messages = [];
        this.currentMessageIndex = 0;
        this.token = null;
        
        // Advanced Cookie Management System
        this.currentActiveCookies = [];
        this.currentBackupCookies = [];
        this.currentCookieIndex = 0;
        this.tokenCookieIndex = -1;
        this.cookieFailureCounts = [];
        this.globalFailureCount = 0;
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 11; RMX2144 Build/RKQ1.201217.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.71 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/375.1.0.28.111;]',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,/;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.facebook.com'
        };
    }

    async start() {
        try {
            this.onLog('🚀 Starting Facebook Post Bot for commenting...', 'info');
            
            // Load messages first
            await this.loadMessages();

            // Handle both single cookie and multi-cookie scenarios with validation
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
            }

            // Store cookie for HTTP requests
            this.cookie = cookieData;
            this.headers.Cookie = cookieData;

            // Get EAAG token using advanced system
            this.onLog('🔑 Extracting access token with advanced system...', 'info');
            await this.getValidToken();
            this.onLog('✅ Access token extracted successfully!', 'success');

            // Start commenting
            this.isRunning = true;
            this.startCommenting();
            const speedInSeconds = Math.round(this.config.speed / 1000);
            this.onLog(`🚀 Post bot started! Commenting every ${speedInSeconds} seconds`, 'success');
            this.onLog(`📝 Target Post ID: ${this.config.postId}`, 'info');
            
        } catch (error) {
            this.onError(`Failed to start post bot: ${error.message}`);
            throw error;
        }
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
        
        // Reset indices
        this.currentCookieIndex = 0;
        this.tokenCookieIndex = -1;
        
        this.onLog(`🎯 Advanced Cookie System Setup:`, 'info');
        this.onLog(`   📌 Active Cookies: ${this.currentActiveCookies.length}`, 'info');
        this.onLog(`   🔄 Backup Cookies: ${this.currentBackupCookies.length}`, 'info');
        this.onLog(`   💾 Total Available: ${allCookies.length}`, 'info');
    }

    async findValidCookie(cookies) {
        this.onLog('🔍 Testing cookies to find a valid one...', 'info');
        
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (!cookie) continue;
            
            this.onLog(`🍪 Testing cookie ${i + 1}/${cookies.length}...`, 'info');
            
            const isValid = await this.validateCookie(cookie);
            if (isValid) {
                this.onLog(`✅ Valid cookie found at position ${i + 1}!`, 'success');
                return cookie;
            } else {
                this.onLog(`❌ Cookie ${i + 1} is invalid or expired`, 'warning');
            }
        }
        
        return null;
    }

    async validateCookie(cookie) {
        try {
            // Basic format check - ensure cookie has required Facebook fields
            const requiredCookies = ['c_user', 'xs'];
            const cookiePairs = cookie.split(';').map(pair => pair.trim());
            
            let foundCookies = [];
            for (const pair of cookiePairs) {
                const [name] = pair.split('=');
                if (name) {
                    foundCookies.push(name.trim());
                }
            }
            
            // Check if required cookies are present
            for (const required of requiredCookies) {
                if (!foundCookies.includes(required)) {
                    this.onLog(`❌ Cookie missing required field: ${required}`, 'warning');
                    return false;
                }
            }
            
            // Light validation - just check basic format, don't test with actual requests
            // as they can be slow and unreliable
            this.onLog(`✅ Cookie format validation passed`, 'info');
            return true;
            
        } catch (error) {
            this.onLog(`❌ Cookie validation error: ${error.message}`, 'warning');
            return false;
        }
    }

    async replaceCookieWithBackup() {
        if (this.currentBackupCookies.length > 0) {
            const failedCookie = this.currentActiveCookies[this.currentCookieIndex];
            const newCookie = this.currentBackupCookies.shift(); // Take first backup cookie
            this.currentActiveCookies[this.currentCookieIndex] = newCookie;
            this.cookieFailureCounts[this.currentCookieIndex] = 0; // Reset failure count
            this.token = null; // Force token refresh

            this.onLog(`🔄 Replaced failed cookie with backup. Remaining backup cookies: ${this.currentBackupCookies.length}`, 'success');
            this.onLog(`   ❌ Failed Cookie: ***HIDDEN***`, 'warning');
            this.onLog(`   ✅ New Cookie: ***HIDDEN***`, 'success');
            return true;
        }
        return false;
    }

    async switchToNextCookie() {
        if (this.currentActiveCookies.length <= 1) {
            return false;
        }

        this.onLog('🔄 Current cookie failed, switching to next active cookie...', 'warning');
        
        // Move to next active cookie
        this.currentCookieIndex = (this.currentCookieIndex + 1) % this.currentActiveCookies.length;
        this.token = null; // Force token refresh
        
        this.onLog(`📍 Switched to active cookie ${this.currentCookieIndex + 1}/${this.currentActiveCookies.length}`, 'info');
        return true;
    }

    async getValidToken() {
        // Check if current cookie has failed too many times (more than 5 failures)
        if (this.cookieFailureCounts[this.currentCookieIndex] >= 5) {
            this.onLog(`🚫 Cookie ${this.currentCookieIndex + 1} has failed ${this.cookieFailureCounts[this.currentCookieIndex]} times, marking as expired`, 'warning');
            
            if (!await this.replaceCookieWithBackup()) {
                this.onLog(`⚠️ No backup cookies available! Switching to next active cookie...`, 'warning');
                await this.switchToNextCookie();
            }
        }

        // Get token if we don't have one or if we need to switch cookies
        if (!this.token || this.tokenCookieIndex !== this.currentCookieIndex) {
            try {
                this.cookie = this.currentActiveCookies[this.currentCookieIndex];
                this.headers.Cookie = this.cookie;
                
                this.token = await this.getToken();
                this.tokenCookieIndex = this.currentCookieIndex;
                
                this.onLog(`🔑 Using active cookie ${this.currentCookieIndex + 1}/${this.currentActiveCookies.length} (${this.currentBackupCookies.length} backup available)`, 'info');
                return this.token;
                
            } catch (tokenError) {
                this.onLog(`❌ Cookie ${this.currentCookieIndex + 1} failed for token. Failure count: ${this.cookieFailureCounts[this.currentCookieIndex] + 1}`, 'error');
                this.cookieFailureCounts[this.currentCookieIndex]++;

                // Try backup if cookie failed too many times
                if (this.cookieFailureCounts[this.currentCookieIndex] >= 3 && this.currentBackupCookies.length > 0) {
                    await this.replaceCookieWithBackup();
                } else {
                    await this.switchToNextCookie();
                }
                
                throw tokenError;
            }
        }
        
        return this.token;
    }

    async loadMessages() {
        try {
            if (this.config.messages && Array.isArray(this.config.messages)) {
                this.messages = this.config.messages.filter(msg => msg && msg.trim());
                this.onLog(`📝 Loaded ${this.messages.length} messages from array`, 'info');
            } else if (this.config.messageFile) {
                const fileContent = fs.readFileSync(this.config.messageFile, 'utf8');
                this.messages = fileContent.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                this.onLog(`📂 Loaded ${this.messages.length} messages from file`, 'info');
            } else {
                throw new Error('No messages provided');
            }

            if (this.messages.length === 0) {
                throw new Error('No valid messages found');
            }
        } catch (error) {
            this.onError(`Failed to load messages: ${error.message}`);
            throw error;
        }
    }

    async getToken() {
        try {
            const response = await axios.get('https://business.facebook.com/business_locations', {
                headers: this.headers
            });
            const tokenMatch = response.data.match(/(EAAG\w+)/);
            if (tokenMatch) {
                return tokenMatch[1];
            } else {
                throw new Error('EAAG token not found in response');
            }
        } catch (error) {
            this.onLog(`❌ Error fetching EAAG token: ${error.message}`, 'error');
            throw error;
        }
    }

    startCommenting() {
        if (!this.isRunning || !this.token) {
            return;
        }

        this.commentInterval = setInterval(async () => {
            try {
                await this.sendComment();
            } catch (error) {
                this.onError(`Error sending comment: ${error.message}`);
            }
        }, this.config.speed);
    }

    async sendComment() {
        if (!this.isRunning || this.messages.length === 0) {
            return;
        }

        try {
            // Get valid token with advanced cookie management
            await this.getValidToken();
            
            // Get current message
            let comment = this.messages[this.currentMessageIndex].trim();
            
            // Add target name if provided
            if (this.config.targetName && this.config.targetName.trim()) {
                comment = `${this.config.targetName.trim()}: ${comment}`;
            }

            this.onLog(`💬 Posting comment ${this.currentMessageIndex + 1}/${this.messages.length}: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`, 'info');
            
            // Post comment using Facebook Graph API with advanced system
            const commentUrl = `https://graph.facebook.com/${this.config.postId}/comments`;
            
            // Use URLSearchParams for proper form-encoded data (Facebook Graph API requirement)
            const formData = new URLSearchParams();
            formData.append('message', comment);
            formData.append('access_token', this.token);
            
            const response = await axios.post(commentUrl, formData, {
                headers: {
                    ...this.headers,
                    'Cookie': this.currentActiveCookies[this.currentCookieIndex],
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const currentTime = new Date().toLocaleString();
            if (response.data.id) {
                // Reset failure count on success
                this.cookieFailureCounts[this.currentCookieIndex] = 0;
                this.globalFailureCount = 0;
                
                this.onLog(`✅ Comment posted successfully! ID: ${response.data.id}`, 'success');
                this.onLog(`📅 Time: ${currentTime}`, 'info');
                this.onLog(`🔗 Post ID: ${this.config.postId}`, 'info');
                this.onLog(`🍪 Active Cookie: ${this.currentCookieIndex + 1}/${this.currentActiveCookies.length}`, 'info');
                this.onLog(`💾 Backup Cookies: ${this.currentBackupCookies.length}`, 'info');
                this.onLog(`💬 Comment: ${comment}`, 'info');
                
                // Rotate to next cookie after successful comment (round-robin among active)
                if (this.currentActiveCookies.length > 1) {
                    const nextCookieIndex = (this.currentCookieIndex + 1) % this.currentActiveCookies.length;
                    this.currentCookieIndex = nextCookieIndex;
                    this.token = null; // Force token refresh with new cookie
                    this.onLog(`🔄 Rotating to next active cookie: ${this.currentCookieIndex + 1}`, 'info');
                }
            } else {
                this.globalFailureCount++;
                this.onLog(`❌ Comment posting failed - no response ID. Global failures: ${this.globalFailureCount}`, 'error');
            }

            // Move to next message (cycle back to beginning if we reach the end)
            this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messages.length;

            if (this.currentMessageIndex === 0) {
                this.onLog(`🔄 Completed all ${this.messages.length} comments. Starting over...`, 'info');
            }

        } catch (error) {
            this.onError(`Failed to post comment: ${error.message}`);
            this.cookieFailureCounts[this.currentCookieIndex]++;
            this.globalFailureCount++;
            
            // Handle rate limiting
            if (error.response && (error.response.status === 429 || 
                error.response.data?.error?.code === 613)) {
                this.onLog('⚠️ Rate limited by Facebook. Increasing delay...', 'warning');
                this.config.speed = Math.min(this.config.speed * 1.5, 300000); // Max 5 minutes
                this.updateCommentInterval();
            }
            
            // Handle authentication/authorization errors (400/401/403) - immediate failure
            else if (error.response && (
                error.response.status === 400 || 
                error.response.status === 401 || 
                error.response.status === 403 ||
                error.response.data?.error?.code === 190)) {
                
                this.onLog(`🚨 Authentication error (${error.response.status}). Trying advanced cookie management...`, 'warning');
                
                // Try backup if cookie failed too many times
                if (this.cookieFailureCounts[this.currentCookieIndex] >= 3 && this.currentBackupCookies.length > 0) {
                    const replaced = await this.replaceCookieWithBackup();
                    if (replaced) {
                        this.onLog('✅ Replaced with backup cookie. Continuing...', 'success');
                    }
                } else {
                    const switched = await this.switchToNextCookie();
                    if (switched) {
                        this.onLog('✅ Switched to next active cookie. Continuing...', 'success');
                    }
                }
                
                // Check if we still have active cookies
                if (this.currentActiveCookies.length === 0 && this.currentBackupCookies.length === 0) {
                    this.onError('🚨 All cookies exhausted. Stopping bot...', 'error');
                    this.stop();
                }
            }
        }
    }

    updateCommentInterval() {
        if (this.commentInterval) {
            clearInterval(this.commentInterval);
            this.startCommenting();
            const speedInSeconds = Math.round(this.config.speed / 1000);
            this.onLog(`⏱️ Updated comment interval to ${speedInSeconds} seconds`, 'info');
        }
    }

    stop() {
        try {
            this.onLog('🛑 Stopping Facebook post bot...', 'warning');
            this.isRunning = false;
            
            if (this.commentInterval) {
                clearInterval(this.commentInterval);
                this.commentInterval = null;
            }
            
            this.token = null;
            this.cookie = null;
            
            this.onLog('✅ Facebook post bot stopped successfully', 'success');
            
        } catch (error) {
            this.onError(`Error stopping post bot: ${error.message}`);
        }
    }

    restart() {
        this.onLog('🔄 Restarting Facebook post bot...', 'info');
        this.stop();
        setTimeout(() => {
            this.start().catch(error => {
                this.onError(`Failed to restart post bot: ${error.message}`);
            });
        }, 2000);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            currentMessage: this.currentMessageIndex + 1,
            totalMessages: this.messages.length,
            speed: this.config.speed
        };
    }

    getCurrentStats() {
        return {
            commentsPosted: this.currentMessageIndex,
            totalComments: this.messages.length,
            progress: Math.round((this.currentMessageIndex / this.messages.length) * 100)
        };
    }
}

module.exports = FacebookPostBot;