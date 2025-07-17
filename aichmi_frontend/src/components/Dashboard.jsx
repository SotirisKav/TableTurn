import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is logged in
        const userData = localStorage.getItem('user');
        const token = localStorage.getItem('accessToken');

        if (!userData || !token) {
            navigate('/login');
            return;
        }

        setUser(JSON.parse(userData));
        setLoading(false);
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        navigate('/');
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <div className="dashboard-welcome">
                        <h1>Welcome back, {user?.firstName}!</h1>
                        <p>Manage your restaurant's AI assistant and reservations</p>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        Sign Out
                    </button>
                </div>

                <div className="dashboard-content">
                    <div className="dashboard-grid">
                        {/* Restaurant Info Card */}
                        <div className="dashboard-card">
                            <div className="card-header">
                                <h3>Restaurant Information</h3>
                                <span className="card-icon">🏪</span>
                            </div>
                            <div className="card-content">
                                {user?.venueName ? (
                                    <div>
                                        <p><strong>Restaurant:</strong> {user.venueName}</p>
                                        <p><strong>Status:</strong> 
                                            <span className="status-active"> Active</span>
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <p>No restaurant linked to your account</p>
                                        <button className="cta-button secondary">
                                            Link Restaurant
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Assistant Card */}
                        <div className="dashboard-card">
                            <div className="card-header">
                                <h3>AI Assistant</h3>
                                <span className="card-icon">🤖</span>
                            </div>
                            <div className="card-content">
                                <p>Your AI-powered reservation assistant</p>
                                <div className="card-actions">
                                    <button className="cta-button primary">
                                        Configure AI
                                    </button>
                                    <button className="cta-button secondary">
                                        Test Chat
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Reservations Card */}
                        <div className="dashboard-card">
                            <div className="card-header">
                                <h3>Recent Reservations</h3>
                                <span className="card-icon">📅</span>
                            </div>
                            <div className="card-content">
                                <p>View and manage your reservations</p>
                                <button className="cta-button secondary">
                                    View All Reservations
                                </button>
                            </div>
                        </div>

                        {/* Subscription Card */}
                        <div className="dashboard-card">
                            <div className="card-header">
                                <h3>Subscription</h3>
                                <span className="card-icon">💳</span>
                            </div>
                            <div className="card-content">
                                <p><strong>Status:</strong> 
                                    <span className={`status-${user?.subscriptionStatus || 'inactive'}`}>
                                        {user?.subscriptionStatus || 'No subscription'}
                                    </span>
                                </p>
                                <button 
                                    className="cta-button primary"
                                    onClick={() => navigate('/subscriptions')}
                                >
                                    {user?.subscriptionStatus ? 'Manage Plan' : 'Choose Plan'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="dashboard-actions">
                        <h3>Quick Actions</h3>
                        <div className="action-buttons">
                            <button className="action-btn">
                                <span className="action-icon">⚙️</span>
                                Settings
                            </button>
                            <button className="action-btn">
                                <span className="action-icon">📊</span>
                                Analytics
                            </button>
                            <button className="action-btn">
                                <span className="action-icon">💬</span>
                                Support
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;