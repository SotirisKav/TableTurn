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
    if (line.startsWith('RestaurantId:')) details.restaurantId = Number(line.split(':')[1].trim());
    if (line.startsWith('CustomerName:')) details.customerName = line.split(':')[1].trim();
    if (line.startsWith('Date:')) details.date = line.split(':')[1].trim();
    if (line.startsWith('Time:')) details.time = line.split(':')[1].trim();
    if (line.startsWith('People:')) details.people = Number(line.split(':')[1].trim());
    if (line.startsWith('SpecialRequests:')) details.specialRequests = line.split(':')[1].trim();
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
              await fetch('/api/reservation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(details)
              });
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