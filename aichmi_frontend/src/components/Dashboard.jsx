import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function Dashboard() {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('tier1');
    const [dashboardData, setDashboardData] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

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
                    throw new Error('Failed to fetch user info');
                }
                
                const data = await response.json();
                setUserInfo(data);

                // Check if user has access to this restaurant
                if (data.role !== 'admin' && data.restaurantId !== parseInt(restaurantId)) {
                    setError('Access denied. You can only view your own restaurant dashboard.');
                    return;
                }
                
            } catch (err) {
                setError(err.message);
            }
        };

        fetchUserInfo();
    }, [restaurantId]);

    useEffect(() => {
        if (userInfo && !error) {
            fetchDashboardData(activeTab);
        }
    }, [activeTab, userInfo, restaurantId]);

    const fetchDashboardData = async (tier) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/dashboard/${tier}/${restaurantId}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${tier} data`);
            }

            const data = await response.json();
            setDashboardData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };


    const renderTier1Dashboard = () => {
        if (!dashboardData) return null;

        const { todaySnapshot, weeklyDemand, alerts } = dashboardData;

        return (
            <div className="dashboard-tier1">
                <div className="snapshot-cards">
                    <div className="snapshot-card">
                        <h3>Reservations Today</h3>
                        <div className="snapshot-number">{todaySnapshot.reservationsToday}</div>
                    </div>
                    <div className="snapshot-card">
                        <h3>Total Guests Today</h3>
                        <div className="snapshot-number">{todaySnapshot.totalGuestsToday}</div>
                    </div>
                    <div className="snapshot-card">
                        <h3>Projected Occupancy</h3>
                        <div className="snapshot-number">{todaySnapshot.projectedOccupancy}%</div>
                    </div>
                </div>

                <div className="weekly-demand">
                    <h3>Next 7 Days Demand</h3>
                    <div className="demand-chart">
                        {weeklyDemand.map((day, index) => (
                            <div key={index} className="demand-bar">
                                <div className="bar" style={{height: `${Math.max(day.reservation_count * 10, 20)}px`}}>
                                    <span className="bar-value">{day.reservation_count}</span>
                                </div>
                                <div className="bar-label">{formatDate(day.date)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="alerts-section">
                    <h3>Recent Alerts & Notifications</h3>
                    <div className="alerts-list">
                        {alerts.length > 0 ? alerts.map((alert, index) => (
                            <div key={index} className={`alert alert-${alert.type}`}>
                                <div className="alert-message">{alert.message}</div>
                                <div className="alert-time">{new Date(alert.timestamp).toLocaleString()}</div>
                            </div>
                        )) : (
                            <div className="no-alerts">No recent alerts</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderTier2Dashboard = () => {
        if (!dashboardData) return null;

        const { reservationTrends, heatmapData, addOnRevenue, leadTimeData } = dashboardData;

        return (
            <div className="dashboard-tier2">
                <div className="analytics-grid">
                    <div className="analytics-card">
                        <h3>Reservation Trends</h3>
                        <div className="trends-chart">
                            {reservationTrends.map((trend, index) => (
                                <div key={index} className="trend-item">
                                    <div className="trend-date">{formatDate(trend.date)}</div>
                                    <div className="trend-stats">
                                        <span>Reservations: {trend.reservation_count}</span>
                                        <span>Guests: {trend.guest_count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="analytics-card">
                        <h3>Add-on Revenue</h3>
                        <div className="revenue-stats">
                            <div className="revenue-item">
                                <span>Cake Orders: {addOnRevenue.cake_orders}</span>
                                <span>Revenue: €{addOnRevenue.cake_revenue || 0}</span>
                            </div>
                            <div className="revenue-item">
                                <span>Flower Orders: {addOnRevenue.flower_orders}</span>
                                <span>Revenue: €{addOnRevenue.flower_revenue || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="analytics-card">
                        <h3>Booking Lead Time</h3>
                        <div className="lead-time-chart">
                            {leadTimeData.map((item, index) => (
                                <div key={index} className="lead-time-item">
                                    <div className="lead-time-category">{item.lead_time_category}</div>
                                    <div className="lead-time-count">{item.booking_count} bookings</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="analytics-card">
                        <h3>Peak Performance Heatmap</h3>
                        <div className="heatmap-info">
                            <p>Most popular booking times:</p>
                            {heatmapData.slice(0, 5).map((item, index) => (
                                <div key={index} className="heatmap-item">
                                    Day {item.day_of_week}, {item.hour}:00 - {item.booking_count} bookings
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTier3Dashboard = () => {
        if (!dashboardData) return null;

        const { celebrationStats, hotelStats, semanticInsights, dietaryTrends } = dashboardData;

        return (
            <div className="dashboard-tier3">
                <div className="insights-grid">
                    <div className="insights-card">
                        <h3>Celebration Types</h3>
                        <div className="celebration-stats">
                            {celebrationStats.map((stat, index) => (
                                <div key={index} className="celebration-item">
                                    <span className="celebration-type">{stat.celebration_type}</span>
                                    <span className="celebration-count">{stat.count}</span>
                                </div>
                            ))}
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
                            <p>{semanticInsights.message}</p>
                        </div>
                    </div>

                    <div className="insights-card">
                        <h3>Dietary Trends</h3>
                        <div className="dietary-info">
                            <p>{dietaryTrends.message}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTier4Dashboard = () => {
        if (!dashboardData) return null;

        const { botInteractionVolume, agentUsageBreakdown, missedOpportunities } = dashboardData;

        return (
            <div className="dashboard-tier4">
                <div className="ai-performance-grid">
                    <div className="performance-card">
                        <h3>Bot Interaction Volume</h3>
                        <div className="interaction-stats">
                            <div className="interaction-number">{botInteractionVolume.totalQueries}</div>
                            <div className="interaction-message">{botInteractionVolume.message}</div>
                        </div>
                    </div>

                    <div className="performance-card">
                        <h3>Agent Usage Breakdown</h3>
                        <div className="agent-info">
                            <p>{agentUsageBreakdown.message}</p>
                        </div>
                    </div>

                    <div className="performance-card">
                        <h3>Missed Opportunities</h3>
                        <div className="missed-info">
                            <p>{missedOpportunities.message}</p>
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
                <h1>Restaurant Dashboard</h1>
                {userInfo && (
                    <div className="dashboard-user-info">
                        <span>Restaurant ID: {restaurantId}</span>
                        {userInfo.role === 'admin' && <span className="admin-badge">Admin View</span>}
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