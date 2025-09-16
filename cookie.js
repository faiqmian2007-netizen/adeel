const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const login = require('fca-priyansh');

const app = express();
const port = process.env.PORT || 5000;

// Configure multer for file uploads with limits
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Store active sessions
let activeSessions = [];

// Function to validate required cookie keys
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

// Function to parse cookie string to appState format
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

// Function to test a single cookie with optimized timeout
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
                        const profilePic = user.thumbSrc || '';

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

// Main HTML page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Facebook Cookie Checker - Professional Tool</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }

            .header {
                background: linear-gradient(135deg, #1877f2 0%, #42a5f5 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }

            .header h1 {
                font-size: 2.5em;
                margin-bottom: 10px;
                font-weight: 300;
            }

            .header p {
                font-size: 1.1em;
                opacity: 0.9;
            }

            .main-content {
                padding: 40px;
            }

            .section {
                margin-bottom: 40px;
                padding: 30px;
                background: #f8f9fa;
                border-radius: 15px;
                border-left: 5px solid #1877f2;
            }

            .section h2 {
                color: #1877f2;
                margin-bottom: 20px;
                font-size: 1.5em;
            }

            .input-group {
                margin-bottom: 20px;
            }

            label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }

            textarea, input[type="file"] {
                width: 100%;
                padding: 15px;
                border: 2px solid #e1e8ed;
                border-radius: 10px;
                font-size: 14px;
                transition: all 0.3s ease;
                resize: vertical;
            }

            textarea:focus, input[type="file"]:focus {
                border-color: #1877f2;
                outline: none;
                box-shadow: 0 0 0 3px rgba(24, 119, 242, 0.1);
            }

            .btn {
                background: linear-gradient(135deg, #1877f2 0%, #42a5f5 100%);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-right: 10px;
                display: inline-block;
            }

            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(24, 119, 242, 0.3);
            }

            .btn:disabled {
                background: #ccc;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .results {
                margin-top: 30px;
            }

            .profile-card {
                background: white;
                border-radius: 15px;
                padding: 25px;
                margin-bottom: 20px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                border-left: 5px solid #42b883;
                display: flex;
                align-items: center;
                gap: 20px;
            }

            .profile-card.error {
                border-left-color: #e74c3c;
                background: #fdf2f2;
            }

            .profile-pic {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                object-fit: cover;
                border: 3px solid #42b883;
            }

            .profile-info h3 {
                color: #333;
                margin-bottom: 5px;
                font-size: 1.3em;
            }

            .profile-info p {
                color: #666;
                margin-bottom: 3px;
            }

            .status {
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
            }

            .status.success {
                background: #d4edda;
                color: #155724;
            }

            .status.error {
                background: #f8d7da;
                color: #721c24;
            }

            .loading {
                text-align: center;
                padding: 40px;
                color: #666;
            }

            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #1877f2;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }

            .stat-card {
                background: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 3px 10px rgba(0,0,0,0.1);
            }

            .stat-number {
                font-size: 2em;
                font-weight: bold;
                color: #1877f2;
            }

            .stat-label {
                color: #666;
                font-size: 0.9em;
                margin-top: 5px;
            }

            .warning {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 10px;
                margin-bottom: 20px;
            }

            .file-upload-area {
                border: 2px dashed #1877f2;
                border-radius: 10px;
                padding: 30px;
                text-align: center;
                transition: all 0.3s ease;
                cursor: pointer;
            }

            .file-upload-area:hover {
                background: #f8f9ff;
            }

            .file-upload-area.dragover {
                background: #e3f2fd;
                border-color: #42a5f5;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Facebook Cookie Checker</h1>
                <p>Professional tool for testing Facebook cookies and retrieving profile information</p>
            </div>

            <div class="main-content">
                <!-- Single Cookie Testing -->
                <div class="section">
                    <h2>🍪 Single Cookie Testing</h2>
                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong> Only use your own Facebook cookies. Never share cookies with others as they provide full access to your account.
                    </div>
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; color: #1565c0; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                        <strong>✨ Auto Process:</strong> When you click test, the system will automatically create appstate in background, login, get your profile info, and immediately clean up all temporary files!
                    </div>
                    <div class="input-group">
                        <label for="singleCookie">Paste Facebook Cookie:</label>
                        <textarea id="singleCookie" rows="4" placeholder="sb=UqOTaABb7LZqMMQrZLIa16b6;datr=UqOTaAYag2dIDapfzmogyjxY;ps_l=1;ps_n=1;wd=1366x633;c_user=100053706995870;..."></textarea>
                    </div>
                    <button class="btn" onclick="checkSingleCookie()">🔍 Check Cookie</button>
                </div>

                <!-- Multiple Cookie Testing -->
                <div class="section">
                    <h2>📁 Multiple Cookie Testing</h2>
                    <div style="background: #e8f5e8; border: 1px solid #4caf50; color: #2e7d32; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                        <strong>🚀 Batch Processing:</strong> Upload multiple cookies and the system will process each one automatically - creating appstates, logging in, extracting info, and cleaning up after each cookie!
                    </div>
                    <div class="input-group">
                        <label for="cookieFile">Upload Cookie File (.txt):</label>
                        <div class="file-upload-area" onclick="document.getElementById('cookieFile').click()">
                            <input type="file" id="cookieFile" accept=".txt" style="display: none;" onchange="handleFileSelect(this)">
                            <p>📄 Click to select or drag & drop your cookie file</p>
                            <small>Each cookie should be on a separate line</small>
                        </div>
                        <div id="fileName" style="margin-top: 10px; font-weight: bold; color: #1877f2;"></div>
                    </div>
                    <button class="btn" onclick="checkMultipleCookies()">🚀 Test All Cookies</button>
                </div>

                <!-- Results Section -->
                <div class="results" id="results" style="display: none;">
                    <h2>📊 Results</h2>
                    <div class="stats" id="stats"></div>
                    <div id="profileResults"></div>
                </div>
            </div>
        </div>

        <script>
            let selectedFile = null;

            // Helper function to escape HTML and prevent XSS
            function escapeHtml(unsafe) {
                if (!unsafe) return '';
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            function handleFileSelect(input) {
                selectedFile = input.files[0];
                if (selectedFile) {
                    document.getElementById('fileName').textContent = \`Selected: \${selectedFile.name}\`;
                }
            }

            // Drag and drop functionality
            const fileUploadArea = document.querySelector('.file-upload-area');

            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('dragover');
            });

            fileUploadArea.addEventListener('dragleave', () => {
                fileUploadArea.classList.remove('dragover');
            });

            fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    document.getElementById('cookieFile').files = files;
                    handleFileSelect({ files: files });
                }
            });

            async function checkSingleCookie() {
                const cookie = document.getElementById('singleCookie').value.trim();
                if (!cookie) {
                    alert('Please paste a Facebook cookie');
                    return;
                }

                console.log('🚀 Starting cookie check...');
                showLoading('Creating appstate and testing login...');

                try {
                    console.log('📡 Making API call to /check-cookie');

                    // Show progress updates
                    setTimeout(() => {
                        showLoading('Logging in with appstate...');
                    }, 1000);

                    setTimeout(() => {
                        showLoading('Retrieving user information...');
                    }, 3000);

                    const response = await fetch('/check-cookie', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ cookie: cookie })
                    });

                    console.log('✅ Response received, status:', response.status);
                    const result = await response.json();
                    console.log('📊 API result:', result);

                    if (result.success) {
                        showLoading('Auto-cleaning appstate files...');
                        setTimeout(() => {
                            displayResults([result]);
                            console.log('✅ Process completed with auto-cleanup');
                        }, 500);
                    } else {
                        displayResults([result]);
                    }
                } catch (error) {
                    console.error('❌ Error in checkSingleCookie:', error);
                    displayResults([{ success: false, error: 'Network error', cookie: 'N/A' }]);
                }
            }

            async function checkMultipleCookies() {
                if (!selectedFile) {
                    alert('Please select a cookie file');
                    return;
                }

                const formData = new FormData();
                formData.append('cookieFile', selectedFile);

                showLoading('Processing multiple cookies with auto-appstate creation...');

                try {
                    // Show progress for batch processing
                    setTimeout(() => {
                        showLoading('Creating appstates and testing logins in sequence...');
                    }, 1000);

                    setTimeout(() => {
                        showLoading('Auto-cleaning temporary files after each test...');
                    }, 3000);

                    const response = await fetch('/check-multiple-cookies', {
                        method: 'POST',
                        body: formData
                    });

                    const results = await response.json();
                    showLoading('Finalizing results with complete auto-cleanup...');

                    setTimeout(() => {
                        displayResults(results);
                        console.log('✅ Batch processing completed with auto-cleanup');
                    }, 500);
                } catch (error) {
                    console.error('Error:', error);
                    displayResults([{ success: false, error: 'Network error', cookie: 'N/A' }]);
                }
            }

            function showLoading(message) {
                const resultsDiv = document.getElementById('results');
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = \`
                    <h2>📊 Results</h2>
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>\${message}</p>
                    </div>
                \`;
            }

            function displayResults(results) {
                const resultsDiv = document.getElementById('results');
                resultsDiv.style.display = 'block';

                // Rebuild the results structure since showLoading() replaced it
                resultsDiv.innerHTML = \`
                    <h2>📊 Results</h2>
                    <div class="stats" id="stats"></div>
                    <div id="profileResults"></div>
                \`;

                const statsDiv = document.getElementById('stats');
                const profileResultsDiv = document.getElementById('profileResults');

                // Calculate stats
                const total = results.length;
                const successful = results.filter(r => r.success).length;
                const failed = total - successful;

                // Display stats
                statsDiv.innerHTML = \`
                    <div class="stat-card">
                        <div class="stat-number">\${total}</div>
                        <div class="stat-label">Total Tested</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" style="color: #42b883;">\${successful}</div>
                        <div class="stat-label">Valid Cookies</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" style="color: #e74c3c;">\${failed}</div>
                        <div class="stat-label">Invalid/Expired</div>
                    </div>
                \`;

                // Display individual results
                profileResultsDiv.innerHTML = results.map(result => {
                    if (result.success) {
                        return \`
                            <div class="profile-card">
                                <img src="\${escapeHtml(result.profilePic)}" alt="Profile Picture" class="profile-pic">
                                <div class="profile-info">
                                    <h3>\${escapeHtml(result.name)}</h3>
                                    <p><strong>User ID:</strong> \${escapeHtml(result.userID)}</p>
                                    <p><strong>Cookie:</strong> \${escapeHtml(result.cookie)}</p>
                                    <span class="status success">✅ Valid</span>
                                </div>
                            </div>
                        \`;
                    } else {
                        return \`
                            <div class="profile-card error">
                                <div class="profile-info">
                                    <h3>❌ Failed to Login</h3>
                                    <p><strong>Error:</strong> \${escapeHtml(result.error)}</p>
                                    <p><strong>Cookie:</strong> \${escapeHtml(result.cookie)}</p>
                                    <span class="status error">❌ Invalid/Expired</span>
                                </div>
                            </div>
                        \`;
                    }
                }).join('');
            }
        </script>
    </body>
    </html>
    `);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), port: port });
});

// API endpoint for single cookie check
app.post('/check-cookie', async (req, res) => {
    const { cookie } = req.body;

    if (!cookie) {
        return res.json({ success: false, error: 'No cookie provided' });
    }

    try {
        const result = await testCookie(cookie);
        res.json(result);
    } catch (error) {
        res.json({ success: false, error: 'Server error', cookie: '***masked***' });
    }
});

// API endpoint for multiple cookie check
app.post('/check-multiple-cookies', upload.single('cookieFile'), async (req, res) => {
    if (!req.file) {
        return res.json([{ success: false, error: 'No file uploaded' }]);
    }

    let uploadedFilePath = req.file.path;

    try {
        const fileContent = fs.readFileSync(uploadedFilePath, 'utf8');
        const cookies = fileContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (cookies.length === 0) {
            return res.json([{ success: false, error: 'No cookies found in file' }]);
        }

        const results = [];

        // Test cookies one by one with auto-cleanup between each test
        for (let i = 0; i < cookies.length; i++) {
            console.log(`📋 Testing cookie ${i + 1}/${cookies.length} with auto-appstate creation`);

            // Cleanup before each test
            cleanupPersistedFiles();

            const result = await testCookie(cookies[i]);
            results.push(result);

            // Cleanup after each test
            setTimeout(() => cleanupPersistedFiles(), 200);

            // Add delay between requests to be respectful to Facebook's servers
            if (i < cookies.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500)); // Reduced delay
            }
        }

        res.json(results);
    } catch (error) {
        console.error('Error processing file:', error);
        res.json([{ success: false, error: 'Error processing file' }]);
    } finally {
        // CRITICAL: Always delete uploaded file to prevent cookie data persistence
        try {
            if (fs.existsSync(uploadedFilePath)) {
                fs.unlinkSync(uploadedFilePath);
                console.log('🔒 Securely deleted uploaded cookie file');
            }
        } catch (cleanupError) {
            console.error('⚠️ Failed to delete uploaded file:', cleanupError);
        }
    }
});

// Enhanced cleanup function for immediate appstate file removal
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

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Cleanup any persisted files on startup
cleanupPersistedFiles();

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Facebook Cookie Checker running at http://localhost:${port}`);
    console.log(`📊 Professional tool for testing Facebook cookies`);
    console.log(`⚠️  Use only your own cookies for security`);
    console.log(`🔒 Security: Cookie values are masked and sessions are preserved`);
});