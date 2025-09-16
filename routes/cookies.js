const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const login = require('fca-priyansh');
const fs = require('fs');
const path = require('path');

// Function to validate required cookie keys (from working cookie.js)
function validateCookie(cookieString) {
    const requiredKeys = ['c_user', 'xs'];
    const cookieLower = cookieString.toLowerCase();

    for (const key of requiredKeys) {
        if (!cookieLower.includes(key + '=')) {
            return false;
        }
    }
    return true;
}

// Function to parse cookie string to appState format (from working cookie.js)
function parseCookieToAppState(cookieString) {
    try {
        // Validate required keys first
        if (!validateCookie(cookieString)) {
            throw new Error('Missing required cookie keys (c_user, xs)');
        }

        const cookies = cookieString.split(';').map(cookie => cookie.trim());
        const appState = [];

        cookies.forEach(cookie => {
            const equalIndex = cookie.indexOf('=');
            if (equalIndex > 0) {
                const key = cookie.substring(0, equalIndex).trim();
                const value = cookie.substring(equalIndex + 1).trim();

                if (key && value) {
                    appState.push({
                        key: key,
                        value: value,
                        domain: ".facebook.com",
                        path: "/",
                        hostOnly: false,
                        creation: new Date().toISOString(),
                        lastAccessed: new Date().toISOString()
                    });
                }
            }
        });

        return appState;
    } catch (error) {
        throw new Error('Invalid cookie format: ' + error.message);
    }
}

// Function to test a single cookie with optimized timeout (from working cookie.js)
async function testCookie(cookieString) {
    const timeout = new Promise((resolve) => {
        setTimeout(() => {
            resolve({ 
                success: false, 
                error: 'Cookie check timed out after 15 seconds',
                cookie: '***masked***'
            });
        }, 15000); // Increased to 15 second timeout for reliable login
    });

    const cookieCheck = new Promise((resolve) => {
        try {
            const appState = parseCookieToAppState(cookieString);

            // Create login with minimal options for faster processing
            console.log('⏰ Starting login process...');
            const loginStartTime = Date.now();

            login({ 
                appState: appState,
                pageID: "",
                selfListen: false,
                listenEvents: false,
                updatePresence: false,
                autoMarkDelivery: false,
                autoMarkRead: false
            }, (err, api) => {
                const loginTime = Date.now() - loginStartTime;
                console.log(`⏱️ Login completed in ${loginTime}ms`);
                if (err) {
                    console.error('Login error:', err);
                    resolve({ 
                        success: false, 
                        error: 'Cookie expired or invalid',
                        cookie: '***masked***'
                    });
                    return;
                }

                // Extract user ID from appstate instead of using problematic getCurrentUserID
                console.log('🔍 Extracting user ID from appstate...');
                let userID = null;

                // Find c_user from appstate which contains the user ID
                try {
                    const cUserCookie = appState.find(cookie => cookie.key === 'c_user');
                    if (cUserCookie && cUserCookie.value) {
                        userID = cUserCookie.value;
                        console.log(`✅ Found user ID from cookie: ${userID}`);
                    }
                } catch (extractError) {
                    console.log('Error extracting user ID from appstate:', extractError);
                }

                // Fallback: try getCurrentUserID with shorter timeout
                if (!userID) {
                    console.log('🔄 Fallback: trying getCurrentUserID...');
                    const userIdTimeout = setTimeout(() => {
                        console.log('⚠️ getCurrentUserID timed out, using fallback');
                        processUserInfo(api, 'unknown', resolve);
                    }, 3000); // 3 second timeout for this specific call

                    api.getCurrentUserID((err, fetchedUserID) => {
                        clearTimeout(userIdTimeout);
                        if (!err && fetchedUserID) {
                            userID = fetchedUserID;
                            console.log(`✅ getCurrentUserID success: ${userID}`);
                        }
                        processUserInfo(api, userID || 'unknown', resolve);
                    });
                } else {
                    processUserInfo(api, userID, resolve);
                }
            });

            function processUserInfo(api, userID, resolve) {
                console.log('👤 Getting user info details...');
                const userInfoStartTime = Date.now();

                api.getUserInfo(userID, (err, userInfo) => {
                    const userInfoTime = Date.now() - userInfoStartTime;
                    console.log(`⏱️ getUserInfo took ${userInfoTime}ms`);

                    if (err) {
                        console.log('getUserInfo error:', err);
                        resolve({ 
                            success: false, 
                            error: 'Failed to get user details',
                            cookie: '***masked***'
                        });
                        return;
                    }

                    try {
                        // Defensive check for userInfo and user object
                        if (!userInfo || !userInfo[userID]) {
                            throw new Error('User info not available');
                        }

                        const user = userInfo[userID];

                        // Defensive checks for required properties
                        const name = user.name || 'Unknown User';
                        const profileUrl = user.profileUrl || '';
                        // Enhanced profile picture extraction - try multiple sources for best quality
                        let profilePic = '';
                        if (user.profilePicLarge) {
                            profilePic = user.profilePicLarge; // High quality
                        } else if (user.picture) {
                            profilePic = user.picture; // Alternative source  
                        } else if (user.thumbSrc) {
                            profilePic = user.thumbSrc; // Fallback to original
                        } else if (userID && userID !== 'unknown') {
                            // Generate high-quality profile picture URL using Facebook's Graph API
                            profilePic = `https://graph.facebook.com/${userID}/picture?type=large&width=200&height=200`;
                        }
                        
                        console.log(`🖼️ Profile picture URL: ${profilePic}`);

                        console.log(`✅ Successfully retrieved info for: ${name}`);

                        resolve({
                            success: true,
                            userID: userID,
                            name: name,
                            profileUrl: profileUrl,
                            profilePic: profilePic,
                            cookie: '***masked***'
                        });
                    } catch (userError) {
                        console.log('User data extraction error:', userError);
                        resolve({
                            success: false,
                            error: 'Failed to extract user details',
                            cookie: '***masked***'
                        });
                    }
                });
            }
        } catch (error) {
            resolve({ 
                success: false, 
                error: 'Invalid cookie format',
                cookie: '***masked***'
            });
        }
    });

    // Return the first promise to resolve (either timeout or successful cookie check)
    return await Promise.race([cookieCheck, timeout]);
}

// Public cookie checking endpoint (no authentication required)
router.post('/check-cookie', async (req, res) => {
    try {
        const { cookie } = req.body;
        
        if (!cookie || typeof cookie !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Cookie string is required'
            });
        }

        console.log('🚀 Starting cookie check...');
        const result = await testCookie(cookie);
        
        res.json(result);

    } catch (error) {
        console.error('Cookie check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test cookie'
        });
    }
});

// Middleware to authenticate all other cookie routes
router.use(authenticate);

// Cookie validation endpoint
router.post('/validate', async (req, res) => {
    try {
        const { cookie } = req.body;
        
        if (!cookie || typeof cookie !== 'string') {
            return res.status(400).json({
                error: 'Cookie string is required'
            });
        }

        // Validate cookie format and check if it's a Facebook cookie
        if (!isValidFacebookCookie(cookie)) {
            return res.json({
                cookie: cookie.substring(0, 100),
                isValid: false,
                error: 'Invalid Facebook cookie format',
                userInfo: null
            });
        }

        // Use the working FCA-based validation
        const validationResult = await validateFacebookCookie(cookie);
        
        res.json({
            cookie: cookie.substring(0, 100),
            isValid: validationResult.isValid,
            userInfo: validationResult.userInfo,
            error: validationResult.error || null
        });

    } catch (error) {
        console.error('Cookie validation error:', error);
        res.status(500).json({
            error: 'Failed to validate cookie',
            isValid: false,
            userInfo: null
        });
    }
});

// Reliable cookie testing endpoint using working FCA implementation
router.post('/test-reliable', async (req, res) => {
    try {
        const { cookie } = req.body;
        
        if (!cookie || typeof cookie !== 'string') {
            return res.status(400).json({
                error: 'Cookie string is required',
                isValid: false,
                userInfo: null
            });
        }

        console.log('🚀 Starting reliable cookie test...');
        const result = await testCookie(cookie);
        
        if (result.success) {
            res.json({
                isValid: true,
                userInfo: {
                    id: result.userID,
                    name: result.name,
                    profileUrl: result.profileUrl,
                    profilePic: result.profilePic
                },
                error: null
            });
        } else {
            res.json({
                isValid: false,
                userInfo: null,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Reliable cookie test error:', error);
        res.status(500).json({
            error: 'Failed to test cookie',
            isValid: false,
            userInfo: null
        });
    }
});

// Bulk cookie validation endpoint
router.post('/validate-bulk', async (req, res) => {
    try {
        const { cookies } = req.body;
        
        if (!Array.isArray(cookies)) {
            return res.status(400).json({
                error: 'Cookies array is required'
            });
        }

        if (cookies.length > 50) {
            return res.status(400).json({
                error: 'Maximum 50 cookies can be validated at once'
            });
        }

        const results = [];
        
        for (const cookie of cookies) {
            try {
                if (!isValidFacebookCookie(cookie)) {
                    results.push({
                        cookie: cookie.substring(0, 100),
                        isValid: false,
                        error: 'Invalid Facebook cookie format',
                        userInfo: null
                    });
                    continue;
                }

                const validationResult = await validateFacebookCookie(cookie);
                results.push({
                    cookie: cookie.substring(0, 100),
                    isValid: validationResult.isValid,
                    userInfo: validationResult.userInfo,
                    error: validationResult.error || null
                });

                // Add delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Error validating cookie:`, error);
                results.push({
                    cookie: cookie.substring(0, 100),
                    isValid: false,
                    error: 'Validation failed',
                    userInfo: null
                });
            }
        }

        res.json({
            results,
            total: results.length,
            valid: results.filter(r => r.isValid).length,
            invalid: results.filter(r => !r.isValid).length
        });

    } catch (error) {
        console.error('Bulk cookie validation error:', error);
        res.status(500).json({
            error: 'Failed to validate cookies'
        });
    }
});

// Function to validate required cookie keys (from working cookie.js)
function validateCookie(cookieString) {
    const requiredKeys = ['c_user', 'xs'];
    const cookieLower = cookieString.toLowerCase();

    for (const key of requiredKeys) {
        if (!cookieLower.includes(key + '=')) {
            return false;
        }
    }
    return true;
}

// Helper function to validate Facebook cookie format
function isValidFacebookCookie(cookie) {
    return validateCookie(cookie);
}

// Generate Facebook AppState from cookie
function generateAppStateFromCookie(cookie) {
    console.log('🔧 Generating AppState from cookie...');
    
    const cookieParams = parseCookieString(cookie);
    const appState = [];
    
    // Convert each cookie parameter to AppState format
    for (const [key, value] of Object.entries(cookieParams)) {
        if (value && value.trim()) {
            appState.push({
                key: key,
                value: value,
                domain: key.includes('datr') || key.includes('sb') ? '.facebook.com' : 'facebook.com',
                path: '/',
                hostOnly: false,
                creation: new Date().toISOString(),
                lastAccessed: new Date().toISOString()
            });
        }
    }
    
    console.log(`✅ Generated AppState with ${appState.length} entries`);
    return appState;
}

// Extract user name using AppState approach
async function extractNameFromAppState(appState, userId) {
    console.log('🔍 Extracting name using AppState approach...');
    
    try {
        // Simulate FCA-like API call using generated AppState
        const cookieString = appState
            .map(item => `${item.key}=${item.value}`)
            .join('; ');
        
        // Try Facebook's internal user info API
        const response = await fetch('https://www.facebook.com/api/graphql/', {
            method: 'POST',
            headers: {
                'Cookie': cookieString,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: `variables={"id":"${userId}"}&doc_id=23959650970785882`
        });
        
        if (response.ok) {
            const data = await response.text();
            console.log(`GraphQL response length: ${data.length}`);
            
            // Look for name in response
            const namePatterns = [
                /"name":"([^"]{2,80})"/,
                /"display_name":"([^"]{2,80})"/,
                /"short_name":"([^"]{2,80})"/,
                /"first_name":"([^"]+)"[^}]*"last_name":"([^"]+)"/
            ];
            
            for (const pattern of namePatterns) {
                const match = data.match(pattern);
                if (match && match[1]) {
                    let name = match[1];
                    // If it's first_name + last_name pattern
                    if (match[2]) {
                        name = `${match[1]} ${match[2]}`;
                    }
                    
                    if (name.length > 1 && 
                        !name.toLowerCase().includes('facebook') &&
                        name.match(/^[A-Za-z\s]+$/)) {
                        console.log(`✅ Real name found via AppState: "${name}"`);
                        return name;
                    }
                }
            }
        }
        
        // Try alternative AppState approach - user info endpoint
        const infoResponse = await fetch(`https://www.facebook.com/profile.php?id=${userId}`, {
            headers: {
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
            }
        });
        
        if (infoResponse.ok) {
            const html = await infoResponse.text();
            
            // Extract name from authenticated profile view
            const authenticatedPatterns = [
                /"USER_ID":"[^"]*","SHORT_NAME":"([^"]+)"/,
                /"name":"([^"]{2,80})"/,
                /<title[^>]*>([^<]+?)\s*\|\s*Facebook/i,
                /"entity_name":"([^"]{2,80})"/
            ];
            
            for (const pattern of authenticatedPatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    let name = match[1].trim();
                    if (name.length > 1 && 
                        !name.toLowerCase().includes('facebook') &&
                        !name.toLowerCase().includes('login') &&
                        name.match(/^[A-Za-z\s]+$/)) {
                        console.log(`✅ Real name found via authenticated profile: "${name}"`);
                        return name;
                    }
                }
            }
        }
        
    } catch (error) {
        console.log(`AppState name extraction error: ${error.message}`);
    }
    
    return null;
}

// Function to parse cookie string to appState format (from working cookie.js)
function parseCookieToAppState(cookieString) {
    try {
        // Validate required keys first
        if (!validateCookie(cookieString)) {
            throw new Error('Missing required cookie keys (c_user, xs)');
        }

        const cookies = cookieString.split(';').map(cookie => cookie.trim());
        const appState = [];

        cookies.forEach(cookie => {
            const equalIndex = cookie.indexOf('=');
            if (equalIndex > 0) {
                const key = cookie.substring(0, equalIndex).trim();
                const value = cookie.substring(equalIndex + 1).trim();

                if (key && value) {
                    appState.push({
                        key: key,
                        value: value,
                        domain: ".facebook.com",
                        path: "/",
                        hostOnly: false,
                        creation: new Date().toISOString(),
                        lastAccessed: new Date().toISOString()
                    });
                }
            }
        });

        return appState;
    } catch (error) {
        throw new Error('Invalid cookie format: ' + error.message);
    }
}

// Function to test a single cookie with optimized timeout (from working cookie.js)
async function testCookie(cookieString) {
    const timeout = new Promise((resolve) => {
        setTimeout(() => {
            resolve({ 
                success: false, 
                error: 'Cookie check timed out after 15 seconds',
                cookie: '***masked***'
            });
        }, 15000); // Increased to 15 second timeout for reliable login
    });

    const cookieCheck = new Promise((resolve) => {
        try {
            const appState = parseCookieToAppState(cookieString);

            // Create login with minimal options for faster processing
            console.log('⏰ Starting login process...');
            const loginStartTime = Date.now();

            login({ 
                appState: appState,
                pageID: "",
                selfListen: false,
                listenEvents: false,
                updatePresence: false,
                autoMarkDelivery: false,
                autoMarkRead: false
            }, (err, api) => {
                const loginTime = Date.now() - loginStartTime;
                console.log(`⏱️ Login completed in ${loginTime}ms`);
                if (err) {
                    console.error('Login error:', err);
                    resolve({ 
                        success: false, 
                        error: 'Cookie expired or invalid',
                        cookie: '***masked***'
                    });
                    return;
                }

                // Extract user ID from appstate instead of using problematic getCurrentUserID
                console.log('🔍 Extracting user ID from appstate...');
                let userID = null;

                // Find c_user from appstate which contains the user ID
                try {
                    const cUserCookie = appState.find(cookie => cookie.key === 'c_user');
                    if (cUserCookie && cUserCookie.value) {
                        userID = cUserCookie.value;
                        console.log(`✅ Found user ID from cookie: ${userID}`);
                    }
                } catch (extractError) {
                    console.log('Error extracting user ID from appstate:', extractError);
                }

                // Fallback: try getCurrentUserID with shorter timeout
                if (!userID) {
                    console.log('🔄 Fallback: trying getCurrentUserID...');
                    const userIdTimeout = setTimeout(() => {
                        console.log('⚠️ getCurrentUserID timed out, using fallback');
                        processUserInfo(api, 'unknown', resolve);
                    }, 3000); // 3 second timeout for this specific call

                    api.getCurrentUserID((err, fetchedUserID) => {
                        clearTimeout(userIdTimeout);
                        if (!err && fetchedUserID) {
                            userID = fetchedUserID;
                            console.log(`✅ getCurrentUserID success: ${userID}`);
                        }
                        processUserInfo(api, userID || 'unknown', resolve);
                    });
                } else {
                    processUserInfo(api, userID, resolve);
                }
            });

            function processUserInfo(api, userID, resolve) {
                console.log('👤 Getting user info details...');
                const userInfoStartTime = Date.now();

                api.getUserInfo(userID, (err, userInfo) => {
                    const userInfoTime = Date.now() - userInfoStartTime;
                    console.log(`⏱️ getUserInfo took ${userInfoTime}ms`);

                    if (err) {
                        console.log('getUserInfo error:', err);
                        resolve({ 
                            success: false, 
                            error: 'Failed to get user details',
                            cookie: '***masked***'
                        });
                        return;
                    }

                    try {
                        // Defensive check for userInfo and user object
                        if (!userInfo || !userInfo[userID]) {
                            throw new Error('User info not available');
                        }

                        const user = userInfo[userID];

                        // Defensive checks for required properties
                        const name = user.name || 'Unknown User';
                        const profileUrl = user.profileUrl || '';
                        // Enhanced profile picture extraction - try multiple sources for best quality
                        let profilePic = '';
                        if (user.profilePicLarge) {
                            profilePic = user.profilePicLarge; // High quality
                        } else if (user.picture) {
                            profilePic = user.picture; // Alternative source  
                        } else if (user.thumbSrc) {
                            profilePic = user.thumbSrc; // Fallback to original
                        } else if (userID && userID !== 'unknown') {
                            // Generate high-quality profile picture URL using Facebook's Graph API
                            profilePic = `https://graph.facebook.com/${userID}/picture?type=large&width=200&height=200`;
                        }
                        
                        console.log(`🖼️ Profile picture URL: ${profilePic}`);

                        console.log(`✅ Successfully retrieved info for: ${name}`);

                        resolve({
                            success: true,
                            userID: userID,
                            name: name,
                            profileUrl: profileUrl,
                            profilePic: profilePic,
                            cookie: '***masked***'
                        });
                    } catch (userError) {
                        console.log('User data extraction error:', userError);
                        resolve({
                            success: false,
                            error: 'Failed to extract user details',
                            cookie: '***masked***'
                        });
                    }
                });
            }
        } catch (error) {
            resolve({ 
                success: false, 
                error: 'Invalid cookie format',
                cookie: '***masked***'
            });
        }
    });

    // Return the first promise to resolve (either timeout or successful cookie check)
    return await Promise.race([cookieCheck, timeout]);
}

// Helper function to validate Facebook cookie using the working implementation
async function validateFacebookCookie(cookie) {
    try {
        const result = await testCookie(cookie);
        
        if (result.success) {
            return {
                isValid: true,
                error: null,
                userInfo: {
                    id: result.userID,
                    name: result.name,
                    profileUrl: result.profileUrl,
                    profilePic: result.profilePic
                }
            };
        } else {
            return {
                isValid: false,
                error: result.error,
                userInfo: null
            };
        }
    } catch (error) {
        return {
            isValid: false,
            error: error.message,
            userInfo: null
        };
    }
}










// Facebook name database for popular IDs (crowd-sourced approach)
const facebookNameCache = {
    // This will store previously found names to avoid repeated API calls
};

// Advanced Facebook UID tracing for real name extraction
async function traceUserIdForName(userId, cookie) {
    console.log(`Starting UID tracing for Facebook ID: ${userId}`);
    
    // Check cache first
    if (facebookNameCache[userId]) {
        console.log(`✅ Name found in cache: "${facebookNameCache[userId]}"`);
        return facebookNameCache[userId];
    }
    
    // Method 1: Try multiple Facebook Graph API endpoints
    const graphEndpoints = [
        `https://graph.facebook.com/${userId}?fields=name,id`,
        `https://graph.facebook.com/v18.0/${userId}?fields=name,id`,
        `https://graph.facebook.com/v17.0/${userId}?fields=name,id`,
        `https://graph.facebook.com/v16.0/${userId}?fields=name,id`
    ];

    for (const endpoint of graphEndpoints) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.name && data.name.length > 1 && !data.error) {
                    console.log(`✅ Real name found via Graph API: "${data.name}"`);
                    facebookNameCache[userId] = data.name; // Cache it
                    return data.name;
                }
            }
        } catch (error) {
            continue; // Try next endpoint
        }
    }

    // Method 2: Try Facebook's public profile approach
    try {
        const publicProfileResponse = await fetch(`https://m.facebook.com/profile.php?id=${userId}`, {
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            redirect: 'manual' // Don't follow redirects to login
        });

        if (publicProfileResponse.ok) {
            const html = await publicProfileResponse.text();
            console.log(`Profile response length: ${html.length}`);
            
            // Look for name in title tag (most reliable)
            const titleMatch = html.match(/<title[^>]*>([^<]+?)\s*(?:\s-\s|\s\|\s)(?:Facebook|FB)/i);
            if (titleMatch && titleMatch[1]) {
                let name = titleMatch[1].trim();
                if (name.length > 1 && name.length < 100 && !name.toLowerCase().includes('login')) {
                    console.log(`✅ Real name found via profile title: "${name}"`);
                    facebookNameCache[userId] = name; // Cache it
                    return name;
                }
            }

            // Look for JSON data with name
            const jsonMatches = html.match(/"name":"([^"]{2,80})"/gi);
            if (jsonMatches) {
                for (const match of jsonMatches) {
                    const nameMatch = match.match(/"name":"([^"]+)"/);
                    if (nameMatch && nameMatch[1]) {
                        let name = nameMatch[1].trim();
                        if (name.length > 1 && 
                            !name.toLowerCase().includes('facebook') &&
                            !name.toLowerCase().includes('login') &&
                            name.match(/^[A-Za-z\s]+$/)) {
                            console.log(`✅ Real name found via profile JSON: "${name}"`);
                            facebookNameCache[userId] = name; // Cache it
                            return name;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.log(`Profile lookup error: ${error.message}`);
    }

    // Method 3: Try alternative lookup services
    try {
        // Use a service that aggregates public Facebook data
        const alternativeEndpoints = [
            `https://lookup-id.com/${userId}`,
            `https://findmyfbid.com/${userId}`,
            `https://facebook.com/${userId}` // Direct profile access
        ];

        for (const endpoint of alternativeEndpoints) {
            try {
                const response = await fetch(endpoint, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 5000
                });

                if (response.ok) {
                    const text = await response.text();
                    
                    // Look for name patterns in response
                    const patterns = [
                        /<title[^>]*>([^<]+?)\s*-\s*Facebook/i,
                        /"name":"([^"]{2,80})"/g,
                        /property="og:title"\s+content="([^"]+)"/i
                    ];

                    for (const pattern of patterns) {
                        const match = text.match(pattern);
                        if (match && match[1]) {
                            let name = match[1].trim();
                            if (name.length > 1 && 
                                !name.toLowerCase().includes('facebook') &&
                                !name.toLowerCase().includes('login') &&
                                name.match(/^[A-Za-z\s]+$/)) {
                                console.log(`✅ Real name found via alternative service: "${name}"`);
                                facebookNameCache[userId] = name; // Cache it
                                return name;
                            }
                        }
                    }
                }
            } catch (e) {
                continue;
            }
        }
    } catch (error) {
        console.log(`Alternative lookup error: ${error.message}`);
    }

    // Method 3: Direct profile URL tracing
    try {
        const profileUrls = [
            `https://m.facebook.com/profile.php?id=${userId}`,
            `https://www.facebook.com/profile.php?id=${userId}`,
            `https://touch.facebook.com/profile.php?id=${userId}`
        ];

        for (const url of profileUrls) {
            const response = await fetch(url, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
                },
                redirect: 'follow'
            });

            if (response.ok) {
                const html = await response.text();
                console.log(`Profile page response length: ${html.length}`);
                
                // Enhanced name extraction patterns for profile pages
                const profilePatterns = [
                    // Title patterns
                    /<title[^>]*>([^<]+?)\s*(?:\s-\s|\s\|\s)(?:Facebook|FB)/gi,
                    /<title[^>]*>([^<]{2,100})<\/title>/gi,
                    
                    // JSON data patterns
                    /"name":"([^"]{2,100})"/gi,
                    /"displayName":"([^"]{2,100})"/gi,
                    /"full_name":"([^"]{2,100})"/gi,
                    /"profile_name":"([^"]{2,100})"/gi,
                    
                    // HTML element patterns
                    /data-testid="profile_name"[^>]*>([^<]+)</gi,
                    /property="og:title"\s+content="([^"]+)"/gi,
                    /"user":{"name":"([^"]+)"/gi,
                    /class="[^"]*profileName[^"]*"[^>]*>([^<]+)</gi,
                    /class="[^"]*userName[^"]*"[^>]*>([^<]+)</gi,
                    
                    // Meta tag patterns
                    /<meta[^>]+property="profile:first_name"[^>]+content="([^"]+)"/gi,
                    /<meta[^>]+property="profile:last_name"[^>]+content="([^"]+)"/gi,
                    
                    // Direct text patterns in HTML
                    />([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)</gi,
                    
                    // Facebook specific patterns
                    /"entity_name":"([^"]{2,100})"/gi,
                    /"alternate_name":"([^"]{2,100})"/gi
                ];

                for (const pattern of profilePatterns) {
                    let match;
                    while ((match = pattern.exec(html)) !== null) {
                        let name = match[1].trim()
                            .replace(/\s*(?:-|–|\|)\s*Facebook.*$/i, '')
                            .replace(/Facebook$/i, '')
                            .trim();

                        if (name && 
                            name.length >= 2 && 
                            name.length <= 100 &&
                            !name.toLowerCase().includes('login') &&
                            !name.toLowerCase().includes('facebook') &&
                            !name.toLowerCase().includes('sign up') &&
                            !name.match(/^\d+$/) &&
                            name !== 'Profile' &&
                            name !== 'User') {

                            console.log(`✅ Real name found via profile tracing: "${name}"`);
                            return name;
                        }
                    }
                    pattern.lastIndex = 0;
                }
                
                // Break after first successful response
                break;
            }
        }
    } catch (error) {
        console.log(`Profile tracing error: ${error.message}`);
    }

    // Method 4: Facebook Graph API public lookup
    try {
        const graphResponse = await fetch(`https://graph.facebook.com/${userId}?fields=name,id`);
        if (graphResponse.ok) {
            const graphData = await graphResponse.json();
            if (graphData.name && graphData.name.length > 1) {
                console.log(`✅ Real name found via Graph API: "${graphData.name}"`);
                return graphData.name;
            }
        }
    } catch (error) {
        console.log(`Graph API error: ${error.message}`);
    }

    // Method 4: Generate intelligent display name based on ID analysis
    try {
        // Analyze the Facebook ID pattern to create a meaningful name
        const idStr = userId.toString();
        
        if (idStr.startsWith('61')) {
            // Newer Facebook IDs (typically 15 digits starting with 61)
            const region = idStr.substring(2, 4);
            const sequence = idStr.substring(-4);
            const displayName = `User ${sequence} (Region ${region})`;
            console.log(`Generated intelligent name: "${displayName}"`);
            return displayName;
        } else if (idStr.length <= 10) {
            // Older Facebook IDs (shorter, usually legacy accounts)
            const displayName = `Legacy User ${idStr.substring(-3)}`;
            console.log(`Generated legacy name: "${displayName}"`);
            return displayName;
        } else {
            // Standard ID format
            const displayName = `FB User ${idStr.substring(-4)}`;
            console.log(`Generated standard name: "${displayName}"`);
            return displayName;
        }
    } catch (error) {
        console.log(`ID analysis error: ${error.message}`);
    }

    console.log(`❌ UID tracing failed - using basic fallback for ${userId}`);
    return `User ${userId.toString().slice(-4)}`;
}

// Extract name from cookie parameters using advanced analysis
function extractNameFromCookieParams(cookieParams, cookie) {
    console.log(`Extracting name from cookie parameters for advanced analysis`);
    
    // Method 1: Try to extract name from 'xs' parameter (session info)
    if (cookieParams.xs) {
        try {
            // xs parameter often contains encoded user info
            const decoded = Buffer.from(cookieParams.xs, 'base64').toString('ascii');
            const nameMatch = decoded.match(/name['":\s]*([^'",\n\r]+)/i);
            if (nameMatch && nameMatch[1] && nameMatch[1].length > 1) {
                const name = nameMatch[1].trim().replace(/['"]/g, '');
                console.log(`Name found in xs parameter: "${name}"`);
                return name;
            }
        } catch (e) {
            // Continue
        }
    }
    
    // Method 2: Extract from 'c_user' and cross-reference with other params
    if (cookieParams.c_user) {
        // Look for associated name data in other parameters
        const userPatterns = [
            'presence', 'datr', 'sb', 'fr'
        ];
        
        for (const param of userPatterns) {
            if (cookieParams[param]) {
                try {
                    const decoded = Buffer.from(cookieParams[param], 'base64').toString('ascii');
                    const nameMatch = decoded.match(/([A-Za-z]{2,}\s+[A-Za-z]{2,})/);
                    if (nameMatch && nameMatch[1]) {
                        console.log(`Name found in ${param} parameter: "${nameMatch[1]}"`);
                        return nameMatch[1].trim();
                    }
                } catch (e) {
                    continue;
                }
            }
        }
    }
    
    return null;
}

// Fetch real user name using advanced UID tracing
async function fetchUserName(userId, cookie) {
    console.log(`🔍 Starting advanced UID tracing for Facebook ID: ${userId}`);
    
    // Method 1: Advanced UID tracing (most comprehensive)
    const tracedName = await traceUserIdForName(userId, cookie);
    if (tracedName) {
        console.log(`✅ Real name found through UID tracing: "${tracedName}"`);
        return tracedName;
    }
    
    // Method 2: Extract from cookie parameters 
    const cookieParams = parseCookieString(cookie);
    const paramName = extractNameFromCookieParams(cookieParams, cookie);
    if (paramName) {
        console.log(`✅ Name found in cookie parameters: "${paramName}"`);
        return paramName;
    }
    
    console.log(`❌ All methods failed - no real name found for ${userId}`);
    console.log(`📝 Using fallback display format`);
    return `User ${userId.slice(-4)}`; // Fallback to last 4 digits
}

// Advanced cookie testing function using fca-priyansh (from cookie.js)
async function testCookieAdvanced(cookieString) {
    const timeout = new Promise((resolve) => {
        setTimeout(() => {
            // Cleanup on timeout to prevent file persistence
            cleanupPersistedFiles();
            resolve({ 
                success: false, 
                error: 'Cookie check timed out after 15 seconds',
                cookie: '***masked***'
            });
        }, 15000); // 15 second timeout for reliable login
    });

    const cookieCheck = new Promise((resolve) => {
        try {
            // Immediately cleanup any existing files before creating new appstate
            cleanupPersistedFiles();

            const appState = parseCookieToAppStateAdvanced(cookieString);

            // Create login with minimal options for faster processing
            console.log('⏰ Starting login process...');
            const loginStartTime = Date.now();

            login({ 
                appState: appState,
                pageID: "",
                selfListen: false,
                listenEvents: false,
                updatePresence: false,
                autoMarkDelivery: false,
                autoMarkRead: false
            }, (err, api) => {
                const loginTime = Date.now() - loginStartTime;
                console.log(`⏱️ Login completed in ${loginTime}ms`);
                if (err) {
                    console.error('Login error:', err);

                    // Cleanup any persisted files on login error
                    cleanupPersistedFiles();

                    resolve({ 
                        success: false, 
                        error: 'Cookie expired or invalid',
                        cookie: '***masked***'
                    });
                    return;
                }

                // Extract user ID from appstate instead of using problematic getCurrentUserID
                console.log('🔍 Extracting user ID from appstate...');
                let userID = null;

                // Find c_user from appstate which contains the user ID
                try {
                    const cUserCookie = appState.find(cookie => cookie.key === 'c_user');
                    if (cUserCookie && cUserCookie.value) {
                        userID = cUserCookie.value;
                        console.log(`✅ Found user ID from cookie: ${userID}`);
                    }
                } catch (extractError) {
                    console.log('Error extracting user ID from appstate:', extractError);
                }

                // Fallback: try getCurrentUserID with shorter timeout
                if (!userID) {
                    console.log('🔄 Fallback: trying getCurrentUserID...');
                    const userIdTimeout = setTimeout(() => {
                        console.log('⚠️ getCurrentUserID timed out, using fallback');
                        // Continue without user ID or with a generic one
                        processUserInfoAdvanced(api, 'unknown', resolve, appState);
                    }, 3000); // 3 second timeout for this specific call

                    api.getCurrentUserID((err, fetchedUserID) => {
                        clearTimeout(userIdTimeout);
                        if (!err && fetchedUserID) {
                            userID = fetchedUserID;
                            console.log(`✅ getCurrentUserID success: ${userID}`);
                        }
                        processUserInfoAdvanced(api, userID || 'unknown', resolve, appState);
                    });
                } else {
                    processUserInfoAdvanced(api, userID, resolve, appState);
                }
            });

            function processUserInfoAdvanced(api, userID, resolve, appState) {
                console.log('👤 Getting user info details...');
                const userInfoStartTime = Date.now();

                api.getUserInfo(userID, (err, userInfo) => {
                    const userInfoTime = Date.now() - userInfoStartTime;
                    console.log(`⏱️ getUserInfo took ${userInfoTime}ms`);

                    // Immediate cleanup right after getting info
                    setTimeout(() => cleanupPersistedFiles(), 100);

                    if (err) {
                        console.log('getUserInfo error:', err);
                        resolve({ 
                            success: false, 
                            error: 'Failed to get user details',
                            cookie: '***masked***'
                        });
                        return;
                    }

                    try {
                        // Defensive check for userInfo and user object
                        if (!userInfo || !userInfo[userID]) {
                            throw new Error('User info not available');
                        }

                        const user = userInfo[userID];

                        // Defensive checks for required properties
                        const name = user.name || 'Unknown User';
                        const profileUrl = user.profileUrl || '';
                        // Enhanced profile picture extraction - try multiple sources for best quality
                        let profilePic = '';
                        if (user.profilePicLarge) {
                            profilePic = user.profilePicLarge; // High quality
                        } else if (user.picture) {
                            profilePic = user.picture; // Alternative source  
                        } else if (user.thumbSrc) {
                            profilePic = user.thumbSrc; // Fallback to original
                        } else if (userID && userID !== 'unknown') {
                            // Generate high-quality profile picture URL using Facebook's Graph API
                            profilePic = `https://graph.facebook.com/${userID}/picture?type=large&width=200&height=200`;
                        }
                        
                        console.log(`🖼️ Profile picture URL: ${profilePic}`);

                        console.log(`✅ Successfully retrieved info for: ${name}`);

                        resolve({
                            success: true,
                            userID: userID,
                            name: name,
                            profileUrl: profileUrl,
                            profilePic: profilePic,
                            appState: appState,
                            cookie: '***masked***'
                        });
                    } catch (userError) {
                        console.log('User data extraction error:', userError);
                        resolve({
                            success: false,
                            error: 'Failed to extract user details',
                            cookie: '***masked***'
                        });
                    }

                    // Note: NOT calling api.logout() to preserve user's session
                });
            }
        } catch (error) {
            // Cleanup any persisted files on parse error
            cleanupPersistedFiles();

            resolve({ 
                success: false, 
                error: 'Invalid cookie format',
                cookie: '***masked***'
            });
        }
    });

    // Return the first promise to resolve (either timeout or successful cookie check)
    return await Promise.race([cookieCheck, timeout]);
}

// Enhanced cookie validation function (from cookie.js)
function validateCookieAdvanced(cookieString) {
    const requiredKeys = ['c_user', 'xs'];
    const cookieLower = cookieString.toLowerCase();

    for (const key of requiredKeys) {
        if (!cookieLower.includes(key + '=')) {
            return false;
        }
    }
    return true;
}

// Enhanced function to parse cookie string to appState format (from cookie.js)
function parseCookieToAppStateAdvanced(cookieString) {
    try {
        // Validate required keys first
        if (!validateCookieAdvanced(cookieString)) {
            throw new Error('Missing required cookie keys (c_user, xs)');
        }

        const cookies = cookieString.split(';').map(cookie => cookie.trim());
        const appState = [];

        cookies.forEach(cookie => {
            const equalIndex = cookie.indexOf('=');
            if (equalIndex > 0) {
                const key = cookie.substring(0, equalIndex).trim();
                const value = cookie.substring(equalIndex + 1).trim();

                if (key && value) {
                    appState.push({
                        key: key,
                        value: value,
                        domain: ".facebook.com",
                        path: "/",
                        hostOnly: false,
                        creation: new Date().toISOString(),
                        lastAccessed: new Date().toISOString()
                    });
                }
            }
        });

        return appState;
    } catch (error) {
        throw new Error('Invalid cookie format: ' + error.message);
    }
}

// Cleanup function to remove persisted files (from cookie.js)
function cleanupPersistedFiles() {
    const filesToCleanup = [
        'PriyanshFca.json', 
        'appstate.json', 
        '.priyansh_fca',
        'fbstate.json',
        'appstate.txt',
        '.fca',
        'fca.json'
    ];

    filesToCleanup.forEach(filename => {
        try {
            if (fs.existsSync(filename)) {
                fs.unlinkSync(filename);
                console.log(`🧹 Auto-cleaned appstate file: ${filename}`);
            }
        } catch (error) {
            // Silent cleanup to avoid console noise
        }
    });

    // Also cleanup any temporary directories that might be created
    try {
        const tempDirs = ['.tmp', 'temp', 'tmp'];
        tempDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(dir, file));
                    } catch (e) {
                        // Silent cleanup
                    }
                });
            }
        });
    } catch (error) {
        // Silent cleanup
    }
}

// =================== RELIABLE COOKIE TESTING FUNCTIONS ===================
// Based on working cookie.js implementation

// Simple cookie validation for required keys
function validateCookieBasic(cookieString) {
    const requiredKeys = ['c_user', 'xs'];
    const cookieLower = cookieString.toLowerCase();

    for (const key of requiredKeys) {
        if (!cookieLower.includes(key + '=')) {
            return false;
        }
    }
    return true;
}

// Parse cookie string to appState format for reliable testing
function parseCookieToAppState(cookieString) {
    try {
        // Validate required keys first
        if (!validateCookieBasic(cookieString)) {
            throw new Error('Missing required cookie keys (c_user, xs)');
        }

        const cookies = cookieString.split(';').map(cookie => cookie.trim());
        const appState = [];

        cookies.forEach(cookie => {
            const equalIndex = cookie.indexOf('=');
            if (equalIndex > 0) {
                const key = cookie.substring(0, equalIndex).trim();
                const value = cookie.substring(equalIndex + 1).trim();

                if (key && value) {
                    appState.push({
                        key: key,
                        value: value,
                        domain: ".facebook.com",
                        path: "/",
                        hostOnly: false,
                        creation: new Date().toISOString(),
                        lastAccessed: new Date().toISOString()
                    });
                }
            }
        });

        return appState;
    } catch (error) {
        throw new Error('Invalid cookie format: ' + error.message);
    }
}

// Enhanced cleanup function for immediate appstate file removal (from cookie.js)
function cleanupPersistedFiles() {
    const filesToCleanup = [
        'PriyanshFca.json', 
        'appstate.json', 
        '.priyansh_fca',
        'fbstate.json',
        'appstate.txt',
        '.fca',
        'fca.json'
    ];

    filesToCleanup.forEach(filename => {
        try {
            if (fs.existsSync(filename)) {
                fs.unlinkSync(filename);
                console.log(`🧹 Auto-cleaned appstate file: ${filename}`);
            }
        } catch (error) {
            // Silent cleanup to avoid console noise
        }
    });

    // Also cleanup any temporary directories that might be created
    try {
        const tempDirs = ['.tmp', 'temp', 'tmp'];
        tempDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(dir, file));
                    } catch (e) {
                        // Silent cleanup
                    }
                });
            }
        });
    } catch (error) {
        // Silent cleanup
    }
}

// Function to test a single cookie with optimized timeout (exact copy from cookie.js)
async function testCookie(cookieString) {
    const timeout = new Promise((resolve) => {
        setTimeout(() => {
            // Cleanup on timeout to prevent file persistence
            cleanupPersistedFiles();
            resolve({ 
                success: false, 
                error: 'Cookie check timed out after 15 seconds',
                cookie: '***masked***'
            });
        }, 15000); // Increased to 15 second timeout for reliable login
    });

    const cookieCheck = new Promise((resolve) => {
        try {
            // Immediately cleanup any existing files before creating new appstate
            cleanupPersistedFiles();

            const appState = parseCookieToAppState(cookieString);

            // Create login with minimal options for faster processing
            console.log('⏰ Starting login process...');
            const loginStartTime = Date.now();

            login({ 
                appState: appState,
                pageID: "",
                selfListen: false,
                listenEvents: false,
                updatePresence: false,
                autoMarkDelivery: false,
                autoMarkRead: false
            }, (err, api) => {
                const loginTime = Date.now() - loginStartTime;
                console.log(`⏱️ Login completed in ${loginTime}ms`);
                if (err) {
                    console.error('Login error:', err);

                    // Cleanup any persisted files on login error
                    cleanupPersistedFiles();

                    resolve({ 
                        success: false, 
                        error: 'Cookie expired or invalid',
                        cookie: '***masked***'
                    });
                    return;
                }

                // Extract user ID from appstate instead of using problematic getCurrentUserID
                console.log('🔍 Extracting user ID from appstate...');
                let userID = null;

                // Find c_user from appstate which contains the user ID
                try {
                    const cUserCookie = appState.find(cookie => cookie.key === 'c_user');
                    if (cUserCookie && cUserCookie.value) {
                        userID = cUserCookie.value;
                        console.log(`✅ Found user ID from cookie: ${userID}`);
                    }
                } catch (extractError) {
                    console.log('Error extracting user ID from appstate:', extractError);
                }

                // Fallback: try getCurrentUserID with shorter timeout
                if (!userID) {
                    console.log('🔄 Fallback: trying getCurrentUserID...');
                    const userIdTimeout = setTimeout(() => {
                        console.log('⚠️ getCurrentUserID timed out, using fallback');
                        // Continue without user ID or with a generic one
                        processUserInfo(api, 'unknown', resolve);
                    }, 3000); // 3 second timeout for this specific call

                    api.getCurrentUserID((err, fetchedUserID) => {
                        clearTimeout(userIdTimeout);
                        if (!err && fetchedUserID) {
                            userID = fetchedUserID;
                            console.log(`✅ getCurrentUserID success: ${userID}`);
                        }
                        processUserInfo(api, userID || 'unknown', resolve);
                    });
                } else {
                    processUserInfo(api, userID, resolve);
                }
            });

            function processUserInfo(api, userID, resolve) {
                console.log('👤 Getting user info details...');
                const userInfoStartTime = Date.now();

                api.getUserInfo(userID, (err, userInfo) => {
                    const userInfoTime = Date.now() - userInfoStartTime;
                    console.log(`⏱️ getUserInfo took ${userInfoTime}ms`);

                    // Immediate cleanup right after getting info
                    setTimeout(() => cleanupPersistedFiles(), 100);

                    if (err) {
                        console.log('getUserInfo error:', err);
                        resolve({ 
                            success: false, 
                            error: 'Failed to get user details',
                            cookie: '***masked***'
                        });
                        return;
                    }

                    try {
                        // Defensive check for userInfo and user object
                        if (!userInfo || !userInfo[userID]) {
                            throw new Error('User info not available');
                        }

                        const user = userInfo[userID];

                        // Defensive checks for required properties
                        const name = user.name || 'Unknown User';
                        const profileUrl = user.profileUrl || '';
                        // Enhanced profile picture extraction - try multiple sources for best quality
                        let profilePic = '';
                        if (user.profilePicLarge) {
                            profilePic = user.profilePicLarge; // High quality
                        } else if (user.picture) {
                            profilePic = user.picture; // Alternative source  
                        } else if (user.thumbSrc) {
                            profilePic = user.thumbSrc; // Fallback to original
                        } else if (userID && userID !== 'unknown') {
                            // Generate high-quality profile picture URL using Facebook's Graph API
                            profilePic = `https://graph.facebook.com/${userID}/picture?type=large&width=200&height=200`;
                        }
                        
                        console.log(`🖼️ Profile picture URL: ${profilePic}`);

                        console.log(`✅ Successfully retrieved info for: ${name}`);

                        resolve({
                            success: true,
                            userID: userID,
                            name: name,
                            profileUrl: profileUrl,
                            profilePic: profilePic,
                            cookie: '***masked***'
                        });
                    } catch (userError) {
                        console.log('User data extraction error:', userError);
                        resolve({
                            success: false,
                            error: 'Failed to extract user details',
                            cookie: '***masked***'
                        });
                    }

                    // Note: NOT calling api.logout() to preserve user's session
                });
            }
        } catch (error) {
            // Cleanup any persisted files on parse error
            cleanupPersistedFiles();

            resolve({ 
                success: false, 
                error: 'Invalid cookie format',
                cookie: '***masked***'
            });
        }
    });

    // Return the first promise to resolve (either timeout or successful cookie check)
    return await Promise.race([cookieCheck, timeout]);
}

// =================== NEW RELIABLE ENDPOINTS ===================

// Reliable single cookie testing endpoint
router.post('/test-reliable', async (req, res) => {
    try {
        const { cookie } = req.body;
        
        if (!cookie || typeof cookie !== 'string') {
            return res.status(400).json({
                error: 'Cookie string is required'
            });
        }

        console.log('🚀 Starting reliable cookie test...');
        const result = await testCookie(cookie);
        
        if (result.success) {
            res.json({
                isValid: true,
                userInfo: {
                    id: result.userID,
                    name: result.name,
                    profileUrl: result.profileUrl,
                    profilePic: result.profilePic
                },
                error: null
            });
        } else {
            res.json({
                isValid: false,
                userInfo: null,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Reliable cookie test error:', error);
        res.status(500).json({
            error: 'Failed to test cookie',
            isValid: false,
            userInfo: null
        });
    }
});

// Reliable bulk cookie testing endpoint
router.post('/test-bulk-reliable', async (req, res) => {
    try {
        const { cookies } = req.body;
        
        if (!Array.isArray(cookies)) {
            return res.status(400).json({
                error: 'Cookies array is required'
            });
        }

        if (cookies.length > 20) {
            return res.status(400).json({
                error: 'Maximum 20 cookies can be tested at once for reliable testing'
            });
        }

        const results = [];
        
        for (const cookie of cookies) {
            try {
                console.log(`🔍 Testing cookie ${results.length + 1}/${cookies.length}...`);
                const result = await testCookie(cookie);
                
                if (result.success) {
                    results.push({
                        cookie: '***masked***',
                        isValid: true,
                        userInfo: {
                            id: result.userID,
                            name: result.name,
                            profileUrl: result.profileUrl,
                            profilePic: result.profilePic
                        },
                        error: null
                    });
                } else {
                    results.push({
                        cookie: '***masked***',
                        isValid: false,
                        userInfo: null,
                        error: result.error
                    });
                }

                // Add delay between requests to avoid overwhelming Facebook
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`Error testing cookie:`, error);
                results.push({
                    cookie: '***masked***',
                    isValid: false,
                    error: 'Test failed',
                    userInfo: null
                });
            }
        }

        res.json({
            results,
            total: results.length,
            valid: results.filter(r => r.isValid).length,
            invalid: results.filter(r => !r.isValid).length
        });

    } catch (error) {
        console.error('Bulk reliable cookie test error:', error);
        res.status(500).json({
            error: 'Failed to test cookies'
        });
    }
});

// Image proxy route to serve Facebook profile pictures through our domain
// This avoids CSP issues when deployed to external hosting services
router.get('/profile-image-proxy', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url || !url.startsWith('https://')) {
            return res.status(400).json({ error: 'Invalid image URL' });
        }
        
        // Only allow Facebook CDN URLs for security
        const allowedDomains = [
            'scontent-bom1-1.xx.fbcdn.net',
            'scontent-bom2-3.xx.fbcdn.net',  
            'graph.facebook.com',
            'scontent.xx.fbcdn.net'
        ];
        
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        if (!allowedDomains.some(allowed => domain.includes('fbcdn.net') || domain === 'graph.facebook.com')) {
            return res.status(403).json({ error: 'Domain not allowed' });
        }
        
        // Fetch the image from Facebook
        const fetch = require('node-fetch');
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        if (!response.ok) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        // Set appropriate headers
        res.set({
            'Content-Type': response.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*'
        });
        
        // Pipe the image data to the response
        response.body.pipe(res);
        
    } catch (error) {
        console.error('Profile image proxy error:', error);
        res.status(500).json({ error: 'Failed to load image' });
    }
});


module.exports = { router };