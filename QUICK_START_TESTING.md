# 🚀 Quick Start - Testing Guide

This guide will help you quickly test the LeetCode to GitHub Chrome Extension.

---

## 📦 Step 1: Load Extension in Chrome

1. **Open Chrome Extensions Page**
   - Navigate to: `chrome://extensions/`
   - Or: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select this folder: `d:\Projects\Leetcode to Github`
   - Extension should appear in your extensions list

4. **Verify Installation**
   - ✅ Extension card shows "LeetCode to GitHub"
   - ✅ Version 1.0.0
   - ✅ No errors shown
   - ✅ Extension icon may appear in toolbar

---

## ⚙️ Step 2: Configure Settings

1. **Open Options Page**
   - Click extension icon in toolbar → "Options"
   - Or: Right-click extension → "Options"
   - Or: In extensions page, click "Extension options"

2. **Enter Your Credentials**
   
   **GitHub Personal Access Token (PAT):**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Name: "LeetCode to GitHub Extension"
   - Expiration: Your choice (recommend 90 days for testing)
   - Required Scopes:
     - ✅ `repo` (Full control of private repositories)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)
   - Paste into "GitHub Personal Access Token" field

   **GitHub Username:**
   - Your GitHub username (e.g., "Aniket-404")

   **Repository Name:**
   - Name of repo where solutions will be pushed
   - Create a new test repo if needed (e.g., "leetcode-solutions-test")
   - Enter just the name (e.g., "leetcode-solutions-test")

3. **Test Connection**
   - Click "Test Connection" button
   - Wait for response
   - ✅ Should see "Connection successful!" message

4. **Save Settings**
   - Click "Save Settings"
   - ✅ Should see success confirmation
   - ✅ Status card appears showing "Last Sync" info

---

## 🧪 Step 3: Test with LeetCode

### Simple Test (Recommended First)

1. **Go to LeetCode**
   - Navigate to: https://leetcode.com/problems/two-sum/
   - Make sure you're logged into LeetCode

2. **Open DevTools**
   - Press F12 or Right-click → Inspect
   - Go to "Console" tab
   - You should see: `"LeetCode to GitHub: Content script loaded"`

3. **Write a Simple Solution**
   - Select language: **Python** (easiest for testing)
   - Paste this simple solution:
   ```python
   class Solution:
       def twoSum(self, nums: List[int], target: int) -> List[int]:
           seen = {}
           for i, num in enumerate(nums):
               complement = target - num
               if complement in seen:
                   return [seen[complement], i]
               seen[num] = i
           return []
   ```

4. **Submit the Solution**
   - Click "Submit" button
   - Wait for "Accepted" status (should be green)

5. **Watch the Console**
   - You should see messages:
     - ✅ "🎉 Submission detected!"
     - ✅ "✅ Accepted status verified"
     - ✅ "✅ Problem data scraped successfully"
     - ✅ Title, language, code length logged
     - ✅ "Sending data to background script..."

6. **Look for Notification**
   - A success notification should appear on the page
   - Green banner in top-right corner

7. **Check Your GitHub Repository**
   - Go to your GitHub repository
   - Refresh the page
   - You should see:
     - ✅ New folder created (Easy, Medium, or Hard)
     - ✅ File created: `two-sum.py`
     - ✅ Commit message: something like "Add solution: Two Sum"
     - ✅ README.md created/updated with solution info

---

## ✅ Success Criteria

If you see all of the following, the extension is working:

- [x] Extension loads without errors
- [x] Options page opens and looks good (dark theme)
- [x] Settings save and persist
- [x] Test connection succeeds
- [x] Console shows "Content script loaded" on LeetCode
- [x] Submission triggers extension
- [x] Problem data is scraped (title, code, language)
- [x] Success notification appears
- [x] File is pushed to GitHub
- [x] Repository structure is correct

---

## 🐛 Common Issues & Solutions

### Issue: Extension won't load
**Solution:** 
- Make sure all files are present (manifest.json, background.js, content_script.js, etc.)
- Check console for errors in `chrome://extensions/`
- Try "Reload" button on extension card

### Issue: "Content script not loaded"
**Solution:**
- Refresh the LeetCode page
- Make sure you're on a problem page (not just leetcode.com)
- Check if extension is enabled

### Issue: No notification after submission
**Solution:**
- Check console for errors
- Make sure submission was "Accepted" (not wrong answer)
- Verify extension has permissions

### Issue: GitHub push fails
**Solution:**
- Verify PAT is correct and not expired
- Check PAT has `repo` scope
- Verify repository name is correct (just name, not full URL)
- Make sure repository exists on GitHub
- Check network connection

### Issue: Wrong language detected
**Solution:**
- This is a known edge case
- Check console logs to see which selector was used
- Extension has fallbacks, but language might default to "Unknown"

---

## 📊 What to Test Next

After basic testing works, try:

1. **Different Languages**
   - Submit solutions in JavaScript, Java, C++
   - Verify correct file extensions (.js, .java, .cpp)

2. **Different Difficulties**
   - Submit Easy, Medium, and Hard problems
   - Verify folders are created correctly

3. **Re-submission**
   - Submit the same problem again with different solution
   - Verify file is updated (not duplicated)

4. **Error Cases**
   - Try with invalid PAT (should show error)
   - Try with non-existent repository (should show error)
   - Submit non-accepted solution (should not push)

5. **Multiple Submissions**
   - Submit 3-5 problems in a row
   - Verify all are captured and pushed

---

## 📝 Detailed Testing

For comprehensive testing, see: [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)

---

## 🆘 Getting Help

If you encounter issues:

1. Check console logs (F12 → Console)
2. Check extension errors (`chrome://extensions/`)
3. Verify all credentials are correct
4. Check GitHub repository permissions
5. Try reloading the extension

---

## 🎯 Next Steps

Once basic testing passes:
1. Mark Task 10.1 as complete ✅
2. Continue through testing checklist
3. Document any bugs or issues found
4. Proceed to Task 11 (if available)

**Happy Testing! 🚀**
