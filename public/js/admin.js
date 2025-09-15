document.addEventListener('DOMContentLoaded', function() {
    const adminLogin = document.getElementById('adminLogin');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminMessage = document.getElementById('adminMessage');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const usersContainer = document.getElementById('usersContainer');
    const refreshUsers = document.getElementById('refreshUsers');
    const userSearch = document.getElementById('userSearch');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const totalUsersEl = document.getElementById('totalUsers');
    const pendingUsersEl = document.getElementById('pendingUsers');
    const approvedUsersEl = document.getElementById('approvedUsers');

    let allUsers = [];
    let currentFilter = 'pending';
    let isLoggedIn = false;

    // Check if admin is already logged in
    function checkAdminLogin() {
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken === 'admin_logged_in') {
            showDashboard();
        }
    }

    // Show message
    function showMessage(message, type = 'error') {
        adminMessage.textContent = message;
        adminMessage.className = `message ${type}`;
        adminMessage.classList.remove('hidden');
        
        setTimeout(() => {
            adminMessage.classList.add('hidden');
        }, 5000);
    }

    // Admin login
    adminLoginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        
        if (username === 'adeel' && password === 'adeel') {
            localStorage.setItem('adminToken', 'admin_logged_in');
            showMessage('Login successful!', 'success');
            setTimeout(() => {
                showDashboard();
            }, 1000);
        } else {
            showMessage('Invalid username or password');
        }
    });

    // Show dashboard
    function showDashboard() {
        adminLogin.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
        isLoggedIn = true;
        loadUsers();
    }

    // Admin logout
    adminLogoutBtn.addEventListener('click', function() {
        localStorage.removeItem('adminToken');
        adminDashboard.classList.add('hidden');
        adminLogin.classList.remove('hidden');
        isLoggedIn = false;
        
        // Clear form
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
    });

    // Load users from API
    async function loadUsers() {
        try {
            usersContainer.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading users...</p>
                </div>
            `;

            const response = await fetch('/api/admin/users', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Admin-Auth': 'admin_logged_in'
                }
            });

            if (response.ok) {
                const data = await response.json();
                allUsers = data.users;
                updateStats();
                displayUsers();
            } else {
                throw new Error('Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            usersContainer.innerHTML = `
                <div class="empty-state">
                    <p>Failed to load users. Please try again.</p>
                </div>
            `;
        }
    }

    // Update stats
    function updateStats() {
        const total = allUsers.length;
        const pending = allUsers.filter(user => !user.isApproved).length;
        const approved = allUsers.filter(user => user.isApproved).length;

        totalUsersEl.textContent = total;
        pendingUsersEl.textContent = pending;
        approvedUsersEl.textContent = approved;
    }

    // Display users
    function displayUsers() {
        let filteredUsers = allUsers;
        
        // Filter by status
        if (currentFilter === 'pending') {
            filteredUsers = allUsers.filter(user => !user.isApproved);
        } else if (currentFilter === 'approved') {
            filteredUsers = allUsers.filter(user => user.isApproved);
        }
        
        // Filter by search
        const searchTerm = userSearch.value.toLowerCase();
        if (searchTerm) {
            filteredUsers = filteredUsers.filter(user => 
                user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredUsers.length === 0) {
            usersContainer.innerHTML = `
                <div class="empty-state">
                    <p>No users found matching your criteria.</p>
                </div>
            `;
            return;
        }

        usersContainer.innerHTML = filteredUsers.map(user => `
            <div class="user-card">
                <div class="user-info">
                    <div class="user-name">${escapeHtml(user.name)}</div>
                    <div class="user-email">${escapeHtml(user.email)}</div>
                    <div class="user-details">
                        <div class="user-detail">
                            <div class="detail-label">Approval Key</div>
                            <div class="detail-value">${escapeHtml(user.approvalKey)}</div>
                        </div>
                        <div class="user-detail">
                            <div class="detail-label">Registered</div>
                            <div class="detail-value">${new Date(user.createdAt).toLocaleDateString()}</div>
                        </div>
                        ${user.isApproved ? `
                            <div class="user-detail">
                                <div class="detail-label">Approved</div>
                                <div class="detail-value">${new Date(user.approvedAt).toLocaleDateString()}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="user-status">
                    <div class="status-badge ${user.isApproved ? 'approved' : 'pending'}">
                        ${user.isApproved ? 'Approved' : 'Pending'}
                    </div>
                    ${!user.isApproved ? `
                        <button class="approve-btn" data-user-id="${user.id}">
                            Approve User
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    // Approve user
    async function approveUser(userId) {
        try {
            // Disable the button and show loading state
            const approveBtn = document.querySelector(`button[data-user-id="${userId}"]`);
            if (approveBtn) {
                approveBtn.disabled = true;
                approveBtn.textContent = 'Approving...';
            }

            const response = await fetch('/api/admin/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Admin-Auth': 'admin_logged_in'
                },
                body: JSON.stringify({ userId })
            });

            if (response.ok) {
                const data = await response.json();
                
                // Show success message
                const adminMessage = document.getElementById('adminMessage');
                if (adminMessage) {
                    adminMessage.textContent = 'User approved successfully!';
                    adminMessage.className = 'message success';
                    adminMessage.classList.remove('hidden');
                    setTimeout(() => adminMessage.classList.add('hidden'), 5000);
                }
                
                // Update user in local array
                const userIndex = allUsers.findIndex(user => user.id === userId);
                if (userIndex !== -1) {
                    allUsers[userIndex] = { ...allUsers[userIndex], ...data.user };
                }
                
                updateStats();
                displayUsers();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to approve user');
            }
        } catch (error) {
            console.error('Error approving user:', error);
            
            // Show error message
            const adminMessage = document.getElementById('adminMessage');
            if (adminMessage) {
                adminMessage.textContent = 'Failed to approve user: ' + error.message;
                adminMessage.className = 'message error';
                adminMessage.classList.remove('hidden');
                setTimeout(() => adminMessage.classList.add('hidden'), 5000);
            }
        }
    }

    // Filter tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            displayUsers();
        });
    });

    // Search functionality
    userSearch.addEventListener('input', function() {
        displayUsers();
    });

    // Refresh users
    refreshUsers.addEventListener('click', function() {
        if (isLoggedIn) {
            loadUsers();
        }
    });

    // Event delegation for approve buttons
    usersContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('approve-btn')) {
            const userId = e.target.getAttribute('data-user-id');
            if (userId) {
                approveUser(userId);
            }
        }
    });

    // Utility function to escape HTML
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Initialize
    checkAdminLogin();
});