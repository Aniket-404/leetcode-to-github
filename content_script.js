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
    
    // Scrape problem data from the page, using submission data for language
    const problemData = await scrapeProblemData(submissionData);
    
    if (!problemData) {
      console.error('LeetCode to GitHub: Failed to scrape problem data');
      showNotification('Error', 'Failed to extract problem data', 'error');
      return;
    }
    
    // Log summary without exposing sensitive code
    console.log('LeetCode to GitHub: ✅ Problem data scraped successfully');
    console.log('LeetCode to GitHub: - Title:', problemData.title);
    console.log('LeetCode to GitHub: - Language:', problemData.language);
    console.log('LeetCode to GitHub: - Extension:', problemData.extension);
    console.log('LeetCode to GitHub: - Code length:', problemData.code?.length || 0, 'characters');
    console.log('LeetCode to GitHub: - Description length:', problemData.description?.length || 0, 'characters');
    
    // Send data to background script for GitHub push
    await sendToBackground(problemData);
    
  } catch (error) {
    console.error('LeetCode to GitHub: Error handling submission:', error);
    showNotification('Error', 'Failed to process submission. Check console for details.', 'error');
  }
}

/**
 * Verify that the submission status is "Accepted"
 * PRIMARY SELECTOR: [data-e2e-locator="submission-result"] - Main submission result
 * FALLBACK 1: [class*="submission-result"] - Result by class pattern
 * FALLBACK 2: [class*="result-state"] - Result state container
 * FALLBACK 3: .result__success - Success result class
 * FALLBACK 4: [data-cy="submission-result"] - Test ID
 * FALLBACK 5: [class*="accepted"] - Accepted class pattern
 * DEFAULT: false if status cannot be determined
 * @returns {Promise<boolean>} True if status is accepted, false otherwise
 */
async function verifyAcceptedStatus() {
  try {
    // Array of selectors to try in order
    const selectors = [
      '[data-e2e-locator="submission-result"]',    // Primary: E2E locator
      '[class*="submission-result"]',              // Fallback 1: Class pattern
      '[class*="result-state"]',                   // Fallback 2: Result state
      '.result__success',                          // Fallback 3: Success class
      '[data-cy="submission-result"]',             // Fallback 4: Test ID
      '[class*="accepted"]',                       // Fallback 5: Accepted pattern
      '[data-testid="submission-result"]'          // Fallback 6: Test ID variant
    ];
    
    // Try each selector in sequence
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const element = document.querySelector(selector);
      
      // Use optional chaining to safely access textContent
      const statusText = element?.textContent?.trim()?.toLowerCase() || '';
      
      if (statusText.length > 0) {
        const isAccepted = statusText.includes('accepted');
        
        // Log which selector was used
        if (i === 0) {
          console.log('LeetCode to GitHub: Status verified using primary selector:', statusText);
        } else {
          console.warn(`LeetCode to GitHub: ⚠️ Status verified using FALLBACK ${i} (${selector}):`, statusText);
        }
        
        console.log('LeetCode to GitHub: Is accepted:', isAccepted);
        return isAccepted;
      }
    }
    
    // All selectors failed - cannot determine status
    console.error('LeetCode to GitHub: ❌ All status selectors failed, cannot verify acceptance');
    return false;
    
  } catch (error) {
    console.error('LeetCode to GitHub: Error verifying status:', error);
    return false; // Fail safe - don't push if we can't verify
  }
}

/**
 * Scrape problem data from the LeetCode page
 * Coordinates all scraping functions and ensures data integrity
 * @param {object} submissionData - Optional submission data from background script (contains lang, questionId)
 * @returns {Promise<object|null>} The scraped problem data, or null if critical data is missing
 */
async function scrapeProblemData(submissionData = {}) {
  try {
    const data = {};
    
    // Scrape title (has default, never null)
    data.title = scrapeTitle();
    if (!data.title || data.title === 'Untitled Problem') {
      console.warn('LeetCode to GitHub: ⚠️ Using default title');
    }
    
    // Scrape description (has default, never null)
    data.description = scrapeDescription();
    if (!data.description || data.description === 'No description available') {
      console.warn('LeetCode to GitHub: ⚠️ Using default description');
    }
    
    // Scrape code (CRITICAL - can be null if all methods fail)
    data.code = scrapeCode();
    if (!data.code) {
      console.error('LeetCode to GitHub: ❌ CRITICAL: Failed to scrape code - cannot proceed');
      return null; // Code is required - fail if we can't get it
    }
    
    // Use language from submissionData if available, otherwise scrape
    if (submissionData.lang) {
      data.language = submissionData.lang;
      console.log('LeetCode to GitHub: ✅ Using language from submission data:', data.language);
    } else {
      data.language = scrapeLanguage();
      if (data.language === 'Unknown') {
        console.warn('LeetCode to GitHub: ⚠️ Language unknown, will use .txt extension');
      }
    }
    
    // Map language to file extension (handles 'Unknown' gracefully)
    data.extension = getFileExtension(data.language);
    
    // Generate slug from title (safe even with default title)
    data.slug = generateSlug(data.title);
    
    // Add metadata
    data.timestamp = Date.now();
    data.url = window.location.href;
    
    // Log successful scraping summary
    console.log('LeetCode to GitHub: ✅ Problem data scraped successfully');
    console.log('LeetCode to GitHub: - Title:', data.title);
    console.log('LeetCode to GitHub: - Language:', data.language);
    console.log('LeetCode to GitHub: - Extension:', data.extension);
    console.log('LeetCode to GitHub: - Code length:', data.code?.length || 0, 'characters');
    console.log('LeetCode to GitHub: - Description length:', data.description?.length || 0, 'characters');
    
    return data;
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping problem data:', error);
    return null;
  }
}

/**
 * Scrape problem title
 * PRIMARY SELECTOR: [data-cy="question-title"] - Main title with test ID
 * FALLBACK 1: [class*="question-title"] - Title by class pattern
 * FALLBACK 2: h1 - First heading element
 * FALLBACK 3: .css-v3d350 - Legacy CSS class
 * DEFAULT: 'Untitled Problem' if all selectors fail
 * @returns {string} The problem title (never null due to default)
 */
function scrapeTitle() {
  try {
    // Array of selectors to try in order (primary first, then fallbacks)
    const selectors = [
      'a[href*="/problems/"]',              // NEW: Problem link in breadcrumb/title
      '[data-cy="question-title"]',        // Primary: Test ID selector
      'div[class*="text-title"] a',         // Fallback 1: Title link
      '[class*="question-title"]',         // Fallback 2: Class pattern match
      'h1',                                 // Fallback 3: Generic h1
      '.css-v3d350',                        // Fallback 4: Legacy class
      '[data-testid="question-title"]',    // Fallback 5: Alternative test ID
      'div[class*="title"] h1'              // Fallback 6: Title wrapper with h1
    ];
    
    // Try each selector in sequence
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const element = document.querySelector(selector);
      
      // Use optional chaining to safely access textContent
      const title = element?.textContent?.trim();
      
      if (title && title.length > 0) {
        // Log which selector was used
        if (i === 0) {
          console.log('LeetCode to GitHub: Title scraped using primary selector:', title);
        } else {
          console.warn(`LeetCode to GitHub: ⚠️ Title scraped using FALLBACK ${i} (${selector}):`, title);
        }
        return title;
      }
    }
    
    // All selectors failed - use default value
    console.error('LeetCode to GitHub: ❌ All title selectors failed, using default');
    return 'Untitled Problem';
    
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping title:', error);
    return 'Untitled Problem'; // Ensure we never return null
  }
}

/**
 * Scrape problem description
 * PRIMARY SELECTOR: .prose - Main description container
 * FALLBACK 1: [class*="elfjS"] - Description by class pattern
 * FALLBACK 2: [class*="question-content"] - Question content container
 * FALLBACK 3: [data-cy="question-description"] - Description test ID
 * FALLBACK 4: .question-description - Legacy class
 * DEFAULT: 'No description available' if all selectors fail
 * @returns {string} The problem description HTML (never null due to default)
 */
function scrapeDescription() {
  try {
    // Array of selectors to try in order
    const selectors = [
      '.prose',                              // Primary: Prose container
      '[class*="elfjS"]',                    // Fallback 1: Class pattern
      '[class*="question-content"]',         // Fallback 2: Question content
      '[data-cy="question-description"]',    // Fallback 3: Test ID
      '.question-description',               // Fallback 4: Legacy class
      'div[class*="description"]'            // Fallback 5: Generic description div
    ];
    
    // Try each selector in sequence
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const element = document.querySelector(selector);
      
      // Use optional chaining to safely access innerHTML
      const description = element?.innerHTML?.trim();
      
      if (description && description.length > 0) {
        // Log which selector was used
        if (i === 0) {
          console.log('LeetCode to GitHub: Description scraped using primary selector (length:', description.length, 'chars)');
        } else {
          console.warn(`LeetCode to GitHub: ⚠️ Description scraped using FALLBACK ${i} (${selector}), length:`, description.length);
        }
        return description;
      }
    }
    
    // All selectors failed - use default value
    console.error('LeetCode to GitHub: ❌ All description selectors failed, using default');
    return 'No description available';
    
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping description:', error);
    return 'Error extracting description'; // Ensure we never return null
  }
}

/**
 * Scrape submitted code
 * PRIMARY METHOD: Monaco Editor API (window.monaco.editor.getModels())
 * FALLBACK 1: pre code - Code in pre/code elements
 * FALLBACK 2: .monaco-editor - Monaco editor container
 * FALLBACK 3: [class*="code-area"] - Code area by class pattern
 * FALLBACK 4: [data-testid="code-editor"] - Code editor test ID
 * FALLBACK 5: textarea[class*="code"] - Code textarea
 * DEFAULT: null if all methods fail (indicates critical failure)
 * @returns {string|null} The submitted code (null only if all attempts fail)
 */
function scrapeCode() {
  try {
    // PRIMARY: Try Monaco Editor API (most reliable)
    if (window.monaco?.editor) {
      const models = window.monaco.editor.getModels();
      const code = models?.[0]?.getValue();
      
      if (code && code.trim().length > 0) {
        console.log('LeetCode to GitHub: Code scraped from Monaco editor (length:', code.length, 'chars)');
        return code;
      }
    }
    
    // FALLBACKS: Try DOM-based selectors
    const selectors = [
      'pre code',                          // Fallback 1: Standard pre/code
      '.monaco-editor',                    // Fallback 2: Monaco container
      '[class*="code-area"]',              // Fallback 3: Code area pattern
      '[data-testid="code-editor"]',       // Fallback 4: Test ID
      'textarea[class*="code"]',           // Fallback 5: Code textarea
      '.CodeMirror',                       // Fallback 6: CodeMirror editor
      '[class*="editor"] textarea'         // Fallback 7: Editor textarea
    ];
    
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const element = document.querySelector(selector);
      
      // Use optional chaining to safely access content
      const code = element?.textContent?.trim() || element?.value?.trim();
      
      if (code && code.length > 0) {
        console.warn(`LeetCode to GitHub: ⚠️ Code scraped using FALLBACK ${i + 1} (${selector}), length:`, code.length);
        return code;
      }
    }
    
    // All methods failed - this is critical, return null to signal failure
    console.error('LeetCode to GitHub: ❌ All code scraping methods failed');
    return null;
    
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping code:', error);
    return null; // Return null to indicate critical failure
  }
}

/**
 * Scrape programming language
 * PRIMARY SELECTOR: button[id^="headlessui-listbox-button-"] - Language dropdown button
 * FALLBACK 1: [class*="lang-select"] - Language select by class pattern
 * FALLBACK 2: [class*="language-picker"] - Language picker container
 * FALLBACK 3: button[aria-label*="language"] - Button with language aria-label
 * FALLBACK 4: [data-cy="language-select"] - Language select test ID
 * FALLBACK 5: select[class*="language"] - Language select element
 * DEFAULT: 'Unknown' if all selectors fail (extension mapping handles this)
 * @returns {string} The programming language (never null due to default)
 */
function scrapeLanguage() {
  try {
    // Array of selectors to try in order
    const selectors = [
      'button[id^="headlessui-listbox-button-"] span',  // Primary: Headless UI dropdown text
      'button[id^="headlessui-listbox-button-"]',       // Primary alt: Full button
      'div[class*="text-label-3"] button',               // NEW: Modern language button
      '[class*="lang-select"]',                          // Fallback 1: Lang select class
      '[class*="language-picker"]',                      // Fallback 2: Language picker
      'button[aria-label*="language"]',                  // Fallback 3: Aria-label match
      '[data-cy="language-select"]',                     // Fallback 4: Test ID
      'select[class*="language"]',                       // Fallback 5: Select element
      'button[class*="language"]',                       // Fallback 6: Language button
      '.language-selector'                               // Fallback 7: Legacy class
    ];
    
    // Try each selector in sequence
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const element = document.querySelector(selector);
      
      // Use optional chaining to safely access textContent or value
      const language = element?.textContent?.trim() || element?.value?.trim();
      
      if (language && language.length > 0) {
        // Log which selector was used
        if (i === 0) {
          console.log('LeetCode to GitHub: Language scraped using primary selector:', language);
        } else {
          console.warn(`LeetCode to GitHub: ⚠️ Language scraped using FALLBACK ${i} (${selector}):`, language);
        }
        return language;
      }
    }
    
    // All selectors failed - use default value
    console.error('LeetCode to GitHub: ❌ All language selectors failed, using default');
    return 'Unknown';
    
  } catch (error) {
    console.error('LeetCode to GitHub: Error scraping language:', error);
    return 'Unknown'; // Ensure we never return null
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
