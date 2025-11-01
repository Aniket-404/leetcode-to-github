// Content Script for LeetCode to GitHub Extension
// Runs on LeetCode problem pages

console.log('LeetCode to GitHub: Content script loaded on', window.location.href);

/**
 * Listen for messages from the background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('LeetCode to GitHub: Content script received message:', message.type);
  
  if (message.type === 'submissionFinished') {
    console.log('LeetCode to GitHub: 🎉 Accepted submission detected!');
    console.log('LeetCode to GitHub: Submission details:', message.data);
    
    // Handle the accepted submission
    handleAcceptedSubmission(message.data);
    
    // Send acknowledgment
    sendResponse({ status: 'received', timestamp: Date.now() });
    return true;
  }
  
  return false;
});

/**
 * Handle an accepted submission
 * @param {object} submissionData - The submission data from background script
 */
async function handleAcceptedSubmission(submissionData) {
  console.log('LeetCode to GitHub: Processing accepted submission...');
  
  try {
    // Show a notification to the user
    showNotification('Submission Accepted!', 'Preparing to push to GitHub...');
    
    // TODO: In future tasks, this will:
    // 1. Extract problem details from the page
    // 2. Get the submitted code
    // 3. Format the solution
    // 4. Push to GitHub repository
    
    console.log('LeetCode to GitHub: Submission processing complete (placeholder)');
  } catch (error) {
    console.error('LeetCode to GitHub: Error processing submission:', error);
    showNotification('Error', 'Failed to process submission. Check console for details.', 'error');
  }
}

/**
 * Show a notification banner on the page
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - 'success' or 'error'
 */
function showNotification(title, message, type = 'success') {
  // Remove any existing notification
  const existing = document.getElementById('leetcode-github-notification');
  if (existing) {
    existing.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'leetcode-github-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">
      ${type === 'success' ? '✅' : '❌'} ${title}
    </div>
    <div style="font-size: 14px; opacity: 0.95;">
      ${message}
    </div>
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Send a ping to background script to verify connection
 */
async function testBackgroundConnection() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'ping' });
    console.log('LeetCode to GitHub: Background script connection:', response);
    return response.status === 'ok';
  } catch (error) {
    console.error('LeetCode to GitHub: Failed to connect to background script:', error);
    return false;
  }
}

// Test connection on load
testBackgroundConnection();

console.log('LeetCode to GitHub: Content script ready and listening for submissions');
