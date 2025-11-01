// DOM Elements
const form = document.getElementById('settingsForm');
const alertMessage = document.getElementById('alertMessage');
const alertText = document.getElementById('alertText');
const alertIcon = document.getElementById('alertIcon');
const testConnectionBtn = document.getElementById('testConnection');

// Input fields
const tokenInput = document.getElementById('githubToken');
const usernameInput = document.getElementById('githubUsername');
const repoInput = document.getElementById('repositoryName');

// Initialize: Load saved settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Form submission handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings();
});

// Test connection handler
testConnectionBtn.addEventListener('click', async () => {
  await testGitHubConnection();
});

/**
 * Load saved settings from chrome.storage.sync
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      'githubToken',
      'githubUsername',
      'repositoryName'
    ]);

    // Auto-populate fields with saved values
    if (result.githubToken) {
      tokenInput.value = result.githubToken;
    }
    if (result.githubUsername) {
      usernameInput.value = result.githubUsername;
    }
    if (result.repositoryName) {
      repoInput.value = result.repositoryName;
    }

    // Show success message if settings exist
    if (result.githubToken && result.githubUsername && result.repositoryName) {
      showAlert('Settings loaded successfully', 'success');
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
  // Validate all fields are non-empty
  const token = tokenInput.value.trim();
  const username = usernameInput.value.trim();
  const repo = repoInput.value.trim();

  if (!token || !username || !repo) {
    showAlert('All fields are required. Please fill in all information.', 'error');
    return;
  }

  // Additional validation for GitHub token format
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    showAlert('Invalid token format. GitHub tokens should start with "ghp_" or "github_pat_"', 'error');
    return;
  }

  // Validate username format (alphanumeric, hyphens only)
  const usernameRegex = /^[a-zA-Z0-9-]+$/;
  if (!usernameRegex.test(username)) {
    showAlert('Invalid username format. Use only letters, numbers, and hyphens.', 'error');
    return;
  }

  // Validate repository name format
  const repoRegex = /^[a-zA-Z0-9._-]+$/;
  if (!repoRegex.test(repo)) {
    showAlert('Invalid repository name. Use only letters, numbers, dots, hyphens, and underscores.', 'error');
    return;
  }

  try {
    // Save to chrome.storage.sync
    await chrome.storage.sync.set({
      githubToken: token,
      githubUsername: username,
      repositoryName: repo
    });

    showAlert('Settings saved successfully! 🎉', 'success');
    
    // Log success without exposing sensitive data
    console.log('Settings saved for user:', username);
  } catch (error) {
    // Never expose the token in error messages
    console.error('Failed to save settings');
    showAlert('Failed to save settings. Please check your Chrome sync settings and try again.', 'error');
  }
}

/**
 * Test GitHub connection with provided credentials
 */
async function testGitHubConnection() {
  const token = tokenInput.value.trim();
  const username = usernameInput.value.trim();

  if (!token || !username) {
    showAlert('Please fill in GitHub token and username before testing connection.', 'error');
    return;
  }

  // Show loading state
  testConnectionBtn.disabled = true;
  testConnectionBtn.textContent = 'Testing...';

  try {
    // Test GitHub API connection
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      if (userData.login.toLowerCase() === username.toLowerCase()) {
        showAlert(`✅ Connection successful! Authenticated as ${userData.login}`, 'success');
      } else {
        showAlert(`⚠️ Connected, but username mismatch. API shows: ${userData.login}`, 'warning');
      }
    } else if (response.status === 401) {
      showAlert('❌ Invalid token. Please check your Personal Access Token.', 'error');
    } else if (response.status === 403) {
      showAlert('❌ Token lacks required permissions. Ensure "repo" scope is enabled.', 'error');
    } else {
      showAlert(`❌ Connection failed with status: ${response.status}`, 'error');
    }
  } catch (error) {
    // Never expose the token in error messages
    console.error('Connection test failed');
    showAlert('❌ Network error. Please check your internet connection.', 'error');
  } finally {
    // Reset button state
    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = 'Test Connection';
  }
}

/**
 * Display alert message
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', or 'warning'
 */
function showAlert(message, type) {
  alertText.textContent = message;
  alertMessage.classList.remove('hidden', 'bg-green-50', 'bg-red-50', 'bg-yellow-50', 'border-green-200', 'border-red-200', 'border-yellow-200', 'text-green-800', 'text-red-800', 'text-yellow-800');

  if (type === 'success') {
    alertMessage.classList.add('bg-green-50', 'border', 'border-green-200');
    alertText.classList.add('text-green-800');
    alertIcon.classList.add('text-green-600');
    alertIcon.innerHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>';
  } else if (type === 'error') {
    alertMessage.classList.add('bg-red-50', 'border', 'border-red-200');
    alertText.classList.add('text-red-800');
    alertIcon.classList.add('text-red-600');
    alertIcon.innerHTML = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>';
  } else if (type === 'warning') {
    alertMessage.classList.add('bg-yellow-50', 'border', 'border-yellow-200');
    alertText.classList.add('text-yellow-800');
    alertIcon.classList.add('text-yellow-600');
    alertIcon.innerHTML = '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>';
  }

  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      alertMessage.classList.add('hidden');
    }, 5000);
  }
}

// Security: Prevent token from being logged or exposed in DevTools
// Override console methods to prevent accidental token exposure
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
