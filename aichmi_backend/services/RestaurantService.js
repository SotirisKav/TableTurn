import db from '../config/database.js';

function toISODate(dateString) {
  if (!dateString) return null;
  
  console.log(`📅 toISODate input: "${dateString}"`);
  
  // If already in ISO format (YYYY-MM-DD), return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
    console.log(`📅 toISODate returning ISO format as-is: "${dateString.trim()}"`);
    return dateString.trim();
  }
  
  // Handle various date formats and ensure current year if not specified
  const currentYear = new Date().getFullYear();
  let normalizedDate = dateString.trim();
  
  // Remove ordinal suffixes (st, nd, rd, th)
  normalizedDate = normalizedDate.replace(/(\\d+)(st|nd|rd|th)/g, '$1');
  
  // If the date string doesn't contain a year, append current year
  if (!/\\d{4}/.test(normalizedDate)) {
    normalizedDate = `${normalizedDate}, ${currentYear}`;
  }
  
  const d = new Date(normalizedDate);
  console.log(`📅 toISODate parsed date: ${d}, isNaN: ${isNaN(d)}`);
  if (isNaN(d)) return null;
  
  // Check if the parsed date is in the past, and if so, use next year
  // Compare only dates, not times to avoid same-day issues
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const reservationDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  if (reservationDateOnly < todayDateOnly && d.getFullYear() === currentYear) {
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
                    r.profile_image_url as image,
                    r.background_image_url,
                    r.min_reservation_gap_hours,
                    o.first_name,
                    o.last_name,
                    o.phone as owner_phone,
                    o.email as owner_email
                FROM restaurant r
                LEFT JOIN owners o ON r.restaurant_id = o.restaurant_id
                ORDER BY r.name;
            `;
            
            console.log('RestaurantService: Executing getAllRestaurants query...');
            const result = await db.query(query);
            
            // Enhanced debugging for production environment
            console.log('RestaurantService: Query result type:', typeof result);
            console.log('RestaurantService: Query result isArray:', Array.isArray(result));
            console.log('RestaurantService: Query result keys:', result ? Object.keys(result) : 'null/undefined');
            
            // Normalize the result to always return an array
            // Handle both direct array responses and result object responses
            const restaurants = Array.isArray(result) ? result : (result.rows || []);
            
            console.log('RestaurantService: Normalized restaurants count:', restaurants.length);
            return restaurants;
        } catch (error) {
            console.error('RestaurantService: Error fetching restaurants:', error);
            console.error('RestaurantService: Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
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
                    r.email,
                    r.profile_image_url,
                    r.background_image_url,
                    r.min_reservation_gap_hours,
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

    // Update a restaurant
    static async updateRestaurant(id, updateData) {
        try {
            // Check if id is valid
            if (!id || id === 'null' || id === 'undefined') {
                throw new Error(`Invalid restaurant ID: ${id}`);
            }

            const {
                name,
                address,
                email,
                phone,
                area,
                island,
                description,
                cuisine,
                min_reservation_gap_hours,
                profile_image_url,
                background_image_url
            } = updateData;

            const query = `
                UPDATE restaurant 
                SET 
                    name = $2,
                    address = $3,
                    email = $4,
                    phone = $5,
                    area = $6,
                    island = $7,
                    description = $8,
                    cuisine = $9,
                    min_reservation_gap_hours = $10,
                    profile_image_url = $11,
                    background_image_url = $12
                WHERE restaurant_id = $1
                RETURNING 
                    restaurant_id,
                    name,
                    address,
                    email,
                    phone,
                    area,
                    island,
                    description,
                    cuisine,
                    min_reservation_gap_hours,
                    profile_image_url,
                    background_image_url;
            `;
            
            const values = [
                id,
                name,
                address,
                email,
                phone,
                area,
                island,
                description,
                cuisine,
                min_reservation_gap_hours || 2, // Default to 2 hours
                profile_image_url,
                background_image_url
            ];

            const result = await db.query(query, values);
            return result[0] || null;
        } catch (error) {
            console.error('Error updating restaurant:', error);
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
                    is_gluten_free
                FROM menu_item
                WHERE restaurant_id = $1 
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
            // First check if table_name column exists
            let hasTableNameColumn = false;
            try {
                await db.query(`
                    SELECT table_name 
                    FROM tables 
                    WHERE restaurant_id = $1 
                    LIMIT 1
                `, [restaurantId]);
                hasTableNameColumn = true;
            } catch (checkError) {
                hasTableNameColumn = false;
            }

            const query = hasTableNameColumn ? `
                SELECT 
                    table_id,
                    table_name,
                    table_type,
                    table_price,
                    capacity,
                    description
                FROM tables
                WHERE restaurant_id = $1
                ORDER BY table_type, table_name;
            ` : `
                SELECT 
                    table_id,
                    CASE 
                        WHEN table_type = 'standard' THEN 'A' || ROW_NUMBER() OVER (PARTITION BY table_type ORDER BY table_id)
                        WHEN table_type = 'grass' THEN 'B' || ROW_NUMBER() OVER (PARTITION BY table_type ORDER BY table_id)
                        WHEN table_type = 'anniversary' THEN 'C' || ROW_NUMBER() OVER (PARTITION BY table_type ORDER BY table_id)
                        ELSE 'T' || table_id
                    END as table_name,
                    table_type,
                    table_price,
                    capacity,
                    description
                FROM tables
                WHERE restaurant_id = $1
                ORDER BY table_type, table_id;
            `;
            
            const result = await db.query(query, [restaurantId]);
            return result || [];
        } catch (error) {
            console.error('Error fetching table inventory:', error);
            return [];
        }
    }

    // Get reservations for a specific restaurant on a specific date
    static async getReservationsByDate(restaurantId, date) {
        try {
            const query = `
                SELECT 
                    r.reservation_id,
                    r.reservation_name,
                    r.reservation_email,
                    r.reservation_phone,
                    r.reservation_date,
                    r.reservation_time,
                    r.guests,
                    r.table_type,
                    r.table_id,
                    r.celebration_type,
                    r.cake,
                    r.flowers,
                    r.hotel_name,
                    t.table_name
                FROM reservation r
                LEFT JOIN tables t ON r.table_id = t.table_id
                WHERE r.restaurant_id = $1 AND r.reservation_date = $2
                ORDER BY r.reservation_time;
            `;
            
            const result = await db.query(query, [restaurantId, date]);
            return result || [];
        } catch (error) {
            console.error('Error fetching reservations by date:', error);
            return [];
        }
    }

    // Update table name
    static async updateTableName(tableId, newName) {
        try {
            // First check if table_name column exists
            let hasTableNameColumn = false;
            try {
                await db.query(`
                    SELECT table_name 
                    FROM tables 
                    WHERE table_id = $1 
                    LIMIT 1
                `, [tableId]);
                hasTableNameColumn = true;
            } catch (checkError) {
                hasTableNameColumn = false;
            }

            if (!hasTableNameColumn) {
                throw new Error('Table name editing is not available. Please update your database schema.');
            }

            const query = `
                UPDATE tables 
                SET table_name = $2
                WHERE table_id = $1
                RETURNING 
                    table_id,
                    table_name,
                    table_type,
                    table_price,
                    capacity,
                    description;
            `;
            
            const result = await db.query(query, [tableId, newName]);
            return result[0] || null;
        } catch (error) {
            console.error('Error updating table name:', error);
            throw error;
        }
    }

    // Get table types for a specific restaurant (for menu pricing agent)
    static async getTableTypes(restaurantId) {
        try {
            const query = `
                SELECT 
                    table_type,
                    table_price
                FROM tables
                WHERE restaurant_id = $1
                GROUP BY table_type, table_price
                ORDER BY table_price ASC, table_type ASC;
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
                WHERE restaurant_id = $1 AND fully_booked_date = $2;
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
                WHERE restaurant_id = $1
                ORDER BY category, price ASC;
            `;
            const result = await db.query(query, [venueId]);
            return result;
        } catch (error) {
            console.error('Error fetching menu items:', error);
            throw error;
        }
    }
    
    // Check if a table of a given type is available for a venue on a specific date and optionally time
    static async isTableAvailable({ venueId, tableType, reservationDate, reservationTime = null }) {
        try {
            // 1. Get max tables for this type from the table_type_counts view
            const invRes = await db.query(
              'SELECT total_tables FROM table_type_counts WHERE restaurant_id = $1 AND table_type = $2',
              [venueId, tableType]
            );
            if (invRes.length === 0) {
              throw new Error(`No tables of type "${tableType}" available at this restaurant.`);
            }
            const maxTables = invRes[0].total_tables;

            // 2. Get restaurant's minimum gap hours
            const restaurantRes = await db.query(
                'SELECT min_reservation_gap_hours FROM restaurant WHERE restaurant_id = $1',
                [venueId]
            );
            const minGapHours = restaurantRes[0]?.min_reservation_gap_hours || 2;

            let reservedCount = 0;

            if (reservationTime) {
                // 3. Time-specific availability check: count reservations that conflict with the gap window
                const requestedDateTime = `${reservationDate} ${reservationTime}`;
                
                // Fix: Check if the absolute time difference is less than the minimum gap
                const timeBasedQuery = `
                    SELECT COUNT(*) as count
                    FROM reservation 
                    WHERE restaurant_id = $1 
                      AND table_type = $2 
                      AND reservation_date = $3
                      AND (
                          -- Check if existing reservation is too close to the requested time
                          ABS(EXTRACT(EPOCH FROM (reservation_date + reservation_time) - $4::timestamp)) / 3600 < $5
                      )
                `;
                
                console.log(`🔍 Debug query - requested time: ${requestedDateTime}, gap: ${minGapHours}h`);
                console.log(`🔍 Debug query - conflict window: ${requestedDateTime} ± ${minGapHours} hours`);
                
                const timeRes = await db.query(timeBasedQuery, [venueId, tableType, reservationDate, requestedDateTime, minGapHours]);
                reservedCount = Number(timeRes[0].count);
                
                // Debug: Let's also see what reservations exist for this date/type
                const debugQuery = `
                    SELECT reservation_time, (reservation_date + reservation_time) as full_datetime
                    FROM reservation 
                    WHERE restaurant_id = $1 AND table_type = $2 AND reservation_date = $3
                `;
                const debugRes = await db.query(debugQuery, [venueId, tableType, reservationDate]);
                console.log(`🔍 Debug: Existing ${tableType} reservations on ${reservationDate}:`, debugRes);
                
                console.log(`🔍 Time-based availability check: ${reservedCount}/${maxTables} ${tableType} tables have conflicts within ${minGapHours}h of ${reservationTime} on ${reservationDate}`);
            } else {
                // 4. Date-only check: count all reservations for this type and date (legacy behavior)
                const dateOnlyQuery = 'SELECT COUNT(*) as count FROM reservation WHERE restaurant_id = $1 AND table_type = $2 AND reservation_date = $3';
                const dateRes = await db.query(dateOnlyQuery, [venueId, tableType, reservationDate]);
                reservedCount = Number(dateRes[0].count);
                
                console.log(`🔍 Date-only availability check: ${reservedCount}/${maxTables} ${tableType} tables reserved for entire day ${reservationDate}`);
            }

            // 5. Return true if we have available tables (no conflicts for time-based, or not fully booked for date-only)
            const available = reservedCount < maxTables;
            console.log(`${available ? '✅' : '❌'} ${tableType} tables ${available ? 'available' : 'unavailable'} - ${maxTables - reservedCount} tables free`);
            
            return available;
        } catch (error) {
            console.error('❌ Error checking table availability:', error);
            return false;
        }
    }

    // New method to check reservation gap constraints
    static async checkReservationGap(restaurantId, reservationDate, reservationTime) {
        try {
            // Get restaurant's minimum gap requirement
            const restaurantQuery = 'SELECT min_reservation_gap_hours FROM restaurant WHERE restaurant_id = $1';
            const restaurantRes = await db.query(restaurantQuery, [restaurantId]);
            
            if (restaurantRes.length === 0) {
                return { available: false, reason: 'Restaurant not found' };
            }
            
            const minGapHours = restaurantRes[0].min_reservation_gap_hours || 2;
            
            // Create the proposed reservation datetime
            const proposedDateTime = `${reservationDate} ${reservationTime}`;
            
            // Check for conflicting reservations within the gap window
            const gapCheckQuery = `
                SELECT COUNT(*) as conflicts
                FROM reservation 
                WHERE restaurant_id = $1 
                AND (
                    -- Check if existing reservation conflicts with gap window
                    (reservation_date + reservation_time) > ($2::timestamp - interval '${minGapHours} hours')
                    AND (reservation_date + reservation_time) < ($2::timestamp + interval '${minGapHours} hours')
                    AND (reservation_date + reservation_time) != $2::timestamp
                )
            `;
            
            const gapRes = await db.query(gapCheckQuery, [restaurantId, proposedDateTime]);
            const conflicts = parseInt(gapRes[0].conflicts);
            
            console.log(`🕐 Gap check: ${conflicts} conflicting reservations within ${minGapHours} hours of ${proposedDateTime}`);
            
            if (conflicts > 0) {
                return { 
                    available: false, 
                    reason: 'gap_conflict',
                    message: `Reservation conflicts with minimum gap requirement of ${minGapHours} hours. Please choose a different time.`,
                    minGapHours,
                    conflicts
                };
            }
            
            return { available: true, minGapHours };
        } catch (error) {
            console.error('❌ Error checking reservation gap:', error);
            return { available: false, reason: 'error', error: error.message };
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

      // 2. Find and assign a specific table that doesn't have gap conflicts
      const assignedTableId = await this.findAvailableTableWithGapCheck(
        venueId, 
        tableType, 
        toISODate(date), 
        time,
        guests
      );
      
      // Note: assignedTableId will be null, which is expected
      // The database trigger will handle table assignment with proper gap checking

      // 3. Insert reservation with assigned table_id
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
          restaurant_id,
          table_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
        venueId,
        assignedTableId
      ];
      const result = await db.query(query, values);
      return result[0];
    }

    // Find an available table of the specified type that doesn't have gap conflicts
    static async findAvailableTableWithGapCheck(restaurantId, tableType, reservationDate, reservationTime, partySize) {
        // KISS: Let the database trigger handle table assignment with proper gap checking
        // The assign_available_table() trigger will automatically find the lowest table_id
        // that meets all criteria including gap requirements
        
        console.log(`🔍 Using database trigger for table assignment: ${tableType} table for ${partySize} people on ${reservationDate} at ${reservationTime}`);
        
        // Return null to indicate no specific table_id should be pre-assigned
        // The database trigger will handle the assignment automatically
        return null;
    }

    // Check if a specific table has gap conflicts for the proposed time
    static async checkTableGapConflict(restaurantId, tableId, reservationDate, reservationTime, minGapHours) {
        try {
            console.log(`🔍 Gap check params: date="${reservationDate}", time="${reservationTime}"`);
            const proposedDateTime = `${reservationDate} ${reservationTime}`;
            console.log(`🔍 Proposed datetime: "${proposedDateTime}"`);
            
            // FIXED: Check for conflicting reservations using ABS to calculate actual time difference
            const gapCheckQuery = `
                SELECT COUNT(*) as conflicts
                FROM reservation 
                WHERE restaurant_id = $1 
                  AND table_id = $2
                  AND reservation_date = $3
                  AND (
                      -- Check if existing reservation conflicts with gap window using absolute time difference
                      ABS(EXTRACT(EPOCH FROM ((reservation_date + reservation_time) - $4::timestamp))) < (${minGapHours} * 3600)
                      AND (reservation_date + reservation_time) != $4::timestamp
                  )
            `;
            
            const gapRes = await db.query(gapCheckQuery, [restaurantId, tableId, reservationDate, proposedDateTime]);
            const conflicts = parseInt(gapRes[0].conflicts);
            
            console.log(`🕐 Table ${tableId} gap check: ${conflicts} conflicting reservations within ${minGapHours} hours of ${proposedDateTime}`);
            
            return conflicts > 0;
            
        } catch (error) {
            console.error('❌ Error checking table gap conflict:', error);
            return true; // Assume conflict on error for safety
        }
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
                LEFT JOIN owners o ON r.restaurant_id = o.restaurant_id
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
                LEFT JOIN owners o ON r.restaurant_id = o.restaurant_id
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
                WHERE restaurant_id = $1 AND type = 'restaurant'
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
                LEFT JOIN owners o ON r.restaurant_id = o.restaurant_id
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
    /**
     * Get available table types for a specific time using the database function
     */
    static async getAvailableTableTypesForTime(params) {
        try {
            const { restaurantId, reservationDate, reservationTime, guests } = params;
            const query = `
                SELECT table_type, table_price, capacity 
                FROM get_available_table_types($1, $2, $3, $4)
            `;
            const result = await db.query(query, [restaurantId, reservationDate, reservationTime, guests]);
            return result;
        } catch (error) {
            console.error('Error fetching available table types for time:', error);
            throw error;
        }
    }

    static async getMaxTableCapacity(restaurantId) {
        try {
            const query = `
                SELECT MAX(capacity) as max_capacity
                FROM tables
                WHERE restaurant_id = $1
            `;
            const result = await db.query(query, [restaurantId]);
            return result && result.length > 0 ? result[0].max_capacity : 0;
        } catch (error) {
            console.error('Error fetching max table capacity:', error);
            return 0;
        }
    }
    

}

export default RestaurantService;