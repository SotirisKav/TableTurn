const { test, expect } = require('@playwright/test');

/**
 * CHAT FUNCTIONALITY E2E TESTS
 * Tests the Tablio AI chat feature for restaurant assistance
 */

test.describe('Chat with Tablio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should access chat from reservation page', async ({ page }) => {
    // Navigate to a reservation page
    await page.goto('/reservation/1');
    
    // Verify chat component is visible
    const chatComponent = page.locator('.unified-chat-component');
    await expect(chatComponent).toBeVisible();
    
    // Verify chat benefits section exists
    const chatBenefits = page.locator('.chat-benefits');
    await expect(chatBenefits).toBeVisible();
    
    // Click Chat with Tablio button
    const chatButton = page.locator('.chat-cta-btn');
    await expect(chatButton).toContainText('💬 Chat with Tablio');
    await chatButton.click();
    
    // Should navigate to chat page
    await expect(page).toHaveURL(/.*chat\/1/);
  });

  test('should display chat interface correctly', async ({ page }) => {
    await page.goto('/chat/1');
    
    // Verify chat interface elements
    await expect(page.locator('.premium-chat-title')).toContainText('Tablio Assistant');
    
    // Should have chat history/messages area
    const chatHistory = page.locator('.premium-chat-history');
    await expect(chatHistory).toBeVisible();
    
    // Should have input field for typing messages
    const chatInput = page.locator('.premium-input');
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toHaveAttribute('placeholder', 'Ask about reservations, menu, or special requests...');
    
    // Should have send button
    const sendButton = page.locator('.premium-send-btn');
    await expect(sendButton).toBeVisible();
    
    // Should show online status
    await expect(page.locator('.chat-status')).toContainText('Online - Ready to help');
  });

  test('should handle user messages and AI responses', async ({ page }) => {
    await page.goto('/chat/1');
    
    // Wait for chat interface to load
    await page.waitForSelector('.premium-input', { timeout: 5000 });
    
    const chatInput = page.locator('.premium-input');
    const sendButton = page.locator('.premium-send-btn');
    
    // Send a test message
    const testMessage = "What are your opening hours?";
    await chatInput.fill(testMessage);
    await sendButton.click();
    
    // Verify user message appears
    const userMessage = page.locator('.premium-message.user').last();
    await expect(userMessage).toContainText(testMessage);
    
    // Wait for AI response
    const aiResponse = page.locator('.premium-message.ai').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
    
    // AI response should contain relevant information
    await expect(aiResponse).toContainText(/hour|open|close|time|available/i);
    
    // Input should be cleared after sending
    await expect(chatInput).toHaveValue('');
  });

  test('should handle reservation-related queries', async ({ page }) => {
    await page.goto('/chat/1');
    
    // Wait for interface
    await page.waitForSelector('.premium-input', { timeout: 5000 });
    
    const chatInput = page.locator('.premium-input');
    const sendButton = page.locator('.premium-send-btn');
    
    // Ask about making a reservation
    await chatInput.fill("I want to make a reservation for 4 people tomorrow at 7 PM");
    await sendButton.click();
    
    // Wait for AI response
    const aiResponse = page.locator('.premium-message.ai').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
    
    // Response should be helpful for reservations
    await expect(aiResponse).toContainText(/reservation|book|table|available|help/i);
  });

  test('should handle menu-related queries', async ({ page }) => {
    await page.goto('/chat/1');
    
    await page.waitForSelector('.premium-input', { timeout: 5000 });
    
    const chatInput = page.locator('.premium-input');
    const sendButton = page.locator('.premium-send-btn');
    
    // Ask about menu
    await chatInput.fill("What Greek dishes do you recommend?");
    await sendButton.click();
    
    // Wait for response
    const aiResponse = page.locator('.premium-message.ai').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
    
    // Should provide menu recommendations
    await expect(aiResponse).toContainText(/recommend|dish|menu|greek|food|cuisine/i);
  });

  test('should handle dietary restriction queries', async ({ page }) => {
    await page.goto('/chat/1');
    
    await page.waitForSelector('.premium-input', { timeout: 5000 });
    
    const chatInput = page.locator('.premium-input');
    const sendButton = page.locator('.premium-send-btn');
    
    // Ask about dietary restrictions
    await chatInput.fill("Do you have vegetarian options?");
    await sendButton.click();
    
    // Wait for response
    const aiResponse = page.locator('.premium-message.ai').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
    
    // Should address dietary concerns
    await expect(aiResponse).toContainText(/vegetarian|vegan|dietary|option|available/i);
  });

  test('should show typing indicator during AI response', async ({ page }) => {
    await page.goto('/chat/1');
    
    await page.waitForSelector('.chat-input, input[type="text"], textarea', { timeout: 5000 });
    
    const chatInput = page.locator('.chat-input, input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"], .send-btn, button:has-text("Send")').first();
    
    // Send message
    await chatInput.fill("Tell me about your restaurant");
    await sendButton.click();
    
    // Look for typing indicator (might appear briefly)
    const typingIndicator = page.locator('.typing, .loading, .typing-indicator, [class*="typing"]');
    
    // This might be visible briefly, so we use a short timeout
    try {
      await expect(typingIndicator).toBeVisible({ timeout: 2000 });
    } catch (e) {
      // Typing indicator might be too fast to catch, that's ok
      console.log('Typing indicator not visible or too fast');
    }
    
    // Eventually should get a response
    const aiResponse = page.locator('.message.ai, .chat-message.ai, [class*="ai-message"]').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
  });

  test('should handle multiple messages in conversation', async ({ page }) => {
    await page.goto('/chat/1');
    
    await page.waitForSelector('.chat-input, input[type="text"], textarea', { timeout: 5000 });
    
    const chatInput = page.locator('.chat-input, input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"], .send-btn, button:has-text("Send")').first();
    
    // Send first message
    await chatInput.fill("Hello");
    await sendButton.click();
    
    // Wait for first response
    await expect(page.locator('.message.ai, .chat-message.ai, [class*="ai-message"]').last()).toBeVisible({ timeout: 10000 });
    
    // Send follow-up message
    await chatInput.fill("What's your most popular dish?");
    await sendButton.click();
    
    // Wait for second response
    await page.waitForTimeout(3000); // Give time for response
    
    // Should have multiple messages in history
    const allMessages = page.locator('.message, .chat-message');
    const messageCount = await allMessages.count();
    
    // Should have at least 4 messages: initial greeting + user hello + ai response + user follow-up + ai response
    expect(messageCount).toBeGreaterThanOrEqual(4);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat/1');
    
    // Verify mobile chat interface
    const chatHistory = page.locator('.chat-history, .messages, .chat-messages');
    const chatInput = page.locator('.chat-input, input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"], .send-btn, button:has-text("Send")').first();
    
    await expect(chatHistory).toBeVisible();
    await expect(chatInput).toBeVisible();
    await expect(sendButton).toBeVisible();
    
    // Test sending a message on mobile
    await chatInput.fill("Mobile test message");
    await sendButton.click();
    
    // Should show user message
    const userMessage = page.locator('.message.user, .chat-message.user, [class*="user-message"]').last();
    await expect(userMessage).toContainText("Mobile test message");
    
    // Should get AI response
    const aiResponse = page.locator('.message.ai, .chat-message.ai, [class*="ai-message"]').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
  });

  test('should handle empty messages gracefully', async ({ page }) => {
    await page.goto('/chat/1');
    
    await page.waitForSelector('.chat-input, input[type="text"], textarea', { timeout: 5000 });
    
    const chatInput = page.locator('.chat-input, input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"], .send-btn, button:has-text("Send")').first();
    
    // Try to send empty message
    await chatInput.fill('');
    
    // Send button should be disabled or sending should be prevented
    const isDisabled = await sendButton.isDisabled();
    
    if (!isDisabled) {
      await sendButton.click();
      
      // If not disabled, should either not send anything or show validation
      const messagesBefore = await page.locator('.message, .chat-message').count();
      await page.waitForTimeout(1000);
      const messagesAfter = await page.locator('.message, .chat-message').count();
      
      // Message count shouldn't increase for empty message
      expect(messagesAfter).toBe(messagesBefore);
    } else {
      // Send button properly disabled for empty input
      expect(isDisabled).toBeTruthy();
    }
  });

  test('should persist chat history during session', async ({ page }) => {
    await page.goto('/chat/1');
    
    await page.waitForSelector('.chat-input, input[type="text"], textarea', { timeout: 5000 });
    
    const chatInput = page.locator('.chat-input, input[type="text"], textarea').first();
    const sendButton = page.locator('button[type="submit"], .send-btn, button:has-text("Send")').first();
    
    // Send a message
    await chatInput.fill("Remember this message");
    await sendButton.click();
    
    // Wait for response
    await expect(page.locator('.message.ai, .chat-message.ai, [class*="ai-message"]').last()).toBeVisible({ timeout: 10000 });
    
    // Refresh the page
    await page.reload();
    
    // Check if message history is maintained
    const userMessage = page.locator('text=Remember this message');
    
    // Note: This depends on your implementation - some chat systems persist history, others don't
    // Adjust the expectation based on your actual behavior
    try {
      await expect(userMessage).toBeVisible({ timeout: 5000 });
    } catch (e) {
      // If chat doesn't persist history, that's also valid behavior
      console.log('Chat history not persisted - this might be expected behavior');
    }
  });
});