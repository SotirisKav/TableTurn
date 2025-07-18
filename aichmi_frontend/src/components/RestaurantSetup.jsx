import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function RestaurantSetup() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [collectedData, setCollectedData] = useState({});
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    const handleSendMessage = async () => {
        if (!inputMessage.trim()) return;

        const userMessage = {
            text: inputMessage,
            sender: 'user',
            timestamp: new Date()
        };

        // Build conversation history INCLUDING the new user message
        const conversationHistory = [...messages, userMessage];
        
        // Update UI immediately
        setMessages(conversationHistory);
        setIsLoading(true);
        
        // CRITICAL DEBUG: Log what we're about to send
        console.log('🚀 About to send to API:');
        console.log('- Message:', inputMessage);
        console.log('- Current messages length:', messages.length);
        console.log('- Conversation history length:', conversationHistory.length);
        console.log('- Conversation history:', conversationHistory);
        console.log('- Collected data:', collectedData);
        
        const requestPayload = {
            message: inputMessage,
            history: conversationHistory,
            collectedData: collectedData
        };
        
        console.log('📤 Full request payload:', JSON.stringify(requestPayload, null, 2));
        
        try {
            const response = await fetch('/api/restaurant-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📨 API Response received:', data);

            if (data.reply) {
                const aiMessage = {
                    text: data.reply,
                    sender: 'ai',
                    timestamp: new Date()
                };
                
                // Update messages with AI response
                setMessages(prev => {
                    const newMessages = [...prev, aiMessage];
                    console.log('📝 Updated messages array:', newMessages);
                    return newMessages;
                });

                // Update collected data
                if (data.collectedData) {
                    setCollectedData(data.collectedData);
                    console.log('📊 Updated collected data:', data.collectedData);
                }

                // If setup is complete, redirect to dashboard
                if (data.setupComplete) {
                    if (data.restaurantData) {
                        localStorage.setItem('restaurantData', JSON.stringify(data.restaurantData));
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
        } finally {
            setIsLoading(false);
            setInputMessage('');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getProgressPercentage = () => {
        const totalFields = 11;
        const collectedFields = Object.keys(collectedData).length;
        return Math.round((collectedFields / totalFields) * 100);
    };

    const getProgressText = () => {
        const collectedFields = Object.keys(collectedData).length;
        const totalFields = 11;
        
        if (collectedFields === 0) return 'Getting Started';
        if (collectedFields < 3) return 'Restaurant Basic Info';
        if (collectedFields < 6) return 'Location & Contact';
        if (collectedFields < 9) return 'Restaurant Details';
        if (collectedFields < 11) return 'Owner Information';
        return 'Setup Complete!';
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
                            {getProgressText()} ({Object.keys(collectedData).length}/11)
                        </span>
                    </div>
                    
                    {/* DEBUG: Show collected data and message count */}
                    <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
                        Messages: {messages.length} | 
                        Collected: {Object.keys(collectedData).length > 0 ? 
                            Object.keys(collectedData).join(', ') : 
                            'None yet'}
                    </div>
                </div>

                <div className="setup-chat-container">
                    <div className="chat-messages">
                        {messages.map((message, index) => (
                            <div key={index} className={`message ${message.sender}`}>
                                <div className="message-content">
                                    <div className="message-text">
                                        {message.text.split('\n').map((line, i) => (
                                            <span key={i}>
                                                {line}
                                                {i < message.text.split('\n').length - 1 && <br />}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="message-time">
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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