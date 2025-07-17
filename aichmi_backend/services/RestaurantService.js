import pool from '../config/database.js';

function toISODate(dateString) {
  // Handles 'August 8, 2025' -> '2025-08-08'
  const d = new Date(dateString);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}
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
    
    // Check if a table of a given type is available for a venue on a specific date
    static async isTableAvailable({ venueId, tableType, reservationDate }) {
        // 1. Get max tables for this type
        const invRes = await pool.query(
          'SELECT max_tables FROM table_inventory WHERE venue_id = $1 AND table_type = $2',
          [venueId, tableType]
        );
        if (invRes.rowCount === 0) {
          throw new Error('No inventory set for this table type at this venue.');
        }
        const maxTables = invRes.rows[0].max_tables;

        // 2. Count existing reservations for this type
        const resRes = await pool.query(
          'SELECT COUNT(*) FROM reservation WHERE venue_id = $1 AND table_type = $2 AND reservation_date = $3',
          [venueId, tableType, reservationDate]
        );
        const reservedCount = Number(resRes.rows[0].count);

        // 3. For grass tables, subtract 2 for each special table booked
        let grassAdjustment = 0;
        if (tableType === 'grass') {
          const specialRes = await pool.query(
            'SELECT COUNT(*) FROM reservation WHERE venue_id = $1 AND table_type = $2 AND reservation_date = $3',
            [venueId, 'special', reservationDate]
          );
          grassAdjustment = Number(specialRes.rows[0].count) * 2;
        }

        // 4. For special tables, ensure no more than 2 are booked
        if (tableType === 'special' && reservedCount >= 2) {
          return false;
        }

        // 5. Check if available
        if (tableType === 'grass') {
          return (reservedCount + grassAdjustment) < maxTables;
        } else {
          return reservedCount < maxTables;
        }
    }
    
    static async createReservation({
      venueId,
      reservationName,
      reservationEmail,
      reservationPhone,
      date,
      time,
      guests,
      tableType,
      celebrationType = null,
      cake = false,
      cakePrice = null,
      flowers = false,
      flowersPrice = null,
      hotelName = null,
      hotelId = null,
      specialRequests = null
    }) {
      // 1. Check table availability
      const available = await RestaurantService.isTableAvailable({
        venueId,
        tableType,
        reservationDate: toISODate(date)
      });
      if (!available) {
        throw new Error('No tables of this type available for the selected date.');
      }

      // 2. Insert reservation
      const query = `
        INSERT INTO reservation (
          reservation_name,
          reservation_email,
          reservation_phone,
          reservation_date,
          reservation_time,
          guests,
          table_type,
          celebration_type,
          cake,
          cake_price,
          flowers,
          flowers_price,
          hotel_name,
          hotel_id,
          venue_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *;
      `;
      const values = [
        reservationName,
        reservationEmail,
        reservationPhone,
        toISODate(date),
        time,
        guests,
        tableType,
        celebrationType,
        cake,
        cakePrice,
        flowers,
        flowersPrice,
        hotelName,
        hotelId,
        venueId
      ];
      const result = await pool.query(query, values);
      return result.rows[0];
    }
}

export default RestaurantService;