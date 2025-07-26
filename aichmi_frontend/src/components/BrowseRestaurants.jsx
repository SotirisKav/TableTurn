import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/BrowseRestaurants.css';

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
    const [islandFilter, setIslandFilter] = useState('All');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const navigate = useNavigate();

    const handleBook = (restaurantId) => {
        navigate(`/reservation/${restaurantId}`);
    };


    useEffect(() => {
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
            (islandFilter === 'All' || r.island === islandFilter)
        );

        // Sort restaurants by name (default)
        filteredList.sort((a, b) => a.name.localeCompare(b.name));

        setFiltered(filteredList);
    }, [search, cuisineFilter, islandFilter, restaurants]);

    const cuisines = ['All', ...Array.from(new Set(restaurants.map(r => r.cuisine)))];
    const islands = ['All', ...Array.from(new Set(restaurants.map(r => r.island)))];

    if (loading) {
        return (
            <div className="browse-restaurants-modern">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <h2>Discovering amazing restaurants...</h2>
                    <p>Curating the best dining experiences in Kos</p>
                </div>
            </div>
        );
    }

    return (
        <div className="browse-restaurants-modern">

            <div className="main-content">
                <div className="container">
                    {/* Combined Filter Bar with Search */}
                    <div className="filter-section">
                        <div className="filter-left">
                            {/* Search */}
                            <div className="filter-group">
                                <label className="filter-label">Search</label>
                                <div className="search-box-inline">
                                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <circle cx="11" cy="11" r="8"/>
                                        <path d="M21 21l-4.35-4.35"/>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search restaurants..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="search-input-inline"
                                    />
                                    {search && (
                                        <button
                                            className="clear-search"
                                            onClick={() => setSearch('')}
                                            aria-label="Clear search"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Island */}
                            <div className="filter-group">
                                <label className="filter-label">Island</label>
                                <select
                                    value={islandFilter}
                                    onChange={e => setIslandFilter(e.target.value)}
                                    className="filter-select"
                                >
                                    {islands.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                            
                            {/* Cuisine */}
                            <div className="filter-group">
                                <label className="filter-label">Cuisine</label>
                                <select
                                    value={cuisineFilter}
                                    onChange={e => setCuisineFilter(e.target.value)}
                                    className="filter-select"
                                >
                                    {cuisines.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="filter-right">
                            <div className="view-toggle">
                                <button
                                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                    onClick={() => setViewMode('grid')}
                                    aria-label="Grid view"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <rect x="3" y="3" width="7" height="7"/>
                                        <rect x="14" y="3" width="7" height="7"/>
                                        <rect x="14" y="14" width="7" height="7"/>
                                        <rect x="3" y="14" width="7" height="7"/>
                                    </svg>
                                </button>
                                <button
                                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                    aria-label="List view"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <line x1="8" y1="6" x2="21" y2="6"/>
                                        <line x1="8" y1="12" x2="21" y2="12"/>
                                        <line x1="8" y1="18" x2="21" y2="18"/>
                                        <line x1="3" y1="6" x2="3.01" y2="6"/>
                                        <line x1="3" y1="12" x2="3.01" y2="12"/>
                                        <line x1="3" y1="18" x2="3.01" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Restaurant Grid/List */}
                    <div className={`restaurants-container ${viewMode}`}>
                        {filtered.length === 0 ? (
                            <div className="no-results">
                                <div className="no-results-icon">🔍</div>
                                <h3>No restaurants found</h3>
                                <p>Try adjusting your search criteria or browse all restaurants</p>
                                <button 
                                    className="reset-filters-btn"
                                    onClick={() => {
                                        setSearch('');
                                        setCuisineFilter('All');
                                        setIslandFilter('All');
                                    }}
                                >
                                    Reset Filters
                                </button>
                            </div>
                        ) : (
                            filtered.map((restaurant, idx) => (
                                <div
                                    key={restaurant.id}
                                    className="restaurant-card-modern"
                                    style={{ animationDelay: `${idx * 0.1}s` }}
                                >
                                    <div className="card-image">
                                        <img
                                            src={restaurant.image || FALLBACK_IMAGE}
                                            alt={restaurant.name}
                                            onError={e => { e.target.src = FALLBACK_IMAGE; }}
                                        />
                                        <div className="image-overlay">
                                            <div className="reserve-overlay">
                                                <button
                                                    className="reserve-table-btn"
                                                    onClick={() => handleBook(restaurant.restaurant_id)}
                                                >
                                                    Reserve a Table
                                                </button>
                                            </div>
                                        </div>
                                        <div className="cuisine-badge"
                                             style={{ background: CUISINE_COLORS[restaurant.cuisine] || '#1e3a8a' }}>
                                            {restaurant.cuisine}
                                        </div>
                                    </div>

                                    <div className="card-content">
                                        <div className="card-header">
                                            <h3 className="restaurant-name">{restaurant.name}</h3>
                                            <div className="rating-container">
                                                {restaurant.rating && (
                                                    <div className="rating">
                                                        <span className="rating-star">⭐</span>
                                                        <span className="rating-value">{restaurant.rating}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="location-info">
                                            <svg className="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                                <circle cx="12" cy="10" r="3"/>
                                            </svg>
                                            <span>{restaurant.area}, {restaurant.island}</span>
                                            <span className="price-range">{restaurant.pricerange || restaurant.price_range}</span>
                                        </div>

                                        <p className="restaurant-description">
                                            {restaurant.description}
                                        </p>

                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BrowseRestaurants;