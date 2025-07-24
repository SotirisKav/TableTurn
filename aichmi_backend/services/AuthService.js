import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../config/database.js';

class AuthService {
    // Generate JWT tokens
    generateTokens(payload) {
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '15m'
        });
        
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });
        
        return { accessToken, refreshToken };
    }

    // Hash password
    async hashPassword(password) {
        return await bcrypt.hash(password, 12);
    }

    // Verify password
    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // Create owner account
    async createOwner(userData) {
        const { email, password, firstName, lastName, phone, oauthProvider = 'local', oauthId = null } = userData;
        
        try {
            // Check if email already exists
            const [existing] = await db.execute(
                'SELECT id FROM owners WHERE email = $1',
                [email]
            );

            if (existing.length > 0) {
                throw new Error('Email already registered');
            }

            // Hash password if provided (not for OAuth)
            const hashedPassword = password ? await this.hashPassword(password) : null;

            // Insert new owner
            const [result] = await db.execute(
                `INSERT INTO owners (email, password, first_name, last_name, phone, oauth_provider, oauth_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [email, hashedPassword, firstName, lastName, phone, oauthProvider, oauthId]
            );

            return result[0].id;
        } catch (error) {
            throw new Error(`Failed to create owner: ${error.message}`);
        }
    }

    // Login owner - Remove subscription requirement for now
    async loginOwner(email, password) {
        try {
            const [owners] = await db.execute(
                `SELECT o.*, r.name as venue_name 
                 FROM owners o 
                 LEFT JOIN restaurant r ON o.restaurant_id = r.restaurant_id 
                 WHERE o.email = $1`,
                [email]
            );

            if (owners.length === 0) {
                throw new Error('Invalid credentials');
            }

            const owner = owners[0];

            // Check password for local accounts
            if (owner.oauth_provider === 'local' && !await this.verifyPassword(password, owner.password)) {
                throw new Error('Invalid credentials');
            }

            // Generate tokens
            const payload = {
                id: owner.id,
                email: owner.email,
                restaurantId: owner.restaurant_id,
                subscriptionStatus: owner.subscription_status
            };

            const tokens = this.generateTokens(payload);

            // Store refresh token
            await this.storeRefreshToken(tokens.refreshToken, owner.id);

            return {
                owner: {
                    id: owner.id,
                    email: owner.email,
                    firstName: owner.first_name,
                    lastName: owner.last_name,
                    restaurantId: owner.restaurant_id,
                    venueName: owner.venue_name,
                    subscriptionStatus: owner.subscription_status
                },
                tokens
            };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    // Store refresh token
    async storeRefreshToken(token, ownerId) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        await db.execute(
            'INSERT INTO refresh_tokens (token, owner_id, expires_at) VALUES ($1, $2, $3)',
            [token, ownerId, expiresAt]
        );
    }

    // Refresh access token
    async refreshAccessToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
            
            // Check if refresh token exists in database
            const [tokens] = await db.execute(
                'SELECT * FROM refresh_tokens WHERE token = $1 AND owner_id = $2 AND expires_at > NOW()',
                [refreshToken, decoded.id]
            );

            if (tokens.length === 0) {
                throw new Error('Invalid refresh token');
            }

            // Generate new access token
            const payload = {
                id: decoded.id,
                email: decoded.email,
                restaurantId: decoded.restaurantId,
                subscriptionStatus: decoded.subscriptionStatus
            };

            const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: '15m'
            });

            return accessToken;
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    // Logout (invalidate refresh token)
    async logout(refreshToken) {
        await db.execute(
            'DELETE FROM refresh_tokens WHERE token = $1',
            [refreshToken]
        );
    }
}

export default new AuthService();