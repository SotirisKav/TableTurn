import pool from '../config/database.js';

class RestaurantService {
    // Get all restaurants with their details
    static async getAllRestaurants() {
        try {
            const query = `
                SELECT 
                    v.venue_id as id,
                    v.name,
                    v.address,
                    v.area as location,
                    v.type,
                    v.rating,
                    v.pricing as price_range,
                    v.image_url as image,
                    v.description,
                    v.cuisine,
                    o.phone,
                    o.email as contact_email,
                    CASE 
                        WHEN v.pricing = 'expensive' THEN '€€€€'
                        WHEN v.pricing = 'moderate' THEN '€€€'
                        ELSE '€€'
                    END as priceRange
                FROM venue v
                LEFT JOIN owner o ON v.venue_id = o.venue_id
                WHERE v.type = 'restaurant'
                ORDER BY v.rating DESC;
            `;
            
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error fetching restaurants:', error);
            throw error;
        }
    }

    // Get a specific restaurant by ID
    static async getRestaurantById(id) {
        try {
            const query = `
                SELECT 
                    v.venue_id as id,
                    v.name,
                    v.address,
                    v.area as location,
                    v.type,
                    v.rating,
                    v.pricing as price_range,
                    v.image_url as image,
                    v.description,
                    v.cuisine,
                    o.phone,
                    o.email as contact_email,
                    o.name as owner_name,
                    CASE 
                        WHEN v.pricing = 'expensive' THEN '€€€€'
                        WHEN v.pricing = 'moderate' THEN '€€€'
                        ELSE '€€'
                    END as priceRange
                FROM venue v
                LEFT JOIN owner o ON v.venue_id = o.venue_id
                WHERE v.venue_id = $1 AND v.type = 'restaurant';
            `;
            
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching restaurant by ID:', error);
            throw error;
        }
    }

    static async getRestaurantByName(name) {
      const { rows } = await pool.query('SELECT * FROM venue WHERE name = $1', [name]);
      return rows[0];
    }

    // Check if a restaurant is fully booked on a specific date
    static async isFullyBooked(venueId, date) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM fully_booked_dates
                WHERE venue_id = $1 AND fully_booked_date = $2;
            `;
            
            const result = await pool.query(query, [venueId, date]);
            return parseInt(result.rows[0].count) > 0;
        } catch (error) {
            console.error('Error checking fully booked status:', error);
            throw error;
        }
    }

    // Get available table types and prices
    static async getTableTypes() {
        try {
            const query = `
                SELECT table_type, table_price
                FROM tables
                ORDER BY table_price ASC;
            `;
            
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error fetching table types:', error);
            throw error;
        }
    }

    // Get menu items for a specific restaurant by venue_id
    static async getMenuItemsByVenueId(venueId) {
        try {
            const query = `
                SELECT 
                    menu_item_id as id,
                    name,
                    description,
                    price,
                    category,
                    is_vegetarian,
                    is_vegan,
                    is_gluten_free
                FROM menu_item
                WHERE venue_id = $1
                ORDER BY category, price ASC;
            `;
            const result = await pool.query(query, [venueId]);
            return result.rows;
        } catch (error) {
            console.error('Error fetching menu items:', error);
            throw error;
        }
    }
}

export default RestaurantService;