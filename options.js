// Security: Prevent token from being logged or exposed in DevTools
// MUST be at the top before any other code runs
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
  const filteredArgs = args.map(arg => 
    typeof arg === 'string' && (arg.includes('ghp_') || arg.includes('github_pat_')) 
      ? '[REDACTED_TOKEN]' 
      : arg
  );
  originalLog.apply(console, filteredArgs);
};

console.error = function(...args) {
  const filteredArgs = args.map(arg => 
    typeof arg === 'string' && (arg.includes('ghp_') || arg.includes('github_pat_')) 
      ? '[REDACTED_TOKEN]' 
      : arg
  );
  originalError.apply(console, filteredArgs);
};

console.warn = function(...args) {
  const filteredArgs = args.map(arg => 
    typeof arg === 'string' && (arg.includes('ghp_') || arg.includes('github_pat_')) 
      ? '[REDACTED_TOKEN]' 
      : arg
  );
  originalWarn.apply(console, filteredArgs);
};

// DOM Elements
const form = document.getElementById('settingsForm');
const alertMessage = document.getElementById('alertMessage');
const alertText = document.getElementById('alertText');
const alertIcon = document.getElementById('alertIcon');
const testConnectionBtn = document.getElementById('testConnection');
const toggleTokenBtn = document.getElementById('toggleToken');
const statusCard = document.getElementById('statusCard');
const lastSyncEl = document.getElementById('lastSync');
const connectionStatusEl = document.getElementById('connectionStatus');
const repoLinkEl = document.getElementById('repoLink');

// Input fields
const tokenInput = document.getElementById('githubToken');
const usernameInput = document.getElementById('githubUsername');
const repoInput = document.getElementById('repositoryName');

// Error message elements
const tokenError = document.getElementById('tokenError');
const tokenSuccess = document.getElementById('tokenSuccess');
const usernameError = document.getElementById('usernameError');
const repoError = document.getElementById('repoError');

// Initialize: Load saved settings on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  setupAccessibility();
});

/**
 * Setup accessibility attributes
 */
function setupAccessibility() {
  // Add ARIA attributes to inputs
  tokenInput.setAttribute('aria-describedby', 'tokenError tokenSuccess');
  tokenInput.setAttribute('aria-invalid', 'false');
  
  usernameInput.setAttribute('aria-describedby', 'usernameError');
  usernameInput.setAttribute('aria-invalid', 'false');
  
  repoInput.setAttribute('aria-describedby', 'repoError');
  repoInput.setAttribute('aria-invalid', 'false');
  
  // Add ARIA live regions to validation messages
  tokenError.setAttribute('role', 'alert');
  tokenError.setAttribute('aria-live', 'polite');
  
  tokenSuccess.setAttribute('role', 'status');
  tokenSuccess.setAttribute('aria-live', 'polite');
  
  usernameError.setAttribute('role', 'alert');
  usernameError.setAttribute('aria-live', 'polite');
  
  repoError.setAttribute('role', 'alert');
  repoError.setAttribute('aria-live', 'polite');
  
  // Setup tooltip triggers
  setupTooltips();
}

/**
 * Setup interactive tooltips
 */
function setupTooltips() {
  const triggers = document.querySelectorAll('.tooltip-trigger');
  
  triggers.forEach(trigger => {
    const tooltipId = trigger.getAttribute('data-tooltip');
    const tooltip = document.getElementById(`tooltip-${tooltipId}`);
    
    if (!tooltip) return;
    
    // Click to toggle tooltip
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Close all other tooltips
      document.querySelectorAll('[id^="tooltip-"]').forEach(t => {
        if (t !== tooltip) t.classList.add('hidden');
      });
      
      // Toggle this tooltip
      tooltip.classList.toggle('hidden');
      
      // Position tooltip near trigger
      const rect = trigger.getBoundingClientRect();
      tooltip.style.position = 'fixed';
      tooltip.style.top = `${rect.bottom + 8}px`;
      tooltip.style.left = `${rect.left - 150}px`; // Offset to left
    });
    
    // Close button
    const closeBtn = tooltip.querySelector('.tooltip-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        tooltip.classList.add('hidden');
      });
    }
    
    // Keyboard accessibility - Enter/Space to open
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      }
    });
  });
  
  // Close tooltips when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tooltip-trigger') && !e.target.closest('[id^="tooltip-"]')) {
      document.querySelectorAll('[id^="tooltip-"]').forEach(t => {
        t.classList.add('hidden');
      });
    }
  });
  
  // Close tooltips on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('[id^="tooltip-"]').forEach(t => {
        t.classList.add('hidden');
      });
    }
  });
}

// Form submission handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings();
});

// Test connection handler
testConnectionBtn.addEventListener('click', async () => {
  await testGitHubConnection();
});

// Toggle password visibility
toggleTokenBtn.addEventListener('click', () => {
  const type = tokenInput.type === 'password' ? 'text' : 'password';
  tokenInput.type = type;
  
  // Update icon
  if (type === 'text') {
    toggleTokenBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
      </svg>
    `;
  } else {
    toggleTokenBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
      </svg>
    `;
  }
});

/**
 * Setup real-time validation listeners
 */
function setupEventListeners() {
  // Token validation
  tokenInput.addEventListener('input', () => {
    validateToken();
  });
  
  tokenInput.addEventListener('blur', () => {
    validateToken();
  });
  
  // Username validation
  usernameInput.addEventListener('input', () => {
    validateUsername();
  });
  
  usernameInput.addEventListener('blur', () => {
    validateUsername();
  });
  
  // Repository validation
  repoInput.addEventListener('input', () => {
    validateRepo();
    updateRepoLink();
  });
  
  repoInput.addEventListener('blur', () => {
    validateRepo();
  });
  
  // Keyboard accessibility: Enter key on inputs triggers save
  [tokenInput, usernameInput, repoInput].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveSettings();
      }
    });
  });
  
  // Keyboard accessibility: Escape key clears alerts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      alertMessage.classList.add('hidden');
    }
  });
}

/**
 * Validate GitHub token format
 */
function validateToken() {
  const token = tokenInput.value.trim();
  
  if (!token) {
    hideValidation(tokenError, tokenSuccess);
    return false;
  }
  
  if (token.startsWith('ghp_') || token.startsWith('github_pat_')) {
    if (token.length < 40) {
      showValidationError(tokenError, tokenSuccess, 'Token seems too short');
      return false;
    }
    showValidationSuccess(tokenError, tokenSuccess, 'Valid token format');
    return true;
  } else {
    showValidationError(tokenError, tokenSuccess, 'Token should start with "ghp_" or "github_pat_"');
    return false;
  }
}

/**
 * Validate GitHub username
 */
function validateUsername() {
  const username = usernameInput.value.trim();
  
  if (!username) {
    hideValidation(usernameError);
    updateRepoLink();
    return false;
  }
  
  const usernameRegex = /^[a-zA-Z0-9-]+$/;
  if (!usernameRegex.test(username)) {
    showValidationError(usernameError, null, 'Use only letters, numbers, and hyphens');
    updateRepoLink();
    return false;
  }
  
  if (username.length < 2) {
    showValidationError(usernameError, null, 'Username too short');
    updateRepoLink();
    return false;
  }
  
  hideValidation(usernameError);
  updateRepoLink();
  return true;
}

/**
 * Validate repository name
 */
function validateRepo() {
  const repo = repoInput.value.trim();
  
  if (!repo) {
    hideValidation(repoError);
    return false;
  }
  
  const repoRegex = /^[a-zA-Z0-9._-]+$/;
  if (!repoRegex.test(repo)) {
    showValidationError(repoError, null, 'Use only letters, numbers, dots, hyphens, and underscores');
    return false;
  }
  
  if (repo.length < 2) {
    showValidationError(repoError, null, 'Repository name too short');
    return false;
  }
  
  hideValidation(repoError);
  return true;
}

/**
 * Update repository link
 */
function updateRepoLink() {
  const username = usernameInput.value.trim();
  const repo = repoInput.value.trim();
  
  if (username && repo && validateUsername() && validateRepo()) {
    const link = repoLinkEl.querySelector('a');
    link.href = `https://github.com/${username}/${repo}`;
    repoLinkEl.classList.remove('hidden');
    repoLinkEl.classList.add('show');
  } else {
    repoLinkEl.classList.remove('show');
    repoLinkEl.classList.add('hidden');
  }
}

/**
 * Show validation error
 */
function showValidationError(errorEl, successEl, message) {
  errorEl.querySelector('span').textContent = message;
  errorEl.classList.remove('hidden');
  errorEl.classList.add('show');
  if (successEl) {
    successEl.classList.remove('show');
    successEl.classList.add('hidden');
  }
  
  // Update ARIA attributes
  const inputId = errorEl.id.replace('Error', '');
  const input = document.getElementById(inputId === 'token' ? 'githubToken' : inputId === 'username' ? 'githubUsername' : 'repositoryName');
  if (input) {
    input.setAttribute('aria-invalid', 'true');
  }
}

/**
 * Show validation success
 */
function showValidationSuccess(errorEl, successEl, message) {
  successEl.querySelector('span').textContent = message;
  successEl.classList.remove('hidden');
  successEl.classList.add('show');
  errorEl.classList.remove('show');
  errorEl.classList.add('hidden');
  
  // Update ARIA attributes
  const inputId = errorEl.id.replace('Error', '');
  const input = document.getElementById(inputId === 'token' ? 'githubToken' : inputId === 'username' ? 'githubUsername' : 'repositoryName');
  if (input) {
    input.setAttribute('aria-invalid', 'false');
  }
}

/**
 * Hide validation messages
 */
function hideValidation(errorEl, successEl = null) {
  errorEl.classList.remove('show');
  errorEl.classList.add('hidden');
  if (successEl) {
    successEl.classList.remove('show');
    successEl.classList.add('hidden');
  }
  
  // Update ARIA attributes
  const inputId = errorEl.id.replace('Error', '');
  const input = document.getElementById(inputId === 'token' ? 'githubToken' : inputId === 'username' ? 'githubUsername' : 'repositoryName');
  if (input) {
    input.setAttribute('aria-invalid', 'false');
  }
}

/**
 * Load saved settings from chrome.storage.sync
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'githubPat',
      'githubUsername',
      'githubRepo',
      'lastSync'
    ]);

    // Auto-populate fields with saved values
    if (result.githubPat) {
      tokenInput.value = result.githubPat;
      validateToken();
    }
    if (result.githubUsername) {
      usernameInput.value = result.githubUsername;
      validateUsername();
    }
    if (result.githubRepo) {
      repoInput.value = result.githubRepo;
      validateRepo();
      updateRepoLink();
    }

    // Show status card if settings exist
    if (result.githubPat && result.githubUsername && result.githubRepo) {
      statusCard.classList.remove('hidden');
      statusCard.classList.add('show');
      if (result.lastSync) {
        const date = new Date(result.lastSync);
        lastSyncEl.textContent = date.toLocaleString();
      }
      showAlert('Settings loaded successfully ✓', 'success');
    }
  } catch (error) {
    // Never expose the token in error messages
    console.error('Failed to load settings');
    showAlert('Failed to load saved settings. Please try again.', 'error');
  }
}

/**
 * Save settings to chrome.storage.sync
 */
async function saveSettings() {
  // Validate all fields
  const tokenValid = validateToken();
  const usernameValid = validateUsername();
  const repoValid = validateRepo();
  
  if (!tokenValid || !usernameValid || !repoValid) {
    showAlert('Please fix all validation errors before saving', 'error');
    return;
  }

  const token = tokenInput.value.trim();
  const username = usernameInput.value.trim();
  const repo = repoInput.value.trim();

  if (!token || !username || !repo) {
    showAlert('All fields are required', 'error');
    return;
  }

  try {
    // Save to chrome.storage.sync
    await chrome.storage.sync.set({
      githubPat: token,
      githubUsername: username,
      githubRepo: repo,
      lastSync: Date.now()
    });

    showAlert('Settings saved successfully! 🎉', 'success');
    statusCard.classList.remove('hidden');
    connectionStatusEl.textContent = 'Configured';
    connectionStatusEl.classList.remove('text-green-400');
    connectionStatusEl.classList.add('text-blue-400');
    
    // Log success without exposing sensitive data
    console.log('Settings saved for user:', username);
  } catch (error) {
    // Never expose the token in error messages
    console.error('Failed to save settings');
    showAlert('Failed to save settings. Please check your Chrome sync settings.', 'error');
  }
}

/**
 * Test GitHub connection with provided credentials
 */
async function testGitHubConnection() {
  const token = tokenInput.value.trim();
  const username = usernameInput.value.trim();
  const repo = repoInput.value.trim();

  if (!token || !username) {
    showAlert('Please fill in GitHub token and username before testing', 'error');
    return;
  }

  // Show loading state
  testConnectionBtn.disabled = true;
  const originalHTML = testConnectionBtn.innerHTML;
  testConnectionBtn.innerHTML = `
    <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
    </svg>
    <span>Testing...</span>
  `;

  try {
    // Test GitHub API connection
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LeetCode-to-GitHub-Extension'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      if (userData.login.toLowerCase() === username.toLowerCase()) {
        showAlert(`✅ Connection successful! Authenticated as ${userData.login}`, 'success');
        connectionStatusEl.textContent = 'Connected';
        connectionStatusEl.classList.remove('text-blue-400');
        connectionStatusEl.classList.add('text-green-400');
        statusCard.classList.remove('hidden');
        lastSyncEl.textContent = new Date().toLocaleString();
        
        // Test repository access if repo name provided
        if (repo) {
          await testRepoAccess(token, username, repo);
        }
      } else {
        showAlert(`⚠️ Connected, but username mismatch. API shows: ${userData.login}`, 'warning');
      }
    } else if (response.status === 401) {
      showAlert('❌ Invalid token. Please check your Personal Access Token', 'error');
      connectionStatusEl.textContent = 'Authentication Failed';
      connectionStatusEl.classList.remove('text-green-400');
      connectionStatusEl.classList.add('text-red-400');
    } else if (response.status === 403) {
      showAlert('❌ Token lacks required permissions. Ensure "repo" scope is enabled', 'error');
    } else {
      showAlert(`❌ Connection failed with status: ${response.status}`, 'error');
    }
  } catch (error) {
    // Never expose the token in error messages
    console.error('Connection test failed');
    showAlert('❌ Network error. Please check your internet connection', 'error');
  } finally {
    // Reset button state
    testConnectionBtn.disabled = false;
    testConnectionBtn.innerHTML = originalHTML;
  }
}

/**
 * Test repository access
 */
async function testRepoAccess(token, username, repo) {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LeetCode-to-GitHub-Extension'
      }
    });

    if (response.ok) {
      console.log('✓ Repository access confirmed');
    } else if (response.status === 404) {
      console.log('ℹ Repository does not exist yet (will be created on first push)');
    }
  } catch (error) {
    console.error('Could not verify repository access');
  }
}

/**
 * Display an alert message with specified type
 * @param {string} message - The message to display
 * @param {string} type - Alert type: 'success', 'error', 'warning'
 */
function showAlert(message, type = 'success') {
  alertText.textContent = message;
  alertMessage.classList.remove('hidden', 'success', 'error', 'warning');
  alertMessage.classList.add('show', type);

  // Update icon based on type
  if (type === 'success') {
    alertIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
  } else if (type === 'error') {
    alertIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
  } else if (type === 'warning') {
    alertIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>';
  }

  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      alertMessage.classList.remove('show');
      alertMessage.classList.add('hidden');
    }, 5000);
  }
}
