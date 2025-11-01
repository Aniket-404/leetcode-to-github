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
    
    // Avoid processing the same submission multiple times
    if (processedSubmissions.has(details.url)) {
      console.log('LeetCode to GitHub: Submission already processed, skipping');
      return;
    }
    
    // Mark as processing
    processedSubmissions.add(details.url);
    
    // Fetch the submission result to check if it's "Accepted"
    try {
      await checkSubmissionStatus(details.url, details.tabId);
    } catch (error) {
      console.error('LeetCode to GitHub: Error checking submission status:', error);
      // Remove from processed set to allow retry
      processedSubmissions.delete(details.url);
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
      status: data.status_msg,
      state: data.state
    });
    
    // Check if submission is complete and accepted
    // state: "SUCCESS" means the check is complete
    // status_msg: "Accepted" means the solution passed all test cases
    if (data.state === 'SUCCESS' && data.status_msg === 'Accepted') {
      console.log('LeetCode to GitHub: ✅ Accepted submission detected!');
      await notifyContentScript(tabId, data);
    } else if (data.state === 'PENDING' || data.state === 'STARTED') {
      console.log('LeetCode to GitHub: Submission still processing...');
      // For pending submissions, we could set up a retry mechanism
      // But LeetCode polls automatically, so we'll catch it on the next request
    } else {
      console.log('LeetCode to GitHub: Submission not accepted:', data.status_msg);
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
    
    // TODO: In next task, this will push to GitHub
    // For now, just acknowledge receipt
    sendResponse({ 
      status: 'received', 
      message: 'Data received successfully. GitHub push will be implemented in next task.',
      timestamp: Date.now() 
    });
    return true;
  }
  
  return false; // No async response needed
});

console.log('LeetCode to GitHub: Background script setup complete');
console.log('LeetCode to GitHub: Listening for submission requests on leetcode.com');
