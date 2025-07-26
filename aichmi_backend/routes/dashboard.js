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
        const now = new Date();
        
        // Today's reservations with detailed breakdown
        const [todayReservations] = await db.execute(`
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
        `, [restaurantId, today]);

        // Current table status (mock data for now since tables table may not exist)
        const tableStatus = [{
            total_tables: 20,
            available_tables: 8,
            occupied_tables: 10,
            reserved_tables: 2,
            cleaning_tables: 0
        }];

        // Today's sales performance
        const [salesData] = await db.execute(`
            SELECT 
                COUNT(*) as total_reservations,
                COALESCE(SUM(guests), 0) as total_covers,
                COALESCE(AVG(guests), 0) as avg_party_size,
                0 as addon_revenue
            FROM reservation 
            WHERE restaurant_id = $1 AND DATE(reservation_date) = $2
        `, [restaurantId, today]);

        // Upcoming reservations by time slot
        const timeSlots = {};
        todayReservations.forEach(res => {
            const hour = new Date(`1970-01-01T${res.reservation_time}`).getHours();
            const timeSlot = `${hour}:00`;
            if (!timeSlots[timeSlot]) {
                timeSlots[timeSlot] = { tables: 0, guests: 0, reservations: [] };
            }
            timeSlots[timeSlot].tables += 1;
            timeSlots[timeSlot].guests += res.guests;
            timeSlots[timeSlot].reservations.push({
                name: res.reservation_name,
                guests: res.guests,
                table: res.table_id,
                requests: null,
                celebration: res.celebration_type || 'none',
                status: res.status
            });
        });

        // Next 7 days detailed reservations
        const [weeklyReservations] = await db.execute(`
            SELECT 
                DATE(reservation_date) as date,
                COUNT(*) as reservation_count,
                SUM(guests) as total_covers
            FROM reservation 
            WHERE restaurant_id = $1 
                AND reservation_date >= CURRENT_DATE 
                AND reservation_date < CURRENT_DATE + INTERVAL '7 days'
            GROUP BY DATE(reservation_date)
            ORDER BY reservation_date
        `, [restaurantId]);

        // Live operational metrics
        const [operationalMetrics] = await db.execute(`
            SELECT 
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_bookings,
                AVG(EXTRACT(EPOCH FROM (reservation_date - created_at))/86400) as avg_lead_time_days
            FROM reservation 
            WHERE restaurant_id = $1 AND reservation_date >= CURRENT_DATE
        `, [restaurantId]);

        // Critical alerts and notifications - simplified for compatibility
        const [largePartyAlerts] = await db.execute(`
            SELECT 
                reservation_name,
                guests,
                reservation_time,
                reservation_date
            FROM reservation 
            WHERE restaurant_id = $1
                AND guests >= 8
                AND reservation_date >= CURRENT_DATE
                AND reservation_date <= CURRENT_DATE + INTERVAL '3 days'
            ORDER BY reservation_date, reservation_time
            LIMIT 5
        `, [restaurantId]);

        const [celebrationAlerts] = await db.execute(`
            SELECT 
                reservation_name,
                celebration_type,
                reservation_time,
                reservation_date,
                cake,
                flowers
            FROM reservation 
            WHERE restaurant_id = $1
                AND celebration_type != 'none'
                AND reservation_date >= CURRENT_DATE
                AND reservation_date <= CURRENT_DATE + INTERVAL '2 days'
            ORDER BY reservation_date, reservation_time
            LIMIT 5
        `, [restaurantId]);

        // Combine alerts
        const criticalAlerts = [
            ...largePartyAlerts.map(alert => ({
                alert_type: 'large_party',
                title: 'Large Party Alert',
                message: `${alert.reservation_name} - ${alert.guests} guests at ${alert.reservation_time}`,
                reservation_date: alert.reservation_date,
                reservation_time: alert.reservation_time,
                priority: 'high'
            })),
            ...celebrationAlerts.map(alert => ({
                alert_type: 'celebration',
                title: 'Special Celebration',
                message: `${alert.celebration_type} for ${alert.reservation_name}${alert.cake ? ' (Cake requested)' : ''}${alert.flowers ? ' (Flowers requested)' : ''}`,
                reservation_date: alert.reservation_date,
                reservation_time: alert.reservation_time,
                priority: 'medium'
            }))
        ];

        // Calculate key metrics
        const totalCapacity = tableStatus[0]?.total_tables || 20;
        const todayCovers = salesData[0]?.total_covers || 0;
        const projectedOccupancy = Math.min((todayCovers / (totalCapacity * 4)) * 100, 100); // Assuming 4 turns per day
        const avgCheckSize = 45; // This would come from actual sales data when available

        res.json({
            // Main reservation timeline data
            upcomingReservations: {
                today: {
                    date: today,
                    totalReservations: todayReservations.length,
                    totalCovers: todayCovers,
                    timeSlots: timeSlots
                },
                nextSevenDays: weeklyReservations
            },
            
            // Live operational status
            liveStatus: {
                currentTime: now.toISOString(),
                tableStatus: {
                    total: tableStatus[0]?.total_tables || 0,
                    available: tableStatus[0]?.available_tables || 0,
                    occupied: tableStatus[0]?.occupied_tables || 0,
                    reserved: tableStatus[0]?.reserved_tables || 0,
                    cleaning: tableStatus[0]?.cleaning_tables || 0
                },
                todayMetrics: {
                    reservations: salesData[0]?.total_reservations || 0,
                    covers: todayCovers,
                    avgPartySize: Math.round(salesData[0]?.avg_party_size || 0),
                    addonRevenue: salesData[0]?.addon_revenue || 0,
                    estimatedRevenue: (todayCovers * avgCheckSize),
                    projectedOccupancy: Math.round(projectedOccupancy)
                },
                operationalInsights: {
                    recentBookings: operationalMetrics[0]?.recent_bookings || 0,
                    avgLeadTime: Math.round(operationalMetrics[0]?.avg_lead_time_days || 0)
                }
            },
            
            // Alerts and notifications
            alerts: criticalAlerts.map(alert => ({
                type: alert.alert_type,
                title: alert.title,
                message: alert.message,
                date: alert.reservation_date,
                time: alert.reservation_time,
                priority: alert.priority,
                timestamp: new Date().toISOString()
            })),
            
            // Legacy compatibility
            todaySnapshot: {
                reservationsToday: salesData[0]?.total_reservations || 0,
                totalGuestsToday: todayCovers,
                projectedOccupancy: Math.round(projectedOccupancy)
            },
            weeklyDemand: weeklyReservations
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
                AND reservation_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(reservation_date)
            ORDER BY reservation_date
        `, [restaurantId]);

        // Peak performance heatmap (day of week vs hour)
        const [heatmapData] = await db.execute(`
            SELECT 
                EXTRACT(DOW FROM reservation_date) as day_of_week,
                EXTRACT(HOUR FROM reservation_time) as hour,
                COUNT(*) as booking_count
            FROM reservation 
            WHERE restaurant_id = $1
                AND reservation_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY EXTRACT(DOW FROM reservation_date), EXTRACT(HOUR FROM reservation_time)
        `, [restaurantId]);

        // Revenue from add-ons
        const [addOnRevenue] = await db.execute(`
            SELECT 
                COUNT(CASE WHEN cake = true THEN 1 END) as cake_orders,
                COUNT(CASE WHEN flowers = true THEN 1 END) as flower_orders,
                SUM(CASE WHEN cake = true THEN cake_price ELSE 0 END) as cake_revenue,
                SUM(CASE WHEN flowers = true THEN flowers_price ELSE 0 END) as flower_revenue
            FROM reservation 
            WHERE restaurant_id = $1
                AND reservation_date >= CURRENT_DATE - INTERVAL '30 days'
        `, [restaurantId]);

        // Booking lead time analysis
        const [leadTimeData] = await db.execute(`
            SELECT 
                CASE 
                    WHEN (reservation_date - DATE(created_at)) <= 1 THEN '0-1 days'
                    WHEN (reservation_date - DATE(created_at)) <= 7 THEN '2-7 days'
                    WHEN (reservation_date - DATE(created_at)) <= 14 THEN '8-14 days'
                    ELSE '15+ days'
                END as lead_time_category,
                COUNT(*) as booking_count
            FROM reservation 
            WHERE restaurant_id = $1
                AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY lead_time_category
        `, [restaurantId]);

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
                AND reservation_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY celebration_type
            ORDER BY count DESC
        `, [restaurantId]);

        // Hotel transfer requests (if available)
        const [hotelStats] = await db.execute(`
            SELECT 
                hotel_name,
                COUNT(*) as request_count
            FROM reservation 
            WHERE restaurant_id = $1 
                AND hotel_name IS NOT NULL
                AND reservation_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY hotel_name
            ORDER BY request_count DESC
            LIMIT 10
        `, [restaurantId]);

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
        
        // Determine if user is admin (ONLY user ID 1 - Sotiris)
        const isAdmin = userId === 1;

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

// Get reservations for a specific date
router.get('/reservations/:restaurantId/:date', checkDashboardAccess, async (req, res) => {
    try {
        const restaurantId = parseInt(req.params.restaurantId);
        const requestedDate = req.params.date;
        
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
        `, [restaurantId, requestedDate]);

        // Group by time slots for better organization
        const timeSlots = {};
        reservations.forEach(res => {
            const hour = new Date(`1970-01-01T${res.reservation_time}`).getHours();
            const timeSlot = `${hour}:00`;
            if (!timeSlots[timeSlot]) {
                timeSlots[timeSlot] = { tables: 0, guests: 0, reservations: [] };
            }
            timeSlots[timeSlot].tables += 1;
            timeSlots[timeSlot].guests += res.guests;
            timeSlots[timeSlot].reservations.push({
                id: res.reservation_id,
                name: res.reservation_name,
                email: res.reservation_email,
                phone: res.reservation_phone,
                guests: res.guests,
                table_type: res.table_type,
                table: res.table_id,
                celebration: res.celebration_type || 'none',
                cake: res.cake,
                cake_price: res.cake_price,
                flowers: res.flowers,
                flowers_price: res.flowers_price,
                hotel_name: res.hotel_name,
                status: res.status,
                created_at: res.created_at,
                time: res.reservation_time
            });
        });

        res.json({
            date: requestedDate,
            totalReservations: reservations.length,
            totalGuests: reservations.reduce((sum, r) => sum + r.guests, 0),
            timeSlots: timeSlots,
            allReservations: reservations.map(r => ({
                id: r.reservation_id,
                name: r.reservation_name,
                email: r.reservation_email,
                phone: r.reservation_phone,
                guests: r.guests,
                table_type: r.table_type,
                table: r.table_id,
                celebration: r.celebration_type || 'none',
                cake: r.cake,
                cake_price: r.cake_price,
                flowers: r.flowers,
                flowers_price: r.flowers_price,
                hotel_name: r.hotel_name,
                status: r.status,
                created_at: r.created_at,
                time: r.reservation_time
            }))
        });

    } catch (error) {
        console.error('Get reservations error:', error);
        res.status(500).json({ error: 'Failed to fetch reservations' });
    }
});

export default router;