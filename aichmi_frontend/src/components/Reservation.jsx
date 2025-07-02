import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

function Reservation() {
    const { restaurantId } = useParams();
    const [restaurant, setRestaurant] = useState(null);

    useEffect(() => {
        // Fetch restaurant details based on restaurantId
        const fetchRestaurant = async () => {
            try {
                const response = await fetch(`/api/restaurants/${restaurantId}`);
                const data = await response.json();
                setRestaurant(data);
            } catch (error) {
                console.error('Error fetching restaurant details:', error);
            }
        };

        fetchRestaurant();
    }, [restaurantId]);

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
        <div className="reservation-page">
            <div className="container">
                <h1 className="page-title">Make a Reservation at {restaurant.name}</h1>
                <p className="page-subtitle">{restaurant.description}</p>
                <form className="reservation-form">
                    <label htmlFor="name">Your Name:</label>
                    <input type="text" id="name" name="name" required />

                    <label htmlFor="date">Date:</label>
                    <input type="date" id="date" name="date" required />

                    <label htmlFor="time">Time:</label>
                    <input type="time" id="time" name="time" required />

                    <button type="submit" className="cta-button primary">Book Now</button>
                </form>
            </div>
        </div>
    );
}

export default Reservation;