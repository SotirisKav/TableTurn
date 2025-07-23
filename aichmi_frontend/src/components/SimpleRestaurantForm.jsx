import React, { useState } from 'react';
import LocationPicker from './LocationPicker';

const SimpleRestaurantForm = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        // Restaurant Information
        restaurantName: '',
        description: '',
        restaurantPhone: '',
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
            { day: 'Monday', open: '', close: '' },
            { day: 'Tuesday', open: '', close: '' },
            { day: 'Wednesday', open: '', close: '' },
            { day: 'Thursday', open: '', close: '' },
            { day: 'Friday', open: '', close: '' },
            { day: 'Saturday', open: '', close: '' },
            { day: 'Sunday', open: '', close: '' }
        ],
        customTimetable: false,
        customTimetableRows: [],
        menuItems: [], // { name, description, price, category, is_vegetarian, is_vegan, is_gluten_free }
        // Owner Information
        ownerName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phoneNumber: ''
    });
    
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.startsWith('hours-')) {
            const [_, idx, field] = name.split('-');
            setFormData(prev => {
                const hours = [...prev.hours];
                hours[parseInt(idx)][field] = value;
                return { ...prev, hours };
            });
        } else if (name.startsWith('customTimetableRows-')) {
            const [_, idx, field] = name.split('-');
            setFormData(prev => {
                const customTimetableRows = [...prev.customTimetableRows];
                customTimetableRows[parseInt(idx)][field] = value;
                return { ...prev, customTimetableRows };
            });
        } else if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    // Menu item handlers
    // (Removed duplicate handleAddMenuItem, handleMenuItemChange, and handleInputChange)

    // Menu item handlers
    const handleAddMenuItem = () => {
        setFormData(prev => ({
            ...prev,
            menuItems: [
                ...prev.menuItems,
                { name: '', description: '', price: '', category: '', is_vegetarian: false, is_vegan: false, is_gluten_free: false, available: true }
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
        } else if (step === 2) {
            // Owner validation
            if (!formData.ownerName.trim()) {
                newErrors.ownerName = 'Owner name is required';
            }
            if (!formData.email.trim()) {
                newErrors.email = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                newErrors.email = 'Invalid email format';
            }
            if (!formData.password) {
                newErrors.password = 'Password is required';
            } else if (formData.password.length < 8) {
                newErrors.password = 'Password must be at least 8 characters';
            }
            if (formData.password !== formData.confirmPassword) {
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
            const response = await fetch('http://localhost:3001/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Registration successful!');
                // Reset form or redirect
                setFormData({
                    restaurantName: '',
                    description: '',
                    location: { island: '', area: '', address: '', lat: null, lng: null },
                    profileImage: null,
                    backgroundImage: null,
                    ownerName: '',
                    email: '',
                    password: '',
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
                                    name="restaurantPhone"
                                    value={formData.restaurantPhone}
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
                                <input
                                    type="text"
                                    name="cuisine"
                                    value={formData.cuisine}
                                    onChange={handleInputChange}
                                    placeholder="Cuisine type (e.g., Greek, Italian)"
                                />
                            </div>

                            {/* Opening/Closing Hours Section */}
                            <div className="form-section">
                                <div className="section-header">
                                    <h2>Opening & Closing Hours</h2>
                                    <label>
                                        <input type="checkbox" name="customTimetable" checked={formData.customTimetable} onChange={handleInputChange} />
                                        Custom Timetable
                                    </label>
                                </div>
                                {!formData.customTimetable ? (
                                    <div>
                                        {formData.hours.map((row, idx) => (
                                            <div className="form-row" key={row.day}>
                                                <label>{row.day}</label>
                                                <input type="time" name={`hours-${idx}-open`} value={row.open} onChange={handleInputChange} required />
                                                <input type="time" name={`hours-${idx}-close`} value={row.close} onChange={handleInputChange} required />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div>
                                        {/* Custom timetable UI: allow user to add/remove custom rows */}
                                        {formData.customTimetableRows.map((row, idx) => (
                                            <div className="form-row" key={idx}>
                                                <input name={`customTimetableRows-${idx}-day`} value={row.day} onChange={handleInputChange} placeholder="Day" required />
                                                <input type="time" name={`customTimetableRows-${idx}-open`} value={row.open} onChange={handleInputChange} required />
                                                <input type="time" name={`customTimetableRows-${idx}-close`} value={row.close} onChange={handleInputChange} required />
                                                <button type="button" onClick={() => {
                                                    setFormData((prev) => {
                                                        const customTimetableRows = prev.customTimetableRows.filter((_, i) => i !== idx);
                                                        return { ...prev, customTimetableRows };
                                                    });
                                                }}>Remove</button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                customTimetableRows: [
                                                    ...prev.customTimetableRows,
                                                    { day: '', open: '', close: '' }
                                                ]
                                            }));
                                        }}>Add Custom Row</button>
                                    </div>
                                )}
                            </div>

                            {/* Menu Items Section (optional) */}
                            <div className="form-section">
                                <div className="section-header">
                                    <h2>Menu Items (Optional)</h2>
                                </div>
                                {formData.menuItems.map((item, idx) => (
                                    <div className="form-row" key={idx}>
                                        <input placeholder="Name" value={item.name} onChange={e => handleMenuItemChange(idx, 'name', e.target.value)} />
                                        <input placeholder="Category" value={item.category} onChange={e => handleMenuItemChange(idx, 'category', e.target.value)} />
                                        <input placeholder="Price" type="number" value={item.price} onChange={e => handleMenuItemChange(idx, 'price', e.target.value)} />
                                        <textarea placeholder="Description" value={item.description} onChange={e => handleMenuItemChange(idx, 'description', e.target.value)} />
                                        <label><input type="checkbox" checked={item.is_vegetarian} onChange={e => handleMenuItemChange(idx, 'is_vegetarian', e.target.checked)} />Vegetarian</label>
                                        <label><input type="checkbox" checked={item.is_vegan} onChange={e => handleMenuItemChange(idx, 'is_vegan', e.target.checked)} />Vegan</label>
                                        <label><input type="checkbox" checked={item.is_gluten_free} onChange={e => handleMenuItemChange(idx, 'is_gluten_free', e.target.checked)} />Gluten Free</label>
                                        <button type="button" onClick={() => handleRemoveMenuItem(idx)}>Remove</button>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddMenuItem}>Add Menu Item</button>
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

                            <div className="form-field">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    name="ownerName"
                                    value={formData.ownerName}
                                    onChange={handleInputChange}
                                    placeholder="Enter your full name"
                                    className={errors.ownerName ? 'error' : ''}
                                />
                                {errors.ownerName && <span className="error-text">{errors.ownerName}</span>}
                            </div>

                            <div className="form-field">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Enter your email"
                                    className={errors.email ? 'error' : ''}
                                />
                                {errors.email && <span className="error-text">{errors.email}</span>}
                            </div>

                            <div className="form-row">
                                <div className="form-field">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        placeholder="Create a password"
                                        className={errors.password ? 'error' : ''}
                                    />
                                    {errors.password && <span className="error-text">{errors.password}</span>}
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
