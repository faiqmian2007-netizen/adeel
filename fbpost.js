const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const app = express();
const port = 5000;

// Set up storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files (like CSS)

// Headers for HTTP requests
const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 11; RMX2144 Build/RKQ1.201217.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.71 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/375.1.0.28.111;]',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.facebook.com'
};

// Logo to display on the console
const logo = `
\x1b[1;33m################################################################
\x1b[1;34mFACEBOOK: F3LIIX URF PRINC3
\x1b[1;35mRUL3X: AKATSUKI 🖤
\x1b[1;36mBROTHERS: F3LIIX X 9L0N3
\x1b[1;33mRUL3X 0WN3R: F3LIIX
\x1b[1;34m################################################################
`;

// Serve the web interface
app.get('/', (req, res) => {
  console.clear();
  console.log(logo);
  console.log('\x1b[92mStart Time:', new Date().toLocaleString());

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>  
        <meta charset="utf-8">  
        <meta name="viewport" content="width=device-width, initial-scale=1.0">  
        <title>SEERAT AUTO COMMENTER</title>  
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
        <style>  
            body {
                background: linear-gradient(135deg, #1e3c72, #2a5298);
                font-family: 'Poppins', sans-serif;
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                overflow: auto;
            }
            .container {
                max-width: 700px;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 20px;
                padding: 30px;
                box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                margin: 20px;
            }
            h3 {
                text-align: center;
                font-size: 28px;
                font-weight: 700;
                color: #ffd700;
                margin-bottom: 10px;
            }
            h2 {
                text-align: center;
                font-size: 16px;
                font-weight: 400;
                color: #ccc;
                margin-bottom: 20px;
            }
            .form-control {
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid #ffd700;
                border-radius: 10px;
                padding: 10px;
                width: 100%;
                color: white;
                margin-bottom: 15px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            .form-control:focus {
                outline: none;
                border-color: #ff4d4d;
            }
            label {
                color: #ffd700;
                font-weight: 600;
                margin-bottom: 5px;
                display: block;
            }
            .btn-submit {
                background: #ff4d4d;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 25px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                display: block;
                margin: 20px auto;
                transition: background 0.3s, transform 0.2s;
            }
            .btn-submit:hover {
                background: #ffd700;
                color: #1e3c72;
                transform: scale(1.05);
            }
            .owner-info {
                text-align: center;
                margin-top: 20px;
                font-size: 14px;
                color: #ccc;
            }
            .owner-info a {
                color: #ffd700;
                text-decoration: none;
                font-weight: 600;
            }
            .owner-info a:hover {
                text-decoration: underline;
            }
        </style>
        <script>
            // Handle cookie method switching
            function toggleCookieMethod() {
                console.log('toggleCookieMethod called');
                const singleRadio = document.getElementById('singleCookie');
                const multiRadio = document.getElementById('multiCookie');
                const singleInput = document.getElementById('singleCookieInput');
                const multiInput = document.getElementById('multiCookieInput');

                if (singleRadio.checked) {
                    console.log('Single cookie selected');
                    singleInput.style.display = 'block';
                    multiInput.style.display = 'none';
                    // Clear multi cookie fields
                    const cookieFile = document.getElementById('cookieFile');
                    if (cookieFile) cookieFile.value = '';
                    const selectionDiv = document.getElementById('cookieSelectionDiv');
                    if (selectionDiv) selectionDiv.style.display = 'none';
                } else {
                    console.log('Multi cookie selected');
                    singleInput.style.display = 'none';
                    multiInput.style.display = 'block';
                    // Clear single cookie field
                    const singleText = document.getElementById('singleCookieText');
                    if (singleText) singleText.value = '';
                }
            }

            // Handle file upload and show cookie count
            function handleFileUpload(event) {
                console.log('File upload started');
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const content = e.target.result;
                            // Use simple split instead of regex to avoid errors
                            const lines = content.split('\\n');
                            const cookies = [];
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i].replace('\\r', '').trim();
                                if (line.length > 0) {
                                    cookies.push(line);
                                }
                            }
                            const cookieCount = cookies.length;

                            console.log('Found ' + cookieCount + ' cookies');

                            // Show selection div and update info
                            const selectionDiv = document.getElementById('cookieSelectionDiv');
                            const countInfo = document.getElementById('cookieCountInfo');
                            const countInput = document.getElementById('activeCookieCount');

                            if (selectionDiv) selectionDiv.style.display = 'block';
                            if (countInfo) countInfo.textContent = 'out of ' + cookieCount + ' cookies';
                            if (countInput) {
                                countInput.max = cookieCount;
                                countInput.value = Math.min(cookieCount, 5);
                            }
                        } catch (error) {
                            console.error('Error processing file:', error);
                        }
                    };
                    reader.readAsText(file);
                }
            }

            // Initialize event listeners
            document.addEventListener('DOMContentLoaded', function() {
                console.log('DOM loaded, setting up event listeners');

                const singleRadio = document.getElementById('singleCookie');
                const multiRadio = document.getElementById('multiCookie');
                const cookieFile = document.getElementById('cookieFile');

                if (singleRadio) {
                    singleRadio.addEventListener('change', toggleCookieMethod);
                    console.log('Single radio listener added');
                }
                if (multiRadio) {
                    multiRadio.addEventListener('change', toggleCookieMethod);
                    console.log('Multi radio listener added');
                }
                if (cookieFile) {
                    cookieFile.addEventListener('change', handleFileUpload);
                    console.log('File upload listener added');
                }

                // Form validation
                const form = document.querySelector('form');
                if (form) {
                    form.addEventListener('submit', function(e) {
                        const singleRadio = document.getElementById('singleCookie');
                        const singleCookieText = document.getElementById('singleCookieText');
                        const cookieFile = document.getElementById('cookieFile');

                        if (singleRadio && singleRadio.checked && singleCookieText && !singleCookieText.value.trim()) {
                            alert('Please enter a cookie or switch to file upload method.');
                            e.preventDefault();
                            return false;
                        }

                        if (singleRadio && !singleRadio.checked && cookieFile && !cookieFile.files[0]) {
                            alert('Please upload a cookies file or switch to single cookie method.');
                            e.preventDefault();
                            return false;
                        }
                    });
                }
            });
        </script>
    </head>  
    <body>  
        <div class="container">  
            <h3>SEERAT AUTO COMMENTER</h3>  
            <h2>Automate Your Facebook Post Comments</h2>  
            <form action="/" method="post" enctype="multipart/form-data">  
                <div class="mb-3">  
                    <label for="postId">Post ID:</label>  
                    <input type="text" class="form-control" id="postId" name="postId" placeholder="Enter Facebook Post ID" required>  
                </div>  
                <div class="mb-3">
                    <label style="color: #ffd700; font-weight: 600; margin-bottom: 10px; display: block;">Cookie Input Method:</label>

                    <!-- Cookie Input Method Selection -->
                    <div style="margin-bottom: 15px;">
                        <input type="radio" id="singleCookie" name="cookieMethod" value="single" checked style="margin-right: 8px;">
                        <label for="singleCookie" style="color: #ccc; margin-right: 20px; cursor: pointer;">Single Cookie</label>

                        <input type="radio" id="multiCookie" name="cookieMethod" value="multi" style="margin-right: 8px;">
                        <label for="multiCookie" style="color: #ccc; cursor: pointer;">Multiple Cookies (File Upload)</label>
                    </div>

                    <!-- Single Cookie Input -->
                    <div id="singleCookieInput" class="cookie-input-section">
                        <label for="singleCookieText">Enter Your Cookie:</label>
                        <input type="text" class="form-control" id="singleCookieText" name="singleCookieText" placeholder="Enter Facebook Cookie">
                    </div>

                    <!-- Multi Cookie File Upload -->
                    <div id="multiCookieInput" class="cookie-input-section" style="display: none;">
                        <label for="cookieFile">Upload Cookies File (cookies.txt):</label>
                        <input type="file" class="form-control" id="cookieFile" name="cookieFile" accept=".txt">
                        <small style="color: #ccc; font-size: 12px; margin-top: 5px; display: block;">Upload a text file with one cookie per line</small>

                        <!-- Cookie Selection Options -->
                        <div id="cookieSelectionDiv" style="margin-top: 15px; display: none;">
                            <label for="activeCookieCount">Select How Many Cookies to Use:</label>
                            <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                                <input type="number" class="form-control" id="activeCookieCount" name="activeCookieCount" min="1" value="1" style="width: 100px;">
                                <span style="color: #ccc; font-size: 14px;" id="cookieCountInfo">out of 0 cookies</span>
                            </div>
                            <small style="color: #28a745; font-size: 12px; margin-top: 5px; display: block;">Remaining cookies will be kept as backup</small>
                        </div>
                    </div>
                </div>  
                <div class="mb-3">  
                    <label for="comments">Paste Your Comments (one per line):</label>  
                    <textarea class="form-control" id="comments" name="comments" rows="6" placeholder="Enter your comments here, one per line" required></textarea>  
                </div>  
                <div class="mb-3">  
                    <label for="kidx">Enter Hater Name:</label>  
                    <input type="text" class="form-control" id="kidx" name="kidx" placeholder="Hater Name" required>  
                </div>  
                <div class="mb-3">  
                    <label for="time">Delay in Seconds:</label>  
                    <input type="number" class="form-control" id="time" name="time" value="60" required>  
                </div>  
                <button type="submit" class="btn-submit">Submit Your Details</button>  
            </form>  
            <div class="owner-info">  
                <h3>Owner: Mian Amir</h3>  
                <p>Contact: <a href="https://wa.me/+923114397148">WhatsApp +923114397148</a></p>  
            </div>  
        </div>  
    </body>  
    </html>
  `);
});

// POST route to handle form submission and comment posting
app.post('/', upload.single('cookieFile'), async (req, res) => {
  try {
    const postId = req.body.postId;
    const haterName = req.body.kidx;
    const delay = parseInt(req.body.time);
    const cookieMethod = req.body.cookieMethod;

    let allCookies = [];
    let activeCookieCount = 1;

    // Handle different cookie input methods
    if (cookieMethod === 'single') {
      // Single cookie input
      const singleCookie = req.body.singleCookieText;
      if (!singleCookie || !singleCookie.trim()) {
        throw new Error('Single cookie is required');
      }
      allCookies = [singleCookie.trim()];
      activeCookieCount = 1;
    } else {
      // Multi cookie file upload
      if (!req.file) {
        throw new Error('Cookie file is required for multi-cookie method');
      }

      const fileContent = req.file.buffer.toString('utf8');
      allCookies = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

      if (allCookies.length === 0) {
        throw new Error('At least one valid cookie is required in the uploaded file');
      }

      activeCookieCount = parseInt(req.body.activeCookieCount) || 1;
      activeCookieCount = Math.min(activeCookieCount, allCookies.length);
    }

    // Split cookies into active and backup
    const activeCookies = allCookies.slice(0, activeCookieCount);
    const backupCookies = allCookies.slice(activeCookieCount);

    console.log(`\x1b[96m[SETUP] Total Cookies: ${allCookies.length}, Active: ${activeCookies.length}, Backup: ${backupCookies.length}`);

    const validCookies = allCookies;

    // Read comments from uploaded file and validate
    const comments = req.body.comments.split('\n').map(line => line.trim()).filter(line => line);

    if (comments.length === 0) {
      throw new Error('At least one comment is required');
    }

    // Create a folder with the Post ID
    const folderName = `Post_${postId}`;
    await fs.mkdir(folderName, { recursive: true });

    // Save inputs to files
    await fs.writeFile(path.join(folderName, 'POST.txt'), postId);
    await fs.writeFile(path.join(folderName, 'cookies.txt'), validCookies.join('\n'));
    await fs.writeFile(path.join(folderName, 'haters.txt'), haterName);
    await fs.writeFile(path.join(folderName, 'time.txt'), delay.toString());
    await fs.writeFile(path.join(folderName, 'comments.txt'), comments.join('\n'));
    await fs.writeFile(path.join(folderName, 'np.txt'), 'NP');

    // Function to extract EAAG token using a specific cookie
    const getToken = async (cookieToUse) => {
      try {
        const response = await axios.get('https://business.facebook.com/business_locations', {
          headers: {
            ...headers,
            'Cookie': cookieToUse
          }
        });
        const tokenMatch = response.data.match(/(EAAG\w+)/);
        if (tokenMatch) {
          return tokenMatch[1];
        } else {
          throw new Error('EAAG token not found');
        }
      } catch (error) {
        console.log('\x1b[91m[!] Error fetching EAAG token:', error.message);
        throw error;
      }
    };

    // Advanced Cookie Management System
    const sendComments = async () => {
      try {
        const commentUrl = `https://graph.facebook.com/${postId}/comments`;

        // Cookie management variables
        let currentActiveCookies = [...activeCookies];
        let currentBackupCookies = [...backupCookies];
        let currentCookieIndex = 0;
        let currentToken = null;
        let tokenCookieIndex = -1;
        let cookieFailureCounts = new Array(currentActiveCookies.length).fill(0);
        let globalFailureCount = 0;

        // Function to replace failed cookie with backup
        const replaceCookieWithBackup = () => {
          if (currentBackupCookies.length > 0) {
            const failedCookie = currentActiveCookies[currentCookieIndex];
            const newCookie = currentBackupCookies.shift(); // Take first backup cookie
            currentActiveCookies[currentCookieIndex] = newCookie;
            cookieFailureCounts[currentCookieIndex] = 0; // Reset failure count
            currentToken = null; // Force token refresh

            console.log(`\x1b[93m[BACKUP] Replaced failed cookie with backup. Remaining backup cookies: ${currentBackupCookies.length}`);
            console.log(`\x1b[93m[BACKUP] Failed Cookie: ***HIDDEN***`);
            console.log(`\x1b[93m[BACKUP] New Cookie: ***HIDDEN***`);
            return true;
          }
          return false;
        };

        for (let x = 0; true; x = (x + 1) % comments.length) {
          try {
            // Check if current cookie has failed too many times (more than 5 failures)
            if (cookieFailureCounts[currentCookieIndex] >= 5) {
              console.log(`\x1b[91m[EXPIRED] Cookie ${currentCookieIndex + 1} has failed ${cookieFailureCounts[currentCookieIndex]} times, marking as expired`);
              if (!replaceCookieWithBackup()) {
                console.log(`\x1b[91m[ERROR] No backup cookies available! Switching to next active cookie...`);
                currentCookieIndex = (currentCookieIndex + 1) % currentActiveCookies.length;
                currentToken = null;
              }
            }

            // Get token if we don't have one or if we need to switch cookies
            if (!currentToken || tokenCookieIndex !== currentCookieIndex) {
              try {
                currentToken = await getToken(currentActiveCookies[currentCookieIndex]);
                tokenCookieIndex = currentCookieIndex;
                console.log(`\x1b[93m[ACTIVE] Using cookie ${currentCookieIndex + 1} of ${currentActiveCookies.length} (${currentBackupCookies.length} backup available)`);
              } catch (tokenError) {
                console.log(`\x1b[91m[!] Cookie ${currentCookieIndex + 1} failed for token. Failure count: ${cookieFailureCounts[currentCookieIndex] + 1}`);
                cookieFailureCounts[currentCookieIndex]++;

                // Try backup if cookie failed too many times
                if (cookieFailureCounts[currentCookieIndex] >= 3 && currentBackupCookies.length > 0) {
                  replaceCookieWithBackup();
                } else {
                  currentCookieIndex = (currentCookieIndex + 1) % currentActiveCookies.length;
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
            }

            const comment = comments[x];
            const commentWithName = `${haterName}: ${comment}`;

            // Use URLSearchParams for proper form-encoded data (Facebook Graph API requirement)
            const formData = new URLSearchParams();
            formData.append('message', commentWithName);
            formData.append('access_token', currentToken);

            const response = await axios.post(commentUrl, formData, {
              headers: {
                ...headers,
                'Cookie': currentActiveCookies[currentCookieIndex],
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });

            const currentTime = new Date().toLocaleString();
            if (response.data.id) {
              // Reset failure count on success
              cookieFailureCounts[currentCookieIndex] = 0;
              globalFailureCount = 0;

              console.log('\x1b[92mP0ST ID ::', postId);
              console.log('\x1b[92mDAT3 T1M3 ::', currentTime);
              console.log('\x1b[92mACTIV3 C00KI3 ::', `${currentCookieIndex + 1}/${currentActiveCookies.length}`);
              console.log('\x1b[92mBAKUP C00KI3S ::', currentBackupCookies.length);
              console.log('\x1b[92mAKATSUKI 🖤 ::', commentWithName);
              console.log('\x1b[97m################################################################');

              // Rotate to next cookie after successful comment (round-robin among active)
              if (currentActiveCookies.length > 1) {
                const nextCookieIndex = (currentCookieIndex + 1) % currentActiveCookies.length;
                currentCookieIndex = nextCookieIndex;
                currentToken = null; // Force token refresh with new cookie
              }
            } else {
              globalFailureCount++;
              console.log(`\x1b[91m[${globalFailureCount}] Status : Failure`);
              console.log(`\x1b[91m[/]Link : https://m.basic.facebook.com//${postId}`);
              console.log(`\x1b[91m[/]Comments : ${commentWithName}\n`);
            }

            // Wait for the specified delay
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
          } catch (error) {
            console.log(`\x1b[91m[!] Error making request with cookie ${currentCookieIndex + 1}:`, error.message);
            cookieFailureCounts[currentCookieIndex]++;
            globalFailureCount++;

            // Check if it's an authentication/authorization error (400/401/403) - immediate failure
            const isAuthError = error.response && [400, 401, 403].includes(error.response.status);

            if (isAuthError || cookieFailureCounts[currentCookieIndex] >= 3) {
              if (isAuthError) {
                console.log(`\x1b[91m[AUTH_ERROR] HTTP ${error.response.status} - Treating as immediate cookie failure`);
              }

              if (currentBackupCookies.length > 0) {
                replaceCookieWithBackup();
              } else {
                currentCookieIndex = (currentCookieIndex + 1) % currentActiveCookies.length;
                currentToken = null; // Force token refresh with new cookie
              }
            } else {
              currentCookieIndex = (currentCookieIndex + 1) % currentActiveCookies.length;
              currentToken = null; // Force token refresh with new cookie
            }

            console.log(`\x1b[93m[SWITCH] Moving to cookie ${currentCookieIndex + 1} of ${currentActiveCookies.length}`);
            await new Promise(resolve => setTimeout(resolve, 5500)); // Wait 5.5 seconds
          }
        }
      } catch (error) {
        console.log('\x1b[91m[!] An unexpected error occurred:', error.message);
      }
    };

    // Start sending comments in the background
    sendComments();

    // Redirect to the index page
    res.redirect('/');
  } catch (error) {
    console.error('\x1b[91mError:', error.message);
    res.status(500).send('An error occurred while processing your request.');
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});