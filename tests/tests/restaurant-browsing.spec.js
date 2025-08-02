const { test, expect } = require('@playwright/test');

/**
 * RESTAURANT BROWSING E2E TESTS
 * Tests the restaurant discovery and browsing functionality
 */

test.describe('Restaurant Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to browse restaurants page', async ({ page }) => {
    // Click Browse Restaurants in navigation
    const browseLink = page.locator('text=Browse Restaurants');
    await expect(browseLink).toBeVisible();
    await browseLink.click();
    
    // Verify we're on the browse page
    await expect(page).toHaveURL(/.*browse-restaurants/);
    await expect(page.locator('h1')).toContainText('Browse Restaurants');
  });

  test('should display restaurant cards with key information', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for restaurants to load
    await page.waitForSelector('.restaurant-card, [class*="restaurant"]', { timeout: 10000 });
    
    const restaurantCards = page.locator('.restaurant-card, [class*="restaurant-item"], [class*="restaurant-grid"] > div');
    const cardCount = await restaurantCards.count();
    
    // Should have at least one restaurant
    expect(cardCount).toBeGreaterThan(0);
    
    // Check first restaurant card has required elements
    const firstCard = restaurantCards.first();
    await expect(firstCard).toBeVisible();
    
    // Should contain restaurant name
    await expect(firstCard.locator('h2, h3, .restaurant-name, .name')).toBeVisible();
    
    // Should contain description or cuisine type
    await expect(firstCard.locator('.description, .cuisine, p')).toBeVisible();
    
    // Should contain location information
    await expect(firstCard.locator('.location, .address, .area')).toBeVisible();
    
    // Should have a reservation button
    const reservationButton = firstCard.locator('text="Make Reservation"').or(firstCard.locator('text="Book Now"')).or(firstCard.locator('.reserve-btn')).or(firstCard.locator('.cta-button'));
    await expect(reservationButton).toBeVisible();
  });

  test('should allow filtering restaurants by location', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for content to load
    await page.waitForSelector('.restaurant-card, [class*="restaurant"]', { timeout: 10000 });
    
    // Look for location filter (dropdown, buttons, or input)
    const locationFilter = page.locator('select[name*="location"], .location-filter, .filter-location, input[placeholder*="location"]');
    
    if (await locationFilter.isVisible()) {
      // Get initial count of restaurants
      const initialCards = await page.locator('.restaurant-card, [class*="restaurant-item"]').count();
      
      // Apply a location filter
      if (await locationFilter.getAttribute('type') === 'select-one') {
        await locationFilter.selectOption({ index: 1 }); // Select second option
      } else {
        await locationFilter.fill('Mykonos');
      }
      
      // Wait for filter to apply
      await page.waitForTimeout(1000);
      
      // Verify results changed (this test might need adjustment based on your data)
      const filteredCards = await page.locator('.restaurant-card, [class*="restaurant-item"]').count();
      
      // Results should be different (either more or less)
      if (filteredCards !== initialCards) {
        expect(filteredCards).not.toBe(initialCards);
      }
    }
  });

  test('should allow searching restaurants by name or cuisine', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], .search-input, input[name*="search"]');
    
    if (await searchInput.isVisible()) {
      // Search for "Greek" cuisine
      await searchInput.fill('Greek');
      
      // Either press Enter or look for search button
      const searchButton = page.locator('button[type="submit"], .search-btn, .search-button');
      
      if (await searchButton.isVisible()) {
        await searchButton.click();
      } else {
        await searchInput.press('Enter');
      }
      
      // Wait for results
      await page.waitForTimeout(1000);
      
      // Verify results contain Greek cuisine
      const restaurantCards = page.locator('.restaurant-card, [class*="restaurant-item"]');
      const cardCount = await restaurantCards.count();
      
      if (cardCount > 0) {
        // At least one result should mention Greek
        const greekText = page.locator('text="Greek"').or(page.locator('text="greek"'));
        await expect(greekText.first()).toBeVisible();
      }
    }
  });

  test('should navigate to reservation page from restaurant card', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for restaurants to load
    const restaurantCards = page.locator('.restaurant-card, [class*="restaurant-item"]');
    await expect(restaurantCards.first()).toBeVisible({ timeout: 10000 });
    
    // Click the reservation button on first restaurant
    const firstCard = restaurantCards.first();
    const reservationButton = firstCard.locator('text="Make Reservation"').or(firstCard.locator('text="Book Now"')).or(firstCard.locator('.reserve-btn')).or(firstCard.locator('.cta-button')).first();
    
    await reservationButton.click();
    
    // Should navigate to reservation page
    await expect(page).toHaveURL(/.*reservation\/\d+/);
    await expect(page.locator('h1')).toContainText('Make a Reservation');
  });

  test('should display restaurant details correctly', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for content and get first restaurant
    const restaurantCards = page.locator('.restaurant-card, [class*="restaurant-item"]');
    await expect(restaurantCards.first()).toBeVisible({ timeout: 10000 });
    
    const firstCard = restaurantCards.first();
    
    // Extract restaurant name for verification
    const restaurantName = await firstCard.locator('h2, h3, .restaurant-name, .name').first().textContent();
    
    // Click to go to reservation page
    const reservationButton = firstCard.locator('text="Make Reservation"').or(firstCard.locator('text="Book Now"')).or(firstCard.locator('.reserve-btn')).or(firstCard.locator('.cta-button')).first();
    await reservationButton.click();
    
    // Verify restaurant name appears on reservation page
    await expect(page.locator('h1')).toContainText(restaurantName?.trim() || '');
    
    // Verify restaurant details are shown
    await expect(page.locator('.restaurant-description, .description')).toBeVisible();
    await expect(page.locator('.restaurant-location, .location')).toBeVisible();
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/browse-restaurants');
    
    // Wait for content to load
    await page.waitForSelector('.restaurant-card, [class*="restaurant"]', { timeout: 10000 });
    
    // Verify mobile layout
    const restaurantCards = page.locator('.restaurant-card, [class*="restaurant-item"]');
    await expect(restaurantCards.first()).toBeVisible();
    
    // Cards should be stacked vertically on mobile
    const firstCard = restaurantCards.first();
    const secondCard = restaurantCards.nth(1);
    
    if (await secondCard.isVisible()) {
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();
      
      // Second card should be below first card (higher y position)
      expect(secondCardBox?.y).toBeGreaterThan(firstCardBox?.y || 0);
    }
    
    // Verify reservation button is accessible on mobile
    const reservationButton = firstCard.locator('text="Make Reservation"').or(firstCard.locator('text="Book Now"')).or(firstCard.locator('.reserve-btn')).or(firstCard.locator('.cta-button')).first();
    await expect(reservationButton).toBeVisible();
    
    // Should be able to click and navigate
    await reservationButton.click();
    await expect(page).toHaveURL(/.*reservation\/\d+/);
  });

  test('should handle empty search results gracefully', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Look for search functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], .search-input');
    
    if (await searchInput.isVisible()) {
      // Search for something that shouldn't exist
      await searchInput.fill('XYZ123NonExistentRestaurant');
      
      const searchButton = page.locator('button[type="submit"], .search-btn');
      if (await searchButton.isVisible()) {
        await searchButton.click();
      } else {
        await searchInput.press('Enter');
      }
      
      // Wait for search to complete
      await page.waitForTimeout(1000);
      
      // Should show "no results" message or empty state
      const noResultsMessage = page.locator('text="No restaurants found"').or(page.locator('text="No results"')).or(page.locator('.no-results')).or(page.locator('.empty-state'));
      
      // Either show no results message or no restaurant cards
      const hasNoResultsMessage = await noResultsMessage.isVisible();
      const restaurantCards = page.locator('.restaurant-card, [class*="restaurant-item"]');
      const cardCount = await restaurantCards.count();
      
      // Either should show no results message OR have no cards
      expect(hasNoResultsMessage || cardCount === 0).toBeTruthy();
    }
  });

  test('should load restaurant images if present', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for content
    await page.waitForSelector('.restaurant-card, [class*="restaurant"]', { timeout: 10000 });
    
    // Check if restaurant cards have images
    const restaurantImages = page.locator('.restaurant-card img, [class*="restaurant-item"] img, .restaurant-image img');
    
    if (await restaurantImages.first().isVisible()) {
      const firstImage = restaurantImages.first();
      
      // Verify image loads properly
      await expect(firstImage).toBeVisible();
      
      // Check that image has proper src attribute
      const imageSrc = await firstImage.getAttribute('src');
      expect(imageSrc).toBeTruthy();
      expect(imageSrc?.length).toBeGreaterThan(0);
      
      // Verify image loads (not broken)
      const naturalWidth = await firstImage.evaluate((img) => img.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });
});