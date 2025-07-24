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

            // Check if this is a redirect response (reservation has been created by the agent)
            if (data.type === 'redirect' && data.reservationDetails) {
                console.log('Redirect detected, reservation details:', data.reservationDetails);
                
                // Check if reservation was successfully created
                if (data.reservationDetails.success) {
                    // Prepare data for confirmation page
                    const confirmationData = {
                        restaurantName: data.reservationDetails.restaurant.name,
                        reservationId: data.reservationDetails.reservationId,
                        customerName: data.reservationDetails.customer.name,
                        customerEmail: data.reservationDetails.customer.email,
                        customerPhone: data.reservationDetails.customer.phone,
                        date: data.reservationDetails.reservation.date,
                        time: data.reservationDetails.reservation.time,
                        guests: data.reservationDetails.reservation.partySize,
                        tableType: data.reservationDetails.reservation.tableType,
                        success: true
                    };

                    console.log('Navigating to confirmation page with:', confirmationData);
                    
                    // Navigate to confirmation page with reservation details
                    navigate('/confirmation', { state: confirmationData });
                } else {
                    // Handle reservation creation error
                    setMessages(msgs => [...msgs, { 
                        sender: 'ai', 
                        text: 'Sorry, there was an issue creating your reservation. Please try again or contact us directly.' 
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