import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

function stripReservationDataBlock(text) {
  // Removes the [RESERVATION_DATA] ... [/RESERVATION_DATA] block from the text
  return text.replace(/\[RESERVATION_DATA\][\s\S]*?\[\/RESERVATION_DATA\]/g, '').trim();
}

function parseReservationDetails(text) {
  const details = {};
  const lines = text.split('\n');
  lines.forEach(line => {
    const getValue = (prefix) => {
      const value = line.split(':')[1]?.trim();
      return value === '' ? null : value;
    };

    if (line.startsWith('RestaurantId:')) details.venueId = Number(getValue('RestaurantId:'));
    if (line.startsWith('CustomerName:')) details.reservationName = getValue('CustomerName:');
    if (line.startsWith('CustomerEmail:')) details.reservationEmail = getValue('CustomerEmail:');
    if (line.startsWith('CustomerPhone:')) details.reservationPhone = getValue('CustomerPhone:');
    if (line.startsWith('Date:')) details.date = getValue('Date:');
    if (line.startsWith('Time:')) {
      let t = getValue('Time:');
      // Normalize to HH:MM if only hour is provided
      if (t && /^\d{1,2}$/.test(t)) {
        t = t.padStart(2, '0') + ':00';
      }
      details.time = t;
    }
    if (line.startsWith('People:')) details.guests = Number(getValue('People:'));
    if (line.startsWith('TableType:')) details.tableType = getValue('TableType:');
    if (line.startsWith('CelebrationType:')) details.celebrationType = getValue('CelebrationType:');
    if (line.startsWith('Cake:')) details.cake = getValue('Cake:')?.toLowerCase() === 'true';
    if (line.startsWith('CakePrice:')) details.cakePrice = Number(getValue('CakePrice:'));
    if (line.startsWith('Flowers:')) details.flowers = getValue('Flowers:')?.toLowerCase() === 'true';
    if (line.startsWith('FlowersPrice:')) details.flowersPrice = Number(getValue('FlowersPrice:'));
    if (line.startsWith('HotelName:')) details.hotelName = getValue('HotelName:');
    if (line.startsWith('HotelId:')) {
      const num = getValue('HotelId:');
      details.hotelId = num === null ? null : Number(num);
      // If the value is 0, treat as null (since 0 is not a valid hotel_id)
      if (details.hotelId === 0) details.hotelId = null;
    }
    if (line.startsWith('SpecialRequests:')) details.specialRequests = getValue('SpecialRequests:');
  });
  return details;
}

function ChatWithAichmi() {
    const { restaurantId } = useParams();
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
            const aiText = data.response;
            setMessages(msgs => [...msgs, { sender: 'ai', text: stripReservationDataBlock(aiText) }]);

            // Detect reservation confirmation and trigger API call
            if (aiText.includes('[RESERVATION_DATA]')) {
              const details = parseReservationDetails(aiText); // your existing function
              console.log('Sending reservation details:', details); // <-- Add this
              const response = await fetch('/api/reservation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(details)
              });
              console.log('Reservation API response:', await response.json());
              setMessages(msgs => [...msgs, { sender: 'ai', text: '✅ Your reservation has been saved in our system!' }]);
            }
        } catch (err) {
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