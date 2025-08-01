import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import '../styles/Reservation.css';

function Reservation() {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [restaurant, setRestaurant] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', date: '', time: '', partySize: 2 });
    const [status, setStatus] = useState('idle');

    useEffect(() => {
        // Fetch restaurant details based on restaurantId
        const fetchRestaurant = async () => {
            try {
                const response = await fetch(`/api/restaurants/${restaurantId}`);
                const data = await response.json();
                setRestaurant(data);
            } catch (error) {
                setRestaurant(null);
            }
        };
        fetchRestaurant();
    }, [restaurantId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('loading');
        // Simulate booking
        setTimeout(() => setStatus('success'), 1200);
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
            <div className="container reservation-center-container">
                <div className="reservation-card">
                    <h1 className="page-title">Make a Reservation at {restaurant.name}</h1>
                    <p className="page-subtitle">{restaurant.description}</p>
                    <form className="reservation-form" onSubmit={handleSubmit} autoComplete="off">
                        <label htmlFor="name">Your Name</label>
                        <input type="text" id="name" name="name" value={form.name} onChange={handleChange} required />

                        <label htmlFor="email">Email</label>
                        <input type="email" id="email" name="email" value={form.email} onChange={handleChange} required />

                        <label htmlFor="phone">Telephone</label>
                        <input type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} required pattern="[0-9+\-() ]*" />

                        <label htmlFor="date">Date</label>
                        <input type="date" id="date" name="date" value={form.date} onChange={handleChange} required />

                        <label htmlFor="time">Time</label>
                        <input type="time" id="time" name="time" value={form.time} onChange={handleChange} required />

                        <label htmlFor="partySize">Party Size</label>
                        <select id="partySize" name="partySize" value={form.partySize} onChange={handleChange} required>
                            {[...Array(12)].map((_, i) => (
                                <option key={i+1} value={i+1}>{i+1}</option>
                            ))}
                        </select>

                        <button type="submit" className="cta-button primary reservation-submit" disabled={status==='loading'}>
                            {status === 'loading' ? 'Booking...' : 'Book Now'}
                        </button>
                        {status === 'success' && <div className="reservation-success">Reservation successful! We look forward to seeing you.</div>}
                    </form>
                    <div className="reservation-divider"><span>or</span></div>
                    <button className="cta-button secondary reservation-chat-btn" type="button" tabIndex={0} onClick={() => navigate(`/chat/${restaurantId}`)}>
                        Chat with Tablio (AI) for special requests
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Reservation;