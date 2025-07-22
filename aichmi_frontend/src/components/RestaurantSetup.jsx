import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LocationPicker from './LocationPicker';

function RestaurantSetup() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [collectedData, setCollectedData] = useState({});
    const [showMapPicker, setShowMapPicker] = useState(false); // Add this state
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Improved scroll function - less aggressive
    const scrollToBottom = () => {
        if (messagesEndRef.current && chatContainerRef.current) {
            // Use a smoother scroll with a slight delay
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ 
                    behavior: "smooth", 
                    block: "end",
                    inline: "nearest"
                });
            }, 100);
        }
    };

    // Only scroll when new messages are added, not on every render
    useEffect(() => {
        scrollToBottom();
    }, [messages.length]); // Changed from [messages] to [messages.length]

    useEffect(() => {
        // Check if user came from plan selection
        const selectedPlan = localStorage.getItem('selectedPlan');
        if (!selectedPlan) {
            navigate('/subscriptions');
            return;
        }

        // Initialize welcome message
        const welcomeMessage = {
            text: `🎉 Welcome to AICHMI! \n\nI'm excited to help you set up your restaurant's AI assistant. You've selected the ${selectedPlan} plan.\n\nLet's start by getting to know your restaurant better. What's the name of your restaurant?`,
            sender: 'ai',
            timestamp: new Date()
        };
        setMessages([welcomeMessage]);
    }, [navigate]);

    // Fixed location handler
    const handleLocationSelect = async (locationData) => {
        console.log('📍 Location selected:', locationData);
        
        // Hide the map picker after selection
        setShowMapPicker(false);
        
        const locationMessage = `location_selected: ${JSON.stringify({
            lat: locationData.lat,
            lng: locationData.lng,
            island: locationData.island,
            area: locationData.area,
            address: locationData.address,
            placeId: locationData.placeId
        })}`;
        
        const userMessage = {
            text: `📍 Selected location: ${locationData.address}, ${locationData.area}, ${locationData.island}`,
            sender: 'user',
            timestamp: new Date()
        };

        const conversationHistory = [...messages, userMessage];
        setMessages(conversationHistory);
        setIsLoading(true);
        
        try {
            const response = await fetch('/api/restaurant-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: locationMessage, // Send the raw location data to backend
                    history: conversationHistory,
                    collectedData: collectedData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('🔄 Setup response:', data);
            
            if (data.reply) {
                const aiMessage = {
                    text: data.reply,
                    sender: 'ai',
                    timestamp: new Date()
                };
                
                setMessages(prev => [...prev, aiMessage]);
                
                // Check if we need to show the map picker
                if (data.needsMap) {
                    console.log('🗺️ Showing map picker');
                    setShowMapPicker(true);
                } else {
                    setShowMapPicker(false);
                }
                
                if (data.collectedData) {
                    setCollectedData(data.collectedData);
                }
                
                if (data.setupComplete) {
                    if (data.venueId) {
                        localStorage.setItem('venueId', data.venueId);
                    }
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('❌ Error sending location:', error);
            const errorMessage = {
                text: 'Sorry, I had trouble processing that location. Could you please try again?',
                sender: 'ai',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            setShowMapPicker(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        const userMessage = {
            text: inputMessage,
            sender: 'user',
            timestamp: new Date()
        };

        const conversationHistory = [...messages, userMessage];
        
        // Clear input immediately for better UX
        const messageToSend = inputMessage;
        setInputMessage('');
        setMessages(conversationHistory);
        setIsLoading(true);
        
        console.log('🚀 Sending message:', messageToSend);
        
        try {
            const response = await fetch('/api/restaurant-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: messageToSend,
                    history: conversationHistory,
                    collectedData: collectedData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('🔄 Setup response:', data);

            if (data.reply) {
                const aiMessage = {
                    text: data.reply,
                    sender: 'ai',
                    timestamp: new Date()
                };
                
                setMessages(prev => [...prev, aiMessage]);

                // Check if we need to show the map picker
                if (data.needsMap) {
                    console.log('🗺️ Showing map picker');
                    setShowMapPicker(true);
                } else {
                    setShowMapPicker(false);
                }

                if (data.collectedData) {
                    setCollectedData(data.collectedData);
                }

                if (data.setupComplete) {
                    if (data.venueId) {
                        localStorage.setItem('venueId', data.venueId);
                    }
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            const errorMessage = {
                text: 'Sorry, I had trouble processing that. Could you please try again?',
                sender: 'ai',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            setShowMapPicker(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getProgressPercentage = () => {
        const totalFields = 10; // Fixed to match backend
        const collectedFields = Object.keys(collectedData).filter(key => !key.startsWith('_')).length;
        return Math.round((collectedFields / totalFields) * 100);
    };

    const getProgressText = () => {
        const collectedFields = Object.keys(collectedData).filter(key => !key.startsWith('_')).length;
        const totalFields = 10;
        
        if (collectedFields === 0) return 'Getting Started';
        if (collectedFields < 3) return 'Restaurant Basic Info';
        if (collectedFields < 6) return 'Location & Contact';
        if (collectedFields < 9) return 'Restaurant Details';
        if (collectedFields < 10) return 'Owner Information';
        return 'Setup Complete!';
    };

    // Simplified message rendering - no more [SHOW_MAP] parsing
    const renderMessageText = (message) => {
        return (
            <div className="message-text">
                {message.text.split('\n').map((line, i) => (
                    <span key={i}>
                        {line}
                        {i < message.text.split('\n').length - 1 && <br />}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="restaurant-setup-page">
            <div className="setup-container">
                <div className="setup-header">
                    <h1>Restaurant Setup</h1>
                    <p>Let AICHMI help you configure your restaurant profile</p>
                    <div className="setup-progress">
                        <div className="progress-bar">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${getProgressPercentage()}%` }}
                            ></div>
                        </div>
                        <span className="progress-text">
                            {getProgressText()} ({Object.keys(collectedData).filter(key => !key.startsWith('_')).length}/10)
                        </span>
                    </div>
                </div>

                <div className="setup-chat-container">
                    <div className="chat-messages" ref={chatContainerRef}>
                        {messages.map((message, index) => (
                            <div key={index} className={`message ${message.sender}`}>
                                <div className="message-content">
                                    {renderMessageText(message)}
                                    <div className="message-time">
                                        {new Date(message.timestamp).toLocaleTimeString([], 
                                            { hour: '2-digit', minute: '2-digit' }
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {isLoading && (
                            <div className="message ai">
                                <div className="message-content">
                                    <div className="typing-indicator">
                                        <div className="typing-dot"></div>
                                        <div className="typing-dot"></div>
                                        <div className="typing-dot"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Show map picker when needsMap is true */}
                    {showMapPicker && (
                        <div className="map-picker-container">
                            <div className="map-picker-header">
                                <h3>📍 Select Your Restaurant Location</h3>
                                <p>Click on the map or search for your restaurant's exact location</p>
                            </div>
                            <LocationPicker onLocationSelect={handleLocationSelect} />
                        </div>
                    )}

                    <div className="chat-input-section">
                        <div className="chat-input-container">
                            <textarea
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your response..."
                                className="chat-input"
                                rows="2"
                                disabled={isLoading}
                            />
                            <button 
                                onClick={handleSendMessage} 
                                className="send-button"
                                disabled={isLoading || !inputMessage.trim()}
                            >
                                <span>Send</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RestaurantSetup;