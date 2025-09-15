// Post server creation functionality
class CreatePostServer {
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
        document.getElementById('createPostServerForm').addEventListener('submit', (e) => {
            this.handleCreatePostServer(e);
        });

        // Cookie type selector
        this.setupCookieTypeSelector();
        
        // Message type selector
        this.setupMessageTypeSelector();
        
        // File upload handling for message files
        this.setupMessageFileHandling();
        
        // File upload handling for cookie files
        this.setupCookieFileHandling();

        // Success modal handler
        document.getElementById('viewDashboardBtn')?.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
    
    setupCookieTypeSelector() {
        const singleCookieBtn = document.getElementById('singleCookieBtn');
        const multiCookieBtn = document.getElementById('multiCookieBtn');
        const singleCookieGroup = document.getElementById('singleCookieGroup');
        const multiCookieGroup = document.getElementById('multiCookieGroup');
        
        singleCookieBtn.addEventListener('click', () => {
            singleCookieBtn.classList.add('active');
            multiCookieBtn.classList.remove('active');
            singleCookieGroup.classList.remove('hidden');
            multiCookieGroup.classList.add('hidden');
            
            // Clear multi cookie file
            document.getElementById('cookieFile').value = '';
            document.getElementById('cookieFileName').classList.add('hidden');
        });
        
        multiCookieBtn.addEventListener('click', () => {
            multiCookieBtn.classList.add('active');
            singleCookieBtn.classList.remove('active');
            multiCookieGroup.classList.remove('hidden');
            singleCookieGroup.classList.add('hidden');
            
            // Clear single cookie textarea
            document.getElementById('facebookCookie').value = '';
        });
    }
    
    setupMessageTypeSelector() {
        const fileUploadBtn = document.getElementById('fileUploadBtn');
        const pasteContentBtn = document.getElementById('pasteContentBtn');
        const messageFileGroup = document.getElementById('messageFileGroup');
        const messagePasteGroup = document.getElementById('messagePasteGroup');
        
        fileUploadBtn.addEventListener('click', () => {
            fileUploadBtn.classList.add('active');
            pasteContentBtn.classList.remove('active');
            messageFileGroup.classList.remove('hidden');
            messagePasteGroup.classList.add('hidden');
            
            // Clear paste content
            document.getElementById('messageContent').value = '';
        });
        
        pasteContentBtn.addEventListener('click', () => {
            pasteContentBtn.classList.add('active');
            fileUploadBtn.classList.remove('active');
            messagePasteGroup.classList.remove('hidden');
            messageFileGroup.classList.add('hidden');
            
            // Clear file upload
            document.getElementById('messageFile').value = '';
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
                
                // Process file to count cookies and show selection options
                this.processCookieFile(file);
            } else {
                cookieFileName.classList.add('hidden');
                cookieFileArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                
                // Hide selection group
                document.getElementById('cookieSelectionGroup').classList.add('hidden');
            }
        });
        
        // Drag and drop for cookie files
        cookieFileArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            cookieFileArea.style.borderColor = '#ffc107';
            cookieFileArea.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
        });
        
        cookieFileArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            cookieFileArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            cookieFileArea.style.backgroundColor = 'transparent';
        });
        
        cookieFileArea.addEventListener('drop', (e) => {
            e.preventDefault();
            cookieFileArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            cookieFileArea.style.backgroundColor = 'transparent';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                cookieFileInput.files = files;
                cookieFileInput.dispatchEvent(new Event('change'));
            }
        });
    }
    
    setupMessageFileHandling() {
        const messageFileInput = document.getElementById('messageFile');
        const messageFileArea = document.querySelector('#messageFileGroup .file-upload-area');
        const fileName = document.getElementById('fileName');
        
        messageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.name.toLowerCase().endsWith('.txt')) {
                    alert('Please select a .txt file only');
                    messageFileInput.value = '';
                    return;
                }
                
                // Validate file size (5MB limit)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size must be less than 5MB');
                    messageFileInput.value = '';
                    return;
                }
                
                fileName.textContent = `📄 ${file.name} (${this.formatFileSize(file.size)})`;
                fileName.classList.remove('hidden');
                messageFileArea.style.borderColor = '#00ff88';
            } else {
                fileName.classList.add('hidden');
                messageFileArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        });
        
        // Drag and drop for message files
        messageFileArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            messageFileArea.style.borderColor = '#00ff88';
            messageFileArea.style.backgroundColor = 'rgba(0, 255, 136, 0.1)';
        });
        
        messageFileArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            messageFileArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            messageFileArea.style.backgroundColor = 'transparent';
        });
        
        messageFileArea.addEventListener('drop', (e) => {
            e.preventDefault();
            messageFileArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            messageFileArea.style.backgroundColor = 'transparent';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                messageFileInput.files = files;
                messageFileInput.dispatchEvent(new Event('change'));
            }
        });
    }

    authenticateSocket() {
        const token = localStorage.getItem('authToken');
        if (token) {
            this.socket.emit('authenticate', token);
        }
    }

    async handleCreatePostServer(e) {
        e.preventDefault();
        
        const createBtn = document.getElementById('createBtn');
        const btnText = createBtn.querySelector('.btn-text');
        const spinner = createBtn.querySelector('.spinner');
        
        // Check authentication first
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Authentication required. Please login again.');
            window.location.href = 'login.html';
            return;
        }
        
        // Disable button and show loading state
        createBtn.disabled = true;
        btnText.textContent = 'Creating Post Server...';
        spinner.classList.remove('hidden');
        
        try {
            const formData = new FormData();
            const form = e.target;
            
            // Get form values
            const serverName = form.name.value.trim();
            const postId = form.postId.value.trim();
            const speed = parseInt(form.speed.value) * 1000; // Convert to milliseconds
            const targetName = form.targetName.value.trim();
            
            // Validate required fields
            if (!serverName || !postId) {
                throw new Error('Server name and Post ID are required');
            }
            
            // Determine cookie type and validate
            const isMultiCookie = document.getElementById('multiCookieBtn').classList.contains('active');
            let cookieData = '';
            
            if (isMultiCookie) {
                const cookieFile = form.cookieFile.files[0];
                if (!cookieFile) {
                    throw new Error('Please upload a cookie file or switch to single cookie mode');
                }
                formData.append('cookieFile', cookieFile);
            } else {
                cookieData = form.facebookCookie.value.trim();
                if (!cookieData) {
                    throw new Error('Please provide a Facebook cookie');
                }
            }
            
            // Determine message input type and validate
            const isFileUpload = document.getElementById('fileUploadBtn').classList.contains('active');
            let messageData = '';
            
            if (isFileUpload) {
                const messageFile = form.messageFile.files[0];
                if (!messageFile) {
                    throw new Error('Please upload a comment file or switch to paste content mode');
                }
                formData.append('messageFile', messageFile);
            } else {
                messageData = form.messageContent.value.trim();
                if (!messageData) {
                    throw new Error('Please provide comment content');
                }
            }
            
            // Add form data
            formData.append('name', serverName);
            formData.append('postId', postId);
            formData.append('speed', speed);
            formData.append('targetName', targetName);
            formData.append('isMultiCookie', isMultiCookie);
            formData.append('serverType', 'post'); // Identify this as a post server
            
            // Add active cookie count if multi-cookie
            if (isMultiCookie) {
                const activeCookieCount = document.getElementById('activeCookieCount').value || 1;
                formData.append('activeCookieCount', activeCookieCount);
            }
            
            if (!isMultiCookie) {
                formData.append('facebookCookie', cookieData);
            }
            
            if (!isFileUpload) {
                formData.append('messageContent', messageData);
            }
            
            // Create server
            const response = await fetch('/api/servers/create-post', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showSuccessModal();
            } else {
                throw new Error(result.message || 'Failed to create post server');
            }
            
        } catch (error) {
            console.error('Error creating post server:', error);
            alert(`Error: ${error.message}`);
        } finally {
            // Reset button state
            createBtn.disabled = false;
            btnText.textContent = 'Create & Run Post Server';
            spinner.classList.add('hidden');
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    processCookieFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const lines = content.split('\n');
                const cookies = [];
                
                for (let line of lines) {
                    const cleanLine = line.replace('\r', '').trim();
                    if (cleanLine.length > 0) {
                        cookies.push(cleanLine);
                    }
                }
                
                const cookieCount = cookies.length;
                
                if (cookieCount > 0) {
                    // Show selection group and update info
                    const selectionGroup = document.getElementById('cookieSelectionGroup');
                    const countInfo = document.getElementById('cookieCountInfo');
                    const activeCookieCountInput = document.getElementById('activeCookieCount');
                    const activeCookieDisplay = document.getElementById('activeCookieDisplay');
                    const backupCookieDisplay = document.getElementById('backupCookieDisplay');
                    const totalCookieDisplay = document.getElementById('totalCookieDisplay');
                    
                    // Show selection group
                    selectionGroup.classList.remove('hidden');
                    
                    // Update total cookies info
                    countInfo.textContent = `out of ${cookieCount} cookies`;
                    totalCookieDisplay.textContent = cookieCount;
                    
                    // Set max and initial value for active cookie count
                    activeCookieCountInput.max = cookieCount;
                    activeCookieCountInput.value = Math.min(cookieCount, 1);
                    
                    // Update displays
                    this.updateCookieDisplay();
                    
                    // Add event listener for active cookie count changes
                    activeCookieCountInput.addEventListener('input', () => {
                        this.updateCookieDisplay();
                    });
                }
                
            } catch (error) {
                console.error('Error processing cookie file:', error);
                alert('Error reading cookie file. Please ensure it\'s a valid text file.');
            }
        };
        reader.readAsText(file);
    }
    
    updateCookieDisplay() {
        const activeCookieCountInput = document.getElementById('activeCookieCount');
        const activeCookieDisplay = document.getElementById('activeCookieDisplay');
        const backupCookieDisplay = document.getElementById('backupCookieDisplay');
        const totalCookieDisplay = document.getElementById('totalCookieDisplay');
        
        const activeCount = parseInt(activeCookieCountInput.value) || 1;
        const totalCount = parseInt(totalCookieDisplay.textContent) || 0;
        const backupCount = Math.max(0, totalCount - activeCount);
        
        activeCookieDisplay.textContent = activeCount;
        backupCookieDisplay.textContent = backupCount;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize post server creation
document.addEventListener('DOMContentLoaded', () => {
    new CreatePostServer();
});