-- Sample data for AICHMI database

-- Insert table types first
INSERT INTO tables (table_type, table_price) VALUES
('standard', 0.00),
('grass', 15.00),
('special', 80.00);

-- Insert transfer areas with pricing
INSERT INTO transfer_areas (name, price_4_or_less, price_5_to_8) VALUES
('Kos Airport', 25.00, 35.00),
('Kos Harbor', 20.00, 30.00),
('Kardamena', 30.00, 40.00),
('Mastichari', 25.00, 35.00),
('Kefalos', 35.00, 45.00),
('Tingaki', 20.00, 30.00);

-- Insert sample hotels
INSERT INTO hotel (hotel_id, name, address, area, transfer_price) VALUES
(1, 'Kos Palace Hotel', 'Psalidi Beach, 85300 Kos', 'Psalidi', 20.00),
(2, 'Aqua Blu Boutique Hotel', 'Lambi Beach, 85300 Kos', 'Lambi', 15.00),
(3, 'Grecotel Kos Imperial', 'Psalidi Beach, 85300 Kos', 'Psalidi', 25.00),
(4, 'Diamond Deluxe Hotel', 'Kardamena Beach, 85302 Kardamena', 'Kardamena', 30.00),
(5, 'Sunrise Hotel', 'Tigkaki Beach, 85300 Kos', 'Tingaki', 20.00);

-- Insert venue (restaurant)
INSERT INTO venue (name, address, area, type, rating, pricing, image_url, description, cuisine) VALUES
('Lofaki Restaurant', 'Agios Nektarios, 85300 Kos', 'Kos Harbor', 'restaurant', 4.8, 'expensive', 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1b/ee/e9/0c/dining-under-the-best.jpg?w=900&h=500&s=1', 'Authentic Greek cuisine with fresh seafood and traditional recipes passed down through generations. Located in the beautiful Kos Harbor with stunning sea views.', 'Greek & modern cuisine');

-- Insert owners for the venue (using correct column names)
INSERT INTO owners (first_name, last_name, email, phone, venue_id) VALUES
('Vasilis', 'Manias', 'vasilis_manias@lofaki.gr', '+30 22420 12345', 1);

-- Insert table inventory for the venue
INSERT INTO table_inventory (venue_id, table_type, max_tables) VALUES
(1, 'standard', 13),
(1, 'grass', 10),
(1, 'special', 2);

-- Insert ONE reservation
INSERT INTO reservation (
  reservation_name,
  reservation_email,
  reservation_phone,
  reservation_date,
  reservation_time,
  guests,
  table_type,
  venue_id
) VALUES (
  'John Doe',
  'johndoe@example.com',
  '+302241234567',
  '2025-08-20',
  '20:00',
  2,
  'grass',
  1
);

-- Insert bot configuration for Lofaki
INSERT INTO bot_config (key, value, venue_id) VALUES
('response_style_1', 'friendly_professional', 1),
('language_1', 'english', 1),
('greeting_enabled_1', 'true', 1),
('confirmation_required_1', 'true', 1);

-- Insert bot modules for Lofaki
INSERT INTO bot_modules (module_name, enabled, venue_id) VALUES
('greeting_1', true, 1),
('reservation_confirmation_1', true, 1),
('menu_suggestions_1', true, 1),
('special_offers_1', true, 1);

-- Insert response templates for Lofaki
INSERT INTO response_templates (module_name, template, venue_id) VALUES
('greeting_1', 'Welcome to Lofaki Taverna! We are delighted to help you with your reservation. How may we assist you today?', 1),
('reservation_confirmation_1', 'Thank you for choosing Lofaki Taverna! Your reservation for {guests} guests on {date} at {time} has been confirmed. We look forward to welcoming you!', 1),
('menu_suggestions_1', 'Our chef recommends our fresh seafood specialties and traditional Greek dishes. Would you like to hear about our daily specials?', 1),
('special_offers_1', 'This month we have a special anniversary package with complimentary flowers and a celebration cake. Perfect for romantic occasions!', 1);

-- Insert menu items
-- Seafood
INSERT INTO menu_item (venue_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
(1, 'Sea Bass Fillet', 'Sea bass grilled or oven-baked', 19.00, 'Seafood', FALSE, FALSE, TRUE),
(1, 'Salmon Fillet', 'Grilled salmon fillet', 19.00, 'Seafood', FALSE, FALSE, TRUE),
(1, 'Tuna Fillet "Tataki"', 'Tuna fillet, soy sauce, wasabi, sesame', 19.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Grilled Shrimps', 'Grilled shrimps, ouzo, dill, tzatziki, pita bread', 19.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Fried Calamari', 'Fried calamari rings', 15.00, 'Seafood', FALSE, FALSE, FALSE),
(1, 'Seafood Plate for 2', 'Shrimps, mussels, squid, octopus, orzo, salad', 60.00, 'Seafood', FALSE, FALSE, FALSE);

-- Appetizers
INSERT INTO menu_item (venue_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
(1, 'Grilled Haloumi from Kos', 'With berry jam', 9.00, 'Appetizer', TRUE, FALSE, TRUE),
(1, 'Feta Nest with Honey & Sesame', 'Feta cheese, honey, sesame', 10.00, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Local Cheese Variety', 'Local cheeses, grapes, breadsticks, fig jam', 17.00, 'Appetizer', TRUE, FALSE, FALSE),
(1, 'Handmade Tzatziki', 'Yogurt, cucumber, garlic', 7.00, 'Appetizer', TRUE, FALSE, TRUE),
(1, 'Avocado Hummus', 'Avocado, chickpeas, tahini', 7.00, 'Appetizer', TRUE, TRUE, TRUE);

-- Desserts
INSERT INTO menu_item (venue_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
(1, 'Homemade Apple Pie', NULL, 8.00, 'Dessert', TRUE, FALSE, FALSE),
(1, 'Juicy Chocolate Souffle', NULL, 8.00, 'Dessert', TRUE, FALSE, FALSE),
(1, 'Lofaki Sunset', '"Creme brulee" of pistachio, sweet red wine', 8.50, 'Dessert', TRUE, FALSE, FALSE),
(1, 'Baklava with Vegan Ice Cream', NULL, 8.00, 'Dessert', FALSE, TRUE, FALSE),
(1, 'Yogurt with Honey', NULL, 7.00, 'Dessert', TRUE, FALSE, TRUE),
(1, 'Fruit Salad (Large)', NULL, 12.00, 'Dessert', TRUE, TRUE, TRUE);

-- Salads
INSERT INTO menu_item (venue_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
(1, 'Greek Salad', 'Tomato, cucumber, feta, olives, onion, olive oil', 9.50, 'Salad', TRUE, FALSE, TRUE),
(1, 'Caesar''s Salad', 'Romaine, parmesan, croutons, Caesar dressing', 10.00, 'Salad', TRUE, FALSE, FALSE);

-- Main dishes
INSERT INTO menu_item (venue_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free) VALUES
(1, 'Homemade Moussaka', NULL, 14.00, 'Greek Cuisine', TRUE, FALSE, FALSE),
(1, 'Lamb "Kleftiko"', 'Lamb, herbs, slow-cooked', 18.00, 'Greek Cuisine', FALSE, FALSE, FALSE),
(1, 'Beef Steak', NULL, 18.00, 'Grill', FALSE, FALSE, TRUE),
(1, 'Grilled Vegan Burger', NULL, 12.00, 'Grill', TRUE, TRUE, TRUE);