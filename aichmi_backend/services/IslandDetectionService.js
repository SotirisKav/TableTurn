import fetch from 'node-fetch';

class IslandDetectionService {
    
    // Greek islands with detection keywords
    static greekIslands = {
        'Kos': {
            keywords: ['kos', 'κως', 'kardamena', 'kardamaina', 'kefalos', 'tigaki', 'mastihari'],
            bounds: { north: 36.950, south: 36.620, east: 27.320, west: 26.920 } // FIXED: Extended east boundary
        },
        'Mykonos': {
            keywords: ['mykonos', 'mikonos', 'μύκονος', 'ornos', 'paradise', 'platis gialos'],
            bounds: { north: 37.500, south: 37.400, east: 25.400, west: 25.270 } // FIXED: Extended bounds
        },
        'Santorini': {
            keywords: ['santorini', 'thira', 'σαντορίνη', 'θήρα', 'oia', 'fira', 'kamari'],
            bounds: { north: 36.500, south: 36.320, east: 25.500, west: 25.330 } // FIXED: Extended bounds
        },
        'Rhodes': {
            keywords: ['rhodes', 'rodos', 'ρόδος', 'lindos', 'faliraki', 'ixia'],
            bounds: { north: 36.520, south: 35.820, east: 28.260, west: 27.720 } // FIXED: Extended bounds
        },
        'Crete': {
            keywords: ['crete', 'kriti', 'κρήτη', 'heraklion', 'chania', 'rethymno', 'agios nikolaos'],
            bounds: { north: 35.720, south: 34.780, east: 26.350, west: 23.480 }
        },
        'Paros': {
            keywords: ['paros', 'πάρος', 'parikia', 'naoussa'],
            bounds: { north: 37.170, south: 37.020, east: 25.240, west: 25.090 }
        },
        'Naxos': {
            keywords: ['naxos', 'νάξος', 'plaka'],
            bounds: { north: 37.200, south: 36.980, east: 25.600, west: 25.330 }
        }
    };

    // Extract island and area from Google Maps data
    static async extractLocationInfo(lat, lng, placeId = null) {
        try {
            let addressComponents = [];
            let formattedAddress = '';

            // Get place details if place ID provided
            if (placeId) {
                const placeResponse = await fetch(
                    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,formatted_address&key=${process.env.GOOGLE_MAPS_API_KEY}`
                );
                const placeData = await placeResponse.json();
                
                if (placeData.status === 'OK') {
                    addressComponents = placeData.result.address_components || [];
                    formattedAddress = placeData.result.formatted_address || '';
                }
            }

            // If no place details, use reverse geocoding
            if (!addressComponents.length) {
                const geocodeResponse = await fetch(
                    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
                );
                const geocodeData = await geocodeResponse.json();
                
                if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
                    addressComponents = geocodeData.results[0].address_components;
                    formattedAddress = geocodeData.results[0].formatted_address;
                }
            }

            // Parse the address components
            const parsedLocation = this.parseGreekAddress(addressComponents, formattedAddress);
            
            // Detect island
            const detectedIsland = this.detectIsland(lat, lng, formattedAddress, parsedLocation);
            
            // Extract area (locality or administrative area)
            const area = parsedLocation.locality || parsedLocation.sublocality || parsedLocation.administrativeArea || 'Unknown Area';
            
            // Extract specific address (street + number)
            const specificAddress = this.extractSpecificAddress(formattedAddress, parsedLocation);

            return {
                island: detectedIsland,
                area: area,
                address: specificAddress,
                formattedAddress,
                isValid: !!detectedIsland
            };

        } catch (error) {
            console.error('Location extraction error:', error);
            return {
                island: null,
                area: null,
                address: null,
                formattedAddress: '',
                isValid: false,
                error: error.message
            };
        }
    }

    // Parse Greek address components
    static parseGreekAddress(components, formattedAddress) {
        const result = {
            streetNumber: null,
            route: null,
            locality: null,
            sublocality: null,
            administrativeArea: null
        };

        for (const component of components) {
            const types = component.types;
            
            if (types.includes('street_number')) {
                result.streetNumber = component.long_name;
            }
            if (types.includes('route')) {
                result.route = component.long_name;
            }
            if (types.includes('locality')) {
                result.locality = component.long_name;
            }
            if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
                result.sublocality = component.long_name;
            }
            if (types.includes('administrative_area_level_1') || types.includes('administrative_area_level_2')) {
                result.administrativeArea = component.long_name;
            }
        }

        return result;
    }

    // Update the detectIsland method to include debug logs:

    static detectIsland(lat, lng, formattedAddress, parsedLocation) {
        console.log('🔍 Detecting island for:', { lat, lng, formattedAddress, parsedLocation });

        const addressLower = formattedAddress.toLowerCase();

        // Method 1: Check for island keywords in address
        for (const [islandName, islandData] of Object.entries(this.greekIslands)) {
            if (islandData.keywords.some(keyword => addressLower.includes(keyword))) {
                console.log('✅ Found by keyword:', islandName);
                return islandName;
            }
        }

        // Method 2: Check administrative areas
        if (parsedLocation.administrativeArea) {
            const adminLower = parsedLocation.administrativeArea.toLowerCase();
            for (const [islandName, islandData] of Object.entries(this.greekIslands)) {
                if (islandData.keywords.some(keyword => adminLower.includes(keyword))) {
                    console.log('✅ Found by admin area:', islandName);
                    return islandName;
                }
            }
        }

        // Method 3: Check locality
        if (parsedLocation.locality) {
            const localityLower = parsedLocation.locality.toLowerCase();
            for (const [islandName, islandData] of Object.entries(this.greekIslands)) {
                if (islandData.keywords.some(keyword => localityLower.includes(keyword))) {
                    console.log('✅ Found by locality:', islandName);
                    return islandName;
                }
            }
        }

        // Method 4: Use coordinate bounds as fallback
        for (const [islandName, islandData] of Object.entries(this.greekIslands)) {
            const bounds = islandData.bounds;
            console.log(`🗺️ Checking bounds for ${islandName}:`, bounds);
            console.log(`📍 Coords: lat=${lat} (${bounds.south}-${bounds.north}), lng=${lng} (${bounds.west}-${bounds.east})`);

            if (lat >= bounds.south && lat <= bounds.north &&
                lng >= bounds.west && lng <= bounds.east) {
                console.log('✅ Found by bounds:', islandName);
                return islandName;
            }
        }

        console.log('❌ No island detected');
        return null;
    }

    // Extract specific street address (e.g., "Ellispontou 4")
    static extractSpecificAddress(formattedAddress, parsedLocation) {
        // Method 1: Use street route + number from components
        if (parsedLocation.route) {
            if (parsedLocation.streetNumber) {
                return `${parsedLocation.route} ${parsedLocation.streetNumber}`;
            } else {
                return parsedLocation.route;
            }
        }

        // Method 2: Extract from formatted address
        // Greek addresses usually follow: "Street Number, Area, Island, Country"
        const addressParts = formattedAddress.split(',').map(part => part.trim());
        
        if (addressParts.length > 0) {
            // First part is usually the street address
            return addressParts[0];
        }

        return formattedAddress;
    }
}

export default IslandDetectionService;