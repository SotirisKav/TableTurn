import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

// Component for parsing and formatting structured text
function parseStructuredText(text) {
    // Check if it's a reservation summary
    if (text.match(/(?:reservation|booking)\s+(?:summary|details|for)/i) || 
        (text.includes('Date') || text.includes('Time') || text.includes('Guests')) && 
        (text.includes('@') || text.includes('phone') || text.includes('table'))) {
        return parseReservationSummary(text);
    }
    
    // Check if it's a menu (contains prices and food items)
    if (text.includes('€') && (text.includes('APPETIZERS') || text.includes('DESSERT') || text.includes('menu') || text.match(/\*\*[^*]+\*\*/))) {
        return parseMenu(text);
    }
    
    // Check if it's a list (contains bullet points or numbers)
    if (text.includes('•') || /^\d+\./.test(text.trim()) || text.includes('- ')) {
        return parseList(text);
    }
    
    // Default paragraph
    return { type: 'paragraph', content: text };
}

function parseMenu(text) {
    const sections = [];
    
    // First, try to split by categories (look for common menu category patterns)
    const categoryPatterns = /\*\*\*([A-Z\s]+)\*\*\*|\*([A-Z\s]{5,})\*|([A-Z\s]{5,}):/g;
    let lastIndex = 0;
    const parts = [];
    let match;
    
    while ((match = categoryPatterns.exec(text)) !== null) {
        // Add content before this match
        if (match.index > lastIndex) {
            const content = text.substring(lastIndex, match.index).trim();
            if (content) {
                parts.push({ type: 'content', text: content });
            }
        }
        
        // Add the category header
        const categoryName = (match[1] || match[2] || match[3] || '').trim().replace(/\*/g, '');
        if (categoryName) {
            parts.push({ type: 'category', name: categoryName });
        }
        
        lastIndex = categoryPatterns.lastIndex;
    }
    
    // Add remaining content
    if (lastIndex < text.length) {
        const content = text.substring(lastIndex).trim();
        if (content) {
            parts.push({ type: 'content', text: content });
        }
    }
    
    // If no categories found, treat entire text as content
    if (parts.length === 0 || parts.every(p => p.type === 'content')) {
        parts.length = 0;
        parts.push({ type: 'content', text: text });
    }
    
    let currentSection = { type: 'section', title: 'Menu Items', items: [] };
    
    for (const part of parts) {
        if (part.type === 'category') {
            // Start new section
            if (currentSection.items.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { type: 'section', title: part.name, items: [] };
        } else if (part.type === 'content') {
            // Parse menu items from content
            const items = parseMenuItems(part.text);
            currentSection.items.push(...items);
        }
    }
    
    if (currentSection.items.length > 0) {
        sections.push(currentSection);
    }
    
    return { type: 'menu', sections: sections.length > 0 ? sections : [{ type: 'section', title: 'Menu Items', items: parseMenuItems(text) }] };
}

function parseMenuItems(text) {
    const items = [];
    
    // Look for patterns like **Name** description (dietary info) price
    const itemPattern = /\*\*([^*]+)\*\*([^€]*?)€(\d+(?:\.\d{2})?)/g;
    let match;
    
    while ((match = itemPattern.exec(text)) !== null) {
        const name = match[1].trim();
        const descriptionPart = match[2].trim();
        const price = '€' + match[3];
        
        // Extract dietary information
        const dietaryInfo = [];
        const dietaryPattern = /\(([^)]+)\)/g;
        let dietaryMatch;
        let cleanDescription = descriptionPart;
        
        while ((dietaryMatch = dietaryPattern.exec(descriptionPart)) !== null) {
            const info = dietaryMatch[1].trim();
            if (info.match(/vegan|vegetarian|gluten.free|dairy.free/i)) {
                dietaryInfo.push(info);
            }
            cleanDescription = cleanDescription.replace(dietaryMatch[0], '').trim();
        }
        
        // Clean up description
        cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim();
        
        // Build item display
        let itemDisplay = name;
        if (cleanDescription) {
            itemDisplay += ` - ${cleanDescription}`;
        }
        
        items.push({
            item: itemDisplay,
            price: price,
            dietary: dietaryInfo
        });
    }
    
    // Fallback: simple price matching if complex pattern didn't work
    if (items.length === 0) {
        const lines = text.split('\n').filter(line => line.trim() && line.includes('€'));
        
        for (const line of lines) {
            const priceMatch = line.match(/€(\d+(?:\.\d{2})?)/);
            if (priceMatch) {
                const price = priceMatch[0];
                let itemName = line.replace(/€\d+(?:\.\d{2})?/, '').replace(/\*+/g, '').trim();
                
                // Extract dietary info from simple format
                const dietaryInfo = [];
                const dietaryPattern = /\(([^)]*(?:vegan|vegetarian|gluten.free|dairy.free)[^)]*)\)/gi;
                let dietaryMatch;
                
                while ((dietaryMatch = dietaryPattern.exec(itemName)) !== null) {
                    dietaryInfo.push(dietaryMatch[1].trim());
                    itemName = itemName.replace(dietaryMatch[0], '').trim();
                }
                
                itemName = itemName.replace(/\s+/g, ' ').trim();
                
                if (itemName) {
                    items.push({
                        item: itemName,
                        price: price,
                        dietary: dietaryInfo
                    });
                }
            }
        }
    }
    
    return items;
}

function parseReservationSummary(text) {
    const details = [];
    
    // Look for common reservation patterns
    const patterns = [
        { key: 'Date', pattern: /(?:date|for|on)\s*[:\-]?\s*([A-Za-z]+ \d+(?:st|nd|rd|th)?(?:, \d{4})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i },
        { key: 'Time', pattern: /(?:time|at)\s*[:\-]?\s*(\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m)/i },
        { key: 'Guests', pattern: /(?:for|party of|guests?)\s*[:\-]?\s*(\d+)\s*(?:people|guests?|persons?)?/i },
        { key: 'Table', pattern: /(?:table|seating)\s*[:\-]?\s*(standard|grass|premium|outdoor|indoor|window|private)/i },
        { key: 'Name', pattern: /(?:name|under)\s*[:\-]?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)/i },
        { key: 'Email', pattern: /(?:email|e-mail)\s*[:\-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i },
        { key: 'Phone', pattern: /(?:phone|number|contact)\s*[:\-]?\s*([\d\s\-\+\(\)]{8,})/i }
    ];
    
    for (const { key, pattern } of patterns) {
        const match = text.match(pattern);
        if (match) {
            details.push({
                label: key,
                value: match[1].trim()
            });
        }
    }
    
    return { type: 'reservation', details };
}

function parseList(text) {
    const items = text.split(/\n+/).filter(line => line.trim());
    return { type: 'list', items: items.map(item => item.replace(/^[-•\d+.]\s*/, '').trim()) };
}

// Component for animated text rendering with structured content support
function AnimatedText({ text, delay = 0 }) {
    const [displayedContent, setDisplayedContent] = useState(null);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        // Handle undefined or null text
        if (!text || typeof text !== 'string') {
            console.error('AnimatedText received invalid text:', text);
            setDisplayedContent(null);
            setIsComplete(true);
            return;
        }

        setDisplayedContent(null);
        setIsComplete(false);
        
        const parsedContent = parseStructuredText(text);

        const timer = setTimeout(() => {
            setDisplayedContent(parsedContent);
            setIsComplete(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [text, delay]);

    const renderContent = (content) => {
        if (!content) return null;

        switch (content.type) {
            case 'menu':
                return (
                    <div className="menu-display">
                        {content.sections.map((section, idx) => (
                            <div key={idx} className="menu-section">
                                <h4 className="menu-section-title">{section.title}</h4>
                                <div className="menu-items">
                                    {section.items.map((menuItem, itemIdx) => (
                                        <div key={itemIdx} className="menu-item">
                                            <div className="menu-item-content">
                                                <span className="menu-item-name">{menuItem.item}</span>
                                                {menuItem.dietary && menuItem.dietary.length > 0 && (
                                                    <div className="menu-item-dietary">
                                                        {menuItem.dietary.map((diet, dietIdx) => (
                                                            <span key={dietIdx} className="dietary-tag">{diet}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {menuItem.price && (
                                                <span className="menu-item-price">{menuItem.price}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            
            case 'reservation':
                return (
                    <div className="reservation-summary">
                        <h4 className="reservation-title">Reservation Details</h4>
                        <div className="reservation-details">
                            {content.details.map((detail, idx) => (
                                <div key={idx} className="reservation-detail">
                                    <span className="detail-label">{detail.label}:</span>
                                    <span className="detail-value">{detail.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            
            case 'list':
                return (
                    <ul className="structured-list">
                        {content.items.map((item, idx) => (
                            <li key={idx}>{item}</li>
                        ))}
                    </ul>
                );
            
            default:
                return <div>{content.content}</div>;
        }
    };

    return (
        <div className={`animated-text ${isComplete ? 'complete' : ''}`}>
            {renderContent(displayedContent)}
        </div>
    );
}

function ChatWithAichmi() {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [restaurantName, setRestaurantName] = useState(null);
    const [messages, setMessages] = useState([
        { sender: 'ai', text: 'Hi! I am AICHMI, your AI assistant. How can I help with your reservation or special request today?', timestamp: new Date() }
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
        
        const userMsg = { sender: 'user', text: input, timestamp: new Date() };
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
            console.log('Response text:', data.response); // Debug the specific response text
            console.log('Response type:', typeof data.response); // Debug the type
            console.log('Data keys:', Object.keys(data)); // See all properties
            
            // Validate response before adding to chat
            const responseText = String(data.response || data.text || 'Sorry, I received an empty response.');
            console.log('Final response text to display:', responseText);
            console.log('Response text length:', responseText.length);
            
            // Add AI message to chat
            setMessages(msgs => [...msgs, { sender: 'ai', text: responseText, timestamp: new Date() }]);

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
                        text: 'Sorry, there was an issue creating your reservation. Please try again or contact us directly.',
                        timestamp: new Date()
                    }]);
                }
                return;
            }
            
        } catch (err) {
            console.error('Error in handleSend:', err);
            setMessages(msgs => [...msgs, { sender: 'ai', text: 'Sorry, there was an error contacting the AI.', timestamp: new Date() }]);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="premium-chat-page">
            <div className="premium-chat-container">
                {/* Header with floating effect */}
                <div className="premium-chat-header">
                    <div className="chat-avatar-container">
                        <div className="chat-avatar">
                            <div className="avatar-icon">A</div>
                            <div className="status-indicator"></div>
                        </div>
                    </div>
                    <div className="chat-header-info">
                        <h1 className="premium-chat-title">AICHMI Assistant</h1>
                        <div className="chat-status">
                            <span className="status-dot"></span>
                            Online - Ready to help
                        </div>
                    </div>
                </div>

                {restaurantId && (
                    <div className="premium-chat-context">
                        <div className="context-text">
                            Booking for <span className="restaurant-name">{restaurantName || 'Loading...'}</span>
                        </div>
                    </div>
                )}

                {/* Messages area with premium styling */}
                <div className="premium-chat-history" ref={chatHistoryRef}>
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`premium-message-wrapper ${msg.sender}`}
                        >
                            <div className={`premium-message ${msg.sender}`}>
                                <div className="message-content">
                                    {msg.sender === 'ai' ? (
                                        <AnimatedText text={msg.text} delay={200} />
                                    ) : (
                                        <div>{msg.text}</div>
                                    )}
                                </div>
                                <div className="message-timestamp">
                                    {formatTime(msg.timestamp)}
                                </div>
                            </div>
                            {msg.sender === 'ai' && (
                                <div className="message-avatar">
                                    <div className="ai-avatar">A</div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="premium-message-wrapper ai">
                            <div className="premium-message ai typing">
                                <div className="typing-indicator">
                                    <div className="typing-dots">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                    <div className="typing-text">AICHMI is typing...</div>
                                </div>
                            </div>
                            <div className="message-avatar">
                                <div className="ai-avatar">A</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Premium input area */}
                <form className="premium-input-container" onSubmit={handleSend} autoComplete="off">
                    <div className="input-wrapper">
                        <input
                            type="text"
                            className="premium-input"
                            placeholder="Ask about reservations, menu, or special requests..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            aria-label="Type your message"
                            disabled={loading}
                        />
                        <button 
                            className="premium-send-btn" 
                            type="submit" 
                            disabled={loading || !input.trim()}
                        >
                            <div className="send-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                                </svg>
                            </div>
                        </button>
                    </div>
                    <div className="input-suggestions">
                        <button type="button" className="suggestion-chip" onClick={() => setInput("What tables do you have available?")}>
                            Available tables
                        </button>
                        <button type="button" className="suggestion-chip" onClick={() => setInput("I'd like to make a reservation")}>
                            Make reservation
                        </button>
                        <button type="button" className="suggestion-chip" onClick={() => setInput("What's on the menu?")}>
                            View menu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ChatWithAichmi;