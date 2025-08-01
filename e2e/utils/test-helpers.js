/**
 * TEST HELPER UTILITIES
 * Common functions to simplify and standardize test operations
 */

const { expect } = require('@playwright/test');

/**
 * Login helper - logs in a user with provided credentials
 * @param {import('@playwright/test').Page} page 
 * @param {string} email 
 * @param {string} password 
 */
async function loginUser(page, email, password) {
  await page.goto('/login');
  
  // Fill login form
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  
  // Submit form
  const submitButton = page.locator('button[type="submit"], input[type="submit"]');
  await submitButton.click();
  
  // Wait for login to complete
  await expect(page.locator('text=Log Out')).toBeVisible({ timeout: 10000 });
}

/**
 * Logout helper - logs out the current user
 * @param {import('@playwright/test').Page} page 
 */
async function logoutUser(page) {
  const logoutButton = page.locator('text=Log Out');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await expect(page.locator('text=Log In')).toBeVisible();
  }
}

/**
 * Fill reservation form with test data
 * @param {import('@playwright/test').Page} page 
 * @param {Object} data - Reservation data
 */
async function fillReservationForm(page, data = {}) {
  const defaults = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+30 123 456 7890',
    date: getTomorrowDate(),
    time: '19:00',
    partySize: '2',
    specialRequests: 'Test reservation'
  };
  
  const formData = { ...defaults, ...data };
  
  await page.fill('input[name="name"]', formData.name);
  await page.fill('input[name="email"]', formData.email);
  await page.fill('input[name="phone"]', formData.phone);
  await page.fill('input[name="date"]', formData.date);
  await page.selectOption('select[name="time"]', formData.time);
  await page.selectOption('select[name="partySize"]', formData.partySize);
  
  if (formData.specialRequests) {
    await page.fill('textarea[name="specialRequests"]', formData.specialRequests);
  }
  
  // Select table type if available
  const tableTypeSelect = page.locator('select[name="tableType"]');
  if (await tableTypeSelect.isVisible()) {
    await tableTypeSelect.selectOption({ index: 0 });
  }
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 * @returns {string}
 */
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Get next week's date in YYYY-MM-DD format
 * @returns {string}
 */
function getNextWeekDate() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.toISOString().split('T')[0];
}

/**
 * Wait for element to be stable (not moving/changing)
 * @param {import('@playwright/test').Locator} locator 
 * @param {number} timeout 
 */
async function waitForStable(locator, timeout = 5000) {
  await locator.waitFor({ state: 'visible', timeout });
  
  let previousBox = await locator.boundingBox();
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    await page.waitForTimeout(100);
    const currentBox = await locator.boundingBox();
    
    if (previousBox && currentBox &&
        previousBox.x === currentBox.x &&
        previousBox.y === currentBox.y &&
        previousBox.width === currentBox.width &&
        previousBox.height === currentBox.height) {
      return; // Element is stable
    }
    
    previousBox = currentBox;
    attempts++;
  }
}

/**
 * Send a chat message and wait for AI response
 * @param {import('@playwright/test').Page} page 
 * @param {string} message 
 * @returns {Promise<string>} - The AI response text
 */
async function sendChatMessage(page, message) {
  const chatInput = page.locator('.chat-input, input[type="text"], textarea').first();
  const sendButton = page.locator('button[type="submit"], .send-btn, button:has-text("Send")').first();
  
  await chatInput.fill(message);
  await sendButton.click();
  
  // Wait for AI response
  const aiResponse = page.locator('.message.ai, .chat-message.ai, [class*="ai-message"]').last();
  await expect(aiResponse).toBeVisible({ timeout: 15000 });
  
  return await aiResponse.textContent();
}

/**
 * Navigate to restaurant reservation page
 * @param {import('@playwright/test').Page} page 
 * @param {number} restaurantId 
 */
async function goToReservationPage(page, restaurantId = 1) {
  await page.goto(`/reservation/${restaurantId}`);
  
  // Wait for page to load
  await expect(page.locator('h1')).toContainText('Make a Reservation');
  await expect(page.locator('.form-card, .reservation-form')).toBeVisible();
}

/**
 * Check if element is in viewport
 * @param {import('@playwright/test').Locator} locator 
 * @returns {Promise<boolean>}
 */
async function isInViewport(locator) {
  return await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  });
}

/**
 * Take screenshot with timestamp
 * @param {import('@playwright/test').Page} page 
 * @param {string} name 
 */
async function takeTimestampedScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  });
}

/**
 * Wait for network to be idle
 * @param {import('@playwright/test').Page} page 
 * @param {number} timeout 
 */
async function waitForNetworkIdle(page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Check if page has no console errors
 * @param {import('@playwright/test').Page} page 
 * @returns {Array} - Array of console errors
 */
async function getConsoleErrors(page) {
  const errors = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  return errors;
}

/**
 * Simulate slow network conditions
 * @param {import('@playwright/test').Page} page 
 */
async function simulateSlowNetwork(page) {
  await page.route('**/*', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.continue();
  });
}

module.exports = {
  loginUser,
  logoutUser,
  fillReservationForm,
  getTomorrowDate,
  getNextWeekDate,
  waitForStable,
  sendChatMessage,
  goToReservationPage,
  isInViewport,
  takeTimestampedScreenshot,
  waitForNetworkIdle,
  getConsoleErrors,
  simulateSlowNetwork
};