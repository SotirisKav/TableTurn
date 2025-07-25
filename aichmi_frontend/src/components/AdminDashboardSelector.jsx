import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminDashboardSelector() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [restaurants, setRestaurants] = useState([]);
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

                // Check if user is admin
                if (data.role !== 'admin') {
                    setError('Access denied. Admin access required.');
                    return;
                }
                
                // Fetch all restaurants
                const restaurantsResponse = await fetch('/api/restaurants');
                if (!restaurantsResponse.ok) {
                    throw new Error('Failed to fetch restaurants');
                }
                
                const restaurantsData = await restaurantsResponse.json();
                setRestaurants(restaurantsData);
                
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserInfo();
    }, []);

    const handleRestaurantSelect = (restaurantId) => {
        navigate(`/dashboard/${restaurantId}`);
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
        return <div className="dashboard-loading">Loading restaurants...</div>;
    }

    return (
        <div className="admin-selector-container">
            <div className="admin-selector-header">
                <h1>Admin Dashboard</h1>
                <p>Select a restaurant to view its dashboard</p>
                {userInfo && (
                    <div className="admin-info">
                        <span className="admin-badge">Admin View</span>
                    </div>
                )}
            </div>

            <div className="restaurant-grid">
                {restaurants.map((restaurant) => (
                    <div 
                        key={restaurant.restaurant_id} 
                        className="restaurant-card"
                        onClick={() => handleRestaurantSelect(restaurant.restaurant_id)}
                    >
                        <div className="restaurant-image">
                            {restaurant.profile_image_url ? (
                                <img 
                                    src={restaurant.profile_image_url} 
                                    alt={restaurant.name}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div className="restaurant-placeholder" style={{display: restaurant.profile_image_url ? 'none' : 'flex'}}>
                                🏪
                            </div>
                        </div>
                        <div className="restaurant-info">
                            <h3>{restaurant.name}</h3>
                            <p className="restaurant-location">{restaurant.area}, {restaurant.island}</p>
                            <p className="restaurant-cuisine">{restaurant.cuisine}</p>
                        </div>
                        <div className="view-dashboard-btn">
                            View Dashboard →
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default AdminDashboardSelector;