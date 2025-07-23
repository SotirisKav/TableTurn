-- Clean Sample Data for AICHMI Database
-- This file provides realistic test data for the restaurant reservation system

-- Clear existing data
DELETE FROM reservation;
DELETE FROM response_templates;
DELETE FROM bot_config;
DELETE FROM bot_modules;
DELETE FROM menu_item;
DELETE FROM tables;
DELETE FROM transfer_prices;
DELETE FROM refresh_tokens;
DELETE FROM owners;
DELETE FROM hotel;
DELETE FROM restaurant_hours;
DELETE FROM restaurant;

-- Reset sequences
ALTER SEQUENCE restaurant_restaurant_id_seq RESTART WITH 1;
ALTER SEQUENCE hotel_hotel_id_seq RESTART WITH 1;
ALTER SEQUENCE owners_id_seq RESTART WITH 1;

-- =====================================
-- 1. RESTAURANTS
-- =====================================

INSERT INTO restaurant (name, address, email, phone, area, island, profile_image_url, background_image_url, description, cuisine) VALUES
('Lofaki Restaurant', 'Agios Nektarios, 85300 Kos', 'info@lofaki.gr', '+30-22420-12345', 'Kos Harbor', 'Kos', 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1b/ee/e9/0c/dining-under-the-best.jpg', 'https://example.com/lofaki-bg.jpg', 'Authentic Greek cuisine with fresh seafood and traditional recipes passed down through generations. Located in the beautiful Kos Harbor with stunning sea views.', 'Greek & Modern Cuisine'),

('Mykonos Paradise Restaurant', 'Paradise Beach, 84600 Mykonos', 'info@paradiserestaurant.gr', '+30-22890-23456', 'Paradise Beach', 'Mykonos', 'https://example.com/mykonos-paradise.jpg', 'https://example.com/mykonos-bg.jpg', 'Beachfront dining with spectacular sunset views and fresh Mediterranean cuisine. Perfect for romantic dinners and special celebrations.', 'Mediterranean'),

('Santorini Sunset Taverna', 'Oia Village, 84702 Santorini', 'info@sunsetaverna.gr', '+30-22860-34567', 'Oia', 'Santorini', 'https://example.com/santorini-sunset.jpg', 'https://example.com/santorini-bg.jpg', 'Traditional Greek taverna with breathtaking caldera views and authentic local dishes. Family-owned for three generations.', 'Traditional Greek'),

('Rhodes Castle View', 'Old Town, 85100 Rhodes', 'info@castleview.gr', '+30-22410-45678', 'Old Town', 'Rhodes', 'https://example.com/rhodes-castle.jpg', 'https://example.com/rhodes-bg.jpg', 'Historic restaurant in the medieval old town with castle views and traditional cuisine. Featuring local Rhodes specialties.', 'Greek Traditional');

-- =====================================
-- 2. RESTAURANT HOURS
-- =====================================

INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
-- Lofaki Restaurant (ID 1) - Lunch & Dinner
(1, 'Monday', '12:00:00', '23:30:00'),
(1, 'Tuesday', '12:00:00', '23:30:00'),
(1, 'Wednesday', '12:00:00', '23:30:00'),
(1, 'Thursday', '12:00:00', '23:30:00'),
(1, 'Friday', '12:00:00', '00:30:00'),
(1, 'Saturday', '12:00:00', '00:30:00'),
(1, 'Sunday', '12:00:00', '23:30:00'),

-- Mykonos Paradise Restaurant (ID 2) - Dinner only, party hours
(2, 'Monday', '18:00:00', '01:00:00'),
(2, 'Tuesday', '18:00:00', '01:00:00'),
(2, 'Wednesday', '18:00:00', '01:00:00'),
(2, 'Thursday', '18:00:00', '02:00:00'),
(2, 'Friday', '18:00:00', '02:00:00'),
(2, 'Saturday', '18:00:00', '02:00:00'),
(2, 'Sunday', '18:00:00', '01:00:00'),

-- Santorini Sunset Taverna (ID 3) - Closed Tuesdays, sunset focused
(3, 'Monday', '17:00:00', '23:00:00'),
(3, 'Wednesday', '17:00:00', '23:00:00'),
(3, 'Thursday', '17:00:00', '23:00:00'),
(3, 'Friday', '17:00:00', '23:30:00'),
(3, 'Saturday', '17:00:00', '23:30:00'),
(3, 'Sunday', '17:00:00', '23:00:00'),

-- Rhodes Castle View (ID 4) - All day service
(4, 'Monday', '11:00:00', '22:00:00'),
(4, 'Tuesday', '11:00:00', '22:00:00'),
(4, 'Wednesday', '11:00:00', '22:00:00'),
(4, 'Thursday', '11:00:00', '22:00:00'),
(4, 'Friday', '11:00:00', '23:00:00'),
(4, 'Saturday', '11:00:00', '23:00:00'),
(4, 'Sunday', '11:00:00', '22:00:00');

-- =====================================
-- 3. OWNERS
-- =====================================

INSERT INTO owners (email, password, first_name, last_name, phone, restaurant_id, stripe_customer_id, subscription_status, oauth_provider, email_verified) VALUES
('vasilis@lofaki.gr', '$2b$10$example_hash_1', 'Vasilis', 'Manias', '+30-694-1234567', 1, 'cus_stripe_lofaki123', 'active', 'local', TRUE),
('maria@paradiserestaurant.gr', '$2b$10$example_hash_2', 'Maria', 'Papadopoulos', '+30-694-2345678', 2, 'cus_stripe_paradise456', 'active', 'google', TRUE),
('nikos@sunsetaverna.gr', '$2b$10$example_hash_3', 'Nikos', 'Stavros', '+30-694-3456789', 3, 'cus_stripe_sunset789', 'active', 'local', TRUE),
('dimitris@castleview.gr', '$2b$10$example_hash_4', 'Dimitris', 'Kostas', '+30-694-4567890', 4, NULL, NULL, 'local', FALSE);

-- =====================================
-- 4. HOTELS
-- =====================================

INSERT INTO hotel (name, address, area, island, transfer_price) VALUES
-- Kos Hotels
('Kos Palace Hotel', 'Psalidi Beach, 85300 Kos', 'Psalidi', 'Kos', 20.00),
('Aqua Blu Boutique Hotel', 'Lambi Beach, 85300 Kos', 'Lambi', 'Kos', 15.00),
('Grecotel Kos Imperial', 'Psalidi Beach, 85300 Kos', 'Psalidi', 'Kos', 25.00),

-- Mykonos Hotels
('Mykonos Grand Hotel', 'Agios Ioannis, 84600 Mykonos', 'Agios Ioannis', 'Mykonos', 30.00),
('Paradise Bay Resort', 'Paradise Beach, 84600 Mykonos', 'Paradise Beach', 'Mykonos', 25.00),
('Villa Mykonos', 'Platis Gialos, 84600 Mykonos', 'Platis Gialos', 'Mykonos', 35.00),

-- Santorini Hotels
('Santorini Palace', 'Fira, 84700 Santorini', 'Fira', 'Santorini', 40.00),
('Oia Suites', 'Oia Village, 84702 Santorini', 'Oia', 'Santorini', 45.00),
('Caldera View Hotel', 'Imerovigli, 84700 Santorini', 'Imerovigli', 'Santorini', 50.00),

-- Rhodes Hotels
('Rhodes Palace Hotel', 'Faliraki, 85105 Rhodes', 'Faliraki', 'Rhodes', 20.00),
('Medieval Inn', 'Old Town, 85100 Rhodes', 'Old Town', 'Rhodes', 15.00),
('Lindos Bay Resort', 'Lindos, 85107 Rhodes', 'Lindos', 'Rhodes', 35.00);

-- =====================================
-- 5. TRANSFER PRICES
-- =====================================

INSERT INTO transfer_prices (price_4_or_less, price_5_to_8, hotel_id, restaurant_id) VALUES
-- To Lofaki Restaurant
(12.00, 20.00, 1, 1), -- Kos Palace to Lofaki
(10.00, 18.00, 2, 1), -- Aqua Blu to Lofaki
(15.00, 25.00, 3, 1), -- Grecotel to Lofaki

-- To Mykonos Paradise Restaurant
(20.00, 35.00, 4, 2), -- Mykonos Grand to Paradise
(15.00, 25.00, 5, 2), -- Paradise Bay to Paradise
(25.00, 40.00, 6, 2), -- Villa Mykonos to Paradise

-- To Santorini Sunset Taverna
(30.00, 50.00, 7, 3), -- Santorini Palace to Sunset
(35.00, 55.00, 8, 3), -- Oia Suites to Sunset
(40.00, 60.00, 9, 3), -- Caldera View to Sunset

-- To Rhodes Castle View
(15.00, 25.00, 10, 4), -- Rhodes Palace to Castle View
(10.00, 18.00, 11, 4), -- Medieval Inn to Castle View
(25.00, 40.00, 12, 4); -- Lindos Bay to Castle View

-- =====================================
-- 6. TABLES
-- =====================================

INSERT INTO tables (table_type, table_price, restaurant_id) VALUES
-- Lofaki Restaurant (13 standard, 10 grass, 2 anniversary)
('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1),
('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1),
('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1),
('grass', 15.00, 1), ('grass', 15.00, 1), ('grass', 15.00, 1), ('grass', 15.00, 1), ('grass', 15.00, 1),
('grass', 15.00, 1), ('grass', 15.00, 1), ('grass', 15.00, 1), ('grass', 15.00, 1), ('grass', 15.00, 1),
('anniversary', 80.00, 1), ('anniversary', 80.00, 1),

-- Mykonos Paradise Restaurant (8 standard, 6 grass, 4 anniversary)
('standard', 10.00, 2), ('standard', 10.00, 2), ('standard', 10.00, 2), ('standard', 10.00, 2),
('standard', 10.00, 2), ('standard', 10.00, 2), ('standard', 10.00, 2), ('standard', 10.00, 2),
('grass', 25.00, 2), ('grass', 25.00, 2), ('grass', 25.00, 2), ('grass', 25.00, 2), ('grass', 25.00, 2), ('grass', 25.00, 2),
('anniversary', 100.00, 2), ('anniversary', 100.00, 2), ('anniversary', 100.00, 2), ('anniversary', 100.00, 2),

-- Santorini Sunset Taverna (10 standard, 6 anniversary)
('standard', 15.00, 3), ('standard', 15.00, 3), ('standard', 15.00, 3), ('standard', 15.00, 3), ('standard', 15.00, 3),
('standard', 15.00, 3), ('standard', 15.00, 3), ('standard', 15.00, 3), ('standard', 15.00, 3), ('standard', 15.00, 3),
('anniversary', 120.00, 3), ('anniversary', 120.00, 3), ('anniversary', 120.00, 3), ('anniversary', 120.00, 3), ('anniversary', 120.00, 3), ('anniversary', 120.00, 3),

-- Rhodes Castle View (12 standard, 4 grass, 2 anniversary)
('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4),
('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4), ('standard', 5.00, 4),
('grass', 12.00, 4), ('grass', 12.00, 4), ('grass', 12.00, 4), ('grass', 12.00, 4),
('anniversary', 50.00, 4), ('anniversary', 50.00, 4);

-- =====================================
-- 7. MENU ITEMS
-- =====================================

-- Lofaki Restaurant Menu
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free, available) VALUES
-- Appetizers
(1, 'Grilled Haloumi from Kos', 'Local halloumi cheese with berry jam', 9.00, 'Appetizer', TRUE, FALSE, TRUE, TRUE),
(1, 'Feta Nest with Honey & Sesame', 'Traditional feta cheese with honey and sesame', 10.00, 'Appetizer', TRUE, FALSE, FALSE, TRUE),
(1, 'Handmade Tzatziki', 'Fresh yogurt, cucumber, garlic, olive oil', 7.00, 'Appetizer', TRUE, FALSE, TRUE, TRUE),
(1, 'Avocado Hummus', 'Creamy avocado and chickpea hummus with tahini', 7.00, 'Appetizer', TRUE, TRUE, TRUE, TRUE),
-- Seafood
(1, 'Sea Bass Fillet', 'Fresh sea bass grilled or oven-baked', 19.00, 'Seafood', FALSE, FALSE, TRUE, TRUE),
(1, 'Grilled Shrimps', 'Grilled shrimps with ouzo, dill, tzatziki, pita bread', 19.00, 'Seafood', FALSE, FALSE, FALSE, TRUE),
(1, 'Seafood Plate for 2', 'Shrimps, mussels, squid, octopus, orzo, salad', 60.00, 'Seafood', FALSE, FALSE, FALSE, TRUE),
-- Main Dishes
(1, 'Homemade Moussaka', 'Traditional Greek moussaka with eggplant and meat sauce', 14.00, 'Main', FALSE, FALSE, FALSE, TRUE),
(1, 'Lamb Kleftiko', 'Slow-cooked lamb with herbs and vegetables', 18.00, 'Main', FALSE, FALSE, TRUE, TRUE),
-- Desserts
(1, 'Lofaki Sunset', 'Pistachio crème brûlée with sweet red wine', 8.50, 'Dessert', TRUE, FALSE, FALSE, TRUE),
(1, 'Baklava with Vegan Ice Cream', 'Traditional baklava with plant-based ice cream', 8.00, 'Dessert', FALSE, TRUE, FALSE, TRUE);

-- Mykonos Paradise Restaurant Menu
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free, available) VALUES
(2, 'Mediterranean Mezze Platter', 'Selection of traditional Greek appetizers', 18.00, 'Appetizer', TRUE, FALSE, FALSE, TRUE),
(2, 'Lobster Pasta', 'Fresh lobster with linguine in white wine sauce', 35.00, 'Seafood', FALSE, FALSE, FALSE, TRUE),
(2, 'Grilled Lamb Chops', 'Prime lamb chops with rosemary and garlic', 28.00, 'Main', FALSE, FALSE, TRUE, TRUE),
(2, 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 12.00, 'Dessert', TRUE, FALSE, FALSE, TRUE);

-- Santorini Sunset Taverna Menu
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free, available) VALUES
(3, 'Santorini Fava', 'Traditional yellow split pea puree with capers', 11.00, 'Appetizer', TRUE, TRUE, TRUE, TRUE),
(3, 'Grilled Octopus', 'Tender octopus with olive oil and vinegar', 22.00, 'Seafood', FALSE, FALSE, TRUE, TRUE),
(3, 'Beef Tenderloin', 'Premium beef with truffle sauce', 32.00, 'Main', FALSE, FALSE, TRUE, TRUE),
(3, 'Honey Panna Cotta', 'Traditional Greek honey dessert', 9.00, 'Dessert', TRUE, FALSE, TRUE, TRUE);

-- Rhodes Castle View Menu
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free, available) VALUES
(4, 'Rhodes Cheese Selection', 'Local cheeses with honey and nuts', 14.00, 'Appetizer', TRUE, FALSE, FALSE, TRUE),
(4, 'Swordfish Steak', 'Grilled swordfish with lemon and herbs', 24.00, 'Seafood', FALSE, FALSE, TRUE, TRUE),
(4, 'Souvlaki Platter', 'Traditional pork souvlaki with pita and tzatziki', 16.00, 'Main', FALSE, FALSE, FALSE, TRUE),
(4, 'Galaktoboureko', 'Traditional custard pastry with syrup', 7.00, 'Dessert', TRUE, FALSE, FALSE, TRUE);

-- =====================================
-- 8. SAMPLE RESERVATIONS
-- =====================================

INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, celebration_type, cake, flowers, hotel_name, restaurant_id) VALUES
-- Lofaki Restaurant reservations
('John Smith', 'john.smith@email.com', '+1-555-123-4567', CURRENT_DATE + INTERVAL '2 days', '19:00:00', 2, 'grass', 'anniversary', TRUE, TRUE, 'Kos Palace Hotel', 1),
('Maria Rossi', 'maria.rossi@email.com', '+39-333-123-4567', CURRENT_DATE + INTERVAL '3 days', '20:30:00', 4, 'standard', 'birthday', TRUE, FALSE, NULL, 1),

-- Mykonos Paradise Restaurant reservations  
('Hans Mueller', 'hans.mueller@email.de', '+49-177-123-4567', CURRENT_DATE + INTERVAL '4 days', '21:00:00', 6, 'anniversary', 'honeymoon', FALSE, TRUE, 'Mykonos Grand Hotel', 2),

-- Santorini Sunset Taverna reservations
('Sophie Laurent', 'sophie.laurent@email.fr', '+33-6-12-34-56-78', CURRENT_DATE + INTERVAL '5 days', '19:30:00', 3, 'standard', 'none', FALSE, FALSE, 'Oia Suites', 3),

-- Rhodes Castle View reservations
('David Wilson', 'david.wilson@email.com', '+44-20-1234-5678', CURRENT_DATE + INTERVAL '6 days', '18:00:00', 2, 'grass', 'anniversary', TRUE, TRUE, NULL, 4);

-- =====================================
-- 9. BOT CONFIGURATION
-- =====================================

-- Response Templates
INSERT INTO response_templates (module_name, template, restaurant_id) VALUES
('greeting', 'Welcome to Lofaki Restaurant! We are delighted to help you with your reservation. How may we assist you today?', 1),
('reservation_confirmation', 'Thank you for choosing Lofaki! Your reservation for {guests} guests on {date} at {time} has been confirmed. We look forward to welcoming you!', 1),

('greeting', 'Welcome to Mykonos Paradise Restaurant! Your perfect beachfront dining experience awaits. How can we help you?', 2),
('reservation_confirmation', 'Your table for {guests} at Paradise Restaurant is confirmed for {date} at {time}. Get ready for an unforgettable evening!', 2),

('greeting', 'Welcome to Santorini Sunset Taverna! Experience authentic Greek cuisine with breathtaking views. How may I assist you?', 3),
('reservation_confirmation', 'Your reservation at Sunset Taverna for {guests} guests on {date} at {time} is confirmed. Perfect timing for our famous sunset!', 3),

('greeting', 'Welcome to Rhodes Castle View! Discover traditional flavors in our historic setting. How can I help you today?', 4),
('reservation_confirmation', 'Your table for {guests} at Castle View is reserved for {date} at {time}. We look forward to serving you!', 4);

-- Bot Config
INSERT INTO bot_config (config_key, config_value, restaurant_id) VALUES
('response_style', 'friendly_professional', 1), ('language', 'en', 1),
('response_style', 'energetic_fun', 2), ('language', 'en', 2),
('response_style', 'romantic_elegant', 3), ('language', 'en', 3),
('response_style', 'traditional_warm', 4), ('language', 'en', 4);

-- Bot Modules
INSERT INTO bot_modules (module_name, enabled, restaurant_id) VALUES
('greeting', TRUE, 1), ('reservation_booking', TRUE, 1), ('menu_inquiry', TRUE, 1),
('greeting', TRUE, 2), ('reservation_booking', TRUE, 2), ('menu_inquiry', TRUE, 2),
('greeting', TRUE, 3), ('reservation_booking', TRUE, 3), ('menu_inquiry', TRUE, 3),
('greeting', TRUE, 4), ('reservation_booking', TRUE, 4), ('menu_inquiry', TRUE, 4);