import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function Confirmation() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after component mounts
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  if (!state) {
    return (
      <div className="reservation-confirmation">
        <div className="container">
          <div className="confirmation-card">
            <div className="error-icon">❌</div>
            <h1 className="page-title">No Reservation Found</h1>
            <p className="error-message">We couldn't find your reservation details. Please try making a new reservation.</p>
            <div className="confirmation-actions">
              <button 
                className="cta-button primary"
                onClick={() => navigate('/')}
              >
                Go Home
              </button>
              <button 
                className="cta-button secondary"
                onClick={() => navigate('/browse-restaurants')}
              >
                Browse Restaurants
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reservation-confirmation">
      <div className="container">
        <div className={`confirmation-card ${isVisible ? 'fade-in-card' : ''}`}>
          <div className="success-icon">🎉</div>
          <h1 className="page-title">Thank you for your reservation!</h1>
          <p className="success-message">
            Your reservation has been successfully confirmed. We look forward to welcoming you to an authentic Greek dining experience!
          </p>
          
          {/* Greek-inspired divider */}
          <div className="greek-divider">
            <svg width="120" height="18" viewBox="0 0 120 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 9 H12 V0 H24 V18 H36 V0 H48 V18 H60 V0 H72 V18 H84 V0 H96 V18 H108 V0 H120" stroke="#1e3a8a" strokeWidth="1.5"/>
            </svg>
          </div>
          
          <div className="reservation-details">
            <h2>Reservation Details</h2>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">👤 Name:</span>
                <span className="value">{state.reservationName}</span>
              </div>
              <div className="detail-item">
                <span className="label">📧 Email:</span>
                <span className="value">{state.reservationEmail}</span>
              </div>
              <div className="detail-item">
                <span className="label">📞 Phone:</span>
                <span className="value">{state.reservationPhone}</span>
              </div>
              <div className="detail-item">
                <span className="label">📅 Date:</span>
                <span className="value">{state.date}</span>
              </div>
              <div className="detail-item">
                <span className="label">🕐 Time:</span>
                <span className="value">{state.time}</span>
              </div>
              <div className="detail-item">
                <span className="label">👥 Guests:</span>
                <span className="value">{state.guests} {state.guests === 1 ? 'person' : 'people'}</span>
              </div>
              <div className="detail-item">
                <span className="label">🪑 Table Type:</span>
                <span className="value">{state.tableType}</span>
              </div>
              
              {/* Conditional details */}
              {state.celebrationType && (
                <div className="detail-item special">
                  <span className="label">🎊 Celebration:</span>
                  <span className="value">{state.celebrationType}</span>
                </div>
              )}
              
              {state.cake && (
                <div className="detail-item special">
                  <span className="label">🎂 Cake:</span>
                  <span className="value">
                    Yes {state.cakePrice ? `(€${state.cakePrice})` : ''}
                  </span>
                </div>
              )}
              
              {state.flowers && (
                <div className="detail-item special">
                  <span className="label">🌸 Flowers:</span>
                  <span className="value">
                    Yes {state.flowersPrice ? `(€${state.flowersPrice})` : ''}
                  </span>
                </div>
              )}
              
              {state.hotelName && (
                <div className="detail-item">
                  <span className="label">🏨 Hotel:</span>
                  <span className="value">{state.hotelName}</span>
                </div>
              )}
              
              {state.specialRequests && (
                <div className="detail-item full-width">
                  <span className="label">📝 Special Requests:</span>
                  <span className="value">{state.specialRequests}</span>
                </div>
              )}
            </div>
          </div>

          {/* Additional info section */}
          <div className="confirmation-info">
            <div className="info-card">
              <h3>📧 Confirmation Email</h3>
              <p>A confirmation email has been sent to <strong>{state.reservationEmail}</strong></p>
            </div>
            <div className="info-card">
              <h3>📱 Contact Us</h3>
              <p>For any changes or questions, please call us at <strong>+30 224 102 7000</strong></p>
            </div>
          </div>

          <div className="confirmation-actions">
            <button 
              className="cta-button primary"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
            <button 
              className="cta-button secondary"
              onClick={() => navigate('/browse-restaurants')}
            >
              Browse More Restaurants
            </button>
          </div>

          {/* Footer message */}
          <div className="confirmation-footer">
            <p>🇬🇷 <em>Γεια σας! We can't wait to welcome you to an authentic Greek experience!</em></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Confirmation;