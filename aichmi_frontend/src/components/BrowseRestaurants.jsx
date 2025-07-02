import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
const CUISINE_COLORS = {
    'Traditional Greek': '#1e3a8a',
    'Seafood': '#0077b6',
    'Mediterranean': '#00b4d8',
    'Modern': '#6b7280',
    'Other': '#64748b'
};

function BrowseRestaurants() {
    const [restaurants, setRestaurants] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [cuisineFilter, setCuisineFilter] = useState('All');
    const [priceFilter, setPriceFilter] = useState('All');
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
                setFiltered(data);
            } catch (error) {
                setRestaurants([]);
                setFiltered([]);
            } finally {
                setLoading(false);
            }
        };
        fetchRestaurants();
    }, []);

    useEffect(() => {
        let filteredList = restaurants.filter(r =>
            r.name.toLowerCase().includes(search.toLowerCase()) &&
            (cuisineFilter === 'All' || r.cuisine === cuisineFilter) &&
            (priceFilter === 'All' || r.priceRange === priceFilter)
        );
        setFiltered(filteredList);
    }, [search, cuisineFilter, priceFilter, restaurants]);

    const cuisines = ['All', ...Array.from(new Set(restaurants.map(r => r.cuisine)))];
    const prices = ['All', ...Array.from(new Set(restaurants.map(r => r.priceRange)))];

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

                {/* Search and filter bar */}
                <div className="restaurant-filters">
                    <input
                        type="text"
                        placeholder="Search by name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        aria-label="Search restaurants by name"
                        className="restaurant-search"
                    />
                    <select
                        value={cuisineFilter}
                        onChange={e => setCuisineFilter(e.target.value)}
                        aria-label="Filter by cuisine"
                        className="restaurant-select"
                    >
                        {cuisines.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        value={priceFilter}
                        onChange={e => setPriceFilter(e.target.value)}
                        aria-label="Filter by price range"
                        className="restaurant-select"
                    >
                        {prices.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                <div className="restaurants-grid vertical">
                    {filtered.length === 0 ? (
                        <div className="no-restaurants">
                            <p>No restaurants found. Try adjusting your search or filters.</p>
                        </div>
                    ) : (
                        filtered.map((restaurant, idx) => (
                            <div
                                key={restaurant.id}
                                className="restaurant-card fade-in-card vertical"
                                tabIndex={0}
                                aria-label={`View details and book at ${restaurant.name}`}
                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleBook(restaurant.id)}
                                style={{ animationDelay: `${idx * 0.07}s` }}
                            >
                                <div className="restaurant-image vertical">
                                    <div className="image-ratio">
                                        <img
                                            src={restaurant.image || FALLBACK_IMAGE}
                                            alt={restaurant.name}
                                            onError={e => { e.target.src = FALLBACK_IMAGE; }}
                                        />
                                    </div>
                                </div>
                                <div className="restaurant-info vertical">
                                    <div className="restaurant-header-row">
                                        <h3>{restaurant.name}</h3>
                                        <span
                                            className="restaurant-cuisine-badge"
                                            style={{ background: CUISINE_COLORS[restaurant.cuisine] || '#1e3a8a' }}
                                        >
                                            {restaurant.cuisine}
                                        </span>
                                    </div>
                                    <div className="restaurant-meta-row">
                                        <span className="rating" aria-label={`Rating: ${restaurant.rating} out of 5`}>
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <span key={i} className={i < Math.round(Number(restaurant.rating)) ? 'star filled' : 'star'}>★</span>
                                            ))}
                                            <span className="rating-value">{restaurant.rating}</span>
                                        </span>
                                        <span className="price-euros" aria-label={`Price range: ${restaurant.pricerange || restaurant.price_range || ''}`}>{restaurant.pricerange || restaurant.price_range || ''}</span>
                                    </div>
                                    <p className="restaurant-description vertical">{restaurant.description}</p>
                                    <button
                                        className="cta-button primary restaurant-book-btn vertical"
                                        onClick={() => handleBook(restaurant.id)}
                                    >
                                        View Details & Book
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default BrowseRestaurants;