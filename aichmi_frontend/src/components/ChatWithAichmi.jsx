import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

function ChatWithAichmi() {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [restaurantName, setRestaurantName] = useState(null);
    const [messages, setMessages] = useState([
        { sender: 'ai', text: 'Hi! I am AICHMI, your AI assistant. How can I help with your reservation or special request today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatHistoryRef = useRef(null);

    useEffect(() => {
        if (restaurantId) {
            fetch(`/api/restaurants/${restaurantId}`)
                .then(res => res.json())
                .then(data => setRestaurantName(data.name || restaurantId))
                .catch(() => setRestaurantName(restaurantId));
        }
    }, [restaurantId]);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        
        const userMsg = { sender: 'user', text: input };
        setMessages(msgs => [...msgs, userMsg]);
        setInput('');
        setLoading(true);
        
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    restaurantId: restaurantId ? Number(restaurantId) : null,
                    restaurantName,
                    history: [...messages, userMsg]
                })
            });
            
            const data = await res.json();
            console.log('Received data from backend:', data); // Debug log
            
            // Add AI message to chat
            setMessages(msgs => [...msgs, { sender: 'ai', text: data.response }]);

            // Check if this is a redirect response (new logic)
            if (data.type === 'redirect' && data.reservationDetails) {
                console.log('Redirect detected, reservation details:', data.reservationDetails);
                
                // Convert the reservation details to the format expected by your reservation API
                const reservationData = {
                    venueId: data.reservationDetails.restaurantId || Number(restaurantId),
                    reservationName: data.reservationDetails.name,
                    reservationEmail: data.reservationDetails.email,
                    reservationPhone: data.reservationDetails.phone,
                    date: data.reservationDetails.date,
                    time: data.reservationDetails.time,
                    guests: Number(data.reservationDetails.partySize),
                    tableType: data.reservationDetails.tableType,
                    // Fix these null value mappings:
                    celebrationType: data.reservationDetails.celebrationType === 'None' || 
                                    data.reservationDetails.celebrationType === 'null' || 
                                    !data.reservationDetails.celebrationType ? null : data.reservationDetails.celebrationType,
                    cake: data.reservationDetails.cake === true || data.reservationDetails.cake === 'true',
                    cakePrice: data.reservationDetails.cakePrice || 0,
                    flowers: data.reservationDetails.flowers === true || data.reservationDetails.flowers === 'true',
                    flowersPrice: data.reservationDetails.flowersPrice || 0,
                    hotelName: data.reservationDetails.hotelName === 'None' || 
                               data.reservationDetails.hotelName === 'null' || 
                               !data.reservationDetails.hotelName ? null : data.reservationDetails.hotelName,
                    hotelId: data.reservationDetails.hotelId === 'null' || 
                             data.reservationDetails.hotelId === '0' || 
                             !data.reservationDetails.hotelId ? null : Number(data.reservationDetails.hotelId),
                    specialRequests: data.reservationDetails.specialRequests === 'None' || 
                                    data.reservationDetails.specialRequests === 'null' || 
                                    !data.reservationDetails.specialRequests ? null : data.reservationDetails.specialRequests
                };

                console.log('Sending reservation data to API:', reservationData);
                
                // Send to reservation API
                const reservationResponse = await fetch('/api/reservation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reservationData)
                });
                
                const reservationResult = await reservationResponse.json();
                console.log('Reservation API response:', reservationResult);
                
                if (reservationResponse.ok) {
                    // Navigate to confirmation page
                    navigate('/confirmation', { state: reservationData });
                } else {
                    // Handle reservation error
                    setMessages(msgs => [...msgs, { 
                        sender: 'ai', 
                        text: `Sorry, there was an error saving your reservation: ${reservationResult.error || 'Unknown error'}` 
                    }]);
                }
                return;
            }
            
        } catch (err) {
            console.error('Error in handleSend:', err);
            setMessages(msgs => [...msgs, { sender: 'ai', text: 'Sorry, there was an error contacting the AI.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-page">
            <div className="chat-container improved">
                <h1 className="chat-title">Chat with AICHMI</h1>
                {restaurantId && (
                    <div className="chat-context">
                        You are chatting about reservation for <b>{restaurantName ? restaurantName : '...'}</b>.
                    </div>
                )}
                <div className="chat-history improved" ref={chatHistoryRef}>
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`chat-message improved ${msg.sender}`}
                        >
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                    ))}
                    {loading && <div className="chat-message improved ai">AICHMI is typing...</div>}
                </div>
                <form className="chat-input-row" onSubmit={handleSend} autoComplete="off">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Type your message..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        aria-label="Type your message"
                        disabled={loading}
                    />
                    <button className="cta-button primary chat-send-btn" type="submit" disabled={loading}>Send</button>
                </form>
            </div>
        </div>
    );
}

export default ChatWithAichmi;