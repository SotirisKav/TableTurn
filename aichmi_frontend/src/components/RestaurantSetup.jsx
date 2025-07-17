import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function RestaurantSetup() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [setupStep, setSetupStep] = useState('welcome');
    const [restaurantData, setRestaurantData] = useState({});
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

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        
        try {
            const response = await fetch('/api/chat/restaurant-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: inputMessage,
                    setupStep: setupStep,
                    restaurantData: restaurantData
                })
            });

            const data = await response.json();

            if (data.reply) {
                const aiMessage = {
                    text: data.reply,
                    sender: 'ai',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, aiMessage]);

                // Update setup progress
                if (data.nextStep) {
                    setSetupStep(data.nextStep);
                }
                if (data.restaurantData) {
                    setRestaurantData(prev => ({ ...prev, ...data.restaurantData }));
                }

                // If setup is complete, redirect to dashboard
                if (data.setupComplete) {
                    setTimeout(() => {
                        navigate('/dashboard');
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
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
                                style={{ width: `${getProgressPercentage(setupStep)}%` }}
                            ></div>
                        </div>
                        <span className="progress-text">{getProgressText(setupStep)}</span>
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

// Helper functions for progress tracking
function getProgressPercentage(step) {
    const steps = {
        'welcome': 10,
        'restaurant_name': 20,
        'restaurant_type': 30,
        'location': 40,
        'contact_info': 50,
        'cuisine': 60,
        'pricing': 70,
        'description': 80,
        'owner_info': 90,
        'complete': 100
    };
    return steps[step] || 10;
}

function getProgressText(step) {
    const texts = {
        'welcome': 'Getting Started',
        'restaurant_name': 'Restaurant Name',
        'restaurant_type': 'Restaurant Type',
        'location': 'Location Details',
        'contact_info': 'Contact Information',
        'cuisine': 'Cuisine Type',
        'pricing': 'Pricing Information',
        'description': 'Restaurant Description',
        'owner_info': 'Owner Information',
        'complete': 'Setup Complete!'
    };
    return texts[step] || 'Getting Started';
}

export default RestaurantSetup;