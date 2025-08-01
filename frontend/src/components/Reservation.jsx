import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import '../styles/Reservation.css';

function Reservation() {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [restaurant, setRestaurant] = useState(null);
    const [tableTypes, setTableTypes] = useState([]);
    const [tableCapacities, setTableCapacities] = useState({});
    const [openingHours, setOpeningHours] = useState({});
    const [form, setForm] = useState({ 
        name: '', 
        email: '', 
        phone: '', 
        date: new Date().toISOString().split('T')[0], // Default to today
        time: '', 
        partySize: 2, 
        tableType: '',
        specialRequests: ''
    });
    const [status, setStatus] = useState('idle');

    useEffect(() => {
        // Fetch restaurant details, table types, capacities, and opening hours
        const fetchData = async () => {
            try {
                const [restaurantResponse, tableTypesResponse, capacitiesResponse, hoursResponse] = await Promise.all([
                    fetch(`/api/restaurants/${restaurantId}`),
                    fetch(`/api/restaurants/${restaurantId}/table-types`),
                    fetch(`/api/restaurants/${restaurantId}/table-capacities`),
                    fetch(`/api/restaurants/${restaurantId}/opening-hours`)
                ]);
                
                const restaurantData = await restaurantResponse.json();
                setRestaurant(restaurantData);
                
                if (tableTypesResponse.ok) {
                    const tableTypesData = await tableTypesResponse.json();
                    setTableTypes(tableTypesData);
                    // Set default table type if available
                    if (tableTypesData.length > 0) {
                        setForm(f => ({ ...f, tableType: tableTypesData[0].table_type }));
                    }
                }
                
                if (capacitiesResponse.ok) {
                    const capacitiesData = await capacitiesResponse.json();
                    const capacityMap = {};
                    capacitiesData.forEach(item => {
                        capacityMap[item.table_type] = item.max_capacity;
                    });
                    setTableCapacities(capacityMap);
                }
                
                if (hoursResponse.ok) {
                    const hoursData = await hoursResponse.json();
                    const hoursMap = {};
                    hoursData.forEach(item => {
                        hoursMap[item.day_of_week] = {
                            open_time: item.open_time,
                            close_time: item.close_time,
                            is_closed: item.is_closed
                        };
                    });
                    setOpeningHours(hoursMap);
                }
            } catch (error) {
                setRestaurant(null);
            }
        };
        fetchData();
    }, [restaurantId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        
        // Clear time selection when date changes to regenerate time slots
        if (name === 'date') {
            setForm(f => ({ ...f, time: '' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        
        try {
            const response = await fetch('/api/reservation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    venueId: parseInt(restaurantId),
                    reservationName: form.name,
                    reservationEmail: form.email,
                    reservationPhone: form.phone,
                    date: form.date,
                    time: form.time,
                    guests: parseInt(form.partySize),
                    tableType: form.tableType,
                    specialRequests: form.specialRequests
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                setStatus('success');
                // Navigate to confirmation after 2 seconds
                setTimeout(() => {
                    navigate('/confirmation', { 
                        state: { 
                            success: true,
                            restaurantName: restaurant.name,
                            reservationId: result.reservation_id,
                            ...form 
                        } 
                    });
                }, 2000);
            } else {
                const error = await response.json();
                setStatus('error');
                alert(error.error || 'Failed to create reservation');
            }
        } catch (error) {
            setStatus('error');
            alert('Failed to create reservation');
        }
    };

    const handleChatRedirect = () => {
        navigate(`/chat/${restaurantId}`);
    };
    
    // Generate time slots based on restaurant opening hours for selected date
    const generateTimeSlots = () => {
        if (!form.date || Object.keys(openingHours).length === 0) {
            // Default slots if no date selected or opening hours not loaded
            const slots = [];
            for (let hour = 18; hour <= 23; hour++) {
                for (let minute = 0; minute < 60; minute += 30) {
                    if (hour === 23 && minute > 30) break;
                    const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
                    slots.push({ value: time24, label: time12 });
                }
            }
            return slots;
        }
        
        // Get day of week (0 = Sunday, 1 = Monday, etc.)
        const selectedDate = new Date(form.date);
        const dayOfWeek = selectedDate.getDay();
        
        const todayHours = openingHours[dayOfWeek];
        
        if (!todayHours || todayHours.is_closed) {
            return [{ value: '', label: 'Restaurant closed on this day' }];
        }
        
        // Parse opening and closing times
        const [openHour, openMinute] = todayHours.open_time.split(':').map(Number);
        const [closeHour, closeMinute] = todayHours.close_time.split(':').map(Number);
        
        const slots = [];
        
        // Generate slots from opening to closing time
        for (let hour = openHour; hour <= closeHour; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                // Skip if before opening time
                if (hour === openHour && minute < openMinute) continue;
                
                // Stop if past closing time
                if (hour === closeHour && minute > closeMinute) break;
                
                // Don't allow reservations in the last 30 minutes before closing
                if (hour === closeHour && minute >= closeMinute - 30) break;
                
                const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
                slots.push({ value: time24, label: time12 });
            }
        }
        
        return slots.length > 0 ? slots : [{ value: '', label: 'No available times' }];
    };
    
    // Get minimum date (today)
    const getMinDate = () => {
        return new Date().toISOString().split('T')[0];
    };
    
    // Get valid party sizes based on selected table type
    const getValidPartySizes = () => {
        if (!form.tableType || !tableCapacities[form.tableType]) {
            return [...Array(12)].map((_, i) => i + 1);
        }
        const maxCapacity = tableCapacities[form.tableType];
        return [...Array(maxCapacity)].map((_, i) => i + 1);
    };
    
    // Filter table types based on party size
    const getValidTableTypes = () => {
        return tableTypes.filter(type => {
            const maxCapacity = tableCapacities[type.table_type];
            return !maxCapacity || form.partySize <= maxCapacity;
        });
    };

    if (!restaurant) {
        return (
            <div className="reservation-page">
                <div className="container">
                    <h1 className="page-title">Loading...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="reservation-page bg-greek">
            <div className="reservation-container">
                <div className="reservation-wrapper">
                    {/* Left Column: Information & Context Zone */}
                    <div className="info-context-zone">
                        <div className="main-headline">
                            <h1>Make a Reservation at {restaurant.name}</h1>
                            <p className="restaurant-description">{restaurant.description}</p>
                        </div>
                        
                        <div className="unified-chat-component">
                            <button 
                                className="chat-cta-btn" 
                                onClick={handleChatRedirect}
                            >
                                💬 Chat with Tablio
                            </button>
                            
                            <h3>Why Chat with Tablio?</h3>
                            <ul className="chat-benefits">
                                <li>Get instant answers about availability</li>
                                <li>Ask about menu recommendations</li>
                                <li>Discuss special dietary requirements</li>
                                <li>Plan celebrations or special occasions</li>
                                <li>Make reservations through conversation</li>
                            </ul>
                        </div>
                    </div>
                    
                    {/* Right Column: Action Zone (Booking Form) */}
                    <div className="action-zone">
                        <div className="form-card">
                            <div className="form-header">
                                <div className="restaurant-location-form">
                                    <span className="location-icon">📍</span>
                                    <span>{restaurant.address}, {restaurant.area}, {restaurant.island}</span>
                                </div>
                            </div>
                        
                        <form className="reservation-form" onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-group">
                                <label htmlFor="name">Your Name</label>
                                <input type="text" id="name" name="name" value={form.name} onChange={handleChange} required />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input type="email" id="email" name="email" value={form.email} onChange={handleChange} required />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="phone">Phone Number</label>
                                <input type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} required pattern="[0-9+\-() ]*" />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="date">Reservation Date</label>
                                <input 
                                    type="date" 
                                    id="date" 
                                    name="date" 
                                    value={form.date} 
                                    onChange={handleChange} 
                                    min={getMinDate()}
                                    required 
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="time">Preferred Time</label>
                                <select id="time" name="time" value={form.time} onChange={handleChange} required>
                                    <option value="">Select a time</option>
                                    {generateTimeSlots().map((slot) => (
                                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="partySize">Party Size</label>
                                <select id="partySize" name="partySize" value={form.partySize} onChange={handleChange} required>
                                    {getValidPartySizes().map((size) => (
                                        <option key={size} value={size}>{size} {size === 1 ? 'person' : 'people'}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {tableTypes.length > 0 && (
                                <div className="form-group">
                                    <label htmlFor="tableType">Table Type</label>
                                    <select id="tableType" name="tableType" value={form.tableType} onChange={handleChange} required>
                                        {getValidTableTypes().map((type) => (
                                            <option key={type.table_type} value={type.table_type}>
                                                {type.table_type.charAt(0).toUpperCase() + type.table_type.slice(1)}
                                                {type.table_price > 0 && ` - €${type.table_price}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            <div className="form-group">
                                <label htmlFor="specialRequests">Special Requests</label>
                                <textarea 
                                    id="specialRequests" 
                                    name="specialRequests" 
                                    value={form.specialRequests} 
                                    onChange={handleChange}
                                    placeholder="Any dietary restrictions, allergies, celebration details, or special accommodations..."
                                    rows="3"
                                />
                            </div>

                            <button type="submit" className="reservation-submit" disabled={status==='loading'}>
                                {status === 'loading' ? 'Booking Your Table...' : 'Book Now'}
                            </button>
                            
                            {status === 'success' && (
                                <div className="reservation-success">
                                    ✅ Reservation successful! Redirecting to confirmation...
                                </div>
                            )}
                            {status === 'error' && (
                                <div className="reservation-error">
                                    ❌ There was an error with your reservation. Please try again.
                                </div>
                            )}
                        </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Reservation;