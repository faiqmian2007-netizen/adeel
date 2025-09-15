const fs = require('fs');
const path = require('path');

class CookieToAppstate {
    constructor() {
        this.appstateDir = path.join(__dirname, '..', 'appstates');
        this.ensureAppstateDir();
    }

    ensureAppstateDir() {
        if (!fs.existsSync(this.appstateDir)) {
            fs.mkdirSync(this.appstateDir, { recursive: true });
        }
    }

    /**
     * Convert Facebook cookie string to appstate.json format
     * @param {string} cookieString - Facebook cookie string
     * @param {string} userId - User ID for file naming
     * @returns {string} - Path to generated appstate.json file
     */
    convertCookieToAppstate(cookieString, userId = 'default') {
        try {
            const appstate = this.parseCookieString(cookieString);
            const appstatePath = path.join(this.appstateDir, `appstate_${userId}.json`);
            
            // Write appstate to file
            fs.writeFileSync(appstatePath, JSON.stringify(appstate, null, 2));
            
            console.log(`✅ Appstate generated: ${appstatePath}`);
            return appstatePath;
            
        } catch (error) {
            console.error(`❌ Failed to convert cookie to appstate: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse cookie string and convert to appstate format
     * @param {string} cookieString - Raw cookie string
     * @returns {Array} - Appstate array format
     */
    parseCookieString(cookieString) {
        const appstate = [];
        
        // Handle different cookie formats
        let cookies = [];
        
        if (cookieString.includes('c_user=')) {
            // Standard Facebook cookie format
            cookies = cookieString.split(';').map(c => c.trim());
        } else if (cookieString.startsWith('[') && cookieString.endsWith(']')) {
            // Already in JSON format
            try {
                return JSON.parse(cookieString);
            } catch (e) {
                throw new Error('Invalid JSON cookie format');
            }
        } else {
            // Try to split by semicolon anyway
            cookies = cookieString.split(';').map(c => c.trim());
        }

        // Convert cookies to appstate format
        cookies.forEach(cookie => {
            if (!cookie || !cookie.includes('=')) return;
            
            const [name, ...valueParts] = cookie.split('=');
            const value = valueParts.join('=');
            
            if (name && value) {
                appstate.push({
                    key: name.trim(),
                    value: value.trim(),
                    domain: ".facebook.com",
                    path: "/",
                    hostOnly: false,
                    creation: new Date().toISOString(),
                    lastAccessed: new Date().toISOString()
                });
            }
        });

        // Add essential cookies if missing
        this.ensureEssentialCookies(appstate);
        
        return appstate;
    }

    /**
     * Ensure essential Facebook cookies are present
     * @param {Array} appstate - Appstate array
     */
    ensureEssentialCookies(appstate) {
        const essentialCookies = ['c_user', 'xs', 'datr', 'sb'];
        const existingCookies = appstate.map(item => item.key);
        
        essentialCookies.forEach(cookieName => {
            if (!existingCookies.includes(cookieName)) {
                console.warn(`⚠️ Missing essential cookie: ${cookieName}`);
            }
        });
    }

    /**
     * Load appstate from file
     * @param {string} userId - User ID
     * @returns {Array|null} - Appstate array or null if not found
     */
    loadAppstate(userId = 'default') {
        try {
            const appstatePath = path.join(this.appstateDir, `appstate_${userId}.json`);
            
            if (fs.existsSync(appstatePath)) {
                const appstate = JSON.parse(fs.readFileSync(appstatePath, 'utf8'));
                console.log(`✅ Loaded appstate for user: ${userId}`);
                return appstate;
            }
            
            return null;
        } catch (error) {
            console.error(`❌ Failed to load appstate: ${error.message}`);
            return null;
        }
    }

    /**
     * Delete appstate file
     * @param {string} userId - User ID
     */
    deleteAppstate(userId = 'default') {
        try {
            const appstatePath = path.join(this.appstateDir, `appstate_${userId}.json`);
            
            if (fs.existsSync(appstatePath)) {
                fs.unlinkSync(appstatePath);
                console.log(`✅ Deleted appstate for user: ${userId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to delete appstate: ${error.message}`);
        }
    }

    /**
     * Validate if appstate has required cookies
     * @param {Array} appstate - Appstate array
     * @returns {boolean} - Is valid
     */
    validateAppstate(appstate) {
        if (!Array.isArray(appstate) || appstate.length === 0) {
            return false;
        }

        const cookieNames = appstate.map(item => item.key);
        const requiredCookies = ['c_user', 'xs'];
        
        return requiredCookies.every(cookie => cookieNames.includes(cookie));
    }

    /**
     * Get user ID from appstate
     * @param {Array} appstate - Appstate array
     * @returns {string|null} - User ID or null
     */
    getUserIdFromAppstate(appstate) {
        const cUserCookie = appstate.find(item => item.key === 'c_user');
        return cUserCookie ? cUserCookie.value : null;
    }
}

module.exports = CookieToAppstate;