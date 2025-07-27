import { useState, useEffect } from 'react';
import '../styles/RestaurantSettings.css';

function RestaurantSettings({ restaurantId, onClose }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        email: '',
        phone: '',
        area: '',
        island: '',
        description: '',
        cuisine: '',
        min_reservation_gap_hours: 2,
        profile_image_url: '',
        background_image_url: ''
    });

    const getAuthHeaders = () => {
        const token = localStorage.getItem('accessToken');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    useEffect(() => {
        const fetchRestaurantData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/restaurants/${restaurantId}`, {
                    headers: getAuthHeaders()
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch restaurant data');
                }

                const data = await response.json();
                setFormData({
                    name: data.name || '',
                    address: data.address || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    area: data.area || '',
                    island: data.island || '',
                    description: data.description || '',
                    cuisine: data.cuisine || '',
                    min_reservation_gap_hours: data.min_reservation_gap_hours || 2,
                    profile_image_url: data.profile_image_url || '',
                    background_image_url: data.background_image_url || ''
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRestaurantData();
    }, [restaurantId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMessage('');

        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Failed to update restaurant settings');
            }

            setSuccessMessage('Restaurant settings updated successfully!');
            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="settings-modal">
                <div className="settings-content">
                    <div className="loading">Loading restaurant settings...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-modal">
            <div className="settings-content">
                <div className="settings-header">
                    <h2>Restaurant Settings</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="success-message">
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="settings-form">
                    <div className="form-section">
                        <h3>Basic Information</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="name">Restaurant Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="cuisine">Cuisine Type</label>
                                <input
                                    type="text"
                                    id="cuisine"
                                    name="cuisine"
                                    value={formData.cuisine}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows={4}
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Contact & Location</h3>
                        <div className="form-group">
                            <label htmlFor="address">Address</label>
                            <input
                                type="text"
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="area">Area</label>
                                <input
                                    type="text"
                                    id="area"
                                    name="area"
                                    value={formData.area}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="island">Island</label>
                                <input
                                    type="text"
                                    id="island"
                                    name="island"
                                    value={formData.island}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="phone">Phone</label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Reservation Settings</h3>
                        <div className="form-group">
                            <label htmlFor="min_reservation_gap_hours">
                                Minimum Gap Between Reservations (hours)
                            </label>
                            <input
                                type="number"
                                id="min_reservation_gap_hours"
                                name="min_reservation_gap_hours"
                                value={formData.min_reservation_gap_hours}
                                onChange={handleInputChange}
                                min="0"
                                max="24"
                                step="1"
                            />
                            <small className="form-help">
                                Set the minimum time gap required between reservations for the same table type.
                                For example, if set to 3 hours and a table is reserved at 4 PM, the next reservation 
                                for that table type cannot be before 7 PM.
                            </small>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Images</h3>
                        <div className="form-group">
                            <label htmlFor="profile_image_url">Profile Image URL</label>
                            <input
                                type="url"
                                id="profile_image_url"
                                name="profile_image_url"
                                value={formData.profile_image_url}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="background_image_url">Background Image URL</label>
                            <input
                                type="url"
                                id="background_image_url"
                                name="background_image_url"
                                value={formData.background_image_url}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="cancel-btn">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="save-btn">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RestaurantSettings;