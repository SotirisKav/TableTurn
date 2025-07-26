import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

function Dashboard() {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('tier1');
    const [dashboardData, setDashboardData] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [restaurantInfo, setRestaurantInfo] = useState(null);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('accessToken');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const response = await fetch('/api/dashboard/user-info', {
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Please log in to access the dashboard.');
                    }
                    throw new Error('Failed to fetch user info');
                }
                
                const data = await response.json();
                setUserInfo(data);

                // Check if user has access to this restaurant
                if (data.role !== 'admin' && data.restaurantId !== parseInt(restaurantId)) {
                    setError('Access denied. You can only view your own restaurant dashboard.');
                    return;
                }

                // Fetch restaurant info
                const restaurantResponse = await fetch(`/api/restaurants/${restaurantId}`);
                if (restaurantResponse.ok) {
                    const restaurantData = await restaurantResponse.json();
                    setRestaurantInfo(restaurantData);
                }
                
            } catch (err) {
                setError(err.message);
            }
        };

        fetchUserInfo();
    }, [restaurantId]);

    const fetchDashboardData = useCallback(async (tier) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/dashboard/${tier}/${restaurantId}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in.');
                }
                throw new Error(`Failed to fetch ${tier} data: ${response.status}`);
            }

            const data = await response.json();
            console.log('Dashboard data received:', data); // Debug log
            setDashboardData(data);
        } catch (err) {
            console.error('Dashboard fetch error:', err); // Debug log
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        if (userInfo && !error) {
            fetchDashboardData(activeTab);
        }
    }, [activeTab, userInfo, error, fetchDashboardData]);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };


    const renderTier1Dashboard = () => {
        if (!dashboardData) return null;

        const { 
            upcomingReservations = {}, 
            liveStatus = {}, 
            alerts = [],
            weeklyDemand = [] // Legacy compatibility
        } = dashboardData;

        const formatTime = (timeString) => {
            if (!timeString) return '';
            const time = new Date(`1970-01-01T${timeString}`);
            return time.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        };

        return (
            <div className="dashboard-tier1">
                {/* Header Status Bar */}
                <div className="live-status-header">
                    <div className="status-indicators">
                        <div className="status-item">
                            <span className="status-label">Current Covers</span>
                            <span className="status-value">{liveStatus?.todayMetrics?.covers || 0}</span>
                        </div>
                        <div className="status-item">
                            <span className="status-label">Available Tables</span>
                            <span className="status-value available">{liveStatus?.tableStatus?.available || 0}</span>
                        </div>
                        <div className="status-item">
                            <span className="status-label">Today's Revenue</span>
                            <span className="status-value">€{liveStatus?.todayMetrics?.estimatedRevenue || 0}</span>
                        </div>
                        <div className="status-item">
                            <span className="status-label">Occupancy</span>
                            <span className="status-value">{liveStatus?.todayMetrics?.projectedOccupancy || 0}%</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-main-layout">
                    {/* Left Column: Reservation Management */}
                    <div className="reservation-management">
                        <div className="section-header">
                            <h3>📅 Upcoming Reservations</h3>
                            <div className="today-summary">
                                <span>{upcomingReservations?.today?.totalReservations || 0} reservations</span>
                                <span>•</span>
                                <span>{upcomingReservations?.today?.totalCovers || 0} covers</span>
                            </div>
                        </div>

                        {/* Today's Timeline */}
                        <div className="reservation-timeline">
                            <h4>Today ({upcomingReservations?.today?.date})</h4>
                            <div className="timeline-slots">
                                {upcomingReservations?.today?.timeSlots && Object.keys(upcomingReservations.today.timeSlots).length > 0 ? 
                                    Object.entries(upcomingReservations.today.timeSlots).map(([timeSlot, data]) => (
                                        <div key={timeSlot} className="time-slot">
                                            <div className="time-slot-header">
                                                <span className="time">{timeSlot}</span>
                                                <div className="slot-summary">
                                                    <span>{data.tables} tables</span>
                                                    <span>•</span>
                                                    <span>{data.guests} guests</span>
                                                </div>
                                            </div>
                                            <div className="reservations-list">
                                                {data.reservations.map((reservation, idx) => (
                                                    <div key={idx} className="reservation-item">
                                                        <div className="reservation-details">
                                                            <span className="guest-name">{reservation.name}</span>
                                                            <span className="party-size">Party of {reservation.guests}</span>
                                                            {reservation.table && <span className="table">Table {reservation.table}</span>}
                                                        </div>
                                                        {reservation.celebration !== 'none' && (
                                                            <div className="celebration-badge">{reservation.celebration}</div>
                                                        )}
                                                        {reservation.requests && (
                                                            <div className="special-requests">{reservation.requests}</div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="no-reservations">No reservations scheduled for today</div>
                                    )
                                }
                            </div>
                        </div>

                        {/* 7-Day Outlook */}
                        <div className="weekly-outlook">
                            <h4>Next 7 Days</h4>
                            <div className="week-bars">
                                {upcomingReservations?.nextSevenDays?.map((day, index) => (
                                    <div key={index} className="day-bar">
                                        <div className="bar" style={{height: `${Math.max(day.reservation_count * 8, 15)}px`}}>
                                            <span className="bar-value">{day.reservation_count}</span>
                                        </div>
                                        <div className="day-info">
                                            <div className="day-date">{formatDate(day.date)}</div>
                                            <div className="day-covers">{day.total_covers} covers</div>
                                        </div>
                                    </div>
                                )) || weeklyDemand.map((day, index) => ( // Legacy fallback
                                    <div key={index} className="day-bar">
                                        <div className="bar" style={{height: `${Math.max(day.reservation_count * 8, 15)}px`}}>
                                            <span className="bar-value">{day.reservation_count}</span>
                                        </div>
                                        <div className="day-info">
                                            <div className="day-date">{formatDate(day.date)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Center Column: Live Operations */}
                    <div className="live-operations">
                        <div className="section-header">
                            <h3>🏪 Current Status</h3>
                            <div className="last-updated">
                                Updated: {liveStatus?.currentTime ? new Date(liveStatus.currentTime).toLocaleTimeString() : 'N/A'}
                            </div>
                        </div>

                        {/* Table Status */}
                        <div className="table-status-grid">
                            <div className="status-card available">
                                <div className="status-number">{liveStatus?.tableStatus?.available || 0}</div>
                                <div className="status-label">Available</div>
                            </div>
                            <div className="status-card occupied">
                                <div className="status-number">{liveStatus?.tableStatus?.occupied || 0}</div>
                                <div className="status-label">Occupied</div>
                            </div>
                            <div className="status-card reserved">
                                <div className="status-number">{liveStatus?.tableStatus?.reserved || 0}</div>
                                <div className="status-label">Reserved</div>
                            </div>
                            <div className="status-card cleaning">
                                <div className="status-number">{liveStatus?.tableStatus?.cleaning || 0}</div>
                                <div className="status-label">Cleaning</div>
                            </div>
                        </div>

                        {/* Today's Performance */}
                        <div className="performance-metrics">
                            <h4>💰 Today's Performance</h4>
                            <div className="metrics-grid">
                                <div className="metric">
                                    <span className="metric-label">Sales</span>
                                    <span className="metric-value">€{liveStatus?.todayMetrics?.estimatedRevenue || 0}</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Avg Party</span>
                                    <span className="metric-value">{liveStatus?.todayMetrics?.avgPartySize || 0}</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Add-ons</span>
                                    <span className="metric-value">€{liveStatus?.todayMetrics?.addonRevenue || 0}</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Recent Bookings</span>
                                    <span className="metric-value">{liveStatus?.operationalInsights?.recentBookings || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Alerts & KPIs */}
                    <div className="alerts-kpis">
                        <div className="section-header">
                            <h3>📊 Key Metrics</h3>
                        </div>

                        {/* Quick KPIs */}
                        <div className="kpi-cards">
                            <div className="kpi-card revenue">
                                <div className="kpi-label">Revenue</div>
                                <div className="kpi-value">€{liveStatus?.todayMetrics?.estimatedRevenue || 0}</div>
                                <div className="kpi-change">+12% vs yesterday</div>
                            </div>
                            <div className="kpi-card covers">
                                <div className="kpi-label">Covers</div>
                                <div className="kpi-value">{liveStatus?.todayMetrics?.covers || 0}</div>
                                <div className="kpi-change">+8% vs yesterday</div>
                            </div>
                            <div className="kpi-card occupancy">
                                <div className="kpi-label">Occupancy</div>
                                <div className="kpi-value">{liveStatus?.todayMetrics?.projectedOccupancy || 0}%</div>
                                <div className="kpi-target">Target: 75%</div>
                            </div>
                        </div>

                        {/* Alerts Section */}
                        <div className="alerts-section">
                            <h4>⚠️ Alerts & Notifications</h4>
                            <div className="alerts-list">
                                {alerts && alerts.length > 0 ? alerts.map((alert, index) => (
                                    <div key={index} className={`alert alert-${alert.priority || alert.type}`}>
                                        <div className="alert-header">
                                            <span className="alert-title">{alert.title || 'Alert'}</span>
                                            <span className="alert-time">
                                                {alert.date && alert.time ? 
                                                    `${formatDate(alert.date)} ${formatTime(alert.time)}` : 
                                                    new Date(alert.timestamp).toLocaleString()
                                                }
                                            </span>
                                        </div>
                                        <div className="alert-message">{alert.message}</div>
                                    </div>
                                )) : (
                                    <div className="no-alerts">✅ No active alerts</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTier2Dashboard = () => {
        if (!dashboardData) return null;

        const { reservationTrends = [], heatmapData = [], addOnRevenue = {}, leadTimeData = [] } = dashboardData;

        return (
            <div className="dashboard-tier2">
                <div className="analytics-grid">
                    <div className="analytics-card">
                        <h3>Reservation Trends</h3>
                        <div className="trends-chart">
                            {reservationTrends && reservationTrends.length > 0 ? reservationTrends.map((trend, index) => (
                                <div key={index} className="trend-item">
                                    <div className="trend-date">{formatDate(trend.date)}</div>
                                    <div className="trend-stats">
                                        <span>Reservations: {trend.reservation_count}</span>
                                        <span>Guests: {trend.guest_count}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="no-data">No reservation trend data available</div>
                            )}
                        </div>
                    </div>

                    <div className="analytics-card">
                        <h3>Add-on Revenue</h3>
                        <div className="revenue-stats">
                            <div className="revenue-item">
                                <span>Cake Orders: {addOnRevenue?.cake_orders || 0}</span>
                                <span>Revenue: €{addOnRevenue?.cake_revenue || 0}</span>
                            </div>
                            <div className="revenue-item">
                                <span>Flower Orders: {addOnRevenue?.flower_orders || 0}</span>
                                <span>Revenue: €{addOnRevenue?.flower_revenue || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="analytics-card">
                        <h3>Booking Lead Time</h3>
                        <div className="lead-time-chart">
                            {leadTimeData && leadTimeData.length > 0 ? leadTimeData.map((item, index) => (
                                <div key={index} className="lead-time-item">
                                    <div className="lead-time-category">{item.lead_time_category}</div>
                                    <div className="lead-time-count">{item.booking_count} bookings</div>
                                </div>
                            )) : (
                                <div className="no-data">No lead time data available</div>
                            )}
                        </div>
                    </div>

                    <div className="analytics-card">
                        <h3>Peak Performance Heatmap</h3>
                        <div className="heatmap-info">
                            <p>Most popular booking times:</p>
                            {heatmapData && heatmapData.length > 0 ? heatmapData.slice(0, 5).map((item, index) => (
                                <div key={index} className="heatmap-item">
                                    Day {item.day_of_week}, {item.hour}:00 - {item.booking_count} bookings
                                </div>
                            )) : (
                                <div className="no-data">No heatmap data available</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTier3Dashboard = () => {
        if (!dashboardData) return null;

        const { celebrationStats = [], hotelStats = [], semanticInsights = {}, dietaryTrends = {} } = dashboardData;

        return (
            <div className="dashboard-tier3">
                <div className="insights-grid">
                    <div className="insights-card">
                        <h3>Celebration Types</h3>
                        <div className="celebration-stats">
                            {celebrationStats && celebrationStats.length > 0 ? celebrationStats.map((stat, index) => (
                                <div key={index} className="celebration-item">
                                    <span className="celebration-type">{stat.celebration_type}</span>
                                    <span className="celebration-count">{stat.count}</span>
                                </div>
                            )) : (
                                <div className="no-data">No celebration data available</div>
                            )}
                        </div>
                    </div>

                    <div className="insights-card">
                        <h3>Top Hotel Transfer Requests</h3>
                        <div className="hotel-stats">
                            {hotelStats.length > 0 ? hotelStats.map((hotel, index) => (
                                <div key={index} className="hotel-item">
                                    <span className="hotel-name">{hotel.hotel_name}</span>
                                    <span className="hotel-count">{hotel.request_count} requests</span>
                                </div>
                            )) : (
                                <div className="no-data">No hotel transfer data available</div>
                            )}
                        </div>
                    </div>

                    <div className="insights-card">
                        <h3>Semantic Query Analysis</h3>
                        <div className="semantic-info">
                            <p>{semanticInsights?.message || 'No data available'}</p>
                        </div>
                    </div>

                    <div className="insights-card">
                        <h3>Dietary Trends</h3>
                        <div className="dietary-info">
                            <p>{dietaryTrends?.message || 'No data available'}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTier4Dashboard = () => {
        if (!dashboardData) return null;

        const { botInteractionVolume = {}, agentUsageBreakdown = {}, missedOpportunities = {} } = dashboardData;

        return (
            <div className="dashboard-tier4">
                <div className="ai-performance-grid">
                    <div className="performance-card">
                        <h3>Bot Interaction Volume</h3>
                        <div className="interaction-stats">
                            <div className="interaction-number">{botInteractionVolume?.totalQueries || 0}</div>
                            <div className="interaction-message">{botInteractionVolume?.message || 'No data available'}</div>
                        </div>
                    </div>

                    <div className="performance-card">
                        <h3>Agent Usage Breakdown</h3>
                        <div className="agent-info">
                            <p>{agentUsageBreakdown?.message || 'No data available'}</p>
                        </div>
                    </div>

                    <div className="performance-card">
                        <h3>Missed Opportunities</h3>
                        <div className="missed-info">
                            <p>{missedOpportunities?.message || 'No data available'}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (error) {
        return (
            <div className="dashboard-error">
                <h2>Access Denied</h2>
                <p>{error}</p>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    if (loading) {
        return <div className="dashboard-loading">Loading dashboard...</div>;
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="dashboard-title">
                    <h1>{restaurantInfo ? restaurantInfo.name : 'Restaurant Dashboard'}</h1>
                    {restaurantInfo && (
                        <p className="restaurant-subtitle">{restaurantInfo.area}, {restaurantInfo.island}</p>
                    )}
                </div>
                {userInfo && (
                    <div className="dashboard-user-info">
                        {userInfo.role === 'admin' && <span className="admin-badge">Admin View</span>}
                        {userInfo.role === 'admin' && (
                            <button 
                                onClick={() => navigate('/dashboard')} 
                                className="back-to-selector-btn"
                            >
                                ← Back to Restaurant Selector
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="dashboard-tabs">
                <button 
                    className={activeTab === 'tier1' ? 'active' : ''} 
                    onClick={() => setActiveTab('tier1')}
                >
                    Live Dashboard
                </button>
                <button 
                    className={activeTab === 'tier2' ? 'active' : ''} 
                    onClick={() => setActiveTab('tier2')}
                >
                    Analytics
                </button>
                <button 
                    className={activeTab === 'tier3' ? 'active' : ''} 
                    onClick={() => setActiveTab('tier3')}
                >
                    Customer Insights
                </button>
                <button 
                    className={activeTab === 'tier4' ? 'active' : ''} 
                    onClick={() => setActiveTab('tier4')}
                >
                    AI Performance
                </button>
            </div>

            <div className="dashboard-content">
                {activeTab === 'tier1' && renderTier1Dashboard()}
                {activeTab === 'tier2' && renderTier2Dashboard()}
                {activeTab === 'tier3' && renderTier3Dashboard()}
                {activeTab === 'tier4' && renderTier4Dashboard()}
            </div>
        </div>
    );
}

export default Dashboard;