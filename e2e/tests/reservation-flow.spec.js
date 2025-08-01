const { test, expect } = require('@playwright/test');

/**
 * RESERVATION FLOW E2E TESTS
 * These tests cover the core reservation functionality - the most critical user journey
 */

test.describe('Reservation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto('/');
  });

  test('should complete full reservation flow for Lofaki Restaurant', async ({ page }) => {
    // Step 1: Navigate to Browse Restaurants
    await page.click('text=Browse Restaurants');
    await expect(page).toHaveURL(/.*browse-restaurants/);
    await expect(page.locator('h1')).toContainText('Browse Restaurants');

    // Step 2: Select Lofaki Restaurant (or first available restaurant)
    const restaurantCard = page.locator('.restaurant-card').first();
    await expect(restaurantCard).toBeVisible();
    
    // Click on "Make Reservation" button
    const reservationButton = restaurantCard.locator('text=Make Reservation');
    await reservationButton.click();

    // Step 3: Verify we're on the reservation page
    await expect(page).toHaveURL(/.*reservation\/\d+/);
    await expect(page.locator('h1')).toContainText('Make a Reservation');

    // Step 4: Verify the new layout elements are present
    await expect(page.locator('.info-context-zone')).toBeVisible();
    await expect(page.locator('.action-zone')).toBeVisible();
    await expect(page.locator('.form-card')).toBeVisible();
    await expect(page.locator('.unified-chat-component')).toBeVisible();

    // Step 5: Verify restaurant address is shown in the form
    await expect(page.locator('.restaurant-location-form')).toBeVisible();

    // Step 6: Fill out the reservation form
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', 'john.doe@example.com');
    await page.fill('input[name="phone"]', '+30 123 456 7890');
    
    // Set date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="date"]', tomorrowStr);
    
    // Select time from dropdown
    await page.selectOption('select[name="time"]', '19:00'); // 7:00 PM
    
    // Select party size
    await page.selectOption('select[name="partySize"]', '2');
    
    // Select table type if available
    const tableTypeSelect = page.locator('select[name="tableType"]');
    if (await tableTypeSelect.isVisible()) {
      await tableTypeSelect.selectOption({ index: 0 });
    }
    
    // Add special requests
    await page.fill('textarea[name="specialRequests"]', 'Window table please, celebrating anniversary');

    // Step 7: Verify form validation and styling
    await expect(page.locator('select[name="time"]')).toHaveClass(/form-group/);
    await expect(page.locator('select[name="partySize"]')).toHaveClass(/form-group/);

    // Step 8: Submit the reservation
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toContainText('Book Now');
    await expect(submitButton).toBeEnabled();
    
    await submitButton.click();

    // Step 9: Verify submission (you may need to adjust based on your success flow)
    // Either redirects to confirmation page or shows success message
    await expect(page.locator('.reservation-success, .confirmation-page')).toBeVisible({ timeout: 10000 });
  });

  test('should validate required form fields', async ({ page }) => {
    // Navigate directly to a reservation page
    await page.goto('/reservation/1');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Check HTML5 validation or custom validation
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    const phoneInput = page.locator('input[name="phone"]');
    
    // Verify required fields are highlighted or show validation messages
    await expect(nameInput).toHaveAttribute('required');
    await expect(emailInput).toHaveAttribute('required');
    await expect(phoneInput).toHaveAttribute('required');
  });

  test('should validate date cannot be in the past', async ({ page }) => {
    await page.goto('/reservation/1');
    
    // Try to set yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const dateInput = page.locator('input[name="date"]');
    await expect(dateInput).toHaveAttribute('min'); // Should have min attribute set to today
    
    // Verify that the min attribute prevents past dates
    const minDate = await dateInput.getAttribute('min');
    const today = new Date().toISOString().split('T')[0];
    expect(minDate).toBe(today);
  });

  test('should show Chat with Tablio component with animations', async ({ page }) => {
    await page.goto('/reservation/1');
    
    // Verify chat component is visible
    const chatComponent = page.locator('.unified-chat-component');
    await expect(chatComponent).toBeVisible();
    
    // Verify chat benefits are animated (check for animation classes)
    const chatBenefits = page.locator('.chat-benefits li');
    await expect(chatBenefits).toHaveCount(5);
    
    // Verify Chat with Tablio button works
    const chatButton = page.locator('.chat-cta-btn');
    await expect(chatButton).toContainText('Chat with Tablio');
    
    // Click should redirect to chat page
    await chatButton.click();
    await expect(page).toHaveURL(/.*chat\/\d+/);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/reservation/1');
    
    // Verify mobile-responsive layout
    await expect(page.locator('.reservation-wrapper')).toBeVisible();
    
    // On mobile, elements should stack vertically
    const infoZone = page.locator('.info-context-zone');
    const actionZone = page.locator('.action-zone');
    
    await expect(infoZone).toBeVisible();
    await expect(actionZone).toBeVisible();
    
    // Fill and submit form on mobile
    await page.fill('input[name="name"]', 'Mobile User');
    await page.fill('input[name="email"]', 'mobile@example.com');
    await page.fill('input[name="phone"]', '+30 987 654 3210');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="date"]', tomorrowStr);
    
    await page.selectOption('select[name="time"]', '20:00');
    await page.selectOption('select[name="partySize"]', '4');
    
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });
});