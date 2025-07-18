import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, StandaloneSearchBox } from '@react-google-maps/api';

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
  },
};

const libraries = ['places'];

const LocationPicker = ({ onLocationSelect, initialLocation = null }) => {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(initialLocation);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchBox, setSearchBox] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [locationData, setLocationData] = useState(null);

  const searchBoxRef = useRef();

  // Check if API key exists with detailed logging
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  console.log('🔑 Detailed API Key check:', {
    hasApiKey: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0,
    keyPreview: apiKey ? `${apiKey.substring(0, 15)}...` : 'No key found',
    fullKey: apiKey, // Remove this line in production!
    allEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
});

const { isLoaded, loadError } = useJsApiLoader({
  id: 'google-map-script',
  googleMapsApiKey: apiKey,
  libraries: libraries,
  region: 'GR',
  language: 'en',
});

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
    setShowConfirmButton(false);

    try {
      const geocoder = new window.google.maps.Geocoder();
      
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const result = results[0];
          const addressComponents = result.address_components;
          
          // Extract location details
          let island = '';
          let area = '';
          let country = '';
          
          addressComponents.forEach(component => {
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

          // Check if it's in Greece
          if (country !== 'Greece') {
            setError('Please select a location in Greece');
            setMarker(null);
            setIsLoading(false);
            return;
          }

          const locationInfo = {
            lat,
            lng,
            island: island || area,
            area: area || island,
            address: result.formatted_address,
            placeId: result.place_id
          };

          setLocationData(locationInfo);
          setSelectedAddress(result.formatted_address);
          setShowConfirmButton(true);
          setIsLoading(false);
        } else {
          setError('Could not get address for this location');
          setMarker(null);
          setIsLoading(false);
        }
      });
    } catch (err) {
      console.error('Geocoding error:', err);
      setError('Failed to get location details');
      setMarker(null);
      setIsLoading(false);
    }
  }, []);

  const onSearchBoxLoad = useCallback((ref) => {
    setSearchBox(ref);
  }, []);

  const onPlacesChanged = useCallback(() => {
    if (searchBox) {
      const places = searchBox.getPlaces();
      
      if (places && places.length > 0) {
        const place = places[0];
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Check if location is in Greece
        const isInGreece = place.address_components?.some(component => 
          component.types.includes('country') && 
          component.long_name === 'Greece'
        );

        if (!isInGreece) {
          setError('Please select a location in Greece');
          return;
        }

        setMarker({ lat, lng });
        
        // Center map on selected location
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(15);
        }

        // Extract location details
        let island = '';
        let area = '';
        
        place.address_components?.forEach(component => {
          const types = component.types;
          if (types.includes('administrative_area_level_1')) {
            island = component.long_name;
          }
          if (types.includes('locality') || types.includes('administrative_area_level_2')) {
            area = component.long_name;
          }
        });

        const locationInfo = {
          lat,
          lng,
          island: island || area,
          area: area || island,
          address: place.formatted_address,
          placeId: place.place_id
        };

        setLocationData(locationInfo);
        setSelectedAddress(place.formatted_address);
        setShowConfirmButton(true);
        setError(null);
      }
    }
  }, [searchBox, map]);

  const handleConfirmLocation = () => {
    if (locationData && onLocationSelect) {
      onLocationSelect(locationData);
      setShowConfirmButton(false);
      setMarker(null);
      setSelectedAddress('');
      setLocationData(null);
    }
  };

  const handleClearSelection = () => {
    setMarker(null);
    setSelectedAddress('');
    setShowConfirmButton(false);
    setLocationData(null);
    setError(null);
    if (searchBoxRef.current) {
      searchBoxRef.current.value = '';
    }
  };

  if (loadError) {
    return (
      <div style={{ 
        padding: '2rem', 
        background: '#fef2f2', 
        border: '1px solid #fecaca', 
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#dc2626', margin: 0 }}>
          Failed to load Google Maps. Please check your API key configuration.
        </p>
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #e0e7ef',
            borderTop: '3px solid #1e3a8a',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#6b7280', margin: 0 }}>Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="location-picker" style={{ width: '100%', height: '450px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <StandaloneSearchBox
          onLoad={onSearchBoxLoad}
          onPlacesChanged={onPlacesChanged}
        >
          <input
            ref={searchBoxRef}
            type="text"
            placeholder="Search for your restaurant location in Greece..."
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e0e7ef',
              borderRadius: '12px',
              fontSize: '16px',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#1e3a8a'}
            onBlur={(e) => e.target.style.borderColor = '#e0e7ef'}
          />
        </StandaloneSearchBox>
      </div>

      <div style={{ 
        width: '100%', 
        height: '350px', 
        border: '2px solid #e0e7ef', 
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={marker || GREEK_ISLANDS_CENTER}
          zoom={marker ? 15 : 7}
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
      </div>

      {isLoading && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '12px', 
          background: '#f0f9ff', 
          border: '1px solid #0ea5e9', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #0ea5e9',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '8px'
          }}></div>
          <span style={{ color: '#0369a1' }}>Getting location details...</span>
        </div>
      )}

      {error && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '12px', 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px'
        }}>
          <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
          <p style={{ fontSize: '14px', color: '#b91c1c', margin: '4px 0 0 0' }}>
            Please select a location on a Greek island.
          </p>
        </div>
      )}

      {showConfirmButton && selectedAddress && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '16px', 
          background: '#f0fdf4', 
          border: '1px solid #bbf7d0', 
          borderRadius: '12px'
        }}>
          <p style={{ 
            color: '#166534', 
            fontWeight: '600', 
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            📍 Selected Location:
          </p>
          <p style={{ 
            color: '#15803d', 
            marginBottom: '12px',
            fontSize: '15px',
            fontWeight: '500'
          }}>
            {selectedAddress}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleConfirmLocation}
              style={{
                background: '#1e3a8a',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'background 0.2s ease',
                flex: 1
              }}
              onMouseOver={(e) => e.target.style.background = '#1e40af'}
              onMouseOut={(e) => e.target.style.background = '#1e3a8a'}
            >
              ✓ Confirm This Location
            </button>
            <button
              onClick={handleClearSelection}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'background 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#4b5563'}
              onMouseOut={(e) => e.target.style.background = '#6b7280'}
            >
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      <div style={{ 
        marginTop: '1rem', 
        fontSize: '14px', 
        color: '#6b7280',
        background: '#f8fafc',
        padding: '12px',
        borderRadius: '8px'
      }}>
        <p style={{ margin: 0, marginBottom: '8px' }}>
          💡 <strong>How to select your location:</strong>
        </p>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Search for your restaurant in the search box above</li>
          <li>Or click directly on the map where your restaurant is located</li>
          <li>Confirm your selection using the "Confirm This Location" button</li>
        </ul>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LocationPicker;