# Task Completion Checklist

When completing any coding task, ensure you:

## Code Quality
1. **Linting:** Run `npm run lint` in respective directory
2. **Testing:** Test functionality manually (no automated tests currently)
3. **Error Handling:** Implement proper try-catch blocks
4. **Validation:** Add input validation where appropriate

## Database Operations
1. **Transactions:** Use database transactions for multi-step operations
2. **Connection Management:** Proper client.release() in finally blocks
3. **SQL Injection:** Use parameterized queries ($1, $2, etc.)

## Security Considerations
1. **Password Hashing:** Use bcrypt for passwords
2. **Input Sanitization:** Validate and sanitize all inputs
3. **Environment Variables:** Store secrets in `.env` files
4. **CORS:** Ensure proper CORS configuration

## Final Steps
1. Test the functionality end-to-end
2. Check console for any errors
3. Verify database changes if applicable
4. Review code for adherence to project patterns