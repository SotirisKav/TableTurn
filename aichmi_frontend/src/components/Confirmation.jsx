import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function Confirmation() {
  const { state } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Debug log to see what state we're getting
    console.log('Confirmation page state:', state);
  }, [state]);

  // If no state, show error
  if (!state) {
    return (
      <div className="confirmation-page">
        <div className="container">
          <div className="confirmation-content">
            <h1>No Reservation Found</h1>
            <p>We couldn't find your reservation details.</p>
            <button 
              className="cta-button primary"
              onClick={() => navigate('/')}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="confirmation-page">
      <div className="container">
        <div className="confirmation-content">
          <div className="confirmation-header">
            <h1>Thank you for your reservation!</h1>
            <p>Your table has been successfully booked.</p>
          </div>

          <div className="reservation-summary">
            <h2>Reservation Details</h2>
            
            <div className="detail-grid">
              <div className="detail-item">
                <span>Name</span>
                <span>{state.reservationName || state.name}</span>
              </div>
              
              <div className="detail-item">
                <span>Email</span>
                <span>{state.reservationEmail || state.email}</span>
              </div>
              
              <div className="detail-item">
                <span>Phone</span>
                <span>{state.reservationPhone || state.phone}</span>
              </div>
              
              <div className="detail-item">
                <span>Date</span>
                <span>{state.date}</span>
              </div>
              
              <div className="detail-item">
                <span>Time</span>
                <span>{state.time}</span>
              </div>
              
              <div className="detail-item">
                <span>Guests</span>
                <span>{state.guests || state.partySize}</span>
              </div>
              
              <div className="detail-item">
                <span>Table Type</span>
                <span>{state.tableType}</span>
              </div>

              {state.specialRequests && (
                <div className="detail-item special">
                  <span>Special Requests</span>
                  <span>{state.specialRequests}</span>
                </div>
              )}
            </div>
          </div>

          <div className="confirmation-info">
            <p>A confirmation email has been sent to <strong>{state.reservationEmail || state.email}</strong></p>
            <p>For any changes, please call us at <strong>+30 224 102 7000</strong></p>
          </div>

          <div className="confirmation-actions">
            <button 
              className="cta-button secondary"
              onClick={() => navigate('/browse-restaurants')}
            >
              Browse More Restaurants
            </button>
            <button 
              className="cta-button primary"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Confirmation;