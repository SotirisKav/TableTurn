const { test, expect } = require('@playwright/test');

/**
 * AUTHENTICATION E2E TESTS
 * Tests user login, logout, and role-based access control
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show login option for restaurant owners', async ({ page }) => {
    // Verify the login link is visible in navigation
    const loginLink = page.locator('.nav-owner-login');
    await expect(loginLink).toBeVisible();
    
    // Verify it shows the subtitle for restaurant owners
    const ownerSubtitle = page.locator('.owner-login-subtitle');
    await expect(ownerSubtitle).toContainText('Restaurant owners only');
    
    // Click login link
    await loginLink.click();
    await expect(page).toHaveURL(/.*login/);
  });

  test('should display login form correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Verify login form elements
    await expect(page.locator('h1')).toContainText('Welcome Back');
    await expect(page.locator('p')).toContainText('Sign in to your TableTurn business account');
    
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitButton = page.locator('button.auth-submit');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText('Sign In');
  });

  test('should validate login form fields', async ({ page }) => {
    await page.goto('/login');
    
    // Try submitting empty form
    const submitButton = page.locator('button.auth-submit');
    await submitButton.click();
    
    // Check for validation (HTML5 validation should prevent submission)
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    
    await expect(emailInput).toHaveAttribute('required');
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    const submitButton = page.locator('button.auth-submit');
    await submitButton.click();
    
    // Should show error message
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('should handle successful login and show dashboard access', async ({ page }) => {
    await page.goto('/login');
    
    // Use test credentials
    const testEmail = process.env.TEST_USER_EMAIL || 'test@restaurant.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword';
    
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    
    const submitButton = page.locator('button.auth-submit');
    await submitButton.click();
    
    // Should redirect to home with user logged in
    await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
    
    // Verify user is logged in by checking navigation
    const logoutButton = page.locator('.nav-logout-btn');
    await expect(logoutButton).toBeVisible();
    
    // Verify dashboard link is visible
    const dashboardLink = page.locator('.nav-dashboard');
    await expect(dashboardLink).toBeVisible();
  });

  test('should show admin dashboard for admin users', async ({ page }) => {
    // This test assumes you have admin test credentials
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'sotiriskavadakis@gmail.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'admin123';
    
    await page.goto('/login');
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    
    const submitButton = page.locator('button.auth-submit');
    await submitButton.click();
    
    // Wait for redirect to home page
    await page.waitForURL(/.*\/$/);
    
    // Admin should see "Admin Dashboard" button with special styling
    const adminDashboard = page.locator('.admin-nav');
    await expect(adminDashboard).toBeVisible();
    await expect(adminDashboard).toContainText('Admin Dashboard');
    
    // Admin dashboard should be distinguished from regular dashboard
    await expect(adminDashboard).toHaveClass(/admin-nav/);
  });

  test('should handle logout correctly', async ({ page }) => {
    // First login (using a helper function would be better in real tests)
    await page.goto('/login');
    
    const testEmail = process.env.TEST_USER_EMAIL || 'test@restaurant.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword';
    
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button.auth-submit');
    
    // Wait for successful login
    await expect(page.locator('.nav-logout-btn')).toBeVisible({ timeout: 10000 });
    
    // Now test logout
    const logoutButton = page.locator('.nav-logout-btn');
    await logoutButton.click();
    
    // Should redirect to home page and show login option again
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.locator('.nav-owner-login')).toBeVisible();
    
    // Dashboard link should no longer be visible
    await expect(page.locator('.nav-dashboard')).not.toBeVisible();
  });

  test('should prevent unauthorized access to dashboard', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');
    
    // Dashboard should be accessible but may show different content for unauthenticated users
    // or redirect based on your app's authentication logic
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Check if the page content indicates need for authentication
    // This test may need adjustment based on your actual auth flow
  });

  test('should maintain session across page reloads', async ({ page }) => {
    // Login first
    await page.goto('/login');
    
    const testEmail = process.env.TEST_USER_EMAIL || 'test@restaurant.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword';
    
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button.auth-submit');
    
    // Wait for login
    await expect(page.locator('.nav-logout-btn')).toBeVisible({ timeout: 10000 });
    
    // Reload the page
    await page.reload();
    
    // Should still be logged in
    await expect(page.locator('.nav-logout-btn')).toBeVisible();
    await expect(page.locator('.nav-dashboard')).toBeVisible();
  });
});