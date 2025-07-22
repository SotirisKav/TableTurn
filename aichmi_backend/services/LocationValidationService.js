import IslandDetectionService from './IslandDetectionService.js';

class LocationValidationService {
    
    // Validate location and extract island/area/address

    static async validateAndExtractLocation(lat, lng, placeId = null, providedData = null) {
        try {
            console.log('🔍 Detecting island for:', { lat, lng, placeId, providedData });

            // If we have provided data from LocationPicker, use it first
            if (providedData && providedData.island && providedData.area && providedData.address) {
                console.log('✅ Using provided LocationPicker data:', providedData);

                // Clean the address - remove postal codes
                let cleanAddress = providedData.address;
                cleanAddress = cleanAddress.replace(/\s+\d{3}\s?\d{2}(\s+\d{2})?/g, ''); // Remove Greek postal codes like "853 00"
                cleanAddress = cleanAddress.replace(/,\s*$/, ''); // Remove trailing comma

                return {
                    isValid: true,
                    island: providedData.island,
                    area: providedData.area,
                    address: cleanAddress,
                    placeId: providedData.placeId || placeId,
                    formattedAddress: `${providedData.area}, ${providedData.island}, Greece`
                };
            }

            // Rest of your existing validation logic as fallback...
            const island = this.detectIslandByBounds(lat, lng);

            if (!island) {
                return {
                    isValid: false,
                    error: 'Location is not in the Greek islands'
                };
            }

            // Your existing code for Google Maps API call, etc.
            // ...
        } catch (error) {
            console.error('Location validation error:', error);
            return {
                isValid: false,
                error: 'Failed to validate location'
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