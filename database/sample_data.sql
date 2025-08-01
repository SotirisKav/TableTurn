-- Clean Sample Data for TableTurn Database
-- This file provides realistic test data for the restaurant reservation system

-- Clear existing data
DELETE FROM reservation;
DELETE FROM response_templates;
DELETE FROM bot_config;
DELETE FROM bot_modules;
DELETE FROM menu_item;
DELETE FROM tables;
DELETE FROM refresh_tokens;
DELETE FROM owners;
DELETE FROM restaurant_hours;
DELETE FROM restaurant;

-- Reset sequences
ALTER SEQUENCE restaurant_restaurant_id_seq RESTART WITH 1;
ALTER SEQUENCE owners_id_seq RESTART WITH 1;

-- =====================================
-- 1. RESTAURANTS
-- =====================================

INSERT INTO restaurant (name, address, email, phone, area, island, profile_image_url, background_image_url, description, cuisine, min_reservation_gap_hours) VALUES
('Lofaki Restaurant', 'Agios Nektarios, 85300 Kos', 'info@lofaki.gr', '+30-22420-12345', 'Kos Harbor', 'Kos', 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1b/ee/e9/0c/dining-under-the-best.jpg', 'https://example.com/lofaki-bg.jpg', 'Authentic Greek cuisine with fresh seafood and traditional recipes passed down through generations. Located in the beautiful Kos Harbor with stunning sea views.', 'Greek & Modern Cuisine', 3),

('Mykonos Paradise Restaurant', 'Paradise Beach, 84600 Mykonos', 'info@paradiserestaurant.gr', '+30-22890-23456', 'Paradise Beach', 'Mykonos', 'https://example.com/mykonos-paradise.jpg', 'https://example.com/mykonos-bg.jpg', 'Beachfront dining with spectacular sunset views and fresh Mediterranean cuisine. Perfect for romantic dinners and special celebrations.', 'Mediterranean', 2),

('Santorini Sunset Taverna', 'Oia Village, 84702 Santorini', 'info@sunsetaverna.gr', '+30-22860-34567', 'Oia', 'Santorini', 'https://example.com/santorini-sunset.jpg', 'https://example.com/santorini-bg.jpg', 'Traditional Greek taverna with breathtaking caldera views and authentic local dishes. Family-owned for three generations.', 'Traditional Greek', 4),

('Rhodes Castle View', 'Old Town, 85100 Rhodes', 'info@castleview.gr', '+30-22410-45678', 'Old Town', 'Rhodes', 'https://example.com/rhodes-castle.jpg', 'https://example.com/rhodes-bg.jpg', 'Historic restaurant in the medieval old town with castle views and traditional cuisine. Featuring local Rhodes specialties.', 'Greek Traditional', 2);

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
(3, 'Tuesday', '17:00:00', '23:00:00'),
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
-- Admin user (ID 1 - Sotiris)
('sotiriskavadakis@gmail.com', '$2b$10$JH5kwtPDscy1Rgpk8Ac24eYnJhtbeotDQh2VI6YDgr3W6HfgqoTou', 'Sotiris', 'Kavadakis', '+30-694-9999999', NULL, NULL, NULL, 'local', TRUE),
('vasilis@lofaki.gr', '$2b$10$example_hash_1', 'Vasilis', 'Manias', '+30-694-1234567', 1, 'cus_stripe_lofaki123', 'active', 'local', TRUE),
('maria@paradiserestaurant.gr', '$2b$10$example_hash_2', 'Maria', 'Papadopoulos', '+30-694-2345678', 2, 'cus_stripe_paradise456', 'active', 'google', TRUE),
('nikos@sunsetaverna.gr', '$2b$10$example_hash_3', 'Nikos', 'Stavros', '+30-694-3456789', 3, 'cus_stripe_sunset789', 'active', 'local', TRUE),
('dimitris@castleview.gr', '$2b$10$example_hash_4', 'Dimitris', 'Kostas', '+30-694-4567890', 4, NULL, NULL, 'local', FALSE);

-- =====================================
-- 4. TABLES
-- =====================================

INSERT INTO tables (table_name, table_type, table_price, capacity, restaurant_id, x_coordinate, y_coordinate, status) VALUES
-- Lofaki Restaurant - Better variety for exact matching testing
-- Standard tables (A section) - Mixed capacities
('A1', 'standard', 0.00, 2, 1, 50, 50, 'available'), 
('A2', 'standard', 0.00, 4, 1, 200, 50, 'available'), 
('A3', 'standard', 0.00, 6, 1, 350, 50, 'available'),
('A4', 'standard', 0.00, 8, 1, 500, 50, 'available'),
-- Grass tables (B section) - Different capacities
('B1', 'grass', 15.00, 2, 1, 100, 400, 'available'), 
('B2', 'grass', 15.00, 4, 1, 300, 400, 'available'),
('B3', 'grass', 15.00, 6, 1, 500, 400, 'available'),
-- Anniversary tables (C section)
('C1', 'anniversary', 80.00, 8, 1, 200, 880, 'available'),

-- Mykonos Paradise Restaurant - Exact matching test variety
-- Standard tables (A section)
('A1', 'standard', 10.00, 2, 2, 60, 60, 'available'), 
('A2', 'standard', 10.00, 4, 2, 220, 60, 'available'),
('A3', 'standard', 10.00, 6, 2, 380, 60, 'available'),
-- Grass tables (B section)
('B1', 'grass', 25.00, 2, 2, 80, 320, 'available'), 
('B2', 'grass', 25.00, 4, 2, 280, 320, 'available'),
('B3', 'grass', 25.00, 6, 2, 480, 320, 'available'),
-- Anniversary tables (C section)
('C1', 'anniversary', 100.00, 8, 2, 120, 600, 'available'),

-- Santorini Sunset Taverna - Precise capacity testing
-- Standard tables (A section)
('A1', 'standard', 15.00, 2, 3, 70, 70, 'available'), 
('A2', 'standard', 15.00, 4, 3, 250, 70, 'available'), 
('A3', 'standard', 15.00, 6, 3, 430, 70, 'available'),
('A4', 'standard', 15.00, 8, 3, 610, 70, 'available'),
-- Anniversary tables (C section)
('C1', 'anniversary', 120.00, 10, 3, 100, 590, 'available'), 
('C2', 'anniversary', 120.00, 12, 3, 350, 590, 'available'),

-- Rhodes Castle View - Complete exact matching variety
-- Standard tables (A section)
('A1', 'standard', 5.00, 2, 4, 80, 80, 'available'), 
('A2', 'standard', 5.00, 4, 4, 240, 80, 'available'), 
('A3', 'standard', 5.00, 6, 4, 400, 80, 'available'),
('A4', 'standard', 5.00, 8, 4, 560, 80, 'available'),
-- Grass tables (B section)
('B1', 'grass', 12.00, 2, 4, 120, 500, 'available'), 
('B2', 'grass', 12.00, 4, 4, 320, 500, 'available'),
('B3', 'grass', 12.00, 6, 4, 520, 500, 'available'),
-- Anniversary tables (C section)
('C1', 'anniversary', 50.00, 8, 4, 180, 740, 'available');

-- =====================================
-- 7. MENU ITEMS
-- =====================================

-- Lofaki Restaurant Menu (Expanded)
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
(1, 'Grilled Haloumi from Kos', 'Local halloumi cheese with berry jam', 9.00, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Feta Nest with Honey & Sesame', 'Traditional feta cheese with honey and sesame', 10.00, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Handmade Tzatziki', 'Fresh yogurt, cucumber, garlic, olive oil', 7.00, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Avocado Hummus', 'Creamy avocado and chickpea hummus with tahini', 7.00, 'Appetizer', TRUE, TRUE, TRUE),
(1, 'Dolmades', 'Vine leaves stuffed with rice, herbs and pine nuts', 8.50, 'Appetizer', TRUE, TRUE, TRUE),
(1, 'Spanakopita', 'Traditional spinach and feta pie in phyllo pastry', 9.50, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Greek Bruschetta', 'Toasted bread with tomato, feta, olive oil and oregano', 8.00, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Fried Zucchini', 'Crispy zucchini with garlic yogurt dip', 7.50, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Keftedakia', 'Traditional Greek meatballs with tomato sauce', 10.00, 'Appetizer', FALSE, FALSE, FALSE),
(1, 'Grilled Octopus', 'Tender octopus with olive oil, lemon and capers', 14.00, 'Appetizer', FALSE, FALSE, FALSE),
-- Seafood
(1, 'Sea Bass Fillet', 'Fresh sea bass grilled or oven-baked', 19.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Grilled Shrimps', 'Grilled shrimps with ouzo, dill, tzatziki, pita bread', 19.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Seafood Plate for 2', 'Shrimps, mussels, squid, octopus, orzo, salad', 60.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Grilled Dorado', 'Fresh dorado with lemon and herbs', 18.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Seafood Risotto', 'Arborio rice with mixed seafood and saffron', 22.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Mussel Saganaki', 'Mussels in tomato sauce with feta cheese', 16.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Grilled Squid', 'Fresh squid with olive oil and balsamic glaze', 17.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Fish Soup', 'Traditional Greek fish soup with vegetables', 12.00, 'Seafood', FALSE, FALSE, FALSE),
-- Main Dishes
(1, 'Homemade Moussaka', 'Traditional Greek moussaka with eggplant and meat sauce', 14.00, 'Main', FALSE, FALSE, FALSE),
(1, 'Lamb Kleftiko', 'Slow-cooked lamb with herbs and vegetables', 18.00, 'Main', FALSE, FALSE, FALSE),
(1, 'Beef Stifado', 'Beef stew with pearl onions and tomato sauce', 16.00, 'Main', FALSE, FALSE, FALSE),
(1, 'Pork Souvlaki', 'Grilled pork skewers with pita and tzatziki', 13.00, 'Main', FALSE, FALSE, FALSE),
(1, 'Chicken Gyros', 'Marinated chicken with pita, tomato, onion and tzatziki', 12.00, 'Main', FALSE, FALSE, FALSE),
(1, 'Vegetarian Moussaka', 'Layers of eggplant, zucchini with béchamel sauce', 13.00, 'Main', TRUE, FALSE, FALSE),
(1, 'Stuffed Tomatoes', 'Tomatoes stuffed with rice, herbs and pine nuts', 11.00, 'Main', TRUE, TRUE, TRUE),
(1, 'Grilled Lamb Chops', 'Prime lamb chops with rosemary and garlic', 24.00, 'Main', FALSE, FALSE, FALSE),
(1, 'Pasta with Seafood', 'Linguine with mixed seafood in white wine sauce', 18.00, 'Main', FALSE, FALSE, FALSE),
(1, 'Gemista', 'Stuffed peppers and tomatoes with rice and herbs', 10.50, 'Main', TRUE, TRUE, TRUE),
-- Salads
(1, 'Greek Village Salad', 'Tomatoes, cucumber, onion, feta, olives, olive oil', 9.50, 'Salad', TRUE, FALSE, FALSE),
(1, 'Arugula Salad', 'Fresh arugula with pomegranate and balsamic dressing', 8.50, 'Salad', TRUE, TRUE, TRUE),
(1, 'Dakos Salad', 'Barley rusk with tomato, feta and olive oil', 10.00, 'Salad', TRUE, FALSE, FALSE),
(1, 'Quinoa Salad', 'Quinoa with vegetables, herbs and lemon dressing', 11.00, 'Salad', TRUE, TRUE, TRUE),
-- Desserts
(1, 'Lofaki Sunset', 'Pistachio crème brûlée with sweet red wine', 8.50, 'Dessert', TRUE, FALSE, FALSE),
(1, 'Baklava with Vegan Ice Cream', 'Traditional baklava with plant-based ice cream', 8.00, 'Dessert', FALSE, TRUE, FALSE),
(1, 'Greek Yogurt with Honey', 'Thick Greek yogurt with local honey and walnuts', 6.50, 'Dessert', TRUE, FALSE, FALSE),
(1, 'Galaktoboureko', 'Custard wrapped in phyllo with syrup', 7.00, 'Dessert', TRUE, FALSE, FALSE),
(1, 'Chocolate Soufflé', 'Warm chocolate soufflé with vanilla ice cream', 9.00, 'Dessert', TRUE, FALSE, FALSE),
(1, 'Fresh Fruit Platter', 'Seasonal fruits with yogurt dip', 7.50, 'Dessert', TRUE, FALSE, FALSE),
-- Wines
(1, 'Assyrtiko White Wine', 'Crisp Assyrtiko from Santorini - Glass', 8.00, 'Wine', TRUE, TRUE, TRUE),
(1, 'Assyrtiko White Wine', 'Crisp Assyrtiko from Santorini - Bottle', 32.00, 'Wine', TRUE, TRUE, TRUE),
(1, 'Agiorgitiko Red Wine', 'Smooth red wine from Nemea - Glass', 7.50, 'Wine', TRUE, TRUE, TRUE),
(1, 'Agiorgitiko Red Wine', 'Smooth red wine from Nemea - Bottle', 28.00, 'Wine', TRUE, TRUE, TRUE),
(1, 'Moschofilero Rosé', 'Elegant rosé from Mantinia - Glass', 7.00, 'Wine', TRUE, TRUE, TRUE),
(1, 'Moschofilero Rosé', 'Elegant rosé from Mantinia - Bottle', 26.00, 'Wine', TRUE, TRUE, TRUE),
(1, 'Local Kos Wine', 'Traditional white wine from Kos - Glass', 6.00, 'Wine', TRUE, TRUE, TRUE),
(1, 'Local Kos Wine', 'Traditional white wine from Kos - Bottle', 22.00, 'Wine', TRUE, TRUE, TRUE),
(1, 'Retsina', 'Traditional Greek white wine with pine resin - Glass', 5.50, 'Wine', TRUE, TRUE, TRUE),
(1, 'Retsina', 'Traditional Greek white wine with pine resin - Bottle', 20.00, 'Wine', TRUE, TRUE, TRUE);

-- Mykonos Paradise Restaurant Menu (Expanded)
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
-- Appetizers
(2, 'Mediterranean Mezze Platter', 'Selection of traditional Greek appetizers', 18.00, 'Appetizer', TRUE, FALSE, FALSE),
(2, 'Tuna Tartare', 'Fresh tuna with avocado and citrus dressing', 16.00, 'Appetizer', FALSE, FALSE, FALSE),
(2, 'Burrata with Fig', 'Creamy burrata with fresh figs and prosciutto', 15.00, 'Appetizer', TRUE, FALSE, FALSE),
(2, 'Grilled Prawns', 'Jumbo prawns with garlic and herb butter', 19.00, 'Appetizer', FALSE, FALSE, FALSE),
(2, 'Fried Calamari', 'Crispy squid rings with aioli dip', 14.00, 'Appetizer', FALSE, FALSE, FALSE),
(2, 'Carpaccio', 'Beef carpaccio with arugula and parmesan', 17.00, 'Appetizer', FALSE, FALSE, FALSE),
-- Seafood
(2, 'Lobster Pasta', 'Fresh lobster with linguine in white wine sauce', 35.00, 'Seafood', FALSE, FALSE, FALSE),
(2, 'Grilled Red Snapper', 'Whole red snapper with Mediterranean herbs', 32.00, 'Seafood', FALSE, FALSE, FALSE),
(2, 'Seafood Risotto', 'Arborio rice with lobster, shrimp and scallops', 28.00, 'Seafood', FALSE, FALSE, FALSE),
(2, 'Pan-Seared Scallops', 'Diver scallops with cauliflower puree', 26.00, 'Seafood', FALSE, FALSE, FALSE),
(2, 'Grilled Tuna Steak', 'Seared tuna with sesame crust and soy glaze', 29.00, 'Seafood', FALSE, FALSE, FALSE),
(2, 'Seafood Platter', 'Mixed grilled seafood for two', 65.00, 'Seafood', FALSE, FALSE, FALSE),
-- Main Dishes
(2, 'Grilled Lamb Chops', 'Prime lamb chops with rosemary and garlic', 28.00, 'Main', FALSE, FALSE, FALSE),
(2, 'Wagyu Beef Tenderloin', 'Premium wagyu with truffle sauce', 45.00, 'Main', FALSE, FALSE, FALSE),
(2, 'Duck Confit', 'Slow-cooked duck leg with orange glaze', 24.00, 'Main', FALSE, FALSE, FALSE),
(2, 'Pork Belly', 'Crispy pork belly with apple compote', 22.00, 'Main', FALSE, FALSE, FALSE),
(2, 'Vegetarian Pasta', 'Homemade pasta with seasonal vegetables', 18.00, 'Main', TRUE, FALSE, FALSE),
(2, 'Stuffed Chicken', 'Chicken breast stuffed with spinach and feta', 20.00, 'Main', FALSE, FALSE, FALSE),
-- Salads   
(2, 'Caesar Salad', 'Romaine lettuce with caesar dressing and croutons', 12.00, 'Salad', TRUE, FALSE, FALSE),
(2, 'Greek Salad Deluxe', 'Premium Greek salad with imported feta', 14.00, 'Salad', TRUE, FALSE, FALSE),
(2, 'Quinoa Power Bowl', 'Quinoa with superfoods and tahini dressing', 16.00, 'Salad', TRUE, TRUE, TRUE),
-- Desserts
(2, 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 12.00, 'Dessert', TRUE, FALSE, FALSE),
(2, 'Tiramisu', 'Classic Italian tiramisu with coffee and mascarpone', 10.00, 'Dessert', TRUE, FALSE, FALSE),
(2, 'Lemon Tart', 'Fresh lemon tart with raspberry coulis', 9.00, 'Dessert', TRUE, FALSE, FALSE),
(2, 'Panna Cotta', 'Vanilla panna cotta with berry compote', 8.50, 'Dessert', TRUE, FALSE, FALSE),
(2, 'Gelato Selection', 'Three scoops of artisanal gelato', 8.00, 'Dessert', TRUE, FALSE, FALSE),
-- Wines
(2, 'Santorini Assyrtiko Premium', 'Premium Assyrtiko from top vineyard - Glass', 12.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Santorini Assyrtiko Premium', 'Premium Assyrtiko from top vineyard - Bottle', 48.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Champagne Veuve Clicquot', 'French champagne - Glass', 18.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Champagne Veuve Clicquot', 'French champagne - Bottle', 95.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Barolo Italian Red', 'Premium Italian red wine - Glass', 15.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Barolo Italian Red', 'Premium Italian red wine - Bottle', 65.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Mykonos Rosé', 'Local rosé wine perfect for sunset - Glass', 9.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Mykonos Rosé', 'Local rosé wine perfect for sunset - Bottle', 35.00, 'Wine', TRUE, TRUE, TRUE),
(2, 'Prosecco', 'Italian sparkling wine - Glass', 8.50, 'Wine', TRUE, TRUE, TRUE),
(2, 'Prosecco', 'Italian sparkling wine - Bottle', 32.00, 'Wine', TRUE, TRUE, TRUE);

-- Santorini Sunset Taverna Menu (Expanded)
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
-- Appetizers
(3, 'Santorini Fava', 'Traditional yellow split pea puree with capers', 11.00, 'Appetizer', TRUE, TRUE, TRUE),
(3, 'Tomato Keftedes', 'Santorini tomato fritters with herbs', 9.50, 'Appetizer', TRUE, FALSE, FALSE),
(3, 'White Eggplant Dip', 'Local white eggplant with garlic and olive oil', 8.00, 'Appetizer', TRUE, TRUE, TRUE),
(3, 'Caper Salad', 'Fresh capers with onions and olive oil', 7.50, 'Appetizer', TRUE, TRUE, TRUE),
(3, 'Fried Cheese Saganaki', 'Local cheese flambéed with ouzo', 12.00, 'Appetizer', TRUE, FALSE, FALSE),
(3, 'Sea Urchin Salad', 'Fresh sea urchin with lemon', 18.00, 'Appetizer', FALSE, FALSE, FALSE),
-- Seafood
(3, 'Grilled Octopus', 'Tender octopus with olive oil and vinegar', 22.00, 'Seafood', FALSE, FALSE, FALSE),
(3, 'Lobster with Orzo', 'Fresh lobster with traditional orzo pasta', 38.00, 'Seafood', FALSE, FALSE, FALSE),
(3, 'Sea Bream', 'Whole sea bream with herbs and lemon', 26.00, 'Seafood', FALSE, FALSE, FALSE),
(3, 'Santorini Seafood Pasta', 'Pasta with local catch and cherry tomatoes', 24.00, 'Seafood', FALSE, FALSE, FALSE),
(3, 'Grilled Grouper', 'Fresh grouper with Santorini herbs', 28.00, 'Seafood', FALSE, FALSE, FALSE),
-- Main Dishes
(3, 'Beef Tenderloin', 'Premium beef with truffle sauce', 32.00, 'Main', FALSE, FALSE, FALSE),
(3, 'Lamb with Fava', 'Slow-cooked lamb with Santorini fava', 24.00, 'Main', FALSE, FALSE, FALSE),
(3, 'Stuffed Vine Leaves', 'Dolmades with rice and herbs', 16.00, 'Main', TRUE, TRUE, TRUE),
(3, 'Goat in Wine Sauce', 'Traditional goat meat in red wine', 26.00, 'Main', FALSE, FALSE, FALSE),
(3, 'Vegetarian Gemista', 'Stuffed vegetables with rice and herbs', 14.00, 'Main', TRUE, TRUE, TRUE),
-- Salads
(3, 'Dakos Santorini', 'Barley rusk with local tomatoes and cheese', 12.00, 'Salad', TRUE, FALSE, FALSE),
(3, 'Rocket Salad', 'Wild rocket with cherry tomatoes and capers', 10.00, 'Salad', TRUE, TRUE, TRUE),
-- Desserts
(3, 'Honey Panna Cotta', 'Traditional Greek honey dessert', 9.00, 'Dessert', TRUE, FALSE, FALSE),
(3, 'Baklava Santorini', 'Local baklava with pistachios', 8.50, 'Dessert', TRUE, FALSE, FALSE),
(3, 'Vinsanto Ice Cream', 'Ice cream made with local Vinsanto wine', 7.00, 'Dessert', TRUE, FALSE, FALSE),
(3, 'Fig Compote', 'Fresh figs with yogurt and honey', 8.00, 'Dessert', TRUE, FALSE, FALSE),
-- Wines
(3, 'Vinsanto Dessert Wine', 'Traditional Santorini dessert wine - Glass', 10.00, 'Wine', TRUE, TRUE, TRUE),
(3, 'Vinsanto Dessert Wine', 'Traditional Santorini dessert wine - Bottle', 42.00, 'Wine', TRUE, TRUE, TRUE),
(3, 'Santorini Assyrtiko', 'Local volcanic soil Assyrtiko - Glass', 9.50, 'Wine', TRUE, TRUE, TRUE),
(3, 'Santorini Assyrtiko', 'Local volcanic soil Assyrtiko - Bottle', 38.00, 'Wine', TRUE, TRUE, TRUE),
(3, 'Mandilaria Red', 'Traditional Santorini red wine - Glass', 8.50, 'Wine', TRUE, TRUE, TRUE),
(3, 'Mandilaria Red', 'Traditional Santorini red wine - Bottle', 34.00, 'Wine', TRUE, TRUE, TRUE),
(3, 'Nykteri White', 'Late harvest Santorini white - Glass', 11.00, 'Wine', TRUE, TRUE, TRUE),
(3, 'Nykteri White', 'Late harvest Santorini white - Bottle', 44.00, 'Wine', TRUE, TRUE, TRUE),
(3, 'Athiri Blend', 'Traditional Santorini white blend - Glass', 7.50, 'Wine', TRUE, TRUE, TRUE),
(3, 'Athiri Blend', 'Traditional Santorini white blend - Bottle', 30.00, 'Wine', TRUE, TRUE, TRUE);

-- Rhodes Castle View Menu (Expanded)
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
-- Appetizers
(4, 'Rhodes Cheese Selection', 'Local cheeses with honey and nuts', 14.00, 'Appetizer', TRUE, FALSE, FALSE),
(4, 'Pitaroudia', 'Traditional Rhodes chickpea fritters', 8.00, 'Appetizer', TRUE, TRUE, TRUE),
(4, 'Mezze Platter Medieval', 'Historic appetizer selection', 16.00, 'Appetizer', TRUE, FALSE, FALSE),
(4, 'Stuffed Zucchini Flowers', 'Delicate flowers stuffed with cheese', 10.00, 'Appetizer', TRUE, FALSE, FALSE),
(4, 'Rhodes Olives', 'Marinated local olives with herbs', 6.00, 'Appetizer', TRUE, TRUE, TRUE),
-- Seafood
(4, 'Swordfish Steak', 'Grilled swordfish with lemon and herbs', 24.00, 'Seafood', FALSE, FALSE, FALSE),
(4, 'Red Mullet', 'Fresh red mullet with olive oil', 20.00, 'Seafood', FALSE, FALSE, FALSE),
(4, 'Seafood Risotto Rhodes', 'Risotto with local seafood', 22.00, 'Seafood', FALSE, FALSE, FALSE),
(4, 'Grilled Prawns', 'Large prawns with garlic and herbs', 18.00, 'Seafood', FALSE, FALSE, FALSE),
(4, 'Fish Soup Medieval', 'Traditional Rhodes fish soup', 14.00, 'Seafood', FALSE, FALSE, FALSE),
-- Main Dishes
(4, 'Souvlaki Platter', 'Traditional pork souvlaki with pita and tzatziki', 16.00, 'Main', FALSE, FALSE, FALSE),
(4, 'Lamb Kleftiko Rhodes', 'Slow-cooked lamb with local herbs', 22.00, 'Main', FALSE, FALSE, FALSE),
(4, 'Beef Kokkinisto', 'Beef in red sauce with pasta', 18.00, 'Main', FALSE, FALSE, FALSE),
(4, 'Chicken Gemisto', 'Stuffed chicken with rice and herbs', 17.00, 'Main', FALSE, FALSE, FALSE),
(4, 'Vegetarian Moussaka Rhodes', 'Vegetarian version with local vegetables', 15.00, 'Main', TRUE, FALSE, FALSE),
(4, 'Pork with Prunes', 'Traditional pork with prunes and wine', 19.00, 'Main', FALSE, FALSE, FALSE),
-- Salads
(4, 'Castle Salad', 'Mixed greens with local cheese and herbs', 11.00, 'Salad', TRUE, FALSE, FALSE),
(4, 'Medieval Garden Salad', 'Historic recipe with wild greens', 9.50, 'Salad', TRUE, TRUE, TRUE),
-- Desserts
(4, 'Galaktoboureko', 'Traditional custard pastry with syrup', 7.00, 'Dessert', TRUE, FALSE, FALSE),
(4, 'Melekouni', 'Traditional Rhodes sesame and honey candy', 6.00, 'Dessert', TRUE, FALSE, FALSE),
(4, 'Souma Ice Cream', 'Ice cream made with local Souma spirit', 7.50, 'Dessert', TRUE, FALSE, FALSE),
(4, 'Walnut Cake', 'Moist walnut cake with syrup', 8.00, 'Dessert', TRUE, FALSE, FALSE),
(4, 'Fresh Figs with Cheese', 'Local figs with fresh cheese and honey', 9.00, 'Dessert', TRUE, FALSE, FALSE),
-- Wines
(4, 'Rhodes Athiri', 'Traditional Rhodes white wine - Glass', 7.00, 'Wine', TRUE, TRUE, TRUE),
(4, 'Rhodes Athiri', 'Traditional Rhodes white wine - Bottle', 26.00, 'Wine', TRUE, TRUE, TRUE),
(4, 'Mandilaria Rhodes', 'Local red wine from Rhodes - Glass', 7.50, 'Wine', TRUE, TRUE, TRUE),
(4, 'Mandilaria Rhodes', 'Local red wine from Rhodes - Bottle', 28.00, 'Wine', TRUE, TRUE, TRUE),
(4, 'Medieval Red Blend', 'Traditional blend from old vines - Glass', 8.00, 'Wine', TRUE, TRUE, TRUE),
(4, 'Medieval Red Blend', 'Traditional blend from old vines - Bottle', 30.00, 'Wine', TRUE, TRUE, TRUE),
(4, 'Castle White', 'Crisp white wine from Rhodes hills - Glass', 6.50, 'Wine', TRUE, TRUE, TRUE),
(4, 'Castle White', 'Crisp white wine from Rhodes hills - Bottle', 24.00, 'Wine', TRUE, TRUE, TRUE),
(4, 'Souma Traditional', 'Local Rhodes spirit digestif - Glass', 5.00, 'Wine', TRUE, TRUE, TRUE),
(4, 'Muscat of Rhodes', 'Sweet dessert wine - Glass', 8.50, 'Wine', TRUE, TRUE, TRUE),
(4, 'Muscat of Rhodes', 'Sweet dessert wine - Bottle', 32.00, 'Wine', TRUE, TRUE, TRUE);

-- =====================================
-- 8. SAMPLE RESERVATIONS
-- =====================================

-- Lofaki Restaurant reservations (restaurant_id: 1)
INSERT INTO reservation (
    reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time,
    guests, table_type, celebration_type, cake, flowers, restaurant_id
) VALUES
('Alice Papadakis', 'alice.papadakis@email.com', '+30-694-1111111', CURRENT_DATE + INTERVAL '1 day', '20:00:00', 2, 'standard', NULL, FALSE, FALSE, 1),
('George Manias', 'george.manias@email.com', '+30-694-2222222', CURRENT_DATE + INTERVAL '2 days', '21:00:00', 4, 'grass', 'birthday', TRUE, TRUE, 1),
('Eva Kosta', 'eva.kosta@email.com', '+30-694-3333333', CURRENT_DATE + INTERVAL '3 days', '19:30:00', 8, 'anniversary', 'anniversary', TRUE, TRUE, 1);

-- Mykonos Paradise Restaurant reservations (restaurant_id: 2)
INSERT INTO reservation (
    reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time,
    guests, table_type, celebration_type, cake, flowers, restaurant_id
) VALUES
('Nikos Papas', 'nikos.papas@email.com', '+30-694-4444444', CURRENT_DATE + INTERVAL '1 day', '20:30:00', 2, 'standard', NULL, FALSE, FALSE, 2),
('Sophia Vrettou', 'sophia.vrettou@email.com', '+30-694-5555555', CURRENT_DATE + INTERVAL '2 days', '21:00:00', 6, 'grass', 'birthday', TRUE, FALSE, 2),
('Dimitris Ioannou', 'dimitris.ioannou@email.com', '+30-694-6666666', CURRENT_DATE + INTERVAL '3 days', '22:00:00', 8, 'anniversary', 'honeymoon', TRUE, TRUE, 2);

-- Santorini Sunset Taverna reservations (restaurant_id: 3)
INSERT INTO reservation (
    reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time,
    guests, table_type, celebration_type, cake, flowers, restaurant_id
) VALUES
('Maria Santorini', 'maria.santorini@email.com', '+30-694-7777777', CURRENT_DATE + INTERVAL '1 day', '18:30:00', 4, 'standard', NULL, FALSE, FALSE, 3),
('Giannis Fava', 'giannis.fava@email.com', '+30-694-8888888', CURRENT_DATE + INTERVAL '2 days', '19:00:00', 10, 'anniversary', 'anniversary', TRUE, TRUE, 3),
('Elena Oia', 'elena.oia@email.com', '+30-694-9999999', CURRENT_DATE + INTERVAL '3 days', '20:00:00', 12, 'anniversary', 'wedding', TRUE, TRUE, 3);

-- Rhodes Castle View reservations (restaurant_id: 4)
INSERT INTO reservation (
    reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time,
    guests, table_type, celebration_type, cake, flowers, restaurant_id
) VALUES
('Petros Lindos', 'petros.lindos@email.com', '+30-694-1010101', CURRENT_DATE + INTERVAL '1 day', '19:00:00', 2, 'standard', NULL, FALSE, FALSE, 4),
('Katerina Medieval', 'katerina.medieval@email.com', '+30-694-2020202', CURRENT_DATE + INTERVAL '2 days', '20:30:00', 6, 'grass', 'birthday', TRUE, TRUE, 4),
('Stavros Castle', 'stavros.castle@email.com', '+30-694-3030303', CURRENT_DATE + INTERVAL '3 days', '21:00:00', 8, 'anniversary', 'anniversary', TRUE, TRUE, 4);
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