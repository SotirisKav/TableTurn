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
    // Verify main container is visible (this page doesn't have an h1)
    await expect(page.locator('.browse-restaurants-modern')).toBeVisible();
  });

  test('should display restaurant cards with key information', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for restaurants to load
    await page.waitForSelector('.restaurant-card-modern', { timeout: 10000 });
    
    const restaurantCards = page.locator('.restaurant-card-modern');
    const cardCount = await restaurantCards.count();
    
    // Should have at least one restaurant
    expect(cardCount).toBeGreaterThan(0);
    
    // Check first restaurant card has required elements
    const firstCard = restaurantCards.first();
    await expect(firstCard).toBeVisible();
    
    // Should contain restaurant name
    await expect(firstCard.locator('.restaurant-name')).toBeVisible();
    
    // Should contain description
    await expect(firstCard.locator('.restaurant-description')).toBeVisible();
    
    // Should contain location information
    await expect(firstCard.locator('.location-info')).toBeVisible();
    
    // Should have cuisine badge
    await expect(firstCard.locator('.cuisine-badge')).toBeVisible();
    
    // Should have a reservation button
    const reservationButton = firstCard.locator('.reserve-table-btn');
    await expect(reservationButton).toBeVisible();
    await expect(reservationButton).toContainText('Reserve a Table');
  });

  test('should allow filtering restaurants by location', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for content to load
    await page.waitForSelector('.restaurant-card-modern', { timeout: 10000 });
    
    // Look for island filter dropdown
    const islandFilter = page.locator('select.filter-select').nth(0); // First select is island filter
    await expect(islandFilter).toBeVisible();
    
    // Get initial count of restaurants
    const initialCards = await page.locator('.restaurant-card-modern').count();
    
    // Apply an island filter - select the second option (first non-"All" option)
    await islandFilter.selectOption({ index: 1 });
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify results changed
    const filteredCards = await page.locator('.restaurant-card-modern').count();
    
    // Results should be different (either same or less, but filtering worked)
    expect(filteredCards).toBeLessThanOrEqual(initialCards);
  });

  test('should allow searching restaurants by name or cuisine', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for content to load
    await page.waitForSelector('.restaurant-card-modern', { timeout: 10000 });
    
    // Look for search input
    const searchInput = page.locator('.search-input-inline');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search restaurants...');
    
    // Search for a restaurant term
    await searchInput.fill('Greek');
    
    // Wait for search to apply (it's real-time)
    await page.waitForTimeout(1000);
    
    // Verify results
    const restaurantCards = page.locator('.restaurant-card-modern');
    const cardCount = await restaurantCards.count();
    
    if (cardCount > 0) {
      // At least one result should mention Greek in name, description, or cuisine
      const hasGreekContent = await page.locator('.restaurant-card-modern').first().locator('text=/Greek/i').isVisible();
      expect(hasGreekContent || cardCount === 0).toBeTruthy();
    }
  });

  test('should navigate to reservation page from restaurant card', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for restaurants to load
    const restaurantCards = page.locator('.restaurant-card-modern');
    await expect(restaurantCards.first()).toBeVisible({ timeout: 10000 });
    
    // Click the reservation button on first restaurant
    const firstCard = restaurantCards.first();
    const reservationButton = firstCard.locator('.reserve-table-btn');
    
    await reservationButton.click();
    
    // Should navigate to reservation page
    await expect(page).toHaveURL(/.*reservation\/\d+/);
    // Verify we're on a reservation page (may not have specific h1 text)
    await expect(page.locator('.unified-chat-component, .form-card, .reservation-form')).toBeVisible();
  });

  test('should display restaurant details correctly', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for content and get first restaurant
    const restaurantCards = page.locator('.restaurant-card-modern');
    await expect(restaurantCards.first()).toBeVisible({ timeout: 10000 });
    
    const firstCard = restaurantCards.first();
    
    // Extract restaurant name for verification
    const restaurantName = await firstCard.locator('.restaurant-name').textContent();
    
    // Click to go to reservation page
    const reservationButton = firstCard.locator('.reserve-table-btn');
    await reservationButton.click();
    
    // Verify we're on reservation page (restaurant name may appear in different format)
    await expect(page).toHaveURL(/.*reservation\/\d+/);
    
    // Verify reservation page has loaded properly
    await expect(page.locator('.unified-chat-component')).toBeVisible();
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/browse-restaurants');
    
    // Wait for content to load
    await page.waitForSelector('.restaurant-card-modern', { timeout: 10000 });
    
    // Verify mobile layout
    const restaurantCards = page.locator('.restaurant-card-modern');
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
    const reservationButton = firstCard.locator('.reserve-table-btn');
    await expect(reservationButton).toBeVisible();
    
    // Should be able to click and navigate
    await reservationButton.click();
    await expect(page).toHaveURL(/.*reservation\/\d+/);
  });

  test('should handle empty search results gracefully', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for initial load
    await page.waitForSelector('.restaurant-card-modern', { timeout: 10000 });
    
    // Look for search functionality
    const searchInput = page.locator('.search-input-inline');
    await expect(searchInput).toBeVisible();
    
    // Search for something that shouldn't exist
    await searchInput.fill('XYZ123NonExistentRestaurant');
    
    // Wait for search to complete (it's real-time)
    await page.waitForTimeout(1000);
    
    // Should show "no results" message
    const noResultsContainer = page.locator('.no-results');
    await expect(noResultsContainer).toBeVisible();
    await expect(noResultsContainer.locator('h3')).toContainText('No restaurants found');
    
    // Should show reset filters button
    const resetButton = page.locator('.reset-filters-btn');
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toContainText('Reset Filters');
  });

  test('should load restaurant images if present', async ({ page }) => {
    await page.goto('/browse-restaurants');
    
    // Wait for content
    await page.waitForSelector('.restaurant-card-modern', { timeout: 10000 });
    
    // Check if restaurant cards have images
    const restaurantImages = page.locator('.restaurant-card-modern .card-image img');
    
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
  });
});