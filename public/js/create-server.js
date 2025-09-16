// Server creation functionality
class CreateServer {
    constructor() {
        this.socket = io();
        this.init();
    }

    init() {
        // Require authentication
        if (!Auth.requireAuth()) return;

        this.setupEventListeners();
        this.authenticateSocket();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('logoutBtn').addEventListener('click', () => {
            new Auth().logout();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        // Form submission
        document.getElementById('createServerForm').addEventListener('submit', (e) => {
            this.handleCreateServer(e);
        });

        // Cookie type selector
        this.setupCookieTypeSelector();
        
        // Message type selector
        this.setupMessageTypeSelector();
        
        // File upload handling for message files
        this.setupMessageFileHandling();
        
        // File upload handling for cookie files
        this.setupCookieFileHandling();

    }
    
    setupCookieTypeSelector() {
        const singleCookieBtn = document.getElementById('singleCookieBtn');
        const multiCookieBtn = document.getElementById('multiCookieBtn');
        const singleCookieGroup = document.getElementById('singleCookieGroup');
        const multiCookieGroup = document.getElementById('multiCookieGroup');
        const facebookCookie = document.getElementById('facebookCookie');
        const cookieFile = document.getElementById('cookieFile');
        
        singleCookieBtn.addEventListener('click', () => {
            singleCookieBtn.classList.add('active');
            multiCookieBtn.classList.remove('active');
            singleCookieGroup.classList.remove('hidden');
            multiCookieGroup.classList.add('hidden');
            
            // Toggle required attributes
            facebookCookie.required = true;
            cookieFile.required = false;
            
            // Clear multi cookie file
            cookieFile.value = '';
            document.getElementById('cookieFileName').classList.add('hidden');
            document.getElementById('cookieSelectionGroup').classList.add('hidden');
        });
        
        multiCookieBtn.addEventListener('click', () => {
            multiCookieBtn.classList.add('active');
            singleCookieBtn.classList.remove('active');
            multiCookieGroup.classList.remove('hidden');
            singleCookieGroup.classList.add('hidden');
            
            // Toggle required attributes
            facebookCookie.required = false;
            cookieFile.required = true;
            
            // Clear single cookie textarea
            facebookCookie.value = '';
        });
    }
    
    setupMessageTypeSelector() {
        const fileUploadBtn = document.getElementById('fileUploadBtn');
        const pasteContentBtn = document.getElementById('pasteContentBtn');
        const messageFileGroup = document.getElementById('messageFileGroup');
        const messagePasteGroup = document.getElementById('messagePasteGroup');
        const messageFile = document.getElementById('messageFile');
        const messageContent = document.getElementById('messageContent');
        
        fileUploadBtn.addEventListener('click', () => {
            fileUploadBtn.classList.add('active');
            pasteContentBtn.classList.remove('active');
            messageFileGroup.classList.remove('hidden');
            messagePasteGroup.classList.add('hidden');
            
            // Toggle required attributes
            messageFile.required = true;
            messageContent.required = false;
            
            // Clear paste content
            messageContent.value = '';
        });
        
        pasteContentBtn.addEventListener('click', () => {
            pasteContentBtn.classList.add('active');
            fileUploadBtn.classList.remove('active');
            messagePasteGroup.classList.remove('hidden');
            messageFileGroup.classList.add('hidden');
            
            // Toggle required attributes
            messageFile.required = false;
            messageContent.required = true;
            
            // Clear file upload
            messageFile.value = '';
            document.getElementById('fileName').classList.add('hidden');
        });
    }
    
    setupCookieFileHandling() {
        const cookieFileInput = document.getElementById('cookieFile');
        const cookieFileArea = document.querySelector('#multiCookieGroup .file-upload-area');
        const cookieFileName = document.getElementById('cookieFileName');
        
        cookieFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.name.toLowerCase().endsWith('.txt')) {
                    alert('Please select a .txt file only');
                    cookieFileInput.value = '';
                    return;
                }
                
                // Validate file size (5MB limit)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size must be less than 5MB');
                    cookieFileInput.value = '';
                    return;
                }
                
                cookieFileName.textContent = `🍪 ${file.name} (${this.formatFileSize(file.size)})`;
                cookieFileName.classList.remove('hidden');
                cookieFileArea.style.borderColor = '#ffc107';
                cookieFileArea.style.background = 'rgba(255, 193, 7, 0.1)';
                cookieFileArea.querySelector('.file-upload-text').innerHTML = '<strong>Cookie file selected!</strong>';
                
                // Process file to count cookies and show selection options
                this.processCookieFile(file);
            } else {
                cookieFileName.classList.add('hidden');
                cookieFileArea.style.borderColor = 'rgba(255, 193, 7, 0.4)';
                cookieFileArea.style.background = 'rgba(255, 193, 7, 0.05)';
                cookieFileArea.querySelector('.file-upload-text').innerHTML = '<strong>Click to upload</strong> or drag and drop your cookies .txt file here';
                
                // Hide selection group if no file
                document.getElementById('cookieSelectionGroup').classList.add('hidden');
            }
        });
        
        // Drag and drop for cookie file
        cookieFileArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cookieFileArea.style.borderColor = '#ffc107';
            cookieFileArea.style.background = 'rgba(255, 193, 7, 0.2)';
        });
        
        cookieFileArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!cookieFileInput.files.length) {
                cookieFileArea.style.borderColor = 'rgba(255, 193, 7, 0.4)';
                cookieFileArea.style.background = 'rgba(255, 193, 7, 0.05)';
            }
        });
        
        cookieFileArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.toLowerCase().endsWith('.txt')) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    cookieFileInput.files = dataTransfer.files;
                    cookieFileInput.dispatchEvent(new Event('change'));
                } else {
                    alert('Please drop a .txt file only');
                }
            }
        });
    }
    
    setupMessageFileHandling() {
        const fileInput = document.getElementById('messageFile');
        const fileUploadArea = document.querySelector('#messageFileGroup .file-upload-area');
        const fileName = document.getElementById('fileName');

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.name.toLowerCase().endsWith('.txt')) {
                    alert('Please select a .txt file only');
                    fileInput.value = '';
                    return;
                }
                
                // Validate file size (5MB limit)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size must be less than 5MB');
                    fileInput.value = '';
                    return;
                }

                fileName.textContent = `📄 ${file.name} (${this.formatFileSize(file.size)})`;
                fileName.classList.remove('hidden');
                fileUploadArea.style.borderColor = '#28a745';
                fileUploadArea.style.background = '#f8fff8';
                fileUploadArea.querySelector('.file-upload-text').innerHTML = '<strong>File selected successfully!</strong>';
            } else {
                fileName.classList.add('hidden');
                fileUploadArea.style.borderColor = '#e1e8ed';
                fileUploadArea.style.background = '#f8f9fa';
                fileUploadArea.querySelector('.file-upload-text').innerHTML = '<strong>Click to upload</strong> or drag and drop your .txt file here';
            }
        });

        // Drag and drop for file upload
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileUploadArea.style.borderColor = '#667eea';
            fileUploadArea.style.background = '#f0f2ff';
        });

        fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!fileInput.files.length) {
                fileUploadArea.style.borderColor = '#e1e8ed';
                fileUploadArea.style.background = '#f8f9fa';
            }
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.toLowerCase().endsWith('.txt')) {
                    // Create a new FileList-like object
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                    fileInput.dispatchEvent(new Event('change'));
                } else {
                    alert('Please drop a .txt file only');
                }
            }
        });

        // Fix click handler for file upload area
        fileUploadArea.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        // Socket event listeners
        this.socket.on('connect', () => {
            this.authenticateSocket();
        });

        this.socket.on('authError', (error) => {
            console.error('Socket authentication error:', error);
            new Auth().logout();
        });

        // Success modal
        document.getElementById('viewDashboardBtn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }

    authenticateSocket() {
        const token = localStorage.getItem('authToken');
        if (token) {
            this.socket.emit('authenticate', token);
        }
    }

    async handleCreateServer(e) {
        e.preventDefault();
        console.log('🚀 Create Server button clicked!');
        
        const createBtn = document.getElementById('createBtn');
        const btnText = createBtn.querySelector('.btn-text');
        const spinner = createBtn.querySelector('.spinner');

        try {
            // Show loading state
            createBtn.disabled = true;
            btnText.textContent = 'Creating Server...';
            spinner.classList.remove('hidden');

            // Prepare form data
            const formData = new FormData(e.target);
            
            // Validation based on selected options
            const requiredFields = ['name', 'groupTid'];
            console.log('📋 Checking required fields...');
            for (const field of requiredFields) {
                const value = formData.get(field)?.trim();
                console.log(`Field ${field}:`, value || 'EMPTY');
                if (!value) {
                    throw new Error(`${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`);
                }
            }
            
            // Cookie validation
            const singleCookieActive = document.getElementById('singleCookieBtn').classList.contains('active');
            console.log('🍪 Cookie mode:', singleCookieActive ? 'Single' : 'Multi');
            
            if (singleCookieActive) {
                const facebookCookie = formData.get('facebookCookie')?.trim();
                console.log('Single cookie length:', facebookCookie ? facebookCookie.length : 'EMPTY');
                if (!facebookCookie) {
                    throw new Error('Facebook Cookie is required');
                }
                if (!facebookCookie.includes('c_user=') || !facebookCookie.includes('xs=')) {
                    throw new Error('Invalid Facebook cookie format. Please ensure it contains c_user and xs parameters.');
                }
            } else {
                const cookieFile = formData.get('cookieFile');
                console.log('Multi cookie file:', cookieFile ? `${cookieFile.name} (${cookieFile.size} bytes)` : 'No file selected');
                if (!cookieFile || cookieFile.size === 0) {
                    throw new Error('Cookie file is required when using multi-cookie option.');
                }
            }

            // Message content validation
            const messageFileActive = document.getElementById('fileUploadBtn').classList.contains('active');
            if (messageFileActive) {
                const messageFile = formData.get('messageFile');
                if (!messageFile || messageFile.size === 0) {
                    throw new Error('Message file is required. Please upload a .txt file with messages to send.');
                }
            } else {
                const messageContent = formData.get('messageContent')?.trim();
                if (!messageContent) {
                    throw new Error('Message content is required. Please paste your messages.');
                }
                
                // Add target name prefix to messages if provided
                const targetName = formData.get('targetName')?.trim();
                if (targetName) {
                    const messages = messageContent.split('\n').filter(msg => msg.trim());
                    const prefixedMessages = messages.map(msg => `${targetName}: ${msg.trim()}`);
                    formData.set('messageContent', prefixedMessages.join('\n'));
                }
            }

            // Validate speed (convert seconds to milliseconds for backend)
            const speedSeconds = parseInt(formData.get('speed'));
            if (speedSeconds < 1 || speedSeconds > 3600) {
                throw new Error('Message speed must be between 1 and 3600 seconds');
            }
            
            // Convert seconds to milliseconds for backend processing
            const speedMs = speedSeconds * 1000;
            formData.set('speed', speedMs.toString());

            // Add target name to form data for file-based messages
            const targetName = formData.get('targetName')?.trim();
            if (targetName && messageFileActive) {
                formData.set('targetName', targetName);
            }
            
            // Send request to create server
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/servers', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                // Show success modal
                this.showSuccessModal(data.server);
                
                // Auto-start the server
                await this.startServer(data.server.id, token);
                
            } else {
                throw new Error(data.error || 'Failed to create server');
            }

        } catch (error) {
            console.error('Server creation error:', error);
            
            // Show more detailed error message
            const errorMessage = error.message || 'Unknown error occurred';
            alert(`خرابی: ${errorMessage}\n\nبرائے کرم تمام required fields بھریں:\n- Server Name\n- Group TID \n- Facebook Cookie\n- Message Content`);
        } finally {
            // Reset button state
            createBtn.disabled = false;
            btnText.textContent = 'Create & Run Server';
            spinner.classList.add('hidden');
        }
    }

    async startServer(serverId, token) {
        try {
            const response = await fetch(`/api/servers/${serverId}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Update success modal to show server is running
                const modalBody = document.querySelector('.modal-body p');
                modalBody.innerHTML = `
                    Your server has been created and <strong>started successfully</strong>! 
                    You can now monitor its activity and view real-time logs from the dashboard.
                `;
            }
        } catch (error) {
            console.error('Error starting server:', error);
        }
    }

    showSuccessModal(server) {
        const modal = document.getElementById('successModal');
        modal.classList.remove('hidden');

        // Add animation
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }

    async processCookieFile(file) {
        try {
            const text = await this.readFileAsText(file);
            const cookies = text.split('\n').filter(cookie => cookie.trim()).map(cookie => cookie.trim());
            
            if (cookies.length === 0) {
                alert('Cookie file is empty or contains no valid cookies');
                return;
            }
            
            // Update UI with cookie count
            document.getElementById('totalCookies').textContent = cookies.length;
            document.getElementById('cookieSelectionGroup').classList.remove('hidden');
            
            // Set max value for active cookie input
            const activeCookieInput = document.getElementById('activeCookieCount');
            activeCookieInput.max = cookies.length;
            activeCookieInput.value = Math.min(1, cookies.length);
            
            // Update backup count
            this.updateBackupCount();
            
            // Add event listeners for cookie selection
            this.setupCookieSelection();
            
        } catch (error) {
            console.error('Error processing cookie file:', error);
            alert('Error reading cookie file. Please try again.');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    setupCookieSelection() {
        const activeCookieInput = document.getElementById('activeCookieCount');
        const quickBtns = document.querySelectorAll('.quick-btn');
        
        // Remove existing listeners to prevent duplicates
        activeCookieInput.removeEventListener('input', () => this.updateBackupCount());
        quickBtns.forEach(btn => {
            btn.removeEventListener('click', this.handleQuickSelect);
        });
        
        // Add input listener
        activeCookieInput.addEventListener('input', () => this.updateBackupCount());
        
        // Add quick select listeners with proper binding
        quickBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleQuickSelect(e));
        });
    }

    handleQuickSelect(e) {
        e.preventDefault();  // Prevent form submission
        e.stopPropagation(); // Stop event bubbling
        
        const count = parseInt(e.target.dataset.count);
        const activeCookieInput = document.getElementById('activeCookieCount');
        const maxCookies = parseInt(activeCookieInput.max);
        
        if (count <= maxCookies) {
            activeCookieInput.value = count;
            this.updateBackupCount();
            
            // Visual feedback for selected button
            document.querySelectorAll('.quick-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
        }
    }

    updateBackupCount() {
        const totalCookies = parseInt(document.getElementById('totalCookies').textContent) || 0;
        const activeCookies = parseInt(document.getElementById('activeCookieCount').value) || 0;
        const backupCookies = Math.max(0, totalCookies - activeCookies);
        
        document.getElementById('backupCookies').textContent = backupCookies;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize create server page
document.addEventListener('DOMContentLoaded', () => {
    new CreateServer();
});