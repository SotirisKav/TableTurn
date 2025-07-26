import db from '../config/database.js';

function toISODate(dateString) {
  if (!dateString) return null;
  
  // Handle various date formats and ensure current year if not specified
  const currentYear = new Date().getFullYear();
  let normalizedDate = dateString.trim();
  
  // Remove ordinal suffixes (st, nd, rd, th)
  normalizedDate = normalizedDate.replace(/(\d+)(st|nd|rd|th)/g, '$1');
  
  // If the date string doesn't contain a year, append current year
  if (!/\d{4}/.test(normalizedDate)) {
    normalizedDate = `${normalizedDate}, ${currentYear}`;
  }
  
  const d = new Date(normalizedDate);
  if (isNaN(d)) return null;
  
  // Check if the parsed date is in the past, and if so, use next year
  const today = new Date();
  if (d < today && d.getFullYear() === currentYear) {
    // If date has passed this year, assume user means next year
    const nextYear = currentYear + 1;
    normalizedDate = normalizedDate.replace(currentYear.toString(), nextYear.toString());
    const nextYearDate = new Date(normalizedDate);
    if (!isNaN(nextYearDate)) {
      const year = nextYearDate.getFullYear();
      const month = (nextYearDate.getMonth() + 1).toString().padStart(2, '0');
      const day = nextYearDate.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  // Return in ISO format using local timezone to avoid timezone offset issues
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

class RestaurantService {
    // Get all restaurants with their details
    static async getAllRestaurants() {
        try {
            const query = `
                SELECT 
                    r.restaurant_id,
                    r.name,
                    r.address,
                    r.area,
                    r.island,
                    r.description,
                    r.cuisine,
                    r.phone,
                    r.email as contact_email,
                    r.profile_image_url,
                    o.first_name,
                    o.last_name,
                    o.phone as owner_phone,
                    o.email as owner_email
                FROM restaurant r
                LEFT JOIN owners o ON r.restaurant_id = o.restaurant_id
                ORDER BY r.name;
            `;
            
            const result = await db.query(query);
            return result;
        } catch (error) {
            console.error('Error fetching restaurants:', error);
            throw error;
        }
    }

    // Get a specific restaurant by ID
    static async getRestaurantById(id) {
        try {
            // Check if id is valid
            if (!id || id === 'null' || id === 'undefined') {
                throw new Error(`Invalid restaurant ID: ${id}`);
            }
            const query = `
                SELECT 
                    r.restaurant_id,
                    r.name,
                    r.address,
                    r.area,
                    r.island,
                    r.description,
                    r.cuisine,
                    r.phone,
                    r.email as contact_email,
                    r.profile_image_url,
                    o.first_name,
                    o.last_name,
                    o.phone as owner_phone,
                    o.email as owner_email,
                    CONCAT(o.first_name, ' ', o.last_name) as owner_name
                FROM restaurant r
                LEFT JOIN owners o ON r.restaurant_id = o.restaurant_id
                WHERE r.restaurant_id = $1;
            `;
            
            const result = await db.query(query, [id]);
            return result[0] || null;
        } catch (error) {
            console.error('Error fetching restaurant by ID:', error);
            throw error;
        }
    }

    static async getRestaurantByName(name) {
        const result = await db.query('SELECT * FROM restaurant WHERE name = $1', [name]);
        return result[0];
    }

    // Get restaurant owner information
    static async getRestaurantOwner(restaurantId) {
        try {
            const query = `
                SELECT 
                    o.id,
                    o.first_name,
                    o.last_name,
                    o.phone,
                    o.email,
                    CONCAT(o.first_name, ' ', o.last_name) as name
                FROM owners o
                WHERE o.restaurant_id = $1;
            `;
            
            const result = await db.query(query, [restaurantId]);
            return result[0] || null;
        } catch (error) {
            console.error('Error fetching restaurant owner:', error);
            throw error;
        }
    }

    // Get restaurant hours for a specific restaurant
    static async getRestaurantHours(restaurantId) {
        try {
            const query = `
                SELECT 
                    day_of_week,
                    open_time,
                    close_time
                FROM restaurant_hours
                WHERE restaurant_id = $1
                ORDER BY 
                    CASE day_of_week
                        WHEN 'Monday' THEN 1
                        WHEN 'Tuesday' THEN 2
                        WHEN 'Wednesday' THEN 3
                        WHEN 'Thursday' THEN 4
                        WHEN 'Friday' THEN 5
                        WHEN 'Saturday' THEN 6
                        WHEN 'Sunday' THEN 7
                    END;
            `;
            
            const result = await db.query(query, [restaurantId]);
            return result;
        } catch (error) {
            console.error('Error fetching restaurant hours:', error);
            throw error;
        }
    }

    // Get menu items for a specific restaurant
    static async getMenuItems(restaurantId) {
        try {
            const query = `
                SELECT 
                    menu_item_id,
                    name,
                    description,
                    price,
                    category,
                    is_vegetarian,
                    is_vegan,
                    is_gluten_free,
                    available
                FROM menu_item
                WHERE restaurant_id = $1 AND available = true
                ORDER BY category, name;
            `;
            
            const result = await db.query(query, [restaurantId]);
            return result;
        } catch (error) {
            console.error('Error fetching menu items:', error);
            throw error;
        }
    }

    // Get fully booked dates for a specific restaurant
    static async getFullyBookedDates(restaurantId) {
        try {
            const query = `
                SELECT 
                    fully_booked_dates
                FROM fully_booked_dates
                WHERE restaurant_id = $1;
            `;
            
            const result = await db.query(query, [restaurantId]);
            
            // Extract dates from the array and filter future dates
            if (result.length > 0 && result[0].fully_booked_dates) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const futureDates = result[0].fully_booked_dates
                    .filter(date => new Date(date) >= today)
                    .sort((a, b) => new Date(a) - new Date(b));
                    
                return futureDates.map(date => ({ fully_booked_date: date }));
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching fully booked dates:', error);
            throw error;
        }
    }

    // Get table inventory for a specific restaurant
    static async getTableInventory(restaurantId) {
        try {
            const query = `
                SELECT 
                    table_type,
                    table_price,
                    COUNT(*) as total_tables
                FROM tables
                WHERE restaurant_id = $1
                GROUP BY table_type, table_price
                ORDER BY table_type;
            `;
            
            const result = await db.query(query, [restaurantId]);
            // db.query already returns result.rows directly, not a result object with .rows
            return result || [];
        } catch (error) {
            console.error('Error fetching table inventory:', error);
            // Return empty array if tables don't exist
            return [];
        }
    }

    // Get table types for a specific restaurant (for menu pricing agent)
    static async getTableTypes(restaurantId) {
        try {
            const query = `
                SELECT 
                    table_type,
                    table_price as price_per_person
                FROM tables
                WHERE restaurant_id = $1
                GROUP BY table_type, table_price
                ORDER BY table_type;
            `;
            
            const result = await db.query(query, [restaurantId]);
            // db.query already returns result.rows directly, not a result object with .rows
            return result || [];
        } catch (error) {
            console.error('Error fetching table types:', error);
            return [];
        }
    }

    // Check if a restaurant is fully booked on a specific date
    static async isFullyBooked(venueId, date) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM fully_booked_dates
                WHERE venue_id = $1 AND fully_booked_date = $2;
            `;
            
            const result = await db.query(query, [venueId, date]);
            return parseInt(result[0].count) > 0;
        } catch (error) {
            console.error('Error checking fully booked status:', error);
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
            const result = await db.query(query, [venueId]);
            return result;
        } catch (error) {
            console.error('Error fetching menu items:', error);
            throw error;
        }
    }
    
    // Check if a table of a given type is available for a venue on a specific date
    static async isTableAvailable({ venueId, tableType, reservationDate }) {
        // 1. Get max tables for this type from the table_type_counts view
        const invRes = await db.query(
          'SELECT total_tables FROM table_type_counts WHERE restaurant_id = $1 AND table_type = $2',
          [venueId, tableType]
        );
        if (invRes.length === 0) {
          throw new Error(`No tables of type "${tableType}" available at this restaurant.`);
        }
        const maxTables = invRes[0].total_tables;

        // 2. Count existing reservations for this type
        const resRes = await db.query(
          'SELECT COUNT(*) FROM reservation WHERE restaurant_id = $1 AND table_type = $2 AND reservation_date = $3',
          [venueId, tableType, reservationDate]
        );
        const reservedCount = Number(resRes[0].count);

        // 3. Check if available
        return reservedCount < maxTables;
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
          restaurant_id
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
      const result = await db.query(query, values);
      return result[0];
    }

    // NEW: Create restaurant with Google Maps location data
    static async createRestaurantWithLocation(restaurantData) {
        try {
            const query = `
                INSERT INTO venue (
                    name, address, area, island, type, rating, pricing, 
                    image_url, google_place_id, description, cuisine
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING venue_id, name, address, area, island, type, rating, pricing, 
                         image_url, google_place_id, description, cuisine
            `;

            const values = [
                restaurantData.name,
                restaurantData.address,
                restaurantData.area,
                restaurantData.island,
                'restaurant', // type is always restaurant
                restaurantData.rating || null,
                restaurantData.pricing,
                restaurantData.image_url || null,
                restaurantData.google_place_id,
                restaurantData.description,
                restaurantData.cuisine
            ];

            const result = await db.query(query, values);
            return result[0];

        } catch (error) {
            console.error('Error creating restaurant with location:', error);
            throw error;
        }
    }

    // NEW: Get restaurants by island
    static async getRestaurantsByIsland(island) {
        try {
            const query = `
                SELECT 
                    v.venue_id as id,
                    v.name,
                    v.address,
                    v.area as location,
                    v.island,
                    v.type,
                    v.rating,
                    v.pricing as price_range,
                    v.image_url as image,
                    v.description,
                    v.cuisine,
                    v.google_place_id,
                    o.phone,
                    o.email as contact_email,
                    CASE 
                        WHEN v.pricing = 'expensive' THEN '€€€€'
                        WHEN v.pricing = 'moderate' THEN '€€€'
                        ELSE '€€'
                    END as priceRange
                FROM venue v
                LEFT JOIN owners o ON v.venue_id = o.venue_id
                WHERE v.type = 'restaurant' AND v.island ILIKE $1
                ORDER BY v.rating DESC
            `;

            const result = await db.query(query, [`%${island}%`]);
            return result;

        } catch (error) {
            console.error('Error getting restaurants by island:', error);
            throw error;
        }
    }

    // NEW: Get restaurants by area within an island
    static async getRestaurantsByArea(island, area) {
        try {
            const query = `
                SELECT 
                    v.venue_id as id,
                    v.name,
                    v.address,
                    v.area as location,
                    v.island,
                    v.type,
                    v.rating,
                    v.pricing as price_range,
                    v.image_url as image,
                    v.description,
                    v.cuisine,
                    v.google_place_id,
                    o.phone,
                    o.email as contact_email,
                    CASE 
                        WHEN v.pricing = 'expensive' THEN '€€€€'
                        WHEN v.pricing = 'moderate' THEN '€€€'
                        ELSE '€€'
                    END as priceRange
                FROM venue v
                LEFT JOIN owners o ON v.venue_id = o.venue_id
                WHERE v.type = 'restaurant' AND v.island ILIKE $1 AND v.area ILIKE $2
                ORDER BY v.rating DESC
            `;

            const result = await db.query(query, [`%${island}%`, `%${area}%`]);
            return result;

        } catch (error) {
            console.error('Error getting restaurants by area:', error);
            throw error;
        }
    }

    // NEW: Update restaurant location
    static async updateRestaurantLocation(venueId, locationData) {
        try {
            const query = `
                UPDATE venue 
                SET address = $2, area = $3, island = $4, google_place_id = $5
                WHERE venue_id = $1 AND type = 'restaurant'
                RETURNING venue_id, name, address, area, island, google_place_id
            `;

            const values = [
                venueId,
                locationData.address,
                locationData.area,
                locationData.island,
                locationData.google_place_id
            ];

            const result = await db.query(query, values);
            return result[0];

        } catch (error) {
            console.error('Error updating restaurant location:', error);
            throw error;
        }
    }

    // NEW: Search restaurants with filters including location
    static async searchRestaurantsWithFilters(filters = {}) {
        try {
            let query = `
                SELECT 
                    v.venue_id as id,
                    v.name,
                    v.address,
                    v.area as location,
                    v.island,
                    v.type,
                    v.rating,
                    v.pricing as price_range,
                    v.image_url as image,
                    v.description,
                    v.cuisine,
                    v.google_place_id,
                    o.phone,
                    o.email as contact_email,
                    CASE 
                        WHEN v.pricing = 'expensive' THEN '€€€€'
                        WHEN v.pricing = 'moderate' THEN '€€€'
                        ELSE '€€'
                    END as priceRange
                FROM venue v
                LEFT JOIN owners o ON v.venue_id = o.venue_id
                WHERE v.type = 'restaurant'
            `;

            const values = [];
            let paramCount = 1;

            if (filters.island) {
                query += ` AND v.island ILIKE $${paramCount}`;
                values.push(`%${filters.island}%`);
                paramCount++;
            }

            if (filters.area) {
                query += ` AND v.area ILIKE $${paramCount}`;
                values.push(`%${filters.area}%`);
                paramCount++;
            }

            if (filters.pricing) {
                query += ` AND v.pricing = $${paramCount}`;
                values.push(filters.pricing);
                paramCount++;
            }

            if (filters.cuisine) {
                query += ` AND v.cuisine ILIKE $${paramCount}`;
                values.push(`%${filters.cuisine}%`);
                paramCount++;
            }

            if (filters.minRating) {
                query += ` AND v.rating >= $${paramCount}`;
                values.push(filters.minRating);
                paramCount++;
            }

            if (filters.searchTerm) {
                query += ` AND (v.name ILIKE $${paramCount} OR v.cuisine ILIKE $${paramCount} OR v.description ILIKE $${paramCount})`;
                values.push(`%${filters.searchTerm}%`);
                paramCount++;
            }

            query += ` ORDER BY v.rating DESC`;

            const result = await db.query(query, values);
            return result;

        } catch (error) {
            console.error('Error searching restaurants with filters:', error);
            throw error;
        }
    }

    // NEW: Get restaurant statistics by island
    static async getRestaurantStatsByIsland() {
        try {
            const query = `
                SELECT 
                    v.island,
                    COUNT(*) as restaurant_count,
                    AVG(v.rating) as avg_rating,
                    COUNT(CASE WHEN v.pricing = 'affordable' THEN 1 END) as affordable_count,
                    COUNT(CASE WHEN v.pricing = 'moderate' THEN 1 END) as moderate_count,
                    COUNT(CASE WHEN v.pricing = 'expensive' THEN 1 END) as expensive_count
                FROM venue v
                WHERE v.type = 'restaurant'
                GROUP BY v.island
                ORDER BY restaurant_count DESC
            `;

            const result = await db.query(query);
            return result;

        } catch (error) {
            console.error('Error getting restaurant stats:', error);
            throw error;
        }
    }
}

export default RestaurantService;