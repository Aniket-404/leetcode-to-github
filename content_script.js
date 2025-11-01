// Content Script for LeetCode to GitHub Extension
// Runs on LeetCode problem pages

console.log('LeetCode to GitHub: Content script loaded on', window.location.href);

/**
 * Language to file extension mapping
 * Maps LeetCode language names to their corresponding file extensions
 */
const LANGUAGE_MAP = {
  // Common languages
  'JavaScript': '.js',
  'TypeScript': '.ts',
  'Python': '.py',
  'Python3': '.py',
  'Java': '.java',
  'C++': '.cpp',
  'C': '.c',
  'C#': '.cs',
  'Ruby': '.rb',
  'Go': '.go',
  'Swift': '.swift',
  'Kotlin': '.kt',
  'Rust': '.rs',
  'PHP': '.php',
  'Scala': '.scala',
  'R': '.r',
  'Perl': '.pl',
  'Elixir': '.ex',
  'Erlang': '.erl',
  'Racket': '.rkt',
  'Dart': '.dart',
  
  // Shell/Scripting
  'Bash': '.sh',
  'Shell': '.sh',
  
  // SQL
  'MySQL': '.sql',
  'MS SQL Server': '.sql',
  'Oracle': '.sql',
  'PostgreSQL': '.sql',
  
  // Functional
  'Haskell': '.hs',
  'Clojure': '.clj',
  'F#': '.fs',
  'OCaml': '.ml',
  
  // Others
  'Lua': '.lua',
  'Julia': '.jl',
  'VB.NET': '.vb',
  'Groovy': '.groovy',
  'Objective-C': '.m',
  'Pascal': '.pas',
  'Prolog': '.pl',
  'Scheme': '.scm'
};

/**
 * Map language to file extension
 * @param {string} language - The programming language name
 * @returns {string} The file extension (e.g., '.py', '.js')
 */
function getFileExtension(language) {
  if (!language) {
    console.warn('LeetCode to GitHub: No language provided, using .txt');
    return '.txt';
  }
  
  // Normalize the language string (trim whitespace, handle case variations)
  const normalizedLanguage = language.trim();
  
  // Direct lookup (case-sensitive first)
  if (LANGUAGE_MAP[normalizedLanguage]) {
    console.log(`LeetCode to GitHub: Mapped language '${normalizedLanguage}' to ${LANGUAGE_MAP[normalizedLanguage]}`);
    return LANGUAGE_MAP[normalizedLanguage];
  }
  
  // Case-insensitive lookup as fallback
  const languageKey = Object.keys(LANGUAGE_MAP).find(
    key => key.toLowerCase() === normalizedLanguage.toLowerCase()
  );
  
  if (languageKey) {
    console.log(`LeetCode to GitHub: Mapped language '${normalizedLanguage}' to ${LANGUAGE_MAP[languageKey]} (case-insensitive)`);
    return LANGUAGE_MAP[languageKey];
  }
  
  // Handle common aliases and variations
  const aliases = {
    'py': '.py',
    'python2': '.py',
    'js': '.js',
    'ts': '.ts',
    'cpp': '.cpp',
    'c++': '.cpp',
    'csharp': '.cs',
    'c sharp': '.cs',
    'golang': '.go',
    'rust-lang': '.rs'
  };
  
  const aliasKey = normalizedLanguage.toLowerCase().replace(/\s+/g, '');
  if (aliases[aliasKey]) {
    console.log(`LeetCode to GitHub: Mapped language alias '${normalizedLanguage}' to ${aliases[aliasKey]}`);
    return aliases[aliasKey];
  }
  
  // Unknown language - fallback to .txt
  console.warn(`LeetCode to GitHub: Unknown language '${normalizedLanguage}', defaulting to .txt`);
  return '.txt';
}

/**
 * Listen for messages from the background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('LeetCode to GitHub: Content script received message:', message.type);
  
  if (message.type === 'submissionFinished') {
    console.log('LeetCode to GitHub: 🎉 Submission detected!');
    console.log('LeetCode to GitHub: Submission details:', message.data);
    
    // Handle the submission asynchronously
    handleSubmission(message.data).then(() => {
      sendResponse({ status: 'received', timestamp: Date.now() });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  return false;
});

/**
 * Handle a submission by verifying status and scraping data
 * @param {object} submissionData - The submission data from background script
 */
async function handleSubmission(submissionData) {
  try {
    // Wait for DOM to update with submission result
    console.log('LeetCode to GitHub: Waiting for DOM to update...');
    await sleep(1500);
    
    // Verify the submission status is "Accepted"
    const isAccepted = await verifyAcceptedStatus();
    
    if (!isAccepted) {
      console.log('LeetCode to GitHub: Submission not accepted, skipping GitHub push');
      showNotification('Submission Not Accepted', 'Only accepted solutions are pushed to GitHub', 'info');
      return;
    }
    
    console.log('LeetCode to GitHub: ✅ Accepted status verified, scraping problem data...');
    showNotification('Accepted!', 'Extracting solution data...', 'success');
    
    // Scrape problem data from the page
    const problemData = await scrapeProblemData();
    
    if (!problemData) {
      console.error('LeetCode to GitHub: Failed to scrape problem data');
      showNotification('Error', 'Failed to extract problem data', 'error');
      return;
    }
    
    console.log('LeetCode to GitHub: Problem data scraped successfully:', problemData);
    
    // Send data to background script for GitHub push
    await sendToBackground(problemData);
    
  } catch (error) {
    console.error('LeetCode to GitHub: Error handling submission:', error);
    showNotification('Error', 'Failed to process submission. Check console for details.', 'error');
  }
}

/**
 * Verify that the submission status is "Accepted"
 * @returns {Promise<boolean>} True if status is accepted
 */
async function verifyAcceptedStatus() {
  try {
    // Primary selector
    let statusElement = document.querySelector('[data-e2e-locator="submission-result"]');
    
    // Fallback selectors
    if (!statusElement) {
      console.warn('LeetCode to GitHub: Primary status selector not found, trying fallbacks...');
      statusElement = document.querySelector('[class*="submission-result"]') ||
                     document.querySelector('[class*="result-state"]') ||
                     document.querySelector('.result__success');
    }
    
    if (!statusElement) {
      console.warn('LeetCode to GitHub: Could not find submission status element');
      return false;
    }
    
    const statusText = statusElement.textContent || '';
    const isAccepted = statusText.toLowerCase().includes('accepted');
    
    console.log('LeetCode to GitHub: Status text:', statusText.trim());
    console.log('LeetCode to GitHub: Is accepted:', isAccepted);
    
    return isAccepted;
  } catch (error) {
    console.error('LeetCode to GitHub: Error verifying status:', error);
    return false;
  }
}

/**
 * Scrape problem data from the LeetCode page
 * @returns {Promise<object|null>} The scraped problem data
 */
async function scrapeProblemData() {
  try {
    const data = {};
    
    // Scrape title
    data.title = scrapeTitle();
    if (!data.title) {
      console.error('LeetCode to GitHub: Failed to scrape title');
      return null;
    }
    
    // Scrape description
    data.description = scrapeDescription();
    
    // Scrape code
    data.code = scrapeCode();
    if (!data.code) {
      console.error('LeetCode to GitHub: Failed to scrape code');
      return null;
    }
    
    // Scrape language
    data.language = scrapeLanguage();
    if (!data.language) {
      console.warn('LeetCode to GitHub: Failed to scrape language, using default');
      data.language = 'Unknown';
    }
    
    // Map language to file extension
    data.extension = getFileExtension(data.language);
    
    // Generate slug from title
    data.slug = generateSlug(data.title);
    
    // Add metadata
    data.timestamp = Date.now();
    data.url = window.location.href;
    
    return data;
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping problem data:', error);
    return null;
  }
}

/**
 * Scrape problem title
 * @returns {string|null} The problem title
 */
function scrapeTitle() {
  try {
    // Primary selector
    let titleElement = document.querySelector('[data-cy="question-title"]');
    
    // Fallback selectors
    if (!titleElement) {
      console.warn('LeetCode to GitHub: Primary title selector not found, trying fallbacks...');
      titleElement = document.querySelector('[class*="question-title"]') ||
                    document.querySelector('h1') ||
                    document.querySelector('.css-v3d350');
    }
    
    if (titleElement) {
      const title = titleElement.textContent.trim();
      console.log('LeetCode to GitHub: Title scraped:', title);
      return title;
    }
    
    console.error('LeetCode to GitHub: Could not find title element');
    return null;
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping title:', error);
    return null;
  }
}

/**
 * Scrape problem description
 * @returns {string} The problem description (HTML or text)
 */
function scrapeDescription() {
  try {
    // Primary selector for description
    let descElement = document.querySelector('.prose') ||
                     document.querySelector('[class*="elfjS"]') ||
                     document.querySelector('[class*="question-content"]');
    
    if (descElement) {
      // Clean up the HTML
      const description = descElement.innerHTML;
      console.log('LeetCode to GitHub: Description scraped (length:', description.length, 'chars)');
      return description;
    }
    
    console.warn('LeetCode to GitHub: Could not find description element');
    return 'No description available';
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping description:', error);
    return 'Error extracting description';
  }
}

/**
 * Scrape submitted code
 * @returns {string|null} The submitted code
 */
function scrapeCode() {
  try {
    // Try to get code from Monaco editor
    if (window.monaco && window.monaco.editor) {
      const models = window.monaco.editor.getModels();
      if (models && models.length > 0) {
        const code = models[0].getValue();
        console.log('LeetCode to GitHub: Code scraped from Monaco editor (length:', code.length, 'chars)');
        return code;
      }
    }
    
    console.warn('LeetCode to GitHub: Monaco editor not found, trying fallback...');
    
    // Fallback: Try to find code in pre/code elements
    const codeElement = document.querySelector('pre code') ||
                       document.querySelector('.monaco-editor') ||
                       document.querySelector('[class*="code-area"]');
    
    if (codeElement) {
      const code = codeElement.textContent;
      console.log('LeetCode to GitHub: Code scraped from fallback (length:', code.length, 'chars)');
      return code;
    }
    
    console.error('LeetCode to GitHub: Could not find code');
    return null;
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping code:', error);
    return null;
  }
}

/**
 * Scrape programming language
 * @returns {string|null} The programming language
 */
function scrapeLanguage() {
  try {
    // Primary selector for language dropdown
    let langElement = document.querySelector('button[id^="headlessui-listbox-button-"]');
    
    // Fallback selectors
    if (!langElement) {
      console.warn('LeetCode to GitHub: Primary language selector not found, trying fallbacks...');
      langElement = document.querySelector('[class*="lang-select"]') ||
                   document.querySelector('[class*="language-picker"]') ||
                   document.querySelector('button[aria-label*="language"]');
    }
    
    if (langElement) {
      const language = langElement.textContent.trim();
      console.log('LeetCode to GitHub: Language scraped:', language);
      return language;
    }
    
    console.warn('LeetCode to GitHub: Could not find language element');
    return null;
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping language:', error);
    return null;
  }
}

/**
 * Generate a URL-friendly slug from the title
 * @param {string} title - The problem title
 * @returns {string} The slug
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

/**
 * Send scraped data to background script
 * @param {object} data - The problem data
 */
async function sendToBackground(data) {
  try {
    console.log('LeetCode to GitHub: Sending data to background script...');
    
    const response = await chrome.runtime.sendMessage({
      type: 'pushToGitHub',
      data: data
    });
    
    console.log('LeetCode to GitHub: Background script response:', response);
    showNotification('Ready to Push', 'Solution data extracted successfully! (GitHub push coming in next task)', 'success');
  } catch (error) {
    console.error('LeetCode to GitHub: Error sending to background:', error);
    showNotification('Error', 'Failed to send data to background script', 'error');
  }
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Show a notification banner on the page
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - 'success', 'error', or 'info'
 */
function showNotification(title, message, type = 'success') {
  // Remove any existing notification
  const existing = document.getElementById('leetcode-github-notification');
  if (existing) {
    existing.remove();
  }
  
  // Color scheme based on type
  const colors = {
    success: { bg: '#10b981', icon: '✅' },
    error: { bg: '#ef4444', icon: '❌' },
    info: { bg: '#3b82f6', icon: 'ℹ️' }
  };
  
  const colorScheme = colors[type] || colors.info;
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'leetcode-github-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colorScheme.bg};
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
      ${colorScheme.icon} ${title}
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
