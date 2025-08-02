const { test, expect } = require('@playwright/test');

/**
 * OVERALL USER EXPERIENCE E2E TESTS
 * Tests complete user journeys and cross-feature integration
 */

test.describe('Complete User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete end-to-end customer journey', async ({ page }) => {
    // Step 1: Start from homepage
    await expect(page.locator('h1, .hero-title')).toBeVisible();
    await expect(page.locator('text=TableTurn')).toBeVisible();
    
    // Step 2: Browse restaurants
    await page.click('text=Browse Restaurants');
    await expect(page).toHaveURL(/.*browse-restaurants/);
    
    // Step 3: Select a restaurant
    const restaurantCards = page.locator('.restaurant-card, [class*="restaurant-item"]');
    await expect(restaurantCards.first()).toBeVisible({ timeout: 10000 });
    
    const firstCard = restaurantCards.first();
    const restaurantName = await firstCard.locator('h2, h3, .restaurant-name').first().textContent();
    
    const reservationButton = firstCard.locator('text="Make Reservation"').or(firstCard.locator('text="Book Now"')).or(firstCard.locator('.reserve-btn')).first();
    await reservationButton.click();
    
    // Step 4: Verify reservation page layout
    await expect(page).toHaveURL(/.*reservation\/\d+/);
    await expect(page.locator('h1')).toContainText(restaurantName?.trim() || '');
    
    // Verify new professional layout
    await expect(page.locator('.info-context-zone')).toBeVisible();
    await expect(page.locator('.action-zone')).toBeVisible();
    await expect(page.locator('.unified-chat-component')).toBeVisible();
    await expect(page.locator('.restaurant-location-form')).toBeVisible();
    
    // Step 5: Test chat functionality
    const chatButton = page.locator('.chat-cta-btn');
    await expect(chatButton).toContainText('Chat with Tablio');
    await chatButton.click();
    
    await expect(page).toHaveURL(/.*chat\/\d+/);
    
    // Send a quick message
    const chatInput = page.locator('.chat-input, input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"], .send-btn, button:has-text("Send")').first();
    
    if (await chatInput.isVisible()) {
      await chatInput.fill("Is there availability for tonight?");
      await sendButton.click();
      
      // Wait for AI response
      const aiResponse = page.locator('.message.ai, .chat-message.ai, [class*="ai-message"]').last();
      await expect(aiResponse).toBeVisible({ timeout: 10000 });
    }
    
    // Step 6: Go back to reservation form
    await page.goBack();
    await expect(page).toHaveURL(/.*reservation\/\d+/);
    
    // Step 7: Complete reservation form
    await page.fill('input[name="name"]', 'E2E Test User');
    await page.fill('input[name="email"]', 'e2e@example.com');
    await page.fill('input[name="phone"]', '+30 123 456 7890');
    
    // Set tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="date"]', tomorrowStr);
    
    // Select time and party size
    await page.selectOption('select[name="time"]', '19:30');
    await page.selectOption('select[name="partySize"]', '2');
    
    // Add special requests
    await page.fill('textarea[name="specialRequests"]', 'E2E test reservation - please ignore');
    
    // Step 8: Submit reservation
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toContainText('Book Now');
    await expect(submitButton).toBeEnabled();
    
    // Click submit
    await submitButton.click();
    
    // Step 9: Verify success or confirmation page
    await expect(page.locator('.reservation-success, .confirmation-page, h1:has-text("Confirmation")')).toBeVisible({ timeout: 10000 });
  });

  test('should handle responsive design across different screen sizes', async ({ page }) => {
    const screenSizes = [
      { width: 320, height: 568, name: 'Mobile Small' },
      { width: 375, height: 667, name: 'Mobile Medium' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1024, height: 768, name: 'Tablet Landscape' },
      { width: 1440, height: 900, name: 'Desktop' },
      { width: 1920, height: 1080, name: 'Large Desktop' }
    ];
    
    for (const size of screenSizes) {
      console.log(`Testing ${size.name} (${size.width}x${size.height})`);
      
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/reservation/1');
      
      // Verify key elements are visible and accessible
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.form-card, .reservation-form')).toBeVisible();
      
      // Form fields should be accessible
      await expect(page.locator('input[name="name"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Chat component should be visible
      await expect(page.locator('.unified-chat-component, .chat-cta-btn')).toBeVisible();
      
      // On mobile, elements should stack properly
      if (size.width <= 768) {
        // Mobile layout checks
        const formCard = page.locator('.form-card, .action-zone');
        const chatComponent = page.locator('.unified-chat-component');
        
        await expect(formCard).toBeVisible();
        await expect(chatComponent).toBeVisible();
      }
    }
  });

  test('should maintain performance standards', async ({ page }) => {
    // Start performance measurement
    await page.goto('/');
    
    // Measure homepage load time
    const homeLoadStart = Date.now();
    await page.waitForLoadState('networkidle');
    const homeLoadTime = Date.now() - homeLoadStart;
    
    // Navigate to browse restaurants
    const browseStart = Date.now();
    await page.click('text=Browse Restaurants');
    await page.waitForLoadState('networkidle');
    const browseLoadTime = Date.now() - browseStart;
    
    // Navigate to reservation page
    const reservationStart = Date.now();
    await page.goto('/reservation/1');
    await page.waitForLoadState('networkidle');
    const reservationLoadTime = Date.now() - reservationStart;
    
    // Performance assertions (adjust thresholds based on your requirements)
    expect(homeLoadTime).toBeLessThan(5000); // 5 seconds
    expect(browseLoadTime).toBeLessThan(3000); // 3 seconds
    expect(reservationLoadTime).toBeLessThan(3000); // 3 seconds
    
    console.log(`Performance metrics:
      Homepage: ${homeLoadTime}ms
      Browse: ${browseLoadTime}ms
      Reservation: ${reservationLoadTime}ms`);
  });

  test('should handle navigation and browser back/forward', async ({ page }) => {
    // Start from homepage
    await page.goto('/');
    
    // Navigate to browse
    await page.click('text=Browse Restaurants');
    await expect(page).toHaveURL(/.*browse-restaurants/);
    
    // Navigate to about
    await page.click('text=About');
    await expect(page).toHaveURL(/.*about/);
    
    // Use browser back
    await page.goBack();
    await expect(page).toHaveURL(/.*browse-restaurants/);
    
    // Use browser forward
    await page.goForward();
    await expect(page).toHaveURL(/.*about/);
    
    // Navigate to reservation
    await page.goto('/reservation/1');
    await expect(page).toHaveURL(/.*reservation\/1/);
    
    // Browser back should work
    await page.goBack();
    await expect(page).toHaveURL(/.*about/);
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto('/nonexistent-page');
    
    // Should show error page or redirect
    const currentUrl = page.url();
    const hasErrorIndicator = await page.locator('text="404"').or(page.locator('text="Not Found"')).or(page.locator('text="Error"')).isVisible();
    
    // Either should show 404 content or redirect to valid page
    if (currentUrl.includes('nonexistent-page')) {
      expect(hasErrorIndicator).toBeTruthy();
    } else {
      // Redirected to valid page
      expect(currentUrl).toMatch(/\/(home|$|browse-restaurants)/);
    }
    
    // Test invalid restaurant ID
    await page.goto('/reservation/99999');
    
    // Should handle gracefully - either show error or redirect
    const reservationError = await page.locator('text="Restaurant not found"').or(page.locator('text="Error"')).or(page.locator('text="404"')).isVisible();
    
    if (reservationError) {
      // Shows proper error message
      expect(reservationError).toBeTruthy();
    } else {
      // Redirects to valid page
      expect(page.url()).toMatch(/\/(browse-restaurants|$)/);
    }
  });

  test('should maintain accessibility standards', async ({ page }) => {
    await page.goto('/reservation/1');
    
    // Check for proper heading hierarchy
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1); // Should have exactly one h1
    
    // Check form labels
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    const phoneInput = page.locator('input[name="phone"]');
    
    // Inputs should have associated labels
    await expect(nameInput).toHaveAttribute('id');
    await expect(emailInput).toHaveAttribute('id');
    await expect(phoneInput).toHaveAttribute('id');
    
    // Check for alt text on images (if any)
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const altText = await img.getAttribute('alt');
      const isDecorative = altText === '';
      const hasAlt = altText !== null;
      
      // Images should either have alt text or be marked as decorative
      expect(hasAlt).toBeTruthy();
    }
    
    // Check button accessibility
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    
    // Button should have text content or aria-label
    const buttonText = await submitButton.textContent();
    const ariaLabel = await submitButton.getAttribute('aria-label');
    
    expect(buttonText?.trim().length || ariaLabel?.length).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/reservation/1');
    
    // Tab through form elements
    await page.keyboard.press('Tab'); // First focusable element
    
    // Check if focus is on a form element
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']).toContain(focusedElement);
    
    // Continue tabbing through form
    const formElements = page.locator('input, select, textarea, button[type="submit"]');
    const elementCount = await formElements.count();
    
    // Should be able to tab through all form elements
    for (let i = 0; i < elementCount; i++) {
      await page.keyboard.press('Tab');
    }
    
    // Test Enter key on submit button
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.focus();
    
    // Fill required fields first
    await page.fill('input[name="name"]', 'Keyboard User');
    await page.fill('input[name="email"]', 'keyboard@example.com');
    await page.fill('input[name="phone"]', '+30 123 456 7890');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('input[name="date"]', tomorrow.toISOString().split('T')[0]);
    
    await page.selectOption('select[name="time"]', '19:00');
    await page.selectOption('select[name="partySize"]', '2');
    
    // Now test Enter key submission
    await submitButton.focus();
    await page.keyboard.press('Enter');
    
    // Should submit the form
    await expect(page.locator('.reservation-success, .confirmation-page')).toBeVisible({ timeout: 10000 });
  });
});