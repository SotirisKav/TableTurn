-- Insert sample data for Lofaki Taverna and related venues
-- This data matches the aichmi_ddl.sql schema

-- Insert venues (restaurants)
INSERT INTO venue (name, address, area, type, rating, pricing, image_url, description, cuisine) VALUES
('Lofaki Taverna', 'Kos Harbor Waterfront, 85300 Kos', 'Kos Harbor', 'restaurant', 4.8, 'expensive', 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1b/ee/e9/0c/dining-under-the-best.jpg?w=900&h=500&s=1', 'Authentic Greek cuisine with fresh seafood and traditional recipes passed down through generations. Located in the beautiful Kos Harbor with stunning sea views.', 'Traditional Greek');

-- Insert owners for the venues
INSERT INTO owner (name, email, phone, venue_id) VALUES
('Vasilis Manias', 'vasilismanias@lofaki.gr', '+30 22420 12345', 1);

-- Insert table types
INSERT INTO tables (table_type, table_price) VALUES
('standard', 0.00),
('grass', 15.00),
('anniversary', 25.00);

-- Insert transfer areas with pricing
INSERT INTO transfer_areas (name, price_4_or_less, price_5_to_8) VALUES
('Kos Airport', 25.00, 35.00),
('Kos Harbor', 20.00, 30.00),
('Kardamena', 30.00, 40.00),
('Mastichari', 25.00, 35.00),
('Kefalos', 35.00, 45.00),
('Tingaki', 20.00, 30.00);

-- Insert sample hotels
INSERT INTO hotel (name, address, area, transfer_price) VALUES
('Kos Palace Hotel', 'Psalidi Beach, 85300 Kos', 'Psalidi', 20.00),
('Aqua Blu Boutique Hotel', 'Lambi Beach, 85300 Kos', 'Lambi', 15.00),
('Grecotel Kos Imperial', 'Psalidi Beach, 85300 Kos', 'Psalidi', 25.00),
('Diamond Deluxe Hotel', 'Kardamena Beach, 85302 Kardamena', 'Kardamena', 30.00),
('Sunrise Hotel', 'Tigkaki Beach, 85300 Kos', 'Tingaki', 20.00);

-- Insert some sample customers
INSERT INTO customer (name, email, phone) VALUES
('John Smith', 'john.smith@email.com', '+44 7700 900123'),
('Maria Garcia', 'maria.garcia@email.com', '+34 600 123 456'),
('Pierre Dubois', 'pierre.dubois@email.com', '+33 6 12 34 56 78'),
('Anna Mueller', 'anna.mueller@email.com', '+49 170 1234567'),
('Sofia Rossi', 'sofia.rossi@email.com', '+39 320 1234567');

-- Insert sample reservations
INSERT INTO reservation (
    reservation_date, 
    reservation_time, 
    guests, 
    table_type, 
    table_price,
    celebration_type,
    cake,
    cake_price,
    flowers,
    flowers_price,
    hotel_name,
    hotel_id,
    customer_id
) VALUES
('2025-07-15', '19:30:00', 2, 'anniversary', 25.00, 'anniversary', true, 35.00, true, 20.00, 'Kos Palace Hotel', 1, 1),
('2025-07-20', '20:00:00', 4, 'standard', 0.00, 'birthday', true, 30.00, false, 0.00, 'Aqua Blu Boutique Hotel', 2, 2),
('2025-07-25', '18:00:00', 6, 'grass', 15.00, 'none', false, 0.00, false, 0.00, NULL, NULL, 3),
('2025-08-01', '19:00:00', 2, 'anniversary', 25.00, 'honeymoon', true, 40.00, true, 25.00, 'Grecotel Kos Imperial', 3, 4),
('2025-08-05', '20:30:00', 8, 'standard', 0.00, 'none', false, 0.00, false, 0.00, 'Diamond Deluxe Hotel', 4, 5);

-- Insert some fully booked dates for venues
INSERT INTO fully_booked_dates (fully_booked_date, venue_id) VALUES
('2025-07-14', 1), -- Lofaki fully booked on July 14
('2025-08-15', 1), -- Lofaki fully booked on August 15 (Greek holiday)
('2025-07-25', 2), -- Aegean Breeze fully booked
('2025-08-10', 3); -- Island Flavors fully booked

-- Insert bot configuration for Lofaki
INSERT INTO bot_config (key, value, venue_id) VALUES
('response_style', 'friendly_professional', 1),
('language', 'english', 1),
('greeting_enabled', 'true', 1),
('confirmation_required', 'true', 1);

-- Insert bot modules for Lofaki
INSERT INTO bot_modules (module_name, enabled, venue_id) VALUES
('greeting', true, 1),
('reservation_confirmation', true, 1),
('menu_suggestions', true, 1),
('special_offers', true, 1);

-- Insert response templates for Lofaki
INSERT INTO response_templates (module_name, template, venue_id) VALUES
('greeting', 'Welcome to Lofaki Taverna! We are delighted to help you with your reservation. How may we assist you today?', 1),
('reservation_confirmation', 'Thank you for choosing Lofaki Taverna! Your reservation for {guests} guests on {date} at {time} has been confirmed. We look forward to welcoming you!', 1),
('menu_suggestions', 'Our chef recommends our fresh seafood specialties and traditional Greek dishes. Would you like to hear about our daily specials?', 1),
('special_offers', 'This month we have a special anniversary package with complimentary flowers and a celebration cake. Perfect for romantic occasions!', 1);
