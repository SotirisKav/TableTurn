import { useState } from 'react';
import LocationPicker from './LocationPicker';

const SimpleRestaurantForm = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        // Restaurant Information
        restaurantName: '',
        description: '',
        phone: '',
        restaurantEmail: '',
        cuisine: '',
        location: {
            island: '',
            area: '',
            address: '',
            lat: null,
            lng: null
        },
        profileImage: null,
        backgroundImage: null,
        hours: [
            { day: 'Monday', open: '09:00', close: '22:00', enabled: true },
            { day: 'Tuesday', open: '09:00', close: '22:00', enabled: true },
            { day: 'Wednesday', open: '09:00', close: '22:00', enabled: true },
            { day: 'Thursday', open: '09:00', close: '22:00', enabled: true },
            { day: 'Friday', open: '09:00', close: '23:00', enabled: true },
            { day: 'Saturday', open: '09:00', close: '23:00', enabled: true },
            { day: 'Sunday', open: '10:00', close: '22:00', enabled: true }
        ],
        customTimetable: false,
        customTimetableRows: [],
        menuItems: [], // { name, description, price, is_vegetarian, is_vegan, is_gluten_free }
        // Owner Information
        ownerFirstName: '',
        ownerLastName: '',
        ownerEmail: '',
        ownerPassword: '',
        confirmPassword: '',
        phoneNumber: ''
    });
    
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        let processedValue = value;
        
        // Phone number validation - only allow numbers and spaces
        if (name === 'phone' && value) {
            processedValue = value.replace(/[^0-9\s]/g, '');
        }
        
        if (name.startsWith('hours-')) {
            const [_, idx, field] = name.split('-');
            setFormData(prev => {
                const hours = [...prev.hours];
                hours[parseInt(idx)][field] = field === 'enabled' ? checked : processedValue;
                return { ...prev, hours };
            });
        } else if (name.startsWith('customTimetableRows-')) {
            const [_, idx, field] = name.split('-');
            setFormData(prev => {
                const customTimetableRows = [...prev.customTimetableRows];
                customTimetableRows[parseInt(idx)][field] = processedValue;
                return { ...prev, customTimetableRows };
            });
        } else if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: processedValue }));
        }
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    // Menu item handlers
    const handleAddMenuItem = () => {
        setFormData(prev => ({
            ...prev,
            menuItems: [
                ...prev.menuItems,
                { name: '', description: '', price: '', is_vegetarian: false, is_vegan: false, is_gluten_free: false }
            ]
        }));
    };

    const handleMenuItemChange = (idx, field, value) => {
        setFormData(prev => {
            const menuItems = [...prev.menuItems];
            menuItems[idx][field] = value;
            return { ...prev, menuItems };
        });
    };

    const handleRemoveMenuItem = (idx) => {
        setFormData(prev => {
            const menuItems = prev.menuItems.filter((_, i) => i !== idx);
            return { ...prev, menuItems };
        });
    };

    const handleImageUpload = (field, file) => {
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setFormData(prev => ({ ...prev, [field]: e.target.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLocationSelect = (location) => {
        setFormData(prev => ({ ...prev, location }));
        setShowMapPicker(false);
    };

    const validateStep = (step) => {
        const newErrors = {};
        
        if (step === 1) {
            // Restaurant validation
            if (!formData.restaurantName.trim()) {
                newErrors.restaurantName = 'Restaurant name is required';
            }
            if (!formData.description.trim()) {
                newErrors.description = 'Description is required';
            }
            if (!formData.location.island || !formData.location.area || !formData.location.address) {
                newErrors.location = 'Complete location is required';
            }
            if (!formData.cuisine.trim()) {
                newErrors.cuisine = 'Cuisine type is required';
            }
        } else if (step === 2) {
            // Owner validation
            if (!formData.ownerFirstName.trim()) {
                newErrors.ownerFirstName = 'First name is required';
            }
            if (!formData.ownerLastName.trim()) {
                newErrors.ownerLastName = 'Last name is required';
            }
            if (!formData.ownerEmail.trim()) {
                newErrors.ownerEmail = 'Email is required';
            } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.ownerEmail)) {
                newErrors.ownerEmail = 'Invalid email format';
            }
            if (!formData.ownerPassword) {
                newErrors.ownerPassword = 'Password is required';
            } else if (formData.ownerPassword.length < 8) {
                newErrors.ownerPassword = 'Password must be at least 8 characters';
            }
            if (formData.ownerPassword !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
            if (!formData.phoneNumber.trim()) {
                newErrors.phoneNumber = 'Phone number is required';
            }
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(2);
        }
    };

    const handlePrevious = () => {
        setCurrentStep(1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateStep(2)) return;
        
        setIsLoading(true);
        
        try {
            // Transform formData to match backend expectations
            const submissionData = {
                // Restaurant fields
                restaurantName: formData.restaurantName,
                description: formData.description,
                cuisine: formData.cuisine,
                phone: formData.phone,
                location: formData.location,
                profileImage: formData.profileImage,
                backgroundImage: formData.backgroundImage,
                hours: formData.hours,
                menuItems: formData.menuItems,
                
                // Owner fields with correct backend names
                ownerFirstName: formData.ownerFirstName,
                ownerLastName: formData.ownerLastName,
                ownerEmail: formData.ownerEmail,
                ownerPassword: formData.ownerPassword,
                phoneNumber: formData.phoneNumber
            };

            const response = await fetch('/api/register-restaurant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submissionData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Registration successful!');
                // Reset form or redirect
                setFormData({
                    restaurantName: '',
                    description: '',
                    phone: '',
                    restaurantEmail: '',
                    cuisine: '',
                    location: { island: '', area: '', address: '', lat: null, lng: null },
                    profileImage: null,
                    backgroundImage: null,
                    hours: [
                        { day: 'Monday', open: '09:00', close: '22:00', enabled: true },
                        { day: 'Tuesday', open: '09:00', close: '22:00', enabled: true },
                        { day: 'Wednesday', open: '09:00', close: '22:00', enabled: true },
                        { day: 'Thursday', open: '09:00', close: '22:00', enabled: true },
                        { day: 'Friday', open: '09:00', close: '23:00', enabled: true },
                        { day: 'Saturday', open: '09:00', close: '23:00', enabled: true },
                        { day: 'Sunday', open: '10:00', close: '22:00', enabled: true }
                    ],
                    customTimetable: false,
                    customTimetableRows: [],
                    menuItems: [],
                    ownerFirstName: '',
                    ownerLastName: '',
                    ownerEmail: '',
                    ownerPassword: '',
                    confirmPassword: '',
                    phoneNumber: ''
                });
                setCurrentStep(1);
            } else {
                setErrors({ submit: data.message || 'Registration failed' });
            }
        } catch (error) {
            setErrors({ submit: 'Network error. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="registration-container">
            <div className="registration-card">
                <div className="registration-header">
                    <h1>Join AICHMI</h1>
                    <p>Register your restaurant and start accepting reservations</p>
                </div>

                {/* Progress Indicator */}
                <div className="progress-steps">
                    <div className={`progress-step ${currentStep >= 1 ? 'active' : ''}`}>
                        <div className="step-number">1</div>
                        <span>Restaurant Info</span>
                    </div>
                    <div className={`progress-line ${currentStep >= 2 ? 'active' : ''}`}></div>
                    <div className={`progress-step ${currentStep >= 2 ? 'active' : ''}`}>
                        <div className="step-number">2</div>
                        <span>Owner Info</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="registration-form">
                    {currentStep === 1 && (
                        <div className="form-section">
                            <div className="section-header">
                                <h2>Restaurant Information</h2>
                                <p>Tell us about your restaurant</p>
                            </div>

                            <div className="form-field">
                                <label>Restaurant Name</label>
                                <input
                                    type="text"
                                    name="restaurantName"
                                    value={formData.restaurantName}
                                    onChange={handleInputChange}
                                    placeholder="Enter your restaurant name"
                                    className={errors.restaurantName ? 'error' : ''}
                                />
                                {errors.restaurantName && <span className="error-text">{errors.restaurantName}</span>}
                            </div>

                            <div className="form-field">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Describe your restaurant..."
                                    rows="4"
                                    className={errors.description ? 'error' : ''}
                                />
                                {errors.description && <span className="error-text">{errors.description}</span>}
                            </div>

                            <div className="form-field">
                                <label>Restaurant Phone</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    placeholder="Enter your restaurant phone"
                                />
                            </div>

                            <div className="form-field">
                                <label>Restaurant Email</label>
                                <input
                                    type="email"
                                    name="restaurantEmail"
                                    value={formData.restaurantEmail}
                                    onChange={handleInputChange}
                                    placeholder="Enter your restaurant email"
                                />
                            </div>

                            <div className="form-field">
                                <label>Cuisine</label>
                                <select
                                    name="cuisine"
                                    value={formData.cuisine}
                                    onChange={handleInputChange}
                                    className={errors.cuisine ? 'error' : ''}
                                >
                                    <option value="">Select cuisine type</option>
                                    <option value="Greek">Greek</option>
                                    <option value="Italian">Italian</option>
                                    <option value="Seafood">Seafood</option>
                                    <option value="Mediterranean">Mediterranean</option>
                                    <option value="Traditional">Traditional</option>
                                    <option value="International">International</option>
                                    <option value="Fast Food">Fast Food</option>
                                    <option value="Asian">Asian</option>
                                    <option value="Mexican">Mexican</option>
                                    <option value="French">French</option>
                                    <option value="American">American</option>
                                    <option value="Vegetarian">Vegetarian</option>
                                    <option value="Vegan">Vegan</option>
                                    <option value="BBQ">BBQ</option>
                                    <option value="Other">Other</option>
                                </select>
                                {errors.cuisine && <span className="error-text">{errors.cuisine}</span>}
                            </div>

                            <div className="form-field">
                                <label>Location</label>
                                
                                {/* Manual Location Input */}
                                <div className="location-inputs">
                                    <div className="location-row">
                                        <div className="location-field">
                                            <label>Address</label>
                                            <input
                                                type="text"
                                                name="address"
                                                value={formData.location.address}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    location: { ...prev.location, address: e.target.value }
                                                }))}
                                                placeholder="Street address"
                                            />
                                        </div>
                                        <div className="location-field">
                                            <label>Area</label>
                                            <input
                                                type="text"
                                                name="area"
                                                value={formData.location.area}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    location: { ...prev.location, area: e.target.value }
                                                }))}
                                                placeholder="Area/Neighborhood"
                                            />
                                        </div>
                                    </div>
                                    <div className="location-row">
                                        <div className="location-field">
                                            <label>Island</label>
                                            <input
                                                type="text"
                                                name="island"
                                                value={formData.location.island}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    location: { ...prev.location, island: e.target.value }
                                                }))}
                                                placeholder="Island name"
                                            />
                                        </div>
                                        <div className="map-option">
                                            <label>Or use map</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowMapPicker(true)}
                                                className="map-picker-btn"
                                            >
                                                📍 Select on Map
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {errors.location && <span className="error-text">{errors.location}</span>}
                            </div>

            
                            {/* Opening/Closing Hours Section */}
                            <div className="section">
                                <h2 className="section-title">Opening & Closing Hours</h2>
                                <p className="section-subtitle">Select your operating days and hours</p>
                                
                                <div className="hours-grid">
                                    {formData.hours.map((row, idx) => (
                                        <div className={`day-row ${!row.enabled ? 'disabled' : ''}`} key={row.day}>
                                            <div className="day-checkbox">
                                                <input 
                                                    type="checkbox" 
                                                    id={row.day.toLowerCase()}
                                                    name={`hours-${idx}-enabled`}
                                                    checked={row.enabled} 
                                                    onChange={handleInputChange}
                                                />
                                                <label htmlFor={row.day.toLowerCase()}>{row.day}</label>
                                            </div>
                                            <div className="time-inputs" id={`${row.day.toLowerCase()}-times`}>
                                                <input 
                                                    type="time" 
                                                    name={`hours-${idx}-open`} 
                                                    value={row.open} 
                                                    onChange={handleInputChange}
                                                    disabled={!row.enabled}
                                                />
                                                <span>to</span>
                                                <input 
                                                    type="time" 
                                                    name={`hours-${idx}-close`} 
                                                    value={row.close} 
                                                    onChange={handleInputChange}
                                                    disabled={!row.enabled}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Menu Items Section (optional) */}
                            <div className="section">
                                <h2 className="section-title">Menu Items (Optional)</h2>
                                <p className="section-subtitle">Add your menu items to help customers discover your restaurant</p>
                                
                                <div id="menu-items">
                                    {formData.menuItems.map((item, idx) => (
                                        <div className="menu-item" key={idx}>
                                            <button 
                                                type="button"
                                                className="remove-item-btn" 
                                                onClick={() => handleRemoveMenuItem(idx)}
                                            >
                                                Remove
                                            </button>
                                            
                                            <div className="menu-item-row">
                                                <div className="form-field">
                                                    <label>Item Name</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g., Grilled Salmon"
                                                        value={item.name} 
                                                        onChange={e => handleMenuItemChange(idx, 'name', e.target.value)} 
                                                    />
                                                </div>
                                                <div className="form-field">
                                                    <label>Price</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        placeholder="€25.00"
                                                        value={item.price} 
                                                        onChange={e => handleMenuItemChange(idx, 'price', e.target.value)} 
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-field">
                                                <label>Description</label>
                                                <textarea 
                                                    placeholder="Brief description of the dish..." 
                                                    rows="2"
                                                    value={item.description} 
                                                    onChange={e => handleMenuItemChange(idx, 'description', e.target.value)}
                                                />
                                            </div>

                                            <div className="form-field">
                                                <label>Dietary Options</label>
                                                <div className="dietary-options">
                                                    <div className="dietary-option">
                                                        <input 
                                                            type="checkbox" 
                                                            id={`veg-${idx + 1}`}
                                                            checked={item.is_vegetarian} 
                                                            onChange={e => handleMenuItemChange(idx, 'is_vegetarian', e.target.checked)}
                                                        />
                                                        <label htmlFor={`veg-${idx + 1}`}>Vegetarian</label>
                                                    </div>
                                                    <div className="dietary-option">
                                                        <input 
                                                            type="checkbox" 
                                                            id={`vegan-${idx + 1}`}
                                                            checked={item.is_vegan} 
                                                            onChange={e => handleMenuItemChange(idx, 'is_vegan', e.target.checked)}
                                                        />
                                                        <label htmlFor={`vegan-${idx + 1}`}>Vegan</label>
                                                    </div>
                                                    <div className="dietary-option">
                                                        <input 
                                                            type="checkbox" 
                                                            id={`gf-${idx + 1}`}
                                                            checked={item.is_gluten_free} 
                                                            onChange={e => handleMenuItemChange(idx, 'is_gluten_free', e.target.checked)}
                                                        />
                                                        <label htmlFor={`gf-${idx + 1}`}>Gluten Free</label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button type="button" className="add-item-btn" onClick={handleAddMenuItem}>
                                    + Add Menu Item
                                </button>
                            </div>

                            <div className="images-section">
                                <h3>Restaurant Images</h3>
                                <div className="image-uploads">
                                    <div className="image-upload-field">
                                        <label>Profile Image</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload('profileImage', e.target.files[0])}
                                        />
                                        {formData.profileImage && (
                                            <div className="image-preview">
                                                <img src={formData.profileImage} alt="Profile preview" className="preview-image profile-preview" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="image-upload-field">
                                        <label>Background Image</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload('backgroundImage', e.target.files[0])}
                                        />
                                        {formData.backgroundImage && (
                                            <div className="image-preview">
                                                <img src={formData.backgroundImage} alt="Background preview" className="preview-image background-preview" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="btn btn-primary"
                                >
                                    Next Step →
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="form-section">
                            <div className="section-header">
                                <h2>Owner Information</h2>
                                <p>Create your account details</p>
                            </div>

                            <div className="form-row">
                                <div className="form-field">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        name="ownerFirstName"
                                        value={formData.ownerFirstName}
                                        onChange={handleInputChange}
                                        placeholder="Enter your first name"
                                        className={errors.ownerFirstName ? 'error' : ''}
                                    />
                                    {errors.ownerFirstName && <span className="error-text">{errors.ownerFirstName}</span>}
                                </div>

                                <div className="form-field">
                                    <label>Last Name</label>
                                    <input
                                        type="text"
                                        name="ownerLastName"
                                        value={formData.ownerLastName}
                                        onChange={handleInputChange}
                                        placeholder="Enter your last name"
                                        className={errors.ownerLastName ? 'error' : ''}
                                    />
                                    {errors.ownerLastName && <span className="error-text">{errors.ownerLastName}</span>}
                                </div>
                            </div>

                            <div className="form-field">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    name="ownerEmail"
                                    value={formData.ownerEmail}
                                    onChange={handleInputChange}
                                    placeholder="Enter your email"
                                    className={errors.ownerEmail ? 'error' : ''}
                                />
                                {errors.ownerEmail && <span className="error-text">{errors.ownerEmail}</span>}
                            </div>

                            <div className="form-row">
                                <div className="form-field">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        name="ownerPassword"
                                        value={formData.ownerPassword}
                                        onChange={handleInputChange}
                                        placeholder="Create a password"
                                        className={errors.ownerPassword ? 'error' : ''}
                                    />
                                    {errors.ownerPassword && <span className="error-text">{errors.ownerPassword}</span>}
                                </div>

                                <div className="form-field">
                                    <label>Confirm Password</label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        placeholder="Confirm your password"
                                        className={errors.confirmPassword ? 'error' : ''}
                                    />
                                    {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                                </div>
                            </div>

                            <div className="form-field">
                                <label>Phone Number</label>
                                <input
                                    type="tel"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleInputChange}
                                    placeholder="Enter your phone number"
                                    className={errors.phoneNumber ? 'error' : ''}
                                />
                                {errors.phoneNumber && <span className="error-text">{errors.phoneNumber}</span>}
                            </div>

                            {errors.submit && (
                                <div className="error-message">
                                    {errors.submit}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    onClick={handlePrevious}
                                    className="btn btn-secondary"
                                >
                                    ← Previous
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="btn btn-primary"
                                >
                                    {isLoading ? 'Creating Account...' : 'Complete Registration'}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Map Picker Popup */}
            {showMapPicker && (
                <div className="map-popup-overlay">
                    <div className="map-popup-content">
                        <div className="map-popup-header">
                            <h3>Select Restaurant Location</h3>
                            <button
                                onClick={() => setShowMapPicker(false)}
                                className="close-map-btn"
                            >
                                ×
                            </button>
                        </div>
                        <LocationPicker
                            onLocationSelect={handleLocationSelect}
                            defaultLocation={formData.location}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimpleRestaurantForm;
