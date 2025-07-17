import jwt from 'jsonwebtoken';
import db from '../config/database.js';

// Verify JWT token - Remove subscription requirement for now
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if owner still exists
        const [owners] = await db.execute(
            'SELECT * FROM owners WHERE id = ?',
            [decoded.id]
        );

        if (owners.length === 0) {
            return res.status(401).json({ error: 'Invalid token - user not found' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Check if user owns the restaurant/venue
export const authorizeVenue = async (req, res, next) => {
    try {
        const venueId = req.params.venueId || req.body.venue_id;
        
        if (req.user.restaurantId !== parseInt(venueId)) {
            return res.status(403).json({ error: 'Access denied to this venue' });
        }
        
        next();
    } catch (error) {
        return res.status(500).json({ error: 'Authorization check failed' });
    }
};