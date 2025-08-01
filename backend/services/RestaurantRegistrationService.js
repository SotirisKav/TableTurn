import LocationValidationService from './LocationValidationService.js';
import db from '../config/database.js';
import bcrypt from 'bcrypt';

class RestaurantRegistrationService {
    
    static validateRestaurantData(data) {
        const errors = {};
        
        // Restaurant Name validation
        if (!data.restaurantName || data.restaurantName.trim().length < 3) {
            errors.restaurantName = 'Restaurant name must be at least 3 characters long';
        } else if (data.restaurantName.trim().length > 100) {
            errors.restaurantName = 'Restaurant name must be less than 100 characters';
        }
        
        // Cuisine validation
        if (!data.cuisine || data.cuisine.trim().length < 2) {
            errors.cuisine = 'Cuisine type is required';
        } else if (data.cuisine.trim().length > 50) {
            errors.cuisine = 'Cuisine type must be less than 50 characters';
        }
        
        // Location validation
        if (!data.location || !data.location.island || !data.location.area) {
            errors.location = 'Please select a valid location using the map';
        }
        
        // Phone validation
        const phoneRegex = /^[\d\s\-\+\(\)]{8,20}$/;
        if (!data.phone || !phoneRegex.test(data.phone)) {
            errors.phone = 'Please enter a valid phone number (8-20 digits)';
        }
        
        
        // Description validation
        if (!data.description || data.description.trim().length < 10) {
            errors.description = 'Description must be at least 10 characters long';
        } else if (data.description.trim().length > 500) {
            errors.description = 'Description must be less than 500 characters';
        }
        
        // Owner Email validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!data.ownerEmail || !emailRegex.test(data.ownerEmail)) {
            errors.ownerEmail = 'Please enter a valid email address';
        }
        
        // Owner First Name validation
        if (!data.ownerFirstName || data.ownerFirstName.trim().length < 2) {
            errors.ownerFirstName = 'First name must be at least 2 characters long';
        } else if (data.ownerFirstName.trim().length > 50) {
            errors.ownerFirstName = 'First name must be less than 50 characters';
        }
        
        // Owner Last Name validation
        if (!data.ownerLastName || data.ownerLastName.trim().length < 2) {
            errors.ownerLastName = 'Last name must be at least 2 characters long';
        } else if (data.ownerLastName.trim().length > 50) {
            errors.ownerLastName = 'Last name must be less than 50 characters';
        }
        
        // Password validation
        if (!data.ownerPassword || data.ownerPassword.length < 8) {
            errors.ownerPassword = 'Password must be at least 8 characters long';
        } else if (data.ownerPassword.length > 100) {
            errors.ownerPassword = 'Password must be less than 100 characters';
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
    
    static async checkEmailExists(email) {
        try {
            const result = await db.query(
                'SELECT id FROM owners WHERE email = $1',
                [email.toLowerCase()]
            );
            return result && result.rows && result.rows.length > 0;
        } catch (error) {
            console.error('Error checking email:', error);
            throw new Error('Database error while checking email');
        }
    }
    
    static async validateLocation(locationData) {
        try {
            const validation = await LocationValidationService.validateAndExtractLocation(
                locationData.lat,
                locationData.lng,
                locationData.placeId,
                {
                    island: locationData.island,
                    area: locationData.area,
                    address: locationData.address,
                    placeId: locationData.placeId
                }
            );
            
            return {
                isValid: validation.isValid,
                error: validation.isValid ? null : 'Invalid location selected',
                validatedLocation: validation.isValid ? {
                    island: validation.island,
                    area: validation.area,
                    address: validation.address,
                    placeId: validation.placeId,
                    formattedAddress: validation.formattedAddress
                } : null
            };
        } catch (error) {
            console.error('Location validation error:', error);
            return {
                isValid: false,
                error: 'Failed to validate location',
                validatedLocation: null
            };
        }
    }
    
    static async registerRestaurant(registrationData) {
        console.log('🔄 Starting restaurant registration...');
        console.log('📋 Registration data received:', JSON.stringify(registrationData, null, 2));
        
        // Import pool directly
        const pkg = await import('pg');
        const { Pool } = pkg.default || pkg;
        const pool = new Pool({
            user: process.env.DB_USER || 'sotiriskavadakis',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'tableturn',
            password: process.env.DB_PASSWORD || '',
            port: process.env.DB_PORT || 5432,
        });
        
        const client = await pool.connect();
        console.log('✅ Database client connected');
        
        try {
            await client.query('BEGIN');
            
            const {
                ownerFirstName,
                ownerLastName,
                ownerEmail,
                ownerPassword,
                phoneNumber,
                restaurantName,
                location,
                description,
                profileImage,
                backgroundImage,
                cuisine,
                phone
            } = registrationData;
            
            // Extract location data
            const { island, area, address, lat, lng } = location || {};
            
            // Hash password
            const hashedPassword = await bcrypt.hash(ownerPassword, 10);
            
            // Combine first and last name
            const ownerName = `${ownerFirstName} ${ownerLastName}`;
            
            // Insert owner
            const ownerResult = await client.query(
                `INSERT INTO owners (first_name, last_name, email, password, phone) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [ownerFirstName, ownerLastName, ownerEmail, hashedPassword, phoneNumber]
            );
            
            const ownerId = ownerResult.rows[0].id;
            
            // Build full location string
            const fullLocation = [address, area, island].filter(Boolean).join(', ');
            
            // Insert restaurant with correct structure
            const restaurantResult = await client.query(
                `INSERT INTO restaurant (
                    name, 
                    description, 
                    address, 
                    email,
                    phone,
                    area,
                    island,
                    profile_image_url,
                    background_image_url,
                    cuisine
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING restaurant_id`,
                [
                    restaurantName,
                    description,
                    address || fullLocation,
                    ownerEmail, // Use owner email as restaurant email for now
                    phone || phoneNumber,
                    area || 'Unknown Area',
                    island || 'Unknown Island',
                    profileImage || null,
                    backgroundImage || null,
                    cuisine || 'Other'
                ]
            );
            
            const restaurantId = restaurantResult.rows[0].restaurant_id;
            
            // Update owner with restaurant_id
            await client.query(
                `UPDATE owners SET restaurant_id = $1 WHERE id = $2`,
                [restaurantId, ownerId]
            );
            
            await client.query('COMMIT');
            
            return {
                success: true,
                message: 'Restaurant registered successfully',
                data: {
                    ownerId,
                    restaurantId,
                    restaurantName,
                    location: fullLocation
                }
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Registration error:', error);
            throw new Error(`Registration failed: ${error.message}`);
        } finally {
            client.release();
            await pool.end();
        }
    }
    
    static capitalizeWords(str) {
        return str.trim().replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }
    
    static formatPhoneNumber(phone) {
        // Remove all non-digits except + at the beginning
        return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    }
}

export default RestaurantRegistrationService;
