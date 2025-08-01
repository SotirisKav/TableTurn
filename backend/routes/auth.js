import express from 'express';
import AuthService from '../services/AuthService.js';
import StripeService from '../services/StripeService.js';
import { authenticateToken } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Local registration
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        // Validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Create owner
        const ownerId = await AuthService.createOwner({
            email,
            password,
            firstName,
            lastName,
            phone
        });

        // Create Stripe customer
        const customer = await StripeService.createCustomer(
            email,
            `${firstName} ${lastName}`
        );

        // Update owner with Stripe customer ID
        await StripeService.updateOwnerSubscription(ownerId, {
            customerId: customer.id,
            subscriptionId: null,
            status: null
        });

        res.status(201).json({
            message: 'Account created successfully',
            ownerId,
            stripeCustomerId: customer.id
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Local login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await AuthService.loginOwner(email, password);

        res.json({
            message: 'Login successful',
            owner: result.owner,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken
        });

    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

export default router;