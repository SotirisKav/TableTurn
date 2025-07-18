import IslandDetectionService from './IslandDetectionService.js';

class LocationValidationService {
    
    // Validate location and extract island/area/address
    static async validateAndExtractLocation(lat, lng, placeId = null) {
        try {
            const locationInfo = await IslandDetectionService.extractLocationInfo(lat, lng, placeId);

            if (!locationInfo.isValid || !locationInfo.island) {
                return {
                    isValid: false,
                    error: 'Unable to detect Greek island from this location',
                    suggestions: 'Please select a location on a Greek island'
                };
            }

            // NEW: More lenient validation - if we have island, allow it
            const area = locationInfo.area || 'Unknown Area';
            const address = locationInfo.address || `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

            return {
                isValid: true,
                island: locationInfo.island,
                area: area,
                address: address,
                formattedAddress: locationInfo.formattedAddress || `${area}, ${locationInfo.island}, Greece`,
                placeId: placeId
            };

        } catch (error) {
            console.error('Location validation error:', error);
            return {
                isValid: false,
                error: 'Location validation service failed'
            };
        }
    }
    
    // Validate place ID and extract location info
    static async validatePlaceId(placeId) {
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${process.env.GOOGLE_MAPS_API_KEY}`
            );
            
            const data = await response.json();
            
            if (data.status !== 'OK') {
                return {
                    isValid: false,
                    error: 'Invalid place ID'
                };
            }
            
            const result = data.result;
            const location = result.geometry.location;
            
            return await this.validateAndExtractLocation(location.lat, location.lng, placeId);
            
        } catch (error) {
            console.error('Place validation error:', error);
            return {
                isValid: false,
                error: 'Place validation failed'
            };
        }
    }
}

export default LocationValidationService;