import express from 'express';
import db from '../config/database.js';
import { authenticateToken, checkDashboardAccess } from '../middleware/auth.js';

const router = express.Router();

// Public route for restaurant info (for chat interface)
router.get('/:restaurantId/info', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);

        const [restaurants] = await db.execute(`
            SELECT 
                restaurant_id,
                name,
                address,
                email,
                phone,
                area,
                island,
                description,
                cuisine
            FROM restaurant
            WHERE restaurant_id = $1
        `, [restaurantId]);

        if (restaurants.length === 0) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        res.json(restaurants[0]);

    } catch (error) {
        console.error('Restaurant info fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant info' });
    }
});

// Public route for basic restaurant info (for dashboard)
router.get('/:restaurantId', async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);

        const [restaurants] = await db.execute(`
            SELECT 
                restaurant_id,
                name,
                address,
                email,
                phone,
                area,
                island,
                description,
                cuisine
            FROM restaurant
            WHERE restaurant_id = $1
        `, [restaurantId]);

        if (restaurants.length === 0) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        res.json(restaurants[0]);

    } catch (error) {
        console.error('Get restaurant error:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant info' });
    }
});

// Apply authentication to all other restaurant routes
router.use(authenticateToken);

// Get all tables for a restaurant
router.get('/:restaurantId/tables', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);

        // Fetch all tables for the given restaurant with real-time status
        const [tables] = await db.execute(`
            SELECT 
                table_id,
                restaurant_id,
                table_name,
                table_type,
                capacity,
                x_coordinate,
                y_coordinate,
                get_current_table_status(table_id, restaurant_id) as status
            FROM tables
            WHERE restaurant_id = $1
            ORDER BY table_type, table_name
        `, [restaurantId]);

        res.json(tables);

    } catch (error) {
        console.error('Tables fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});

// Get reservations for a specific restaurant and date
router.get('/:restaurantId/reservations', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required' });
        }

        // Get detailed reservations for the specific date
        const [reservations] = await db.execute(`
            SELECT 
                reservation_id,
                reservation_time,
                reservation_name,
                reservation_email,
                reservation_phone,
                guests,
                table_type,
                table_id,
                celebration_type,
                cake,
                cake_price,
                flowers,
                flowers_price,
                hotel_name,
                created_at,
                'confirmed' as status
            FROM reservation 
            WHERE restaurant_id = $1 AND DATE(reservation_date) = $2
            ORDER BY reservation_time
        `, [restaurantId, date]);

        // Also get the corresponding table names for reservations with table_id
        const reservationsWithTableNames = await Promise.all(
            reservations.map(async (reservation) => {
                if (reservation.table_id) {
                    const [tableResult] = await db.execute(`
                        SELECT table_name FROM tables WHERE table_id = $1
                    `, [reservation.table_id]);
                    
                    if (tableResult.length > 0) {
                        reservation.table_name = tableResult[0].table_name;
                    }
                }
                return reservation;
            })
        );

        res.json(reservationsWithTableNames);

    } catch (error) {
        console.error('Get reservations error:', error);
        res.status(500).json({ error: 'Failed to fetch reservations' });
    }
});

// Update table name
router.put('/:restaurantId/tables/:tableId', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const tableId = parseInt(req.params.tableId);
        const { table_name } = req.body;

        if (!table_name || table_name.trim() === '') {
            return res.status(400).json({ error: 'Table name is required' });
        }

        // First, verify the table belongs to this restaurant
        const [tableCheck] = await db.execute(`
            SELECT restaurant_id FROM tables WHERE table_id = $1
        `, [tableId]);

        if (tableCheck.length === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (tableCheck[0].restaurant_id !== restaurantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update the table name
        await db.execute(`
            UPDATE tables
            SET table_name = $1
            WHERE table_id = $2 AND restaurant_id = $3
        `, [table_name.trim(), tableId, restaurantId]);

        res.json({ message: 'Table name updated successfully' });

    } catch (error) {
        console.error('Update table name error:', error);
        res.status(500).json({ error: 'Failed to update table name' });
    }
});

// Update table position (for drag-and-drop)
router.put('/:restaurantId/tables/:tableId/position', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const tableId = parseInt(req.params.tableId);
        const { x, y } = req.body;

        if (typeof x === 'undefined' || typeof y === 'undefined') {
            return res.status(400).json({ error: 'Missing x or y coordinates' });
        }

        // First, verify the table belongs to this restaurant
        const [tableCheck] = await db.execute(`
            SELECT restaurant_id FROM tables WHERE table_id = $1
        `, [tableId]);

        if (tableCheck.length === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (tableCheck[0].restaurant_id !== restaurantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update the table's coordinates
        await db.execute(`
            UPDATE tables
            SET x_coordinate = $1, y_coordinate = $2
            WHERE table_id = $3 AND restaurant_id = $4
        `, [x, y, tableId, restaurantId]);

        res.json({ message: 'Table position updated successfully' });

    } catch (error) {
        console.error('Error updating table position:', error);
        res.status(500).json({ error: 'Failed to update table position' });
    }
});

// Update table status manually (e.g., mark as occupied when guests arrive)
router.put('/:restaurantId/tables/:tableId/status', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const tableId = parseInt(req.params.tableId);
        const { status } = req.body;

        // Validate status
        const validStatuses = ['available', 'occupied', 'reserved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be: available, occupied, or reserved' });
        }

        // First, verify the table belongs to this restaurant
        const [tableCheck] = await db.execute(`
            SELECT restaurant_id FROM tables WHERE table_id = $1
        `, [tableId]);

        if (tableCheck.length === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (tableCheck[0].restaurant_id !== restaurantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update the table status
        await db.execute(`
            UPDATE tables
            SET status = $1
            WHERE table_id = $2 AND restaurant_id = $3
        `, [status, tableId, restaurantId]);

        res.json({ 
            message: 'Table status updated successfully',
            tableId: tableId,
            newStatus: status
        });

    } catch (error) {
        console.error('Error updating table status:', error);
        res.status(500).json({ error: 'Failed to update table status' });
    }
});

// Occupy table for specific duration
router.put('/:restaurantId/tables/:tableId/occupy', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const tableId = parseInt(req.params.tableId);
        const { date, time, duration_hours = 2 } = req.body;

        if (!date || !time) {
            return res.status(400).json({ error: 'Date and time are required' });
        }

        // Create a temporary reservation to mark the table as occupied
        const reservationName = `Manual Occupation - ${new Date().toLocaleTimeString()}`;
        const reservationEmail = 'system@restaurant.com';
        const reservationPhone = '0000000000';

        // Get table info to determine table type
        const [tableInfo] = await db.execute(`
            SELECT table_type, table_name FROM tables 
            WHERE table_id = $1 AND restaurant_id = $2
        `, [tableId, restaurantId]);

        if (tableInfo.length === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Insert a system reservation that will control the table status
        await db.execute(`
            INSERT INTO reservation (
                reservation_name, reservation_email, reservation_phone,
                reservation_date, reservation_time, guests, table_type,
                table_id, restaurant_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, NOW())
        `, [
            reservationName, reservationEmail, reservationPhone,
            date, time, tableInfo[0].table_type, tableId, restaurantId
        ]);

        res.json({ 
            message: 'Table marked as occupied successfully',
            tableId: tableId,
            tableName: tableInfo[0].table_name,
            occupiedUntil: `${date} ${time}`,
            duration: `${duration_hours} hours`
        });

    } catch (error) {
        console.error('Error occupying table:', error);
        res.status(500).json({ error: 'Failed to mark table as occupied' });
    }
});

// Cleanup expired reservations
router.post('/:restaurantId/cleanup-reservations', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        
        // Run the cleanup function
        await db.execute('SELECT cleanup_expired_reservations()');
        
        // Get updated table status
        const [tables] = await db.execute(`
            SELECT 
                table_id,
                table_name,
                get_current_table_status(table_id, restaurant_id) as status
            FROM tables
            WHERE restaurant_id = $1
            ORDER BY table_name
        `, [restaurantId]);

        res.json({ 
            message: 'Cleanup completed successfully',
            updatedTables: tables.length,
            tables: tables
        });

    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ error: 'Failed to cleanup reservations' });
    }
});


export default router;