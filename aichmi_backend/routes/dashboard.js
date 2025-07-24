import express from 'express';
import db from '../config/database.js';
import { authenticateToken, checkDashboardAccess } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Tier 1: At-a-Glance Live Dashboard
router.get('/tier1/:restaurantId', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const today = new Date().toISOString().split('T')[0];
        
        // Today's reservations and guests
        const [todayStats] = await db.execute(`
            SELECT 
                COUNT(*) as reservations_today,
                COALESCE(SUM(guests), 0) as total_guests_today
            FROM reservation 
            WHERE restaurant_id = $1 AND DATE(reservation_date) = $2
        `, [restaurantId, today]);

        // Get restaurant capacity for occupancy calculation
        const [capacityResult] = await db.execute(`
            SELECT COALESCE(SUM(capacity), 0) as total_capacity 
            FROM restaurant_table_types 
            WHERE restaurant_id = $1
        `, [restaurantId]);

        const totalCapacity = capacityResult[0]?.total_capacity || 100; // Default fallback
        const projectedOccupancy = Math.min((todayStats[0].total_guests_today / totalCapacity) * 100, 100);

        // Next 7 days demand
        const [weeklyDemand] = await db.execute(`
            SELECT 
                DATE(reservation_date) as date,
                COUNT(*) as reservation_count
            FROM reservation 
            WHERE restaurant_id = $1 
                AND reservation_date >= CURDATE() 
                AND reservation_date < DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(reservation_date)
            ORDER BY reservation_date
        `, [restaurantId]);

        // Recent large parties and celebrations
        const [alerts] = await db.execute(`
            SELECT 
                reservation_name,
                guests,
                reservation_time,
                celebration_type,
                cake,
                flowers,
                created_at
            FROM reservation 
            WHERE restaurant_id = $1
                AND (guests >= 6 OR celebration_type != 'none' OR cake = true OR flowers = true)
                AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY created_at DESC
            LIMIT 10
        `, [restaurantId]);

        res.json({
            todaySnapshot: {
                reservationsToday: todayStats[0].reservations_today,
                totalGuestsToday: todayStats[0].total_guests_today,
                projectedOccupancy: Math.round(projectedOccupancy)
            },
            weeklyDemand,
            alerts: alerts.map(alert => ({
                type: alert.guests >= 6 ? 'large_party' : 'celebration',
                message: alert.guests >= 6 
                    ? `Large party booking: ${alert.guests} people by '${alert.reservation_name}'`
                    : `${alert.celebration_type} booking with ${alert.cake ? 'Cake' : ''}${alert.cake && alert.flowers ? ' and ' : ''}${alert.flowers ? 'Flowers' : ''} by '${alert.reservation_name}'`,
                timestamp: alert.created_at
            }))
        });

    } catch (error) {
        console.error('Tier 1 dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Tier 2: Performance & Revenue Analytics
router.get('/tier2/:restaurantId', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { period = '30' } = req.query; // days

        // Reservation trends over time
        const [reservationTrends] = await db.execute(`
            SELECT 
                DATE(reservation_date) as date,
                COUNT(*) as reservation_count,
                SUM(guests) as guest_count
            FROM reservation 
            WHERE restaurant_id = $1 
                AND reservation_date >= DATE_SUB(CURDATE(), INTERVAL $2 DAY)
            GROUP BY DATE(reservation_date)
            ORDER BY reservation_date
        `, [restaurantId, parseInt(period)]);

        // Peak performance heatmap (day of week vs hour)
        const [heatmapData] = await db.execute(`
            SELECT 
                DAYOFWEEK(reservation_date) as day_of_week,
                HOUR(reservation_time) as hour,
                COUNT(*) as booking_count
            FROM reservation 
            WHERE restaurant_id = $1
                AND reservation_date >= DATE_SUB(CURDATE(), INTERVAL $2 DAY)
            GROUP BY DAYOFWEEK(reservation_date), HOUR(reservation_time)
        `, [restaurantId, parseInt(period)]);

        // Revenue from add-ons
        const [addOnRevenue] = await db.execute(`
            SELECT 
                COUNT(CASE WHEN cake = true THEN 1 END) as cake_orders,
                COUNT(CASE WHEN flowers = true THEN 1 END) as flower_orders,
                SUM(CASE WHEN cake = true THEN cake_price ELSE 0 END) as cake_revenue,
                SUM(CASE WHEN flowers = true THEN flowers_price ELSE 0 END) as flower_revenue
            FROM reservation 
            WHERE restaurant_id = $1
                AND reservation_date >= DATE_SUB(CURDATE(), INTERVAL $2 DAY)
        `, [restaurantId, parseInt(period)]);

        // Booking lead time analysis
        const [leadTimeData] = await db.execute(`
            SELECT 
                CASE 
                    WHEN DATEDIFF(reservation_date, created_at) <= 1 THEN '0-1 days'
                    WHEN DATEDIFF(reservation_date, created_at) <= 7 THEN '2-7 days'
                    WHEN DATEDIFF(reservation_date, created_at) <= 14 THEN '8-14 days'
                    ELSE '15+ days'
                END as lead_time_category,
                COUNT(*) as booking_count
            FROM reservation 
            WHERE restaurant_id = $1
                AND created_at >= DATE_SUB(NOW(), INTERVAL $2 DAY)
            GROUP BY lead_time_category
        `, [restaurantId, parseInt(period)]);

        res.json({
            reservationTrends,
            heatmapData,
            addOnRevenue: addOnRevenue[0],
            leadTimeData
        });

    } catch (error) {
        console.error('Tier 2 dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

// Tier 3: Customer & Menu Insights
router.get('/tier3/:restaurantId', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const { period = '30' } = req.query;

        // Celebration types breakdown
        const [celebrationStats] = await db.execute(`
            SELECT 
                celebration_type,
                COUNT(*) as count
            FROM reservation 
            WHERE restaurant_id = $1 
                AND celebration_type != 'none'
                AND reservation_date >= DATE_SUB(CURDATE(), INTERVAL $2 DAY)
            GROUP BY celebration_type
            ORDER BY count DESC
        `, [restaurantId, parseInt(period)]);

        // Hotel transfer requests (if available)
        const [hotelStats] = await db.execute(`
            SELECT 
                hotel_name,
                COUNT(*) as request_count
            FROM reservation 
            WHERE restaurant_id = $1 
                AND hotel_name IS NOT NULL
                AND reservation_date >= DATE_SUB(CURDATE(), INTERVAL $2 DAY)
            GROUP BY hotel_name
            ORDER BY request_count DESC
            LIMIT 10
        `, [restaurantId, parseInt(period)]);

        res.json({
            celebrationStats,
            hotelStats,
            // Note: Semantic query analysis and dietary trends would require chat log data
            // which we'll implement when we have the chat logging system in place
            semanticInsights: {
                message: "Semantic analysis requires chat log data - coming soon"
            },
            dietaryTrends: {
                message: "Dietary trends analysis requires chat log data - coming soon"
            }
        });

    } catch (error) {
        console.error('Tier 3 dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch customer insights' });
    }
});

// Tier 4: AI & Operational Performance
router.get('/tier4/:restaurantId', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        
        // For now, return placeholder data since we need to implement chat logging
        res.json({
            botInteractionVolume: {
                totalQueries: 0,
                message: "Chat logging system needed for accurate metrics"
            },
            agentUsageBreakdown: {
                message: "Agent usage tracking requires chat log implementation"
            },
            missedOpportunities: {
                message: "Failed query tracking requires enhanced logging"
            }
        });

    } catch (error) {
        console.error('Tier 4 dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch AI performance data' });
    }
});

// Get user info for dashboard header
router.get('/user-info', async (req, res) => {
    try {
        const [owners] = await db.execute(
            'SELECT restaurant_id, email FROM owners WHERE id = $1',
            [req.user.id]
        );

        if (owners.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = req.user.id;
        
        // Determine if user is admin (ONLY user ID 6 - Sotiris)
        const isAdmin = userId === 6;

        res.json({
            restaurantId: owners[0].restaurant_id,
            role: isAdmin ? 'admin' : 'owner',
            userId: req.user.id
        });
        
    } catch (error) {
        console.error('User info error:', error);
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});

export default router;