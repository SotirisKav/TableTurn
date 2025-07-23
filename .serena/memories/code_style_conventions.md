# Code Style & Conventions

## General
- **Module System:** ES6 modules (`import`/`export`)
- **JavaScript:** Modern ES6+ syntax
- **TypeScript:** Used in frontend with strict typing

## Backend (Node.js)
- **Framework:** Express.js
- **Database:** PostgreSQL with `pg` client
- **Authentication:** Passport.js strategies
- **Validation:** Custom service-based validation
- **Error Handling:** Try-catch with proper HTTP status codes
- **Logging:** Console.log with emojis for visual distinction

## Frontend (React)
- **Build Tool:** Vite
- **Linting:** ESLint with React hooks plugin
- **Routing:** React Router DOM
- **Styling:** CSS modules or styled components

## File Organization
- Services in `/services/` directory
- Routes in `/routes/` directory  
- Middleware in `/middleware/` directory
- Configuration in `/config/` directory

## Naming Conventions
- **Files:** camelCase (e.g., `RestaurantService.js`)
- **Classes:** PascalCase
- **Methods:** camelCase
- **Constants:** UPPER_SNAKE_CASE