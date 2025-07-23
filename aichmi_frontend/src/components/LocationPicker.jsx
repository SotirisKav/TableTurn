import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const GREEK_ISLANDS_CENTER = {
  lat: 37.0,
  lng: 25.0
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '12px'
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  gestureHandling: 'greedy',
  restriction: {
    latLngBounds: {
      north: 41.8,
      south: 34.8,
      west: 19.3,
      east: 29.7,
    },
    strictBounds: false,
  }
};

const libraries = ['places'];

const LocationPicker = ({ onLocationSelect, initialLocation = null }) => {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(initialLocation);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [autocomplete, setAutocomplete] = useState(null);

  const searchBoxRef = useRef();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: libraries,
    region: 'GR',
    language: 'en'
  });

  // Define processPlace first
  const processPlace = useCallback((place, lat, lng) => {
    let island = '';
    let area = '';
    let country = '';
    
    if (place.address_components) {
      place.address_components.forEach(component => {
        const types = component.types;
        if (types.includes('administrative_area_level_1')) {
          island = component.long_name;
        }
        if (types.includes('locality') || types.includes('administrative_area_level_2')) {
          area = component.long_name;
        }
        if (types.includes('country')) {
          country = component.long_name;
        }
      });
    }

    if (country !== 'Greece') {
      setError('Please select a location in Greece');
      setMarker(null);
      setLocationData(null);
      setShowPopup(false);
      return;
    }

    const locationInfo = {
      lat,
      lng,
      island: island || area || 'Unknown Island',
      area: area || island || 'Unknown Area',
      address: place.formatted_address || `${lat}, ${lng}`,
      placeId: place.place_id || null
    };

    setLocationData(locationInfo);
    setMarker({ lat, lng });
    setError(null);
    setShowPopup(true); // Show popup when location is processed

    if (map) {
      map.panTo({ lat, lng });
      map.setZoom(16);
    }
  }, [map]);

  // Initialize Autocomplete when map loads
  useEffect(() => {
    if (isLoaded && searchBoxRef.current && !autocomplete) {
      try {
        const autocompleteService = new window.google.maps.places.Autocomplete(
          searchBoxRef.current,
          {
            bounds: new window.google.maps.LatLngBounds(
              new window.google.maps.LatLng(34.8, 19.3),
              new window.google.maps.LatLng(41.8, 29.7)
            ),
            strictBounds: false,
            componentRestrictions: { country: 'gr' },
            fields: ['place_id', 'geometry', 'name', 'formatted_address', 'address_components'],
            types: ['establishment', 'geocode']
          }
        );

        autocompleteService.addListener('place_changed', () => {
          const place = autocompleteService.getPlace();
          console.log('Place selected:', place);
          if (place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            processPlace(place, lat, lng);
          } else {
            console.warn('No geometry found for place:', place);
            setError('Please select a valid location from the dropdown');
          }
        });

        setAutocomplete(autocompleteService);
        console.log('Autocomplete initialized successfully');
      } catch (error) {
        console.error('Failed to initialize autocomplete:', error);
        setError('Failed to initialize location search. Please try again.');
      }
    }
  }, [isLoaded, processPlace]);

  const onLoad = useCallback((map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMapClick = useCallback(async (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    setMarker({ lat, lng });
    setIsLoading(true);
    setError(null);
    setShowPopup(false); // Hide popup while loading

    try {
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const result = results[0];
          processPlace(result, lat, lng);
          setIsLoading(false);
        } else {
          setError('Could not get address for this location');
          setLocationData(null);
          setShowPopup(false);
          setIsLoading(false);
        }
      });
    } catch (err) {
      setError('Failed to get location details');
      setLocationData(null);
      setShowPopup(false);
      setIsLoading(false);
    }
  }, [processPlace]);

  const handleConfirmLocation = useCallback(() => {
    if (locationData && onLocationSelect) {
      onLocationSelect(locationData);
      
      // Clear everything and close popup
      setMarker(null);
      setLocationData(null);
      setError(null);
      setShowPopup(false);
      if (searchBoxRef.current) {
        searchBoxRef.current.value = '';
      }
    }
  }, [locationData, onLocationSelect]);

  const handleCancelSelection = useCallback(() => {
    setMarker(null);
    setLocationData(null);
    setError(null);
    setShowPopup(false);
    if (searchBoxRef.current) {
      searchBoxRef.current.value = '';
    }
  }, []);

  if (loadError) {
    return (
      <div style={{ 
        padding: '2rem', 
        background: '#fef2f2', 
        border: '1px solid #fecaca', 
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h3 style={{ color: '#dc2626' }}>❌ Google Maps Load Error</h3>
        <p style={{ color: '#dc2626' }}>Failed to load Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ 
        height: '450px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8fafc',
        borderRadius: '12px'
      }}>
        <p style={{ color: '#6b7280' }}>Loading Google Maps...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* SEARCH + MAP CONTAINER */}
      <div style={{ 
        width: '100%',
        background: '#ffffff',
        borderRadius: '12px',
        border: '2px solid #e0e7ef',
        overflow: 'hidden'
      }}>
        {/* Search Input */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e0e7ef' }}>
          <input
            ref={searchBoxRef}
            type="text"
            placeholder="Search for your restaurant name or location in Greece..."
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e0e7ef',
              borderRadius: '12px',
              fontSize: '16px',
              outline: 'none'
            }}
          />
        </div>

        {/* Map Container */}
        <div style={{ 
          width: '100%', 
          height: '400px', // Increased height since no confirmation box below
          position: 'relative'
        }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={marker || GREEK_ISLANDS_CENTER}
            zoom={marker ? 16 : 7}
            onLoad={onLoad}
            onUnmount={onUnmount}
            onClick={handleMapClick}
            options={mapOptions}
          >
            {marker && (
              <Marker
                position={marker}
                animation={window.google?.maps?.Animation?.BOUNCE}
              />
            )}
          </GoogleMap>

          {/* Loading Overlay */}
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              zIndex: 1000
            }}>
              <div style={{
                background: 'white',
                padding: '1rem 2rem',
                borderRadius: '8px',
                color: '#0369a1',
                fontWeight: 'bold'
              }}>
                Getting location details...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ 
          marginTop: '1rem',
          padding: '12px', 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* POPUP MODAL */}
      {showPopup && locationData && (
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 9998,
              backdropFilter: 'blur(4px)'
            }}
            onClick={handleCancelSelection}
          />
          
          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            maxWidth: '90vw',
            width: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #f0f4f8'
            }}>
              <h2 style={{
                color: '#15803d',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                📍 Confirm Your Location
              </h2>
            </div>

            {/* Location Details */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{
                background: '#f8fffe',
                border: '2px solid #d1fae5',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: '#166534',
                    display: 'block',
                    marginBottom: '0.25rem'
                  }}>
                    🏝️ Island:
                  </span>
                  <span style={{ color: '#15803d', fontSize: '1.1rem' }}>
                    {locationData.island}
                  </span>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: '#166534',
                    display: 'block',
                    marginBottom: '0.25rem'
                  }}>
                    📍 Area:
                  </span>
                  <span style={{ color: '#15803d', fontSize: '1.1rem' }}>
                    {locationData.area}
                  </span>
                </div>
                
                <div>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: '#166534',
                    display: 'block',
                    marginBottom: '0.25rem'
                  }}>
                    🏠 Full Address:
                  </span>
                  <span style={{ color: '#15803d', fontSize: '1.1rem' }}>
                    {locationData.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleConfirmLocation}
                style={{
                  flex: 1,
                  maxWidth: '200px',
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 1.5rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#15803d';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(22, 163, 74, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#16a34a';
                  e.target.style.transform = 'translateY(0px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
                }}
              >
                ✅ Confirm Location
              </button>
              
              <button
                onClick={handleCancelSelection}
                style={{
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 1.5rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#4b5563';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#6b7280';
                  e.target.style.transform = 'translateY(0px)';
                }}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LocationPicker;