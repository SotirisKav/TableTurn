import React, { useState } from 'react';
import LocationPicker from './LocationPicker';

function SetupFlow() {
    const [messages, setMessages] = useState([
        {
            text: "🎉 Welcome to AICHMI!\n\nI'm excited to help you set up your restaurant's AI assistant. Let's start by getting to know your restaurant better.\n\nWhat's the name of your restaurant?",
            sender: 'ai',
            timestamp: new Date()
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [collectedData, setCollectedData] = useState({});
    const [setupComplete, setSetupComplete] = useState(false);

    const handleLocationSelect = async (locationData) => {
        console.log('📍 Location selected:', locationData);
        
        // Send location data to the setup API
        const locationMessage = `location_selected: ${JSON.stringify({
            lat: locationData.lat,
            lng: locationData.lng,
            island: locationData.island,
            area: locationData.area,
            address: locationData.address,
            placeId: locationData.placeId
        })}`;
        
        const userMessage = {
            text: `Selected: ${locationData.island}, ${locationData.area}`,
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
                    message: locationMessage,
                    history: conversationHistory,
                    collectedData: collectedData
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
                
                if (data.collectedData) {
                    setCollectedData(data.collectedData);
                }

                if (data.setupComplete) {
                    setSetupComplete(true);
                }
            }
        } catch (error) {
            console.error('Error sending location:', error);
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
        setMessages(conversationHistory);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/restaurant-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: inputMessage,
                    history: conversationHistory,
                    collectedData: collectedData
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
                
                if (data.collectedData) {
                    setCollectedData(data.collectedData);
                }

                if (data.setupComplete) {
                    setSetupComplete(true);
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
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="setup-flow">
            <div className="setup-header">
                <h2>Restaurant Setup</h2>
                <div className="progress-info">
                    {Object.keys(collectedData).length}/10 fields completed
                </div>
            </div>

            <div className="messages-container">
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.sender}`}>
                        <div className="message-content">
                            <div className="message-text">
                              {message.text.includes('[SHOW_MAP]') ? (
                                <>
                                  {/* Text before map */}
                                  {message.text.split('[SHOW_MAP]')[0] && (
                                    <div style={{ marginBottom: '1rem' }}>
                                      {message.text.split('[SHOW_MAP]')[0].split('\n').map((line, i) => (
                                        <span key={i}>
                                          {line}
                                          {i < message.text.split('[SHOW_MAP]')[0].split('\n').length - 1 && <br />}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Google Map Component */}
                                  <div className="map-container" style={{ margin: '1rem 0', borderRadius: '12px', overflow: 'hidden', height: '400px' }}>
                                    <LocationPicker onLocationSelect={handleLocationSelect} />
                                  </div>

                                  {/* Text after map */}
                                  {message.text.split('[SHOW_MAP]')[1] && (
                                    <div style={{ marginTop: '1rem' }}>
                                      {message.text.split('[SHOW_MAP]')[1].split('\n').map((line, i) => (
                                        <span key={i}>
                                          {line}
                                          {i < message.text.split('[SHOW_MAP]')[1].split('\n').length - 1 && <br />}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              ) : (
                                // Regular message display
                                message.text.split('\n').map((line, i) => (
                                  <span key={i}>
                                    {line}
                                    {i < message.text.split('\n').length - 1 && <br />}
                                  </span>
                                ))
                              )}
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
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {!setupComplete && (
                <div className="input-container">
                    <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your response..."
                        disabled={isLoading}
                        rows="1"
                    />
                    <button 
                        onClick={handleSendMessage} 
                        disabled={!inputMessage.trim() || isLoading}
                        className="send-button"
                    >
                        Send ➤
                    </button>
                </div>
            )}

            {setupComplete && (
                <div className="setup-complete-actions">
                    <button className="primary-button">
                        Continue to Dashboard
                    </button>
                    <button className="secondary-button" onClick={() => window.location.reload()}>
                        Start Over
                    </button>
                </div>
            )}
        </div>
    );
}

export default SetupFlow;