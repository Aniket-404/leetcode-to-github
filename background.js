// Background Service Worker for LeetCode to GitHub Extension
// Manifest V3 compliant

console.log('LeetCode to GitHub: Background service worker initialized');

// Track submission check URLs to avoid duplicate processing
const processedSubmissions = new Set();

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  if (processedSubmissions.size > 100) {
    processedSubmissions.clear();
    console.log('LeetCode to GitHub: Cleared processed submissions cache');
  }
}, 5 * 60 * 1000);

/**
 * Listen for LeetCode submission check requests
 * In Manifest V3, webRequest can be used for observation (non-blocking)
 */
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    console.log('LeetCode to GitHub: Detected submission check request:', details.url);
    
    // Check if already processed BEFORE fetching
    if (processedSubmissions.has(details.url)) {
      console.log('LeetCode to GitHub: Submission already processed, skipping');
      return;
    }
    
    // Fetch the submission result to check if it's "Accepted"
    try {
      await checkSubmissionStatus(details.url, details.tabId);
    } catch (error) {
      console.error('LeetCode to GitHub: Error checking submission status:', error);
    }
  },
  {
    urls: [
      '*://*.leetcode.com/submissions/detail/*/check/',
      '*://*.leetcode.com/submissions/detail/*/check'
    ]
  }
);

/**
 * Fetch submission result and check if it's accepted
 * @param {string} url - The submission check URL
 * @param {number} tabId - The tab ID where the submission was made
 */
async function checkSubmissionStatus(url, tabId) {
  console.log('LeetCode to GitHub: Fetching submission status from:', url);
  
  try {
    // Fetch the submission result using Fetch API (MV3 compatible)
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('LeetCode to GitHub: Failed to fetch submission:', response.status);
      return;
    }
    
    const data = await response.json();
    console.log('LeetCode to GitHub: Submission data received:', {
      status_msg: data.status_msg,
      state: data.state
    });
    
    // Check if submission is complete and accepted
    // state: "SUCCESS" means the check is complete
    // status_msg: "Accepted" means the solution passed all test cases
    if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
      console.log('LeetCode to GitHub: ✅ Accepted submission detected!');
      
      // Mark as processed FIRST to prevent race conditions with multiple polls
      processedSubmissions.add(url);
      
      // Notify content script
      await notifyContentScript(tabId, data);
    } else if (data.state === 'PENDING' || data.state === 'STARTED') {
      console.log('LeetCode to GitHub: Submission still processing...');
      // Don't mark as processed - we'll check again when LeetCode polls
    } else {
      console.log('LeetCode to GitHub: Submission not accepted:', data.status_msg);
      // Mark as processed so we don't check this failed submission again
      processedSubmissions.add(url);
    }
  } catch (error) {
    console.error('LeetCode to GitHub: Error fetching submission status:', error);
    throw error;
  }
}

/**
 * Send message to content script in the tab
 * @param {number} tabId - The tab ID to send the message to
 * @param {object} submissionData - The submission result data
 */
async function notifyContentScript(tabId, submissionData) {
  try {
    // Verify the tab exists and is a LeetCode page
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab.url || !tab.url.includes('leetcode.com')) {
      console.log('LeetCode to GitHub: Tab is not a LeetCode page, skipping notification');
      return;
    }
    
    console.log('LeetCode to GitHub: Sending message to content script in tab', tabId);
    
    // Send message to content script
    const message = {
      type: 'submissionFinished',
      data: {
        status: submissionData.status_msg,
        runtime: submissionData.status_runtime,
        memory: submissionData.status_memory,
        submissionId: submissionData.submission_id,
        questionId: submissionData.question_id,
        lang: submissionData.lang,
        timestamp: Date.now()
      }
    };
    
    await chrome.tabs.sendMessage(tabId, message);
    console.log('LeetCode to GitHub: ✅ Message sent to content script successfully');
  } catch (error) {
    // Tab might be closed or content script not injected yet
    console.error('LeetCode to GitHub: Failed to send message to content script:', error.message);
  }
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('LeetCode to GitHub: Extension installed');
    console.log('LeetCode to GitHub: Click the extension icon to configure your GitHub settings');
  } else if (details.reason === 'update') {
    console.log('LeetCode to GitHub: Extension updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Push problem solution to GitHub repository
 * @param {object} problemData - The scraped problem data from content script
 * @returns {Promise<object>} - Result of the push operation
 */
async function pushToGitHub(problemData) {
  console.log('LeetCode to GitHub: Starting GitHub push process...');
  
  // Subtask 6.1: Retrieve and validate user configuration
  const config = await getUserConfig();
  if (!config.isValid) {
    throw new Error(config.error || 'Invalid GitHub configuration. Please check your settings.');
  }
  
  const { pat, username, repo } = config;
  console.log('LeetCode to GitHub: Configuration validated for', `${username}/${repo}`);
  
  // Subtask 6.2: Prepare file content and repository structure
  const files = prepareFilesForGitHub(problemData);
  console.log('LeetCode to GitHub: Prepared', files.length, 'files for upload');
  
  // Subtask 6.3 & 6.4: Push each file to GitHub with error handling
  const results = [];
  for (const file of files) {
    try {
      const result = await pushFileToGitHub(pat, username, repo, file, problemData.title);
      results.push({ file: file.path, status: 'success', ...result });
      console.log(`LeetCode to GitHub: ✅ ${result.action} ${file.path}`);
    } catch (error) {
      console.error(`LeetCode to GitHub: ❌ Failed to push ${file.path}:`, error.message);
      results.push({ file: file.path, status: 'error', error: error.message });
    }
  }
  
  // Check if all files succeeded
  const allSuccessful = results.every(r => r.status === 'success');
  const message = allSuccessful 
    ? `Successfully pushed ${results.length} file(s) to ${username}/${repo}`
    : `Pushed ${results.filter(r => r.status === 'success').length}/${results.length} file(s). Some files failed.`;
  
  return {
    status: allSuccessful ? 'success' : 'partial',
    message,
    results,
    timestamp: Date.now()
  };
}

/**
 * Retrieve and validate user configuration from chrome.storage.sync
 * Implements Subtask 6.1
 * @returns {Promise<object>} - Configuration object with validation status
 */
async function getUserConfig() {
  try {
    const result = await chrome.storage.sync.get(['githubPat', 'githubUsername', 'githubRepo']);
    
    // Validate all required fields are present
    if (!result.githubPat || !result.githubUsername || !result.githubRepo) {
      return {
        isValid: false,
        error: 'Missing GitHub configuration. Please configure the extension first.'
      };
    }
    
    // Validate PAT format (should start with 'ghp_' for classic tokens or 'github_pat_' for fine-grained)
    const pat = result.githubPat.trim();
    if (!pat.startsWith('ghp_') && !pat.startsWith('github_pat_')) {
      console.warn('LeetCode to GitHub: PAT format may be invalid');
    }
    
    // Validate username and repo are non-empty after trimming
    const username = result.githubUsername.trim();
    const repo = result.githubRepo.trim();
    
    if (!username || !repo) {
      return {
        isValid: false,
        error: 'GitHub username or repository name is empty.'
      };
    }
    
    return {
      isValid: true,
      pat,
      username,
      repo
    };
  } catch (error) {
    console.error('LeetCode to GitHub: Error retrieving config:', error);
    return {
      isValid: false,
      error: 'Failed to retrieve configuration from storage.'
    };
  }
}

/**
 * Prepare files for GitHub upload
 * Implements Subtask 6.2
 * @param {object} problemData - The scraped problem data
 * @returns {Array<object>} - Array of file objects with path, content, and encoding
 */
function prepareFilesForGitHub(problemData) {
  const { slug, extension, code, description, title } = problemData;
  
  // File 1: Solution code
  const solutionFile = {
    path: `${slug}/${slug}${extension}`,
    content: btoa(unescape(encodeURIComponent(code))),
    encoding: 'base64'
  };
  
  // File 2: Problem description (README.md)
  const readmeContent = `# ${title}\n\n${description}\n\n## Solution\n\nSee [\`${slug}${extension}\`](./${slug}${extension})`;
  const readmeFile = {
    path: `${slug}/README.md`,
    content: btoa(unescape(encodeURIComponent(readmeContent))),
    encoding: 'base64'
  };
  
  return [solutionFile, readmeFile];
}

/**
 * Push a single file to GitHub repository
 * Implements Subtask 6.3 & 6.4
 * @param {string} pat - GitHub Personal Access Token
 * @param {string} owner - Repository owner (username)
 * @param {string} repo - Repository name
 * @param {object} file - File object with path, content, and encoding
 * @param {string} problemTitle - Problem title for commit message
 * @returns {Promise<object>} - Result of the push operation
 */
async function pushFileToGitHub(pat, owner, repo, file, problemTitle) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
  
  // Step 1: Check if file exists (GET request)
  let sha = null;
  let isUpdate = false;
  
  try {
    const checkResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LeetCode-to-GitHub-Extension'
      }
    });
    
    if (checkResponse.ok) {
      const existingFile = await checkResponse.json();
      sha = existingFile.sha;
      isUpdate = true;
      console.log(`LeetCode to GitHub: File ${file.path} exists, will update (SHA: ${sha.substring(0, 7)}...)`);
    } else if (checkResponse.status === 404) {
      console.log(`LeetCode to GitHub: File ${file.path} does not exist, will create`);
    } else {
      // Handle other errors from GET request
      throw new Error(`Failed to check file existence: ${checkResponse.status} ${checkResponse.statusText}`);
    }
  } catch (error) {
    // Network errors or parsing errors
    if (!error.message.includes('Failed to check')) {
      throw new Error(`Network error checking file: ${error.message}`);
    }
    throw error;
  }
  
  // Step 2: Create or update the file (PUT request)
  const commitMessage = isUpdate 
    ? `Update ${problemTitle} solution`
    : `Add ${problemTitle} solution`;
  
  const body = {
    message: commitMessage,
    content: file.content,
    ...(sha && { sha }) // Include SHA only if file exists (update)
  };
  
  try {
    const pushResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'LeetCode-to-GitHub-Extension'
      },
      body: JSON.stringify(body)
    });
    
    // Handle GitHub API errors with detailed messages
    if (!pushResponse.ok) {
      const errorData = await pushResponse.json().catch(() => ({}));
      const errorMessage = errorData.message || pushResponse.statusText;
      
      switch (pushResponse.status) {
        case 401:
          throw new Error('Authentication failed. Please check your GitHub Personal Access Token.');
        case 403:
          throw new Error('Permission denied. Ensure your PAT has "repo" scope and you have write access.');
        case 404:
          throw new Error(`Repository ${owner}/${repo} not found. Please check the repository name.`);
        case 409:
          throw new Error('Conflict: File was modified since last check. Please try again.');
        case 422:
          throw new Error(`Validation failed: ${errorMessage}`);
        default:
          throw new Error(`GitHub API error (${pushResponse.status}): ${errorMessage}`);
      }
    }
    
    const result = await pushResponse.json();
    return {
      action: isUpdate ? 'Updated' : 'Created',
      sha: result.content.sha,
      commitUrl: result.commit.html_url
    };
  } catch (error) {
    // Re-throw with context if not already a custom error
    if (error.message.includes('GitHub API error') || 
        error.message.includes('Authentication failed') ||
        error.message.includes('Permission denied') ||
        error.message.includes('Repository') ||
        error.message.includes('Conflict') ||
        error.message.includes('Validation failed')) {
      throw error;
    }
    throw new Error(`Failed to push file: ${error.message}`);
  }
}

/**
 * Handle messages from content script or popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('LeetCode to GitHub: Received message:', message.type);
  
  if (message.type === 'ping') {
    // Health check from content script
    sendResponse({ status: 'ok', timestamp: Date.now() });
    return true;
  }
  
  if (message.type === 'testConnection') {
    // Test if background script is responsive
    sendResponse({ status: 'connected', version: chrome.runtime.getManifest().version });
    return true;
  }
  
  if (message.type === 'pushToGitHub') {
    // Received problem data from content script
    console.log('LeetCode to GitHub: Received problem data for GitHub push');
    console.log('LeetCode to GitHub: Problem:', message.data.title);
    console.log('LeetCode to GitHub: Language:', message.data.language);
    console.log('LeetCode to GitHub: Code length:', message.data.code?.length || 0, 'chars');
    
    // Handle async GitHub push
    (async () => {
      try {
        const result = await pushToGitHub(message.data);
        sendResponse(result);
      } catch (error) {
        console.error('LeetCode to GitHub: Error pushing to GitHub:', error);
        sendResponse({ 
          status: 'error', 
          message: error.message,
          timestamp: Date.now() 
        });
      }
    })();
    
    return true; // Keep message channel open for async response
  }
  
  return false; // No async response needed
});

console.log('LeetCode to GitHub: Background script setup complete');
console.log('LeetCode to GitHub: Listening for submission requests on leetcode.com');
