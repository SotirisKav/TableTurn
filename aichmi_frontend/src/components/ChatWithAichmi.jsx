import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

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
            setMessages(msgs => [...msgs, { sender: 'ai', text: data.response }]);
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