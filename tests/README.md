# TableTurn End-to-End Tests

Comprehensive end-to-end test suite for the TableTurn restaurant reservation system using **Playwright**.

## 🎯 What We Test

### 1. **Reservation Flow Tests** (`reservation-flow.spec.js`)
- **Complete reservation journey**: Browse → Select Restaurant → Fill Form → Submit
- **Form validation**: Required fields, date restrictions, input validation
- **New UI components**: Two-column layout, chat component, form card styling
- **Special dropdown styling**: Time picker, party size, table type selections
- **Mobile responsiveness**: Form functionality across different screen sizes
- **Smart validation**: Party size + table type capacity validation

### 2. **Authentication Tests** (`authentication.spec.js`)
- **Login/logout flows**: User authentication and session management
- **Role-based access**: Admin vs regular user privileges
- **Admin dashboard**: Special red button styling and access control
- **Session persistence**: Maintaining login across page reloads
- **Security**: Unauthorized access prevention

### 3. **Restaurant Browsing Tests** (`restaurant-browsing.spec.js`)
- **Restaurant discovery**: Browse restaurants page functionality
- **Restaurant cards**: Display of name, description, location, reservation buttons
- **Filtering & search**: Location-based filtering and cuisine search
- **Navigation**: From browse page to reservation page
- **Mobile layout**: Responsive restaurant browsing experience

### 4. **Chat Functionality Tests** (`chat-functionality.spec.js`)
- **Tablio AI chat**: Chat with AI assistant integration
- **Chat interface**: Message history, input field, send button
- **AI responses**: Handling various query types (menu, reservations, dietary)
- **Real-time communication**: Message sending and receiving
- **Mobile chat**: Chat functionality on mobile devices

### 5. **Overall User Experience Tests** (`overall-user-experience.spec.js`)
- **End-to-end customer journey**: Complete user flow from start to finish
- **Performance testing**: Page load times and response measurements
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Cross-browser testing**: Chrome, Firefox, Safari compatibility
- **Error handling**: 404 pages, network errors, graceful degradation

## 🏗️ Architecture

```
e2e/
├── tests/                    # Test specifications
│   ├── reservation-flow.spec.js
│   ├── authentication.spec.js
│   ├── restaurant-browsing.spec.js
│   ├── chat-functionality.spec.js
│   └── overall-user-experience.spec.js
├── utils/
│   └── test-helpers.js       # Reusable test utilities
├── playwright.config.js      # Playwright configuration
├── package.json             # Dependencies and scripts
├── .env.example             # Environment variables template
└── README.md               # This file
```

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd e2e
npm install
```

### 2. Install Playwright Browsers
```bash
npx playwright install
```

### 3. Setup Environment Variables
```bash
cp .env.example .env
# Edit .env with your test credentials and settings
```

### 4. Run Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:reservation
npm run test:auth
npm run test:browse
npm run test:chat
npm run test:ux

# Run with browser visible (for debugging)
npm run test:headed

# Run in debug mode
npm run test:debug

# Run tests with UI mode
npm run test:ui
```

## 🌐 Browser Testing

Tests run across multiple browsers and devices:

- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)
- **Responsive**: Tests verify layouts work across different screen sizes

## 🔧 CI/CD Integration

The tests are fully integrated into your GitHub Actions pipeline:

### **When Tests Run:**
- ✅ **Every pull request** to main branch
- ✅ **Every push** to main branch
- ✅ **Manual workflow dispatch**

### **What Happens:**
1. **Setup**: Install dependencies and Playwright browsers
2. **Start Server**: Launch backend server for testing
3. **Run Tests**: Execute full e2e test suite
4. **Collect Results**: Generate HTML reports and screenshots
5. **Upload Artifacts**: Save test results and videos for debugging

### **Test Results:**
- 📊 **HTML Reports**: Detailed test execution reports
- 📸 **Screenshots**: Captured on test failures
- 🎥 **Videos**: Recorded for failed tests
- 📋 **GitHub Checks**: Pass/fail status on PRs

## 🛠️ Test Utilities

### Helper Functions (`utils/test-helpers.js`)

```javascript
// User authentication
await loginUser(page, email, password);
await logoutUser(page);

// Form filling
await fillReservationForm(page, {
  name: 'John Doe',
  email: 'john@example.com',
  time: '19:00'
});

// Chat testing
const response = await sendChatMessage(page, "What are your opening hours?");

// Navigation
await goToReservationPage(page, restaurantId);

// Utilities
const tomorrow = getTomorrowDate();
await takeTimestampedScreenshot(page, 'test-result');
```

## 📊 Test Coverage

### **Critical User Journeys** ✅
- Restaurant discovery and selection
- Complete reservation flow
- User authentication and authorization
- AI chat assistance
- Mobile and responsive design

### **Technical Validations** ✅
- Form validation and error handling
- Cross-browser compatibility
- Performance benchmarks
- Accessibility standards
- Security and authorization

### **Edge Cases** ✅
- Network failures and timeouts
- Invalid inputs and error states
- Mobile and tablet layouts
- Keyboard navigation
- Screen reader compatibility

## 🎯 Key Features Tested

### **New Reservation Page Layout**
- ✅ Two-column asymmetrical design
- ✅ Left column: Restaurant info + Chat component
- ✅ Right column: Reservation form card
- ✅ Mobile stacking order: Header → Form → Chat

### **Enhanced Form Features**
- ✅ Time picker with 30-minute intervals (6:00 PM - 11:30 PM)
- ✅ Date picker with past date prevention
- ✅ Smart party size + table type validation
- ✅ Special dropdown styling with gradients
- ✅ Restaurant address display in form header

### **Chat Integration**
- ✅ "Chat with Tablio" button with animations
- ✅ Benefits list with slide-in animations
- ✅ Redirect to dedicated chat page
- ✅ AI conversation handling

### **Professional UI Elements**
- ✅ Card-based design with shadows
- ✅ Brand color consistency (red CTA buttons)
- ✅ Hover animations and transitions
- ✅ Professional typography and spacing

## 🐛 Debugging Tests

### **Run with Visual Browser**
```bash
npm run test:headed
```

### **Debug Mode**
```bash
npm run test:debug
```

### **Generate Trace Files**
```bash
npx playwright test --trace on
```

### **View Test Reports**
```bash
npm run report
```

### **Run Specific Test**
```bash
npx playwright test tests/reservation-flow.spec.js
```

## 🔒 Test Data Requirements

### **Test Users** (Add to GitHub Secrets)
```
TEST_USER_EMAIL=test@restaurant.com
TEST_USER_PASSWORD=testpassword123
TEST_ADMIN_EMAIL=admin@tableturn.com  
TEST_ADMIN_PASSWORD=adminpassword123
```

### **Test Restaurant**
- Ensure at least one restaurant exists with ID=1
- Restaurant should have multiple table types for validation tests
- Restaurant should be accessible for reservations

## 📈 Performance Benchmarks

Tests include performance validation:
- **Homepage load**: < 5 seconds
- **Browse restaurants**: < 3 seconds  
- **Reservation page**: < 3 seconds
- **Chat response**: < 10 seconds

## 🚨 Troubleshooting

### **Common Issues:**

1. **Tests failing locally**
   ```bash
   # Ensure server is running
   cd ../backend && npm start
   
   # Check environment variables
   cat .env
   ```

2. **Browser installation issues**
   ```bash
   npx playwright install --with-deps
   ```

3. **Test data issues**
   - Verify test users exist in database
   - Ensure restaurant with ID=1 exists
   - Check database connection

### **CI/CD Issues:**
- Verify GitHub Secrets are set
- Check server startup logs in Actions
- Review uploaded test artifacts

## 📝 Adding New Tests

### **1. Create Test File**
```javascript
const { test, expect } = require('@playwright/test');

test.describe('My New Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/my-feature');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### **2. Add Test Script**
```json
// package.json
{
  "scripts": {
    "test:my-feature": "playwright test tests/my-feature.spec.js"
  }
}
```

### **3. Update CI/CD** (if needed)
Add any specific environment variables or setup steps to `.github/workflows/deploy.yml`.

## 🎉 Benefits

### **For Development:**
- ✅ **Catch regressions** before they reach production
- ✅ **Validate user flows** across the entire application
- ✅ **Test real browser behavior** vs unit test mocks
- ✅ **Confidence in deployments** with automated validation

### **For Product Quality:**
- ✅ **User experience validation** on real devices
- ✅ **Performance monitoring** with each release
- ✅ **Accessibility compliance** testing
- ✅ **Cross-browser compatibility** assurance

### **For Team Productivity:**
- ✅ **Automated testing** reduces manual QA time  
- ✅ **Fast feedback** on pull requests
- ✅ **Clear documentation** of expected behavior
- ✅ **Regression prevention** saves debugging time

---

Your TableTurn reservation system now has **comprehensive end-to-end test coverage** that validates the complete user experience from restaurant discovery to successful reservations! 🎊