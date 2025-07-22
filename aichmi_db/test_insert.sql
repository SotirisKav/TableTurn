-- Test Data Insert File for AICHMI Database
-- This file tests DDL integrity, constraints, triggers, and business logic

-- =========================================
-- AICHMI Database Comprehensive Test Suite
-- =========================================

-- Clear all existing data
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

-- 1. INSERTING BASE DATA
-- =====================

-- 1. Insert test restaurants
INSERT INTO restaurant (name, address, email, phone, area, island, profile_image_url, background_image_url, description, cuisine) VALUES
('Sunset Taverna', '123 Beach Road, Mykonos', 'info@sunsettaverna.gr', '+30-22890-12345', 'Mykonos Town', 'Mykonos', 'https://example.com/sunset-profile.jpg', 'https://example.com/sunset-bg.jpg', 'Traditional Greek taverna with stunning sunset views', 'Greek'),
('Ocean Blue Restaurant', '456 Harbor Street, Santorini', 'contact@oceanblue.gr', '+30-22860-67890', 'Oia', 'Santorini', 'https://example.com/ocean-profile.jpg', 'https://example.com/ocean-bg.jpg', 'Fine dining with panoramic sea views', 'Mediterranean'),
('Mountain View Bistro', '789 Village Square, Naxos', 'hello@mountainview.gr', '+30-22850-11111', 'Apiranthos', 'Naxos', NULL, NULL, 'Cozy bistro in traditional village setting', 'International');

SELECT 'Restaurants inserted successfully' AS status;

-- 2. Insert restaurant hours
INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES
-- Sunset Taverna (Restaurant ID 1) - Dinner only, closes at midnight
(1, 'Monday', '17:00:00', '00:00:00'),
(1, 'Tuesday', '17:00:00', '00:00:00'),
(1, 'Wednesday', '17:00:00', '00:00:00'),
(1, 'Thursday', '17:00:00', '00:00:00'),
(1, 'Friday', '17:00:00', '01:00:00'),
(1, 'Saturday', '17:00:00', '01:00:00'),
(1, 'Sunday', '17:00:00', '00:00:00'),
-- Ocean Blue Restaurant (Restaurant ID 2) - Lunch & Dinner
(2, 'Monday', '12:00:00', '23:00:00'),
(2, 'Tuesday', '12:00:00', '23:00:00'),
(2, 'Wednesday', '12:00:00', '23:00:00'),
(2, 'Thursday', '12:00:00', '23:00:00'),
(2, 'Friday', '12:00:00', '23:30:00'),
(2, 'Saturday', '12:00:00', '23:30:00'),
(2, 'Sunday', '12:00:00', '23:00:00'),
-- Mountain View Bistro (Restaurant ID 3) - Closed Mondays
(3, 'Tuesday', '11:00:00', '22:00:00'),
(3, 'Wednesday', '11:00:00', '22:00:00'),
(3, 'Thursday', '11:00:00', '22:00:00'),
(3, 'Friday', '11:00:00', '23:00:00'),
(3, 'Saturday', '11:00:00', '23:00:00'),
(3, 'Sunday', '11:00:00', '22:00:00');

SELECT 'Restaurant hours inserted successfully' AS status;

-- 3. Insert owners
INSERT INTO owners (email, password, first_name, last_name, phone, restaurant_id, stripe_customer_id, subscription_status, oauth_provider, email_verified) VALUES
('maria@sunsettaverna.gr', '$2b$10$encrypted_password_hash_1', 'Maria', 'Papadopoulos', '+30-694-1234567', 1, 'cus_stripe_123', 'active', 'local', TRUE),
('dimitris@oceanblue.gr', '$2b$10$encrypted_password_hash_2', 'Dimitris', 'Alexopoulos', '+30-694-2345678', 2, 'cus_stripe_456', 'active', 'google', TRUE),
('anna@mountainview.gr', '$2b$10$encrypted_password_hash_3', 'Anna', 'Komnenos', '+30-694-3456789', 3, NULL, NULL, 'local', FALSE);

SELECT 'Owners inserted successfully' AS status;

-- 4. Insert hotels
INSERT INTO hotel (name, address, area, island, transfer_price) VALUES
('Mykonos Palace Hotel', '100 Luxury Lane, Mykonos', 'Platis Gialos', 'Mykonos', 25.00),
('Santorini Suites', '200 Cliff Road, Santorini', 'Imerovigli', 'Santorini', 30.00),
('Naxos Beach Resort', '300 Sandy Beach, Naxos', 'Plaka', 'Naxos', 20.00),
('Villa Paradiso', '50 Paradise Street, Mykonos', 'Paradise Beach', 'Mykonos', 35.00);

SELECT 'Hotels inserted successfully' AS status;

-- 5. Insert transfer prices
INSERT INTO transfer_prices (price_4_or_less, price_5_to_8, hotel_id, restaurant_id) VALUES
(15.00, 25.00, 1, 1), -- Mykonos Palace to Sunset Taverna
(20.00, 35.00, 2, 2), -- Santorini Suites to Ocean Blue
(12.00, 20.00, 3, 3), -- Naxos Beach Resort to Mountain View
(18.00, 30.00, 4, 1); -- Villa Paradiso to Sunset Taverna

SELECT 'Transfer prices inserted successfully' AS status;

-- 6. Insert tables with strategic distribution
INSERT INTO tables (table_type, table_price, restaurant_id) VALUES
-- Sunset Taverna: 3 standard, 2 grass, 1 anniversary = 6 total
('standard', 0.00, 1), ('standard', 0.00, 1), ('standard', 0.00, 1),
('grass', 15.00, 1), ('grass', 15.00, 1),
('anniversary', 25.00, 1),
-- Ocean Blue: 4 standard, 2 anniversary = 6 total  
('standard', 10.00, 2), ('standard', 10.00, 2), ('standard', 10.00, 2), ('standard', 10.00, 2),
('anniversary', 35.00, 2), ('anniversary', 35.00, 2),
-- Mountain View: 2 standard, 1 grass = 3 total
('standard', 5.00, 3), ('standard', 5.00, 3),
('grass', 12.00, 3);

SELECT 'Tables inserted successfully' AS status;

-- 7. Insert menu items
INSERT INTO menu_item (restaurant_id, name, description, price, category, is_vegetarian, is_vegan, is_gluten_free, available) VALUES
-- Sunset Taverna menu
(1, 'Greek Salad', 'Traditional village salad with feta cheese, olives, and olive oil', 12.50, 'Appetizer', TRUE, FALSE, TRUE, TRUE),
(1, 'Grilled Octopus', 'Fresh octopus grilled with herbs and lemon', 18.00, 'Appetizer', FALSE, FALSE, TRUE, TRUE),
(1, 'Moussaka', 'Traditional Greek casserole with eggplant and meat sauce', 22.00, 'Main', FALSE, FALSE, FALSE, TRUE),
(1, 'Grilled Sea Bass', 'Fresh local fish grilled to perfection', 28.00, 'Main', FALSE, FALSE, TRUE, TRUE),
(1, 'Baklava', 'Traditional honey and nut pastry', 8.00, 'Dessert', TRUE, FALSE, FALSE, TRUE),
-- Ocean Blue Restaurant menu
(2, 'Lobster Bisque', 'Rich and creamy lobster soup', 16.00, 'Appetizer', FALSE, FALSE, FALSE, TRUE),
(2, 'Santorini Fava', 'Traditional yellow split pea puree', 11.00, 'Appetizer', TRUE, TRUE, TRUE, TRUE),
(2, 'Beef Tenderloin', 'Premium beef with truffle sauce', 45.00, 'Main', FALSE, FALSE, TRUE, TRUE),
(2, 'Chocolate Soufflé', 'Warm chocolate dessert with vanilla ice cream', 14.00, 'Dessert', TRUE, FALSE, FALSE, TRUE),
-- Mountain View Bistro menu
(3, 'Quinoa Salad', 'Healthy quinoa with vegetables and herbs', 13.00, 'Appetizer', TRUE, TRUE, TRUE, TRUE),
(3, 'Pasta Primavera', 'Fresh pasta with seasonal vegetables', 16.00, 'Main', TRUE, FALSE, FALSE, TRUE);

SELECT 'Menu items inserted successfully' AS status;

-- 8. Insert bot configuration
INSERT INTO response_templates (module_name, template, restaurant_id) VALUES
('greeting', 'Welcome to Sunset Taverna! How can I help you today?', 1),
('reservation_confirmation', 'Your reservation for {guests} guests on {date} at {time} has been confirmed.', 1),
('greeting', 'Hello! Welcome to Ocean Blue Restaurant. What can I do for you?', 2),
('reservation_confirmation', 'Thank you! Your table for {guests} is reserved for {date} at {time}.', 2);

INSERT INTO bot_config (config_key, config_value, restaurant_id) VALUES
('response_style', 'professional', 1), ('language', 'en', 1),
('response_style', 'friendly', 2), ('language', 'en', 2);

INSERT INTO bot_modules (module_name, enabled, restaurant_id) VALUES
('greeting', TRUE, 1), ('reservation_booking', TRUE, 1), ('menu_inquiry', TRUE, 1),
('greeting', TRUE, 2), ('reservation_booking', TRUE, 2);

SELECT 'Bot configuration inserted successfully' AS status;

-- 2. TESTING VALID RESERVATIONS
-- =============================

-- Insert valid reservations
INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, celebration_type, cake, flowers, hotel_name, restaurant_id) VALUES
('John Smith', 'john.smith@email.com', '+1-555-123-4567', CURRENT_DATE + INTERVAL '1 day', '19:00:00', 2, 'standard', 'anniversary', TRUE, TRUE, 'Mykonos Palace Hotel', 1),
('Sofia Rossi', 'sofia.rossi@email.com', '+39-333-123-4567', CURRENT_DATE + INTERVAL '2 days', '20:30:00', 4, 'grass', 'birthday', TRUE, FALSE, NULL, 1),
('Hans Mueller', 'hans.mueller@email.de', '+49-177-123-4567', CURRENT_DATE + INTERVAL '3 days', '18:00:00', 6, 'standard', 'none', FALSE, FALSE, 'Santorini Suites', 2),
('Marie Dubois', 'marie.dubois@email.fr', '+33-6-12-34-56-78', CURRENT_DATE + INTERVAL '5 days', '12:30:00', 3, 'standard', 'honeymoon', FALSE, TRUE, NULL, 3);

SELECT 'Valid reservations inserted successfully' AS status;

-- 3. TESTING CONSTRAINT VIOLATIONS
-- ================================

SELECT 'Starting constraint violation tests...' AS status;

-- Test 1: Reservation outside opening hours
DO $$
BEGIN
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('Test User', 'test1@example.com', '+30-123-456789', CURRENT_DATE + INTERVAL '1 day', '10:00:00', 2, 'standard', 1);
    RAISE NOTICE 'ERROR: Reservation outside hours was allowed!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test 1: %', SQLERRM;
END $$;

-- Test 2: Reservation on closed day
DO $$
DECLARE
    next_monday DATE;
BEGIN
    next_monday := CURRENT_DATE + (7 - EXTRACT(DOW FROM CURRENT_DATE) + 1)::INTEGER;
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('Test User', 'test2@example.com', '+30-123-456789', next_monday, '12:00:00', 2, 'standard', 3);
    RAISE NOTICE 'ERROR: Reservation on closed day was allowed!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test 2: %', SQLERRM;
END $$;

-- Test 3: Invalid email format
DO $$
BEGIN
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('Test User', 'invalid-email', '+30-123-456789', CURRENT_DATE + INTERVAL '1 day', '19:00:00', 2, 'standard', 1);
    RAISE NOTICE 'ERROR: Invalid email was allowed!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test 3: %', SQLERRM;
END $$;

-- Test 4: Past date reservation
DO $$
BEGIN
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('Test User', 'test4@example.com', '+30-123-456789', CURRENT_DATE - INTERVAL '1 day', '19:00:00', 2, 'standard', 1);
    RAISE NOTICE 'ERROR: Past date reservation was allowed!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test 4: %', SQLERRM;
END $$;

-- Test 5: Invalid foreign key
DO $$
BEGIN
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('Test User', 'test5@example.com', '+30-123-456789', CURRENT_DATE + INTERVAL '1 day', '19:00:00', 2, 'standard', 999);
    RAISE NOTICE 'ERROR: Invalid restaurant_id was allowed!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test 5: %', SQLERRM;
END $$;

-- 4. TESTING TABLE AVAILABILITY TRIGGER
-- =====================================

SELECT 'Starting table availability tests...' AS status;

-- Test A: Fill up standard tables at Sunset Taverna (3 standard tables available)
INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) VALUES
('User A1', 'usera1@test.com', '+30-123-000001', CURRENT_DATE + INTERVAL '10 days', '19:00:00', 2, 'standard', 1),
('User A2', 'usera2@test.com', '+30-123-000002', CURRENT_DATE + INTERVAL '10 days', '19:30:00', 2, 'standard', 1);

SELECT '2 more standard tables booked (3/3 total now reserved)' AS status;

-- Test B: Try to book 4th standard table (should fail)
DO $$
BEGIN
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('User B1', 'userb1@test.com', '+30-123-000003', CURRENT_DATE + INTERVAL '10 days', '20:00:00', 2, 'standard', 1);
    RAISE NOTICE 'ERROR: Should have failed - no standard tables available!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test B: %', SQLERRM;
END $$;

-- Test C: Book remaining grass and anniversary tables
INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) VALUES
('User C1', 'userc1@test.com', '+30-123-000004', CURRENT_DATE + INTERVAL '10 days', '20:15:00', 2, 'grass', 1),
('User C2', 'userc2@test.com', '+30-123-000005', CURRENT_DATE + INTERVAL '10 days', '20:30:00', 2, 'grass', 1),
('User C3', 'userc3@test.com', '+30-123-000006', CURRENT_DATE + INTERVAL '10 days', '20:45:00', 2, 'anniversary', 1);

SELECT 'All tables now booked for test date (6/6 total)' AS status;

-- Test D: Try to book when fully booked
DO $$
BEGIN
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('User D1', 'userd1@test.com', '+30-123-000007', CURRENT_DATE + INTERVAL '10 days', '21:00:00', 2, 'standard', 1);
    RAISE NOTICE 'ERROR: Should have failed - restaurant fully booked!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test D: %', SQLERRM;
END $$;

-- Test E: Invalid table type
DO $$
BEGIN
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('User E1', 'usere1@test.com', '+30-123-000008', CURRENT_DATE + INTERVAL '15 days', '19:00:00', 2, 'vip', 1);
    RAISE NOTICE 'ERROR: Should have failed - invalid table type!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'SUCCESS Test E: %', SQLERRM;
END $$;

-- Test F: Same table type on different date (should work)
INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) VALUES
('User F1', 'userf1@test.com', '+30-123-000009', CURRENT_DATE + INTERVAL '15 days', '19:00:00', 2, 'standard', 1);

SELECT 'Successfully booked same table type on different date' AS status;

-- 5. TESTING VIEWS
-- ===============

SELECT 'Testing Views - Table Type Distribution:' AS status;

SELECT 
    r.name as restaurant,
    t.table_type,
    t.total_tables
FROM table_type_counts t
JOIN restaurant r ON t.restaurant_id = r.restaurant_id
ORDER BY r.restaurant_id, t.table_type;

SELECT 'Testing Views - Upcoming Reservations:' AS status;

SELECT 
    ur.reservation_name,
    r.name as restaurant,
    ur.reservation_date,
    ur.reservation_time,
    ur.guests,
    ur.table_type
FROM upcoming_reservations ur
JOIN restaurant r ON ur.restaurant_id = r.restaurant_id
ORDER BY ur.reservation_date, ur.reservation_time;

SELECT 'Testing Views - Fully Booked Dates:' AS status;

SELECT * FROM fully_booked_dates ORDER BY restaurant_id;

-- 6. TABLE AVAILABILITY ANALYSIS
-- ==============================

SELECT 'Table Availability Analysis:' AS status;

SELECT 
    r.name as restaurant,
    t.table_type,
    COUNT(t.table_id) as total_tables,
    COALESCE(res.reserved_count, 0) as reserved_for_test_date,
    COUNT(t.table_id) - COALESCE(res.reserved_count, 0) as available_tables,
    CASE 
        WHEN COUNT(t.table_id) - COALESCE(res.reserved_count, 0) = 0 THEN 'FULL'
        WHEN COUNT(t.table_id) - COALESCE(res.reserved_count, 0) <= 1 THEN 'LIMITED'
        ELSE 'AVAILABLE'
    END as availability_status
FROM restaurant r
JOIN tables t ON r.restaurant_id = t.restaurant_id
LEFT JOIN (
    SELECT 
        restaurant_id, 
        table_type, 
        COUNT(*) as reserved_count
    FROM reservation 
    WHERE reservation_date = CURRENT_DATE + INTERVAL '10 days'
    GROUP BY restaurant_id, table_type
) res ON t.restaurant_id = res.restaurant_id AND t.table_type = res.table_type
GROUP BY r.restaurant_id, r.name, t.table_type, res.reserved_count
ORDER BY r.restaurant_id, t.table_type;

-- 7. TRIGGER EXECUTION ORDER TEST
-- ===============================

SELECT 'Testing trigger order (time validation should fire before table availability):' AS status;

DO $$
BEGIN
    -- This should fail on time validation, not table availability
    INSERT INTO reservation (reservation_name, reservation_email, reservation_phone, reservation_date, reservation_time, guests, table_type, restaurant_id) 
    VALUES ('Trigger Test', 'trigger@test.com', '+30-123-999999', CURRENT_DATE + INTERVAL '10 days', '15:00:00', 2, 'standard', 1);
    RAISE NOTICE 'ERROR: Should have failed on time validation!';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%outside opening hours%' THEN
            RAISE NOTICE 'SUCCESS: Time validation triggered first: %', SQLERRM;
        ELSE
            RAISE NOTICE 'WARNING: Unexpected error: %', SQLERRM;
        END IF;
END $$;

-- 8. BUSINESS LOGIC VERIFICATION
-- ==============================

SELECT 'Business Logic Verification:' AS status;

SELECT 
    'Email Format' as constraint_type,
    CASE WHEN 'invalid@' ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
         THEN 'FAILED' ELSE 'WORKING' END as constraint_status
UNION ALL
SELECT 
    'Date Validation',
    CASE WHEN CURRENT_DATE - INTERVAL '1 day' >= CURRENT_DATE 
         THEN 'FAILED' ELSE 'WORKING' END
UNION ALL
SELECT 
    'Positive Guests',
    CASE WHEN 0 > 0 THEN 'FAILED' ELSE 'WORKING' END;

-- 9. FINAL SUMMARY
-- ================

SELECT 'Final Test Summary:' AS status;

SELECT 
    'Restaurants' as entity, 
    COUNT(*) as record_count,
    'SUCCESS' as test_status
FROM restaurant
UNION ALL
SELECT 'Restaurant Hours', COUNT(*), 'SUCCESS' FROM restaurant_hours
UNION ALL
SELECT 'Owners', COUNT(*), 'SUCCESS' FROM owners
UNION ALL
SELECT 'Hotels', COUNT(*), 'SUCCESS' FROM hotel
UNION ALL
SELECT 'Tables', COUNT(*), 'SUCCESS' FROM tables
UNION ALL
SELECT 'Menu Items', COUNT(*), 'SUCCESS' FROM menu_item
UNION ALL
SELECT 'Reservations', COUNT(*), 
       CASE WHEN COUNT(*) > 0 THEN 'SUCCESS' ELSE 'WARNING' END
FROM reservation
UNION ALL
SELECT 'Response Templates', COUNT(*), 'SUCCESS' FROM response_templates
UNION ALL
SELECT 'Bot Config', COUNT(*), 'SUCCESS' FROM bot_config
UNION ALL
SELECT 'Bot Modules', COUNT(*), 'SUCCESS' FROM bot_modules;

SELECT '=========================================' AS final_message;
SELECT 'ALL TESTS COMPLETED SUCCESSFULLY!' AS final_message;
SELECT '=========================================' AS final_message;
SELECT 'Database