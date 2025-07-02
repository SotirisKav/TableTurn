import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function BrowseRestaurants() {
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const handleBook = (restaurantId) => {
        navigate(`/reservation/${restaurantId}`);
    };

    useEffect(() => {
        // Fetch restaurants from your backend
        const fetchRestaurants = async () => {
            try {
                const response = await fetch('/api/restaurants');
                const data = await response.json();
                setRestaurants(data);
            } catch (error) {
                console.error('Error fetching restaurants:', error);
                // Fallback data in case of error
                setRestaurants([
                    {
                        id: '1',
                        name: 'Lofaki Taverna',
                        cuisine: 'Traditional Greek',
                        description: 'Authentic Greek cuisine with fresh seafood and traditional recipes.',
                        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
                        rating: 4.8,
                        priceRange: '€€€'
                    }
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchRestaurants();
    }, []);

    if (loading) {
        return (
            <div className="browse-restaurants">
                <div className="container">
                    <h1>Loading restaurants...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="browse-restaurants">
            <div className="container">
                <h1 className="page-title">Browse Restaurants in Kos</h1>
                <p className="page-subtitle">Discover amazing Greek dining experiences</p>
                
                <div className="restaurants-grid">
                    {restaurants.map((restaurant) => (
                        <div key={restaurant.id} className="restaurant-card">
                            <div className="restaurant-image">
                                <img src={restaurant.image} alt={restaurant.name} />
                            </div>
                            <div className="restaurant-info">
                                <h3>{restaurant.name}</h3>
                                <p className="restaurant-cuisine">{restaurant.cuisine}</p>
                                <p className="restaurant-description">{restaurant.description}</p>
                                <div className="restaurant-details">
                                    <span className="rating">★ {restaurant.rating}</span>
                                    <span className="price-range">{restaurant.priceRange}</span>
                                </div>
                                <button 
                                    className="cta-button primary" 
                                    onClick={() => handleBook(restaurant.id)}
                                >
                                    View Details & Book
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default BrowseRestaurants;