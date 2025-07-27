import { useState, useEffect, useRef } from 'react';
import '../styles/TableMap.css';

function TableMap({ restaurantId }) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [tables, setTables] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingTable, setEditingTable] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [draggedTable, setDraggedTable] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState(false);
    const [statusMode, setStatusMode] = useState(false);
    const [selectedTime, setSelectedTime] = useState('12:00');
    const [restaurantHours, setRestaurantHours] = useState({ open: '12:00', close: '23:30' });
    const dragRef = useRef(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [selectedTableModal, setSelectedTableModal] = useState(null);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('accessToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    };

    useEffect(() => {
        const fetchTableData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // Fetch tables
                console.log('Fetching tables for restaurant:', restaurantId);
                const tablesResponse = await fetch(`/api/restaurants/${restaurantId}/tables`, {
                    headers: getAuthHeaders()
                });
                
                if (!tablesResponse.ok) {
                    const errorData = await tablesResponse.text();
                    throw new Error(`Failed to fetch tables: ${tablesResponse.status} - ${errorData}`);
                }
                
                const tablesData = await tablesResponse.json();
                console.log('Tables data received:', tablesData);
                setTables(Array.isArray(tablesData) ? tablesData : []);

                // Fetch restaurant hours
                const restaurantResponse = await fetch(`/api/restaurants/${restaurantId}`, {
                    headers: getAuthHeaders()
                });
                
                if (restaurantResponse.ok) {
                    const restaurantData = await restaurantResponse.json();
                    // For now, use default hours - we'd need to add hours API endpoint
                    setRestaurantHours({ open: '12:00', close: '23:30' });
                }

                // Fetch reservations for selected date
                const reservationsResponse = await fetch(`/api/restaurants/${restaurantId}/reservations?date=${selectedDate}`, {
                    headers: getAuthHeaders()
                });
                
                if (!reservationsResponse.ok) {
                    const errorData = await reservationsResponse.text();
                    console.warn('Failed to fetch reservations:', errorData);
                    setReservations([]); // Don't fail completely if reservations fail
                } else {
                    const reservationsData = await reservationsResponse.json();
                    console.log('Reservations data received:', reservationsData);
                    setReservations(Array.isArray(reservationsData) ? reservationsData : []);
                }
                
            } catch (err) {
                console.error('Error in fetchTableData:', err);
                setError(err.message);
                setTables([]);
                setReservations([]);
            } finally {
                setLoading(false);
            }
        };

        if (restaurantId) {
            fetchTableData();
        }
    }, [restaurantId, selectedDate]);

    const getTableReservation = (tableId, tableName, tableType) => {
        // Get all reservations that could match this table
        const potentialReservations = (reservations || []).filter(reservation => {
            // First priority: exact table_id match
            if (reservation.table_id && tableId && reservation.table_id === tableId) {
                return true;
            }
            // Second priority: table_name match
            if (reservation.table_name === tableName) {
                return true;
            }
            return false;
        });

        // If we found specific matches, return the first one
        if (potentialReservations.length > 0) {
            return potentialReservations[0];
        }

        // For table_type matching, we need to be more careful
        // Only match by table_type if it's the FIRST available table of that type
        // and the reservation doesn't have a specific table assigned
        const typeReservations = (reservations || []).filter(reservation => 
            !reservation.table_id && !reservation.table_name && reservation.table_type === tableType
        );

        if (typeReservations.length > 0) {
            // Find the first table of this type (by table_id) to assign the reservation
            const allTablesOfType = tables
                .filter(table => table.table_type === tableType)
                .sort((a, b) => a.table_id - b.table_id);
            
            const firstTableOfType = allTablesOfType[0];
            
            // Only assign to the first table of this type
            if (firstTableOfType && firstTableOfType.table_id === tableId) {
                return typeReservations[0];
            }
        }

        return null;
    };

    const getTableStatus = (tableId, tableName, tableType) => {
        const reservation = getTableReservation(tableId, tableName, tableType);
        if (reservation) {
            // Use the slider time as reference instead of current time
            const currentSelectedDate = new Date(selectedDate);
            const [sliderHours, sliderMinutes] = selectedTime.split(':');
            const sliderDateTime = new Date(currentSelectedDate);
            sliderDateTime.setHours(parseInt(sliderHours), parseInt(sliderMinutes), 0, 0);
            
            const reservationDate = new Date(reservation.reservation_date);
            const [hours, minutes] = reservation.reservation_time.split(':');
            const reservationDateTime = new Date(reservationDate);
            reservationDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // Get restaurant's min gap hours (default to 2)
            const gapHours = 2; // This could be fetched from restaurant data
            const reservationEndTime = new Date(reservationDateTime.getTime() + (gapHours * 60 * 60 * 1000));
            
            // Check if the slider time is within the reservation window
            const isActiveAtSliderTime = sliderDateTime >= reservationDateTime && sliderDateTime <= reservationEndTime;
            
            // Show the reservation status only if the slider is within the active window
            if (isActiveAtSliderTime) {
                // Check if it's a manual occupation (system reservation)
                let status = 'reserved';
                if (reservation.reservation_name?.includes('Manual Occupation')) {
                    status = 'occupied';
                } else {
                    status = 'reserved';
                }
                
                return {
                    status: status,
                    time: reservation.reservation_time,
                    guest: reservation.reservation_name,
                    guests: reservation.guests,
                    celebration: reservation.celebration_type !== 'none' ? reservation.celebration_type : null,
                    isActive: true,
                    endTime: reservationEndTime
                };
            } else {
                // If slider is outside the reservation window, show as available
                return { 
                    status: 'available',
                    hasReservation: true,
                    time: reservation.reservation_time,
                    guest: reservation.reservation_name,
                    guests: reservation.guests,
                    celebration: reservation.celebration_type !== 'none' ? reservation.celebration_type : null,
                    isActive: false,
                    endTime: reservationEndTime
                };
            }
        }
        return { status: 'available' };
    };

    // Generate time options for slider
    const generateTimeOptions = () => {
        const times = [];
        const start = new Date(`1970-01-01T${restaurantHours.open}`);
        const end = new Date(`1970-01-01T${restaurantHours.close}`);
        
        // Handle overnight hours
        if (end < start) {
            end.setDate(end.getDate() + 1);
        }
        
        let current = new Date(start);
        while (current <= end) {
            const timeStr = current.toTimeString().slice(0, 5);
            times.push(timeStr);
            current.setMinutes(current.getMinutes() + 30);
        }
        
        return times;
    };

    const timeOptions = generateTimeOptions();

    const formatTime = (timeString) => {
        if (!timeString) return '';
        const time = new Date(`1970-01-01T${timeString}`);
        return time.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    };

    const getNextDate = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    };

    const getPreviousDate = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result.toISOString().split('T')[0];
    };

    const formatDisplayDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (dateString === today.toISOString().split('T')[0]) {
            return 'Today';
        } else if (dateString === tomorrow.toISOString().split('T')[0]) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    };

    const handleTableNameEdit = (table) => {
        setEditingTable(table.table_id);
        setEditingName(table.table_name);
    };

    const handleTableNameSave = async (tableId) => {
        try {
            const response = await fetch(`/api/restaurants/${restaurantId}/tables/${tableId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ table_name: editingName })
            });

            if (!response.ok) {
                throw new Error('Failed to update table name');
            }

            // Update the local state
            setTables(prevTables => 
                prevTables.map(table => 
                    table.table_id === tableId 
                        ? { ...table, table_name: editingName }
                        : table
                )
            );

            setEditingTable(null);
            setEditingName('');
        } catch (err) {
            alert('Failed to update table name: ' + err.message);
        }
    };

    const handleTableNameCancel = () => {
        setEditingTable(null);
        setEditingName('');
    };

    const handleKeyPress = (e, tableId) => {
        if (e.key === 'Enter') {
            handleTableNameSave(tableId);
        } else if (e.key === 'Escape') {
            handleTableNameCancel();
        }
    };

    // Collision detection helper
    const checkCollision = (newX, newY, currentTableId, tableWidth = 80, tableHeight = 80) => {
        const margin = 10; // Minimum spacing between tables
        
        return tables.some(table => {
            if (table.table_id === currentTableId) return false;
            
            const tableX = table.x_coordinate || 0;
            const tableY = table.y_coordinate || 0;
            
            return (
                newX < tableX + tableWidth + margin &&
                newX + tableWidth + margin > tableX &&
                newY < tableY + tableHeight + margin &&
                newY + tableHeight + margin > tableY
            );
        });
    };

    // Snap to grid helper
    const snapToGrid = (x, y, gridSize = 20) => {
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    };

    // Drag and drop handlers
    const handleDragStart = (e, table) => {
        if (!dragMode) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const mapContainer = e.currentTarget.closest('.unified-table-map');
        const mapRect = mapContainer.getBoundingClientRect();
        
        // Calculate offset from mouse to table's top-left corner
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        
        setDragOffset({ x: offsetX, y: offsetY });
        setDraggedTable(table);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', '');
    };

    const handleDragEnd = (e) => {
        setDraggedTable(null);
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        if (!dragMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e) => {
        if (!dragMode || !draggedTable) return;
        e.preventDefault();
        
        const mapContainer = e.currentTarget;
        const rect = mapContainer.getBoundingClientRect();
        
        // Calculate position relative to the map container, accounting for drag offset
        let rawX = e.clientX - rect.left - dragOffset.x;
        let rawY = e.clientY - rect.top - dragOffset.y;
        
        // Snap to grid for better alignment
        const snapped = snapToGrid(rawX, rawY, 20);
        
        // Apply boundaries (accounting for table size 80x80)
        const tableSize = 80;
        const mapPadding = 10;
        const maxX = rect.width - tableSize - mapPadding;
        const maxY = rect.height - tableSize - mapPadding;
        
        let finalX = Math.min(Math.max(snapped.x, mapPadding), maxX);
        let finalY = Math.min(Math.max(snapped.y, mapPadding), maxY);
        
        // Check for collisions and adjust position if needed
        if (checkCollision(finalX, finalY, draggedTable.table_id)) {
            // Try to find a nearby non-colliding position
            let found = false;
            const searchRadius = 40;
            
            for (let offsetX = -searchRadius; offsetX <= searchRadius && !found; offsetX += 20) {
                for (let offsetY = -searchRadius; offsetY <= searchRadius && !found; offsetY += 20) {
                    const testX = Math.min(Math.max(finalX + offsetX, mapPadding), maxX);
                    const testY = Math.min(Math.max(finalY + offsetY, mapPadding), maxY);
                    
                    if (!checkCollision(testX, testY, draggedTable.table_id)) {
                        finalX = testX;
                        finalY = testY;
                        found = true;
                    }
                }
            }
            
            if (!found) {
                alert('Cannot place table here - not enough space. Please try a different location.');
                return;
            }
        }
        
        try {
            const response = await fetch(`/api/restaurants/${restaurantId}/tables/${draggedTable.table_id}/position`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ x: finalX, y: finalY })
            });

            if (!response.ok) {
                throw new Error('Failed to update table position');
            }

            // Update the local state
            setTables(prevTables => 
                prevTables.map(table => 
                    table.table_id === draggedTable.table_id 
                        ? { ...table, x_coordinate: finalX, y_coordinate: finalY }
                        : table
                )
            );
        } catch (err) {
            console.error('Failed to update table position:', err);
            alert('Failed to update table position: ' + err.message);
        }
    };

    // Handle table status change with time-based reservation
    const handleStatusChange = async (tableId, newStatus) => {
        try {
            // If setting to occupied, create a time-based reservation
            if (newStatus === 'occupied') {
                const response = await fetch(`/api/restaurants/${restaurantId}/tables/${tableId}/occupy`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ 
                        date: selectedDate,
                        time: selectedTime,
                        duration_hours: 2 // Default duration, can be made configurable
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to occupy table');
                }
            } else {
                // For other status changes, use the original API
                const response = await fetch(`/api/restaurants/${restaurantId}/tables/${tableId}/status`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: newStatus })
                });

                if (!response.ok) {
                    throw new Error('Failed to update table status');
                }
            }

            // Refresh table data to get updated status
            const tablesResponse = await fetch(`/api/restaurants/${restaurantId}/tables`, {
                headers: getAuthHeaders()
            });
            
            if (tablesResponse.ok) {
                const tablesData = await tablesResponse.json();
                setTables(Array.isArray(tablesData) ? tablesData : []);
            }
        } catch (err) {
            console.error('Failed to update table status:', err);
            alert('Failed to update table status: ' + err.message);
        }
    };

    // Handle cleanup expired reservations
    const handleCleanup = async () => {
        try {
            const response = await fetch(`/api/restaurants/${restaurantId}/cleanup-reservations`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to cleanup reservations');
            }

            const result = await response.json();
            
            // Refresh table data
            const tablesResponse = await fetch(`/api/restaurants/${restaurantId}/tables`, {
                headers: getAuthHeaders()
            });
            
            if (tablesResponse.ok) {
                const tablesData = await tablesResponse.json();
                setTables(Array.isArray(tablesData) ? tablesData : []);
            }

            alert(`Cleanup completed! ${result.updatedTables} tables checked.`);
        } catch (err) {
            console.error('Failed to cleanup:', err);
            alert('Failed to cleanup reservations: ' + err.message);
        }
    };

    if (loading) {
        return <div className="table-map-loading">Loading table map...</div>;
    }

    if (error) {
        return <div className="table-map-error">Error: {error}</div>;
    }

    return (
        <div className="table-map-container">
            <div className="table-map-header">
                <h3>🏪 Restaurant Floor Plan</h3>
                <div className="header-controls">
                    <div className="date-time-controls">
                        <div className="date-controls">
                            <button 
                                onClick={() => setSelectedDate(getPreviousDate(selectedDate, 1))}
                                className="date-nav-btn"
                            >
                                ← Previous
                            </button>
                            <div className="selected-date">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="date-picker"
                                />
                                <span className="date-display">{formatDisplayDate(selectedDate)}</span>
                            </div>
                            <button 
                                onClick={() => setSelectedDate(getNextDate(selectedDate, 1))}
                                className="date-nav-btn"
                            >
                                Next →
                            </button>
                        </div>
                        <div className="time-controls">
                            <label htmlFor="time-slider" className="time-label">Time:</label>
                            <input
                                id="time-slider"
                                type="range"
                                min="0"
                                max={timeOptions.length - 1}
                                value={timeOptions.indexOf(selectedTime)}
                                onChange={(e) => setSelectedTime(timeOptions[parseInt(e.target.value)])}
                                className="time-slider"
                            />
                            <span className="time-display">{formatTime(selectedTime)}</span>
                        </div>
                    </div>
                    <div className="control-buttons">
                        <button 
                            className={`drag-mode-btn ${dragMode ? 'active' : ''}`}
                            onClick={() => {
                                setDragMode(!dragMode);
                                setStatusMode(false);
                            }}
                            title={dragMode ? 'Exit drag mode' : 'Enable drag mode to rearrange tables'}
                        >
                            {dragMode ? '🔒 Lock Layout' : '🔄 Rearrange Tables'}
                        </button>
                        <button 
                            className={`status-mode-btn ${statusMode ? 'active' : ''}`}
                            onClick={() => {
                                setStatusMode(!statusMode);
                                setDragMode(false);
                            }}
                            title={statusMode ? 'Exit status mode' : 'Enable status mode to change table status'}
                        >
                            {statusMode ? '✅ Done' : '🎯 Manage Status'}
                        </button>
                        <button 
                            className="cleanup-btn"
                            onClick={handleCleanup}
                            title="Clean up expired reservations and reset table status"
                        >
                            🧹 Cleanup
                        </button>
                    </div>
                </div>
            </div>

            <div className="table-legend">
                <div className="legend-section">
                    <h4>Status</h4>
                    <div className="legend-items">
                        <div className="legend-item">
                            <div className="legend-dot available"></div>
                            <span>Available</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-dot reserved"></div>
                            <span>Reserved</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-dot occupied"></div>
                            <span>Occupied</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-dot celebration"></div>
                            <span>Celebration</span>
                        </div>
                    </div>
                </div>
                <div className="legend-section">
                    <h4>Table Types</h4>
                    <div className="legend-items">
                        <div className="legend-item">
                            <div className="legend-stripe type-standard"></div>
                            <span>Standard</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-stripe type-grass"></div>
                            <span>Grass</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-stripe type-anniversary"></div>
                            <span>Anniversary</span>
                        </div>
                    </div>
                </div>
            </div>

            {dragMode && (
                <div className="drag-mode-notice">
                    <p>🔄 Drag mode enabled - You can now drag tables to rearrange the floor plan</p>
                </div>
            )}

            {statusMode && (
                <div className="status-mode-notice">
                    <p>🎯 Status mode enabled - Click tables to change their status (Available → Occupied → Available)</p>
                </div>
            )}

            <div 
                className={`unified-table-map ${dragMode ? 'drag-mode' : ''}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                key={`map-${selectedTime}-${selectedDate}`}
            >
                <div className="table-map-container-inner">
                    {tables.map((table) => {
                        // Force re-calculation of table status when selectedTime, selectedDate, or reservations change
                        const tableStatus = getTableStatus(table.table_id, table.table_name, table.table_type);
                        const isEditing = editingTable === table.table_id;
                        
                        // Debug: Log table status for first table
                        if (table.table_id === tables[0]?.table_id) {
                            console.log(`Table ${table.table_name} at ${selectedTime}:`, {
                                status: tableStatus.status,
                                isActive: tableStatus.isActive,
                                hasReservation: tableStatus.hasReservation,
                                guest: tableStatus.guest,
                                selectedTime: selectedTime
                            });
                        }
                        
                        // Get table type class for border distinction
                        const getTableTypeClass = (type) => {
                            switch(type) {
                                case 'standard': return 'type-standard';
                                case 'grass': return 'type-grass';
                                case 'anniversary': return 'type-anniversary';
                                default: return 'type-standard';
                            }
                        };
                        
                        return (
                            <div
                                key={`${table.table_id}-${selectedTime}-${selectedDate}`}
                                className={`table-item ${tableStatus.status} ${getTableTypeClass(table.table_type)} ${tableStatus.celebration ? 'celebration' : ''} ${isEditing ? 'editing' : ''} ${dragMode ? 'draggable' : ''} ${statusMode ? 'status-mode' : ''} ${isDragging && draggedTable?.table_id === table.table_id ? 'dragging' : ''} ${tableStatus.isActive ? 'active-reservation' : ''}`}
                                style={{
                                    position: 'absolute',
                                    left: `${Math.min(Math.max(table.x_coordinate || 0, 10), 1100)}px`,
                                    top: `${Math.min(Math.max(table.y_coordinate || 0, 10), 630)}px`,
                                    cursor: dragMode ? 'move' : statusMode ? 'pointer' : 'default'
                                }}
                                draggable={dragMode && !isEditing}
                                onDragStart={(e) => handleDragStart(e, table)}
                                onDragEnd={handleDragEnd}
                                title={
                                    !isEditing ? `${table.table_name}${dragMode ? ' - Drag to move' : statusMode ? ' - Click to change status' : ' - Click for details'}`
                                        : ''
                                }
                                onClick={() => {
                                    if (statusMode && !isEditing) {
                                        const currentStatus = table.status || 'available';
                                        const nextStatus = currentStatus === 'available' ? 'occupied' : 'available';
                                        handleStatusChange(table.table_id, nextStatus);
                                    } else if (!dragMode && !isEditing) {
                                        setSelectedTableModal({...table, tableStatus});
                                    }
                                }}
                            >
                                {isEditing ? (
                                    <div className="table-name-edit">
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => handleKeyPress(e, table.table_id)}
                                            onBlur={() => handleTableNameSave(table.table_id)}
                                            className="table-name-input"
                                            autoFocus
                                            maxLength={10}
                                        />
                                        <div className="edit-buttons">
                                            <button 
                                                onClick={() => handleTableNameSave(table.table_id)}
                                                className="save-btn"
                                                title="Save"
                                            >
                                                ✓
                                            </button>
                                            <button 
                                                onClick={handleTableNameCancel}
                                                className="cancel-btn"
                                                title="Cancel"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="table-name">
                                            {table.table_name}
                                        </div>
                                        <div className="table-capacity">{table.capacity} seats</div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {tables.length === 0 && !loading && !error && (
                <div className="no-tables">
                    <p>No tables found for this restaurant.</p>
                    <p>Tables will appear here once they are added to the restaurant's configuration.</p>
                </div>
            )}

            {/* Table Details Modal */}
            {selectedTableModal && (
                <div className="modal-overlay" onClick={() => setSelectedTableModal(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Table {selectedTableModal.table_name}</h3>
                            <button 
                                className="modal-close"
                                onClick={() => setSelectedTableModal(null)}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="table-details">
                                <p><strong>Capacity:</strong> {selectedTableModal.capacity} seats</p>
                                <p><strong>Type:</strong> {selectedTableModal.table_type}</p>
                                <p><strong>Status:</strong> {selectedTableModal.tableStatus.status}</p>
                            </div>
                            
                            {(selectedTableModal.tableStatus.hasReservation || selectedTableModal.tableStatus.guest) && (
                                <div className="reservation-details">
                                    <h4>Reservation Details</h4>
                                    <p><strong>Guest:</strong> {selectedTableModal.tableStatus.guest}</p>
                                    <p><strong>Time:</strong> {formatTime(selectedTableModal.tableStatus.time)}</p>
                                    <p><strong>Guests:</strong> {selectedTableModal.tableStatus.guests}</p>
                                    {selectedTableModal.tableStatus.celebration && (
                                        <p><strong>Celebration:</strong> {selectedTableModal.tableStatus.celebration}</p>
                                    )}
                                    <p><strong>Active:</strong> {selectedTableModal.tableStatus.isActive ? 'Yes' : 'No'}</p>
                                </div>
                            )}
                            
                            <div className="modal-actions">
                                <button 
                                    className="rename-btn"
                                    onClick={() => {
                                        setSelectedTableModal(null);
                                        handleTableNameEdit(selectedTableModal);
                                    }}
                                >
                                    Rename Table
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TableMap;