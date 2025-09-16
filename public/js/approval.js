document.addEventListener('DOMContentLoaded', function() {
    const approvalKeyElement = document.getElementById('approvalKey');
    const copyKeyBtn = document.getElementById('copyKeyBtn');
    const whatsappBtn = document.getElementById('whatsappBtn');
    const loginBtn = document.getElementById('loginBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    
    let currentUser = null;
    let approvalKey = null;

    // Load user data from localStorage or session
    function loadUserData() {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');
        
        if (token && userData) {
            currentUser = JSON.parse(userData);
            if (currentUser.approvalKey) {
                approvalKey = currentUser.approvalKey;
                displayApprovalKey();
            } else {
                // If no approval key in stored data, fetch from server
                fetchUserProfile();
            }
        } else {
            // Redirect to login if no user data
            window.location.href = '/login.html';
        }
    }

    // Fetch user profile to get approval key
    async function fetchUserProfile() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const response = await fetch('/api/auth/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                currentUser = data.user;
                localStorage.setItem('userData', JSON.stringify(currentUser));
                
                if (currentUser.isApproved) {
                    // User is already approved, redirect to dashboard
                    window.location.href = '/dashboard.html';
                    return;
                }
                
                approvalKey = currentUser.approvalKey;
                displayApprovalKey();
            } else {
                console.error('Failed to fetch user profile');
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            window.location.href = '/login.html';
        }
    }

    // Display approval key
    function displayApprovalKey() {
        if (approvalKey) {
            approvalKeyElement.textContent = approvalKey;
            approvalKeyElement.style.opacity = '1';
        }
    }

    // Copy approval key to clipboard
    function copyApprovalKey() {
        if (approvalKey) {
            navigator.clipboard.writeText(approvalKey).then(function() {
                // Visual feedback
                const originalText = copyKeyBtn.textContent;
                copyKeyBtn.textContent = '✅';
                copyKeyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
                
                setTimeout(() => {
                    copyKeyBtn.textContent = originalText;
                    copyKeyBtn.style.background = '';
                }, 2000);
            }).catch(function(err) {
                console.error('Failed to copy: ', err);
                // Fallback for older browsers
                fallbackCopyTextToClipboard(approvalKey);
            });
        }
    }

    // Fallback copy method
    function fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "-1000px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            // Visual feedback
            const originalText = copyKeyBtn.textContent;
            copyKeyBtn.textContent = '✅';
            setTimeout(() => {
                copyKeyBtn.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Fallback: Could not copy text: ', err);
        }

        document.body.removeChild(textArea);
    }

    // Open WhatsApp
    function openWhatsApp() {
        const phoneNumber = '971565929614';
        const message = `Hi Owner Adeel,\n\nI have registered on Server Manager and my account is pending approval.\n\nMy Approval Key: ${approvalKey}\nName: ${currentUser ? currentUser.name : 'N/A'}\nEmail: ${currentUser ? currentUser.email : 'N/A'}\n\nPlease approve my account.\n\nThank you!`;
        
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }

    // Check approval status
    async function checkApprovalStatus() {
        try {
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = 'Checking...';
            refreshBtn.disabled = true;

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
                currentUser = data.user;
                localStorage.setItem('userData', JSON.stringify(currentUser));
                
                if (currentUser.isApproved) {
                    // Show success animation
                    document.querySelector('.status-icon').textContent = '✅';
                    document.querySelector('.approval-header h1').textContent = 'Account Approved!';
                    document.querySelector('.approval-header p').textContent = 'Your account has been approved. Redirecting to dashboard...';
                    
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 2000);
                } else {
                    // Show "still pending" message
                    refreshBtn.textContent = 'Still Pending';
                    setTimeout(() => {
                        refreshBtn.textContent = originalText;
                        refreshBtn.disabled = false;
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Error checking status:', error);
            refreshBtn.textContent = 'Error';
            setTimeout(() => {
                refreshBtn.textContent = 'Check Status';
                refreshBtn.disabled = false;
            }, 2000);
        }
    }

    // Event listeners
    copyKeyBtn.addEventListener('click', copyApprovalKey);
    whatsappBtn.addEventListener('click', openWhatsApp);
    loginBtn.addEventListener('click', () => window.location.href = '/login.html');
    refreshBtn.addEventListener('click', checkApprovalStatus);

    // Initialize
    loadUserData();

    // Auto-refresh status every 30 seconds
    setInterval(() => {
        if (currentUser && !currentUser.isApproved) {
            fetchUserProfile();
        }
    }, 30000);
});