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
        
        // Pricing validation
        const validPricing = ['affordable', 'moderate', 'expensive'];
        if (!data.pricing || !validPricing.includes(data.pricing)) {
            errors.pricing = 'Please select a valid pricing level';
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
    
    async registerRestaurant(registrationData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const {
                ownerName,
                email,
                password,
                phoneNumber,
                restaurantName,
                location,
                description,
                profileImage,
                backgroundImage
            } = registrationData;
            
            // Extract location data
            const { island, area, address, lat, lng } = location || {};
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Insert owner
            const ownerResult = await client.query(
                `INSERT INTO owners (name, email, password, phone_number) 
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [ownerName, email, hashedPassword, phoneNumber]
            );
            
            const ownerId = ownerResult.rows[0].id;
            
            // Build full location string
            const fullLocation = [address, area, island].filter(Boolean).join(', ');
            
            // Insert venue with new structure
            const venueResult = await client.query(
                `INSERT INTO venues (
                    name, 
                    description, 
                    location, 
                    owner_id, 
                    latitude, 
                    longitude,
                    profile_image_url,
                    background_image_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    restaurantName,
                    description,
                    fullLocation,
                    ownerId,
                    lat || null,
                    lng || null,
                    profileImage || null,
                    backgroundImage || null
                ]
            );
            
            const venueId = venueResult.rows[0].id;
            
            await client.query('COMMIT');
            
            return {
                success: true,
                message: 'Restaurant registered successfully',
                data: {
                    ownerId,
                    venueId,
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
