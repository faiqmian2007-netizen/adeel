// Cookie Check Management
class CookieChecker {
    constructor() {
        this.currentMode = 'single';
        this.cookieResults = [];
        this.init();
    }

    init() {
        // Require authentication
        if (!Auth.requireAuth()) return;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            new Auth().logout();
        });

        // Mode switching
        document.getElementById('singleModeBtn').addEventListener('click', () => {
            this.switchMode('single');
        });

        document.getElementById('multiModeBtn').addEventListener('click', () => {
            this.switchMode('multi');
        });

        // Single cookie check
        document.getElementById('checkSingleBtn').addEventListener('click', () => {
            this.checkSingleCookie();
        });

        // Multi cookie check
        document.getElementById('selectFileBtn').addEventListener('click', () => {
            document.getElementById('cookieFile').click();
        });

        document.getElementById('cookieFile').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        document.getElementById('checkMultiBtn').addEventListener('click', () => {
            this.checkMultipleCookies();
        });

        // Export functionality
        document.getElementById('exportValidBtn').addEventListener('click', () => {
            this.exportResults('valid');
        });

        document.getElementById('exportAllBtn').addEventListener('click', () => {
            this.exportResults('all');
        });

        // Sorting and filtering controls
        document.getElementById('nameFilter').addEventListener('input', () => {
            this.applyFiltersAndSort();
        });

        document.getElementById('statusFilter').addEventListener('change', () => {
            this.applyFiltersAndSort();
        });

        document.getElementById('sortBy').addEventListener('change', () => {
            this.applyFiltersAndSort();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Batch actions for valid cookies
        document.getElementById('downloadAllAppStatesBtn').addEventListener('click', () => {
            this.downloadAllAppStates();
        });

        document.getElementById('copyAllCookiesBtn').addEventListener('click', () => {
            this.copyAllValidCookies();
        });

        document.getElementById('downloadValidCookiesBtn').addEventListener('click', () => {
            this.downloadValidCookiesFile();
        });

        document.getElementById('copyAllAppStatesBtn').addEventListener('click', () => {
            this.copyAllAppStates();
        });

        // Drag and drop functionality
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        uploadArea.addEventListener('click', () => {
            document.getElementById('cookieFile').click();
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update mode visibility
        document.getElementById('singleMode').classList.toggle('active', mode === 'single');
        document.getElementById('multiMode').classList.toggle('active', mode === 'multi');

        // Hide results when switching modes
        document.getElementById('resultsSection').classList.add('hidden');
    }

    async checkSingleCookie() {
        const cookieInput = document.getElementById('singleCookie');
        const cookie = cookieInput.value.trim();

        if (!cookie) {
            this.showNotification('Please enter a cookie to check', 'error');
            return;
        }

        this.showLoadingModal('Validating cookie...');

        try {
            const result = await this.validateCookie(cookie);
            this.cookieResults = [result];
            this.displayResults();
            this.hideLoadingModal();
        } catch (error) {
            console.error('Error checking cookie:', error);
            this.showNotification('Failed to validate cookie', 'error');
            this.hideLoadingModal();
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    async handleFile(file) {
        if (!file.name.endsWith('.txt')) {
            this.showNotification('Please select a .txt file', 'error');
            return;
        }

        const uploadArea = document.getElementById('uploadArea');
        const checkBtn = document.getElementById('checkMultiBtn');
        
        // Update UI to show file is loaded
        uploadArea.querySelector('h3').textContent = `File: ${file.name}`;
        uploadArea.querySelector('p').textContent = `Size: ${(file.size / 1024).toFixed(2)} KB`;
        checkBtn.disabled = false;

        // Store file reference
        this.selectedFile = file;
    }

    async checkMultipleCookies() {
        if (!this.selectedFile) {
            this.showNotification('Please select a file first', 'error');
            return;
        }

        this.showLoadingModal('Reading file and validating cookies...', true);

        try {
            const fileContent = await this.readFile(this.selectedFile);
            const cookies = fileContent.split('\n').filter(cookie => cookie.trim());

            if (cookies.length === 0) {
                this.showNotification('No cookies found in the file', 'error');
                this.hideLoadingModal();
                return;
            }

            // Initialize progress with total count
            this.progressData.total = cookies.length;
            this.updateProgress(0, cookies.length, 0, 0, `Starting validation of ${cookies.length} cookies...`);

            const results = [];
            let validCount = 0;
            let invalidCount = 0;

            for (let i = 0; i < cookies.length; i++) {
                try {
                    const cookiePreview = cookies[i].trim().substring(0, 50) + '...';
                    this.updateProgress(
                        i, 
                        cookies.length, 
                        validCount, 
                        invalidCount, 
                        `Validating cookie: ${cookiePreview}`
                    );
                    
                    const result = await this.validateCookie(cookies[i].trim());
                    results.push(result);
                    
                    // Update counts based on result
                    if (result.isValid) {
                        validCount++;
                    } else {
                        invalidCount++;
                    }
                    
                    // Update progress after validation
                    this.updateProgress(
                        i + 1, 
                        cookies.length, 
                        validCount, 
                        invalidCount, 
                        result.isValid ? 
                            `✅ Valid: ${result.userInfo?.name || 'User'}` : 
                            `❌ Invalid: ${result.error || 'Unknown error'}`
                    );
                    
                    // Small delay to prevent overwhelming the API and show progress
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`Error validating cookie ${i + 1}:`, error);
                    const errorResult = {
                        cookie: cookies[i].trim(),
                        isValid: false,
                        error: 'Validation failed',
                        userInfo: null
                    };
                    results.push(errorResult);
                    invalidCount++;
                    
                    // Update progress for error case
                    this.updateProgress(
                        i + 1, 
                        cookies.length, 
                        validCount, 
                        invalidCount, 
                        `❌ Error: Failed to validate cookie`
                    );
                }
            }

            // Final progress update
            this.updateProgress(
                cookies.length, 
                cookies.length, 
                validCount, 
                invalidCount, 
                `🎉 Validation complete! Found ${validCount} valid and ${invalidCount} invalid cookies.`
            );

            // Show completion message briefly before hiding modal
            await new Promise(resolve => setTimeout(resolve, 1500));

            this.cookieResults = results;
            this.displayResults();
            this.hideLoadingModal();
        } catch (error) {
            console.error('Error processing file:', error);
            this.showNotification('Failed to process file', 'error');
            this.hideLoadingModal();
        }
    }

    async validateCookie(cookie) {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch('/api/cookies/test-reliable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ cookie })
        });

        if (!response.ok) {
            throw new Error('Failed to validate cookie');
        }

        return await response.json();
    }

    displayResults() {
        const resultsSection = document.getElementById('resultsSection');
        
        // Store original results for filtering/sorting
        this.originalResults = [...this.cookieResults];
        
        // Update summary
        const validCount = this.cookieResults.filter(r => r.isValid).length;
        const expiredCount = this.cookieResults.filter(r => !r.isValid).length;
        const totalCount = this.cookieResults.length;

        document.getElementById('validCount').textContent = validCount;
        document.getElementById('expiredCount').textContent = expiredCount;
        document.getElementById('totalCount').textContent = totalCount;

        // Initial display of all results
        this.renderFilteredResults(this.cookieResults);

        // Show results section
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        // Store appState globally for download/copy functions
        if (this.cookieResults[0] && this.cookieResults[0].appState) {
            window.currentAppState = this.cookieResults[0].appState;
        }
    }
    
    renderFilteredResults(filteredResults) {
        const cookieResults = document.getElementById('cookieResults');
        
        // Clear previous results
        cookieResults.innerHTML = '';

        // Update filtered count
        const totalResults = this.originalResults ? this.originalResults.length : this.cookieResults.length;
        const filteredCount = filteredResults.length;
        
        let infoText;
        if (filteredCount === totalResults) {
            infoText = `Showing all ${totalResults} results`;
        } else {
            infoText = `Showing ${filteredCount} of ${totalResults} results`;
        }
        
        document.getElementById('filteredCount').textContent = infoText;

        // Create result cards using safe DOM manipulation
        filteredResults.forEach((result, index) => {
            const cardElement = this.createResultCard(result, index);
            cookieResults.appendChild(cardElement);
        });
        
        // Show "no results" message if filtered list is empty
        if (filteredResults.length === 0) {
            const noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'no-results-message';
            noResultsDiv.innerHTML = `
                <div class="no-results-content">
                    <div class="no-results-icon">🔍</div>
                    <h4>No results found</h4>
                    <p>Try adjusting your filters or search terms</p>
                </div>
            `;
            cookieResults.appendChild(noResultsDiv);
        }
    }
    
    applyFiltersAndSort() {
        if (!this.originalResults) return;
        
        let filteredResults = [...this.originalResults];
        
        // Apply name filter
        const nameFilter = document.getElementById('nameFilter').value.toLowerCase().trim();
        if (nameFilter) {
            filteredResults = filteredResults.filter(result => {
                const userName = result.userInfo?.name || '';
                return userName.toLowerCase().includes(nameFilter);
            });
        }
        
        // Apply status filter
        const statusFilter = document.getElementById('statusFilter').value;
        if (statusFilter !== 'all') {
            filteredResults = filteredResults.filter(result => {
                return statusFilter === 'valid' ? result.isValid : !result.isValid;
            });
        }
        
        // Apply sorting
        const sortBy = document.getElementById('sortBy').value;
        this.sortResults(filteredResults, sortBy);
        
        // Re-render results
        this.renderFilteredResults(filteredResults);
    }
    
    sortResults(results, sortBy) {
        switch (sortBy) {
            case 'status':
                results.sort((a, b) => {
                    // Valid first, then expired
                    if (a.isValid === b.isValid) return 0;
                    return a.isValid ? -1 : 1;
                });
                break;
                
            case 'name':
                results.sort((a, b) => {
                    const nameA = (a.userInfo?.name || '').toLowerCase();
                    const nameB = (b.userInfo?.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                break;
                
            case 'name-desc':
                results.sort((a, b) => {
                    const nameA = (a.userInfo?.name || '').toLowerCase();
                    const nameB = (b.userInfo?.name || '').toLowerCase();
                    return nameB.localeCompare(nameA);
                });
                break;
                
            case 'date':
                results.sort((a, b) => {
                    const dateA = a.userInfo?.accountCreationDate || '0';
                    const dateB = b.userInfo?.accountCreationDate || '0';
                    return new Date(dateB) - new Date(dateA); // Newest first
                });
                break;
                
            case 'default':
            default:
                // Keep original order - no sorting needed
                break;
        }
    }
    
    clearAllFilters() {
        // Reset all filter controls
        document.getElementById('nameFilter').value = '';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('sortBy').value = 'default';
        
        // Re-apply filters (which will now show all results)
        this.applyFiltersAndSort();
        
        // Show success notification
        this.showNotification('Filters cleared successfully', 'success');
    }
    
    // Batch Actions for Valid Cookies
    downloadAllAppStates() {
        const validResults = this.cookieResults.filter(r => r.isValid && r.appState);
        
        if (validResults.length === 0) {
            this.showNotification('No valid AppStates found to download', 'error');
            return;
        }
        
        // Create a combined object with all AppStates
        const allAppStates = {
            downloadedAt: new Date().toISOString(),
            totalCount: validResults.length,
            appStates: validResults.map((result, index) => ({
                index: index + 1,
                userName: result.userInfo?.name || 'Unknown User',
                userId: result.userInfo?.id || 'N/A',
                appState: result.appState
            }))
        };
        
        // Create and download file
        const blob = new Blob([JSON.stringify(allAppStates, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `all-appstates-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`Downloaded ${validResults.length} AppStates successfully!`, 'success');
    }
    
    copyAllValidCookies() {
        const validResults = this.cookieResults.filter(r => r.isValid);
        
        if (validResults.length === 0) {
            this.showNotification('No valid cookies found to copy', 'error');
            return;
        }
        
        // Extract just the cookie strings
        const validCookies = validResults.map(result => result.cookie).join('\n');
        
        navigator.clipboard.writeText(validCookies).then(() => {
            this.showNotification(`Copied ${validResults.length} valid cookies to clipboard!`, 'success');
        }).catch(err => {
            console.error('Failed to copy cookies:', err);
            this.showNotification('Failed to copy cookies to clipboard', 'error');
        });
    }
    
    downloadValidCookiesFile() {
        const validResults = this.cookieResults.filter(r => r.isValid);
        
        if (validResults.length === 0) {
            this.showNotification('No valid cookies found to download', 'error');
            return;
        }
        
        // Create detailed cookie file with user info
        const cookieData = validResults.map((result, index) => {
            const userInfo = result.userInfo ? 
                `# User: ${result.userInfo.name || 'Unknown'} (ID: ${result.userInfo.id || 'N/A'})` : 
                '# User info not available';
            return `${userInfo}\n${result.cookie}`;
        }).join('\n\n');
        
        const fileHeader = `# Valid Facebook Cookies - Downloaded on ${new Date().toLocaleString()}\n# Total: ${validResults.length} valid cookies\n\n`;
        const finalContent = fileHeader + cookieData;
        
        // Create and download file
        const blob = new Blob([finalContent], {
            type: 'text/plain'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `valid-cookies-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`Downloaded ${validResults.length} valid cookies as file!`, 'success');
    }
    
    copyAllAppStates() {
        const validResults = this.cookieResults.filter(r => r.isValid && r.appState);
        
        if (validResults.length === 0) {
            this.showNotification('No valid AppStates found to copy', 'error');
            return;
        }
        
        // Create simplified array of AppStates for easier use
        const appStatesArray = validResults.map(result => result.appState);
        
        // If only one AppState, copy it directly; otherwise copy as array
        const contentToCopy = appStatesArray.length === 1 ? 
            JSON.stringify(appStatesArray[0], null, 2) : 
            JSON.stringify(appStatesArray, null, 2);
        
        navigator.clipboard.writeText(contentToCopy).then(() => {
            this.showNotification(`Copied ${validResults.length} AppStates to clipboard!`, 'success');
        }).catch(err => {
            console.error('Failed to copy AppStates:', err);
            this.showNotification('Failed to copy AppStates to clipboard', 'error');
        });
    }

    createResultCard(result, index) {
        const statusClass = result.isValid ? 'valid' : 'expired';
        const statusText = result.isValid ? '✅ Valid' : '❌ Expired';
        
        // Use profile picture URL from server response (check both locations for compatibility)
        let profilePicUrl = result.userInfo?.profilePic || result.profilePic || null;
        
        // Convert Facebook direct URLs to our proxy for deployment compatibility
        if (profilePicUrl && (profilePicUrl.includes('fbcdn.net') || profilePicUrl.includes('graph.facebook.com'))) {
            profilePicUrl = `/api/cookies/profile-image-proxy?url=${encodeURIComponent(profilePicUrl)}`;
        }
        
        // Create main container
        const cardDiv = document.createElement('div');
        cardDiv.className = `cookie-result-item ${statusClass}`;
        
        // Create header section
        const headerDiv = document.createElement('div');
        headerDiv.className = 'cookie-header';
        
        // Create profile section if user info available
        if (result.userInfo && profilePicUrl) {
            const profileSection = document.createElement('div');
            profileSection.className = 'user-profile-section';
            
            // Profile picture container
            const picContainer = document.createElement('div');
            picContainer.className = 'profile-pic-container';
            
            // Profile picture
            const profileImg = document.createElement('img');
            profileImg.src = profilePicUrl;
            profileImg.alt = `${result.userInfo.name || 'User'} Profile`;
            profileImg.className = 'profile-pic';
            
            // Profile picture fallback
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'profile-pic-fallback';
            fallbackDiv.style.display = 'none';
            fallbackDiv.innerHTML = '<span>👤</span>';
            
            // Handle profile picture error
            profileImg.onerror = function() {
                this.style.display = 'none';
                fallbackDiv.style.display = 'flex';
            };
            
            picContainer.appendChild(profileImg);
            picContainer.appendChild(fallbackDiv);
            
            // User basic info
            const basicInfoDiv = document.createElement('div');
            basicInfoDiv.className = 'user-basic-info';
            
            const userName = document.createElement('h4');
            userName.className = 'user-name';
            userName.textContent = result.userInfo.name || 'Unknown User';
            
            const userId = document.createElement('p');
            userId.className = 'user-id';
            userId.textContent = `ID: ${result.userInfo.id || 'N/A'}`;
            
            basicInfoDiv.appendChild(userName);
            basicInfoDiv.appendChild(userId);
            
            profileSection.appendChild(picContainer);
            profileSection.appendChild(basicInfoDiv);
            headerDiv.appendChild(profileSection);
        }
        
        // Cookie status
        const statusDiv = document.createElement('div');
        statusDiv.className = `cookie-status ${statusClass}`;
        statusDiv.textContent = statusText;
        
        headerDiv.appendChild(statusDiv);
        cardDiv.appendChild(headerDiv);
        
        // Create cookie info section
        const infoDiv = document.createElement('div');
        infoDiv.className = 'cookie-info';
        
        if (result.userInfo) {
            // User details grid
            const detailsGrid = document.createElement('div');
            detailsGrid.className = 'user-details-grid';
            
            // Full Name
            const nameItem = this.createInfoItem('👤 Full Name', result.userInfo.name || 'N/A');
            detailsGrid.appendChild(nameItem);
            
            // User ID
            const idItem = this.createInfoItem('🆔 User ID', result.userInfo.id || 'N/A');
            detailsGrid.appendChild(idItem);
            
            // Profile URL
            const urlItem = document.createElement('div');
            urlItem.className = 'info-item';
            const urlLabel = document.createElement('label');
            urlLabel.textContent = '🔗 Profile URL';
            const urlSpan = document.createElement('span');
            urlSpan.className = 'profile-link';
            
            if (result.userInfo.profileUrl) {
                // Security validation: Only create a link if the URL is safe
                if (this.isUrlSafe(result.userInfo.profileUrl)) {
                    // Safe URL - create clickable link
                    const urlLink = document.createElement('a');
                    urlLink.href = result.userInfo.profileUrl;
                    urlLink.target = '_blank';
                    urlLink.rel = 'noopener noreferrer';
                    urlLink.textContent = result.userInfo.profileUrl;
                    urlSpan.appendChild(urlLink);
                } else {
                    // Unsafe URL - render as plain text with warning
                    const warningSpan = document.createElement('span');
                    warningSpan.style.color = '#ff6b6b';
                    warningSpan.textContent = '⚠️ Unsafe URL (displayed as text): ';
                    urlSpan.appendChild(warningSpan);
                    
                    const textSpan = document.createElement('span');
                    textSpan.textContent = result.userInfo.profileUrl;
                    urlSpan.appendChild(textSpan);
                }
            } else {
                urlSpan.textContent = 'N/A';
            }
            
            urlItem.appendChild(urlLabel);
            urlItem.appendChild(urlSpan);
            detailsGrid.appendChild(urlItem);
            
            // Verification Level - handle both field names for robustness
            const verificationItem = document.createElement('div');
            verificationItem.className = 'info-item';
            const verificationLabel = document.createElement('label');
            verificationLabel.textContent = '✅ Verification Level';
            const verificationSpan = document.createElement('span');
            const validationLevel = result.userInfo.validationLevel || result.userInfo.verificationLevel || 'basic';
            verificationSpan.className = `verification-badge ${validationLevel.toLowerCase().replace(' ', '-')}`;
            verificationSpan.textContent = this.getVerificationText(validationLevel);
            
            verificationItem.appendChild(verificationLabel);
            verificationItem.appendChild(verificationSpan);
            detailsGrid.appendChild(verificationItem);
            
            infoDiv.appendChild(detailsGrid);

            // Enhanced Account Information Section
            const accountSection = document.createElement('div');
            accountSection.className = 'account-details-section';
            
            const accountTitle = document.createElement('h5');
            accountTitle.className = 'section-title';
            accountTitle.textContent = '📊 Account & Session Details';
            accountSection.appendChild(accountTitle);
            
            const accountGrid = document.createElement('div');
            accountGrid.className = 'account-details-grid';
            
            // Confidence Score
            const confidenceItem = document.createElement('div');
            confidenceItem.className = 'info-item';
            const confidenceLabel = document.createElement('label');
            confidenceLabel.textContent = '🎯 Confidence Score';
            const confidenceSpan = document.createElement('span');
            confidenceSpan.className = 'confidence-score';
            confidenceSpan.textContent = result.userInfo.confidence || 'N/A';
            confidenceItem.appendChild(confidenceLabel);
            confidenceItem.appendChild(confidenceSpan);
            accountGrid.appendChild(confidenceItem);
            
            // Session Type - robust DOM access
            const sessionTypeItem = this.createInfoItem('📱 Session Type', result.userInfo.sessionType || 'Unknown');
            const sessionTypeSpan = sessionTypeItem.querySelector('span');
            if (sessionTypeSpan) sessionTypeSpan.className = 'session-type';
            accountGrid.appendChild(sessionTypeItem);
            
            // Locale & Region
            const locale = result.userInfo.locale || 'N/A';
            const region = result.userInfo.region || 'Unknown';
            const localeItem = this.createInfoItem('🌍 Locale & Region', `${locale} (${region})`);
            accountGrid.appendChild(localeItem);
            
            // Cookie Age - robust DOM access
            const cookieAgeItem = this.createInfoItem('📅 Cookie Age', result.userInfo.cookieAge || 'Unknown');
            const cookieAgeSpan = cookieAgeItem.querySelector('span');
            if (cookieAgeSpan) cookieAgeSpan.className = 'cookie-age';
            accountGrid.appendChild(cookieAgeItem);
            
            // Account Creation Date - new field
            if (result.userInfo.accountCreationDate) {
                const accountCreationItem = this.createInfoItem('🎂 Account Created', result.userInfo.accountCreationDate);
                const creationSpan = accountCreationItem.querySelector('span');
                if (creationSpan) creationSpan.className = 'account-creation-date';
                accountGrid.appendChild(accountCreationItem);
            }
            
            accountSection.appendChild(accountGrid);
            infoDiv.appendChild(accountSection);

            // Enhanced Technical Information Section
            const techSection = document.createElement('div');
            techSection.className = 'technical-details-section';
            
            const techTitle = document.createElement('h5');
            techTitle.className = 'section-title';
            techTitle.textContent = '⚙️ Technical Information';
            techSection.appendChild(techTitle);
            
            const techGrid = document.createElement('div');
            techGrid.className = 'technical-details-grid';
            
            // Screen Dimensions
            const screenItem = this.createInfoItem('🖥️ Screen Dimensions', result.userInfo.screenDimensions || 'Unknown');
            techGrid.appendChild(screenItem);
            
            // Pixel Ratio
            const pixelItem = this.createInfoItem('📐 Pixel Ratio', result.userInfo.pixelRatio || 'Unknown');
            techGrid.appendChild(pixelItem);
            
            // Browser Info
            const browserItem = this.createInfoItem('🌐 Browser Info', result.userInfo.browserInfo || 'Unknown');
            techGrid.appendChild(browserItem);
            
            // Validation Method
            const methodItem = this.createInfoItem('🔬 Validation Method', result.userInfo.validationMethod || 'Standard');
            techGrid.appendChild(methodItem);
            
            techSection.appendChild(techGrid);
            infoDiv.appendChild(techSection);
        } else {
            // Error info
            const errorItem = document.createElement('div');
            errorItem.className = 'info-item error-info';
            const errorLabel = document.createElement('label');
            errorLabel.textContent = '❌ Status';
            const errorSpan = document.createElement('span');
            errorSpan.textContent = result.error || 'Cookie expired or invalid';
            
            errorItem.appendChild(errorLabel);
            errorItem.appendChild(errorSpan);
            infoDiv.appendChild(errorItem);
        }
        
        // AppState section
        if (result.appState) {
            const appStateItem = document.createElement('div');
            appStateItem.className = 'info-item appstate-section';
            const appStateLabel = document.createElement('label');
            appStateLabel.textContent = '🔧 AppState Generated';
            const appStateSpan = document.createElement('span');
            appStateSpan.textContent = `${result.appState.length} entries ready`;
            
            appStateItem.appendChild(appStateLabel);
            appStateItem.appendChild(appStateSpan);
            infoDiv.appendChild(appStateItem);
            
            // AppState actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'appstate-actions';
            
            // Download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'action-btn download-btn';
            downloadBtn.textContent = '📥 Download AppState';
            downloadBtn.addEventListener('click', () => this.downloadAppState(result.appState));
            
            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'action-btn copy-btn';
            copyBtn.textContent = '📋 Copy AppState';
            copyBtn.addEventListener('click', () => this.copyAppState(result.appState));
            
            actionsDiv.appendChild(downloadBtn);
            actionsDiv.appendChild(copyBtn);
            infoDiv.appendChild(actionsDiv);
        }
        
        // Technical info section
        const technicalDiv = document.createElement('div');
        technicalDiv.className = 'technical-info';
        
        // Checked At
        const checkedItem = this.createInfoItem('⏰ Checked At', new Date().toLocaleString());
        technicalDiv.appendChild(checkedItem);
        
        // Cookie Preview
        const cookiePreview = result.cookie ? result.cookie.substring(0, 50) + '...' : 'N/A';
        const cookieItem = document.createElement('div');
        cookieItem.className = 'info-item';
        const cookieLabel = document.createElement('label');
        cookieLabel.textContent = '🍪 Cookie Preview';
        const cookieSpan = document.createElement('span');
        cookieSpan.className = 'cookie-preview';
        cookieSpan.textContent = cookiePreview;
        
        cookieItem.appendChild(cookieLabel);
        cookieItem.appendChild(cookieSpan);
        technicalDiv.appendChild(cookieItem);
        
        // Account Age
        if (result.userInfo?.accountAge) {
            const ageItem = this.createInfoItem('📅 Account Age', result.userInfo.accountAge);
            technicalDiv.appendChild(ageItem);
        }
        
        infoDiv.appendChild(technicalDiv);
        cardDiv.appendChild(infoDiv);
        
        return cardDiv;
    }
    
    createInfoItem(label, value) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'info-item';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        
        const spanEl = document.createElement('span');
        spanEl.textContent = value;
        
        itemDiv.appendChild(labelEl);
        itemDiv.appendChild(spanEl);
        
        return itemDiv;
    }
    
    downloadAppState(appState) {
        const blob = new Blob([JSON.stringify(appState, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facebook-appstate-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('AppState downloaded successfully!', 'success');
    }
    
    copyAppState(appState) {
        const appStateString = JSON.stringify(appState, null, 2);
        
        navigator.clipboard.writeText(appStateString).then(() => {
            this.showNotification('AppState copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy AppState:', err);
            this.showNotification('Failed to copy AppState', 'error');
        });
    }

    getVerificationText(level) {
        const levels = {
            'basic': '🔸 Basic Validation',
            'standard': '🔹 Standard Validation', 
            'verified': '🟢 Verified Account',
            'premium': '⭐ Premium Validation',
            'high': '🔥 High Confidence',
            'medium': '🟡 Medium Confidence'
        };
        return levels[level] || '🔸 Basic Validation';
    }

    /**
     * Safely validates a URL to prevent XSS attacks through javascript: and data: schemes
     * @param {string} url - The URL to validate
     * @returns {boolean} - True if the URL is safe to use as href
     */
    isUrlSafe(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        try {
            // Create URL object to parse the URL
            const parsedUrl = new URL(url, location.origin);
            
            // Only allow https and http protocols
            if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
                return false;
            }
            
            // Optionally restrict to Facebook domains for additional security
            if (parsedUrl.hostname && !parsedUrl.hostname.includes('facebook.com')) {
                // For this specific use case, we might want to only allow Facebook URLs
                // But for flexibility, we'll allow all https/http URLs
                // Uncomment the line below to restrict to Facebook only:
                // return false;
            }
            
            return true;
        } catch (error) {
            // Invalid URL format
            return false;
        }
    }

    exportResults(type) {
        let dataToExport = this.cookieResults;
        
        if (type === 'valid') {
            dataToExport = this.cookieResults.filter(r => r.isValid);
        }

        if (dataToExport.length === 0) {
            this.showNotification('No data to export', 'error');
            return;
        }

        // Create export data
        const exportData = dataToExport.map(result => ({
            cookie: result.cookie,
            isValid: result.isValid,
            userName: result.userInfo?.name || 'N/A',
            userId: result.userInfo?.id || 'N/A',
            checkedAt: new Date().toISOString()
        }));

        // Create and download file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cookie-check-results-${type}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification(`Exported ${dataToExport.length} results`, 'success');
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    showLoadingModal(text, isProgress = false) {
        const modal = document.getElementById('loadingModal');
        const loadingText = document.getElementById('loadingText');
        loadingText.textContent = text;
        modal.classList.remove('hidden');
        
        if (isProgress) {
            this.initializeProgressModal();
        }
    }
    
    initializeProgressModal() {
        // Initialize progress tracking
        this.progressData = {
            startTime: Date.now(),
            total: 0,
            current: 0,
            valid: 0,
            invalid: 0
        };
        
        // Update UI elements
        document.getElementById('progressPercent').textContent = '0%';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('elapsedTime').textContent = '0s';
        document.getElementById('validProgress').textContent = '0';
        document.getElementById('invalidProgress').textContent = '0';
        document.getElementById('remainingCount').textContent = '0';
        document.getElementById('currentStatus').textContent = 'Initializing...';
        
        // Start timer for elapsed time
        this.progressTimer = setInterval(() => {
            this.updateElapsedTime();
        }, 1000);
    }
    
    updateProgress(current, total, validCount, invalidCount, statusText) {
        if (!this.progressData) return;
        
        this.progressData.current = current;
        this.progressData.total = total;
        this.progressData.valid = validCount;
        this.progressData.invalid = invalidCount;
        
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        const remaining = total - current;
        
        // Update progress bar
        document.getElementById('progressPercent').textContent = `${percentage}%`;
        document.getElementById('progressFill').style.width = `${percentage}%`;
        
        // Update statistics
        document.getElementById('validProgress').textContent = validCount.toString();
        document.getElementById('invalidProgress').textContent = invalidCount.toString();
        document.getElementById('remainingCount').textContent = remaining.toString();
        
        // Update current status
        if (statusText) {
            document.getElementById('currentStatus').textContent = statusText;
        }
        
        // Update main text
        this.updateLoadingText(`Processing ${current} of ${total} cookies... (${percentage}% complete)`);
    }
    
    updateElapsedTime() {
        if (!this.progressData) return;
        
        const elapsed = Math.floor((Date.now() - this.progressData.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        let timeText;
        if (minutes > 0) {
            timeText = `${minutes}m ${seconds}s`;
        } else {
            timeText = `${seconds}s`;
        }
        
        document.getElementById('elapsedTime').textContent = timeText;
    }

    updateLoadingText(text) {
        const loadingText = document.getElementById('loadingText');
        loadingText.textContent = text;
    }

    hideLoadingModal() {
        const modal = document.getElementById('loadingModal');
        modal.classList.add('hidden');
        
        // Clear progress timer
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        
        // Clear progress data
        this.progressData = null;
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        const icon = notification.querySelector('.notification-icon');
        const messageEl = notification.querySelector('.notification-message');
        
        icon.textContent = type === 'success' ? '✅' : '❌';
        messageEl.textContent = message;
        notification.className = `notification ${type}`;
        
        // Show notification
        setTimeout(() => {
            notification.classList.remove('hidden');
        }, 100);
        
        // Hide after 4 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 4000);
    }
}


// Initialize cookie checker
document.addEventListener('DOMContentLoaded', () => {
    new CookieChecker();
});