-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS response_templates CASCADE;
DROP TABLE IF EXISTS restaurant_hours CASCADE;
DROP TABLE IF EXISTS transfer_prices CASCADE;
DROP TABLE IF EXISTS reservation CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS hotel CASCADE;
DROP TABLE IF EXISTS transfer_areas CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS owners CASCADE;
DROP TABLE IF EXISTS restaurant CASCADE;
DROP TABLE IF EXISTS bot_modules CASCADE;
DROP TABLE IF EXISTS bot_config CASCADE;
DROP TABLE IF EXISTS menu_item CASCADE;
DROP TABLE IF EXISTS table_inventory CASCADE;
DROP VIEW IF EXISTS table_type_counts CASCADE;
DROP VIEW IF EXISTS upcoming_reservations CASCADE;
DROP VIEW IF EXISTS fully_booked_dates CASCADE;

DROP TYPE IF EXISTS subscription_status_enum CASCADE;
DROP TYPE IF EXISTS oauth_provider_enum CASCADE;

-- Create ENUM types for PostgreSQL
CREATE TYPE subscription_status_enum AS ENUM ('active', 'canceled', 'past_due', 'unpaid');
CREATE TYPE oauth_provider_enum AS ENUM ('google', 'facebook', 'local');

CREATE TABLE restaurant (
    restaurant_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    area VARCHAR(100),
    island VARCHAR(100) NOT NULL,
    profile_image_url VARCHAR(500), 
    background_image_url VARCHAR(500),
    description TEXT,
    cuisine VARCHAR(100),
    embedding vector(768)
);

CREATE TABLE restaurant_hours (
    hours_id SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL,
    day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN (
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    )),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id) ON DELETE CASCADE
);

CREATE TABLE owners ( -- they are our app users
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- nullable for OAuth users?
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    restaurant_id INT,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status subscription_status_enum DEFAULT NULL,
    oauth_provider oauth_provider_enum DEFAULT 'local',
    oauth_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id)
);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_owners_updated_at BEFORE UPDATE ON owners
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(500) NOT NULL,
    owner_id INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE TABLE hotel (
    hotel_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(100),
    island VARCHAR(100) NOT NULL,
    transfer_price NUMERIC(5,2) DEFAULT 0 CHECK (transfer_price >= 0)
);

CREATE TABLE transfer_prices ( --prices to/from hotel to/from restaurant
    transfer_id SERIAL PRIMARY KEY,
    price_4_or_less NUMERIC(5,2) NOT NULL CHECK (price_4_or_less >= 0),
    price_5_to_8 NUMERIC(5,2) NOT NULL CHECK (price_5_to_8 >= 0),
    hotel_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    FOREIGN KEY (hotel_id) REFERENCES hotel(hotel_id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id) ON DELETE CASCADE 
);

CREATE TABLE tables (
    table_id SERIAL PRIMARY KEY,
    table_type TEXT,
    table_price NUMERIC(5,2) DEFAULT 0 CHECK (table_price >= 0),
    description TEXT,
    embedding vector(768),
    restaurant_id INT NOT NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id) ON DELETE CASCADE
);

CREATE TABLE menu_item (
    menu_item_id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurant(restaurant_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(8,2) NOT NULL,
    category VARCHAR(50), -- e.g. 'Appetizer', 'Main', 'Dessert', 'Drink'
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    available BOOLEAN DEFAULT TRUE,
    embedding vector(768)
);

CREATE TABLE reservation (
    reservation_id SERIAL PRIMARY KEY,
    reservation_name TEXT NOT NULL,
    reservation_email TEXT NOT NULL CHECK (reservation_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    reservation_phone TEXT NOT NULL,
    reservation_date DATE NOT NULL CHECK (reservation_date >= CURRENT_DATE),
    reservation_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    guests INT NOT NULL CHECK (guests > 0),
    table_type TEXT NOT NULL,
    celebration_type TEXT CHECK (celebration_type IN ('birthday', 'anniversary', 'honeymoon', 'none')),
    cake BOOLEAN DEFAULT FALSE,
    cake_price NUMERIC(5,2) CHECK (cake_price >= 0),
    flowers BOOLEAN DEFAULT FALSE,
    flowers_price NUMERIC(5,2) CHECK (flowers_price >= 0),
    hotel_name TEXT,
    table_id INT, -- for specific table reservations
    hotel_id INT, -- this is if the customer wants us to set up transfers
    restaurant_id INT NOT NULL,
    FOREIGN KEY (table_id) REFERENCES tables(table_id),
    FOREIGN KEY (hotel_id) REFERENCES hotel(hotel_id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id) ON DELETE CASCADE
);

-- for example create automated response for greeting or for reservation confirmation
CREATE TABLE response_templates (
    id SERIAL PRIMARY KEY,
    module_name TEXT NOT NULL,
    template TEXT NOT NULL,
    restaurant_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, module_name)  -- Fixed: allows same module for different restaurants
);

-- for example response_style -> professional
CREATE TABLE bot_config (
    id SERIAL PRIMARY KEY,
    config_key TEXT NOT NULL,
    config_value TEXT NOT NULL,
    restaurant_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, config_key)  -- Fixed: allows same key for different restaurants
);

-- for example give greeting -> TRUE for specific restaurant
CREATE TABLE bot_modules (
    id SERIAL PRIMARY KEY,
    module_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    restaurant_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurant(restaurant_id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, module_name)  -- Fixed: allows same module for different restaurants
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_stripe_customer ON owners(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_owner ON refresh_tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_reservation_venue ON reservation(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservation_date ON reservation(reservation_date);

-- Create vector indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_restaurant_embedding ON restaurant USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_tables_embedding ON tables USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);  
CREATE INDEX IF NOT EXISTS idx_menu_item_embedding ON menu_item USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE VIEW table_type_counts AS
SELECT 
    restaurant_id,
    table_type,
    COUNT(*) AS total_tables
FROM 
    tables
GROUP BY 
    restaurant_id, table_type;

CREATE VIEW upcoming_reservations AS
SELECT 
    reservation_name,
    reservation_date,
    reservation_time,
    guests,
    table_type,
    restaurant_id
FROM 
    reservation
WHERE 
    reservation_date >= CURRENT_DATE
ORDER BY 
    reservation_date, reservation_time;


CREATE VIEW fully_booked_dates AS
WITH restaurant_capacity AS (
    SELECT 
        restaurant_id,
        COUNT(*) as total_tables
    FROM tables 
    GROUP BY restaurant_id
),
daily_reservations AS (
    SELECT 
        restaurant_id,
        reservation_date,
        COUNT(*) as total_reservations
    FROM reservation
    WHERE reservation_date >= CURRENT_DATE
    GROUP BY restaurant_id, reservation_date
),
fully_booked_days AS (
    SELECT 
        dr.restaurant_id,
        dr.reservation_date
    FROM daily_reservations dr
    JOIN restaurant_capacity rc ON dr.restaurant_id = rc.restaurant_id
    WHERE dr.total_reservations >= rc.total_tables
)
SELECT 
    r.restaurant_id,
    r.name as restaurant_name,
    ARRAY_AGG(fbd.reservation_date ORDER BY fbd.reservation_date) as fully_booked_dates
FROM restaurant r
LEFT JOIN fully_booked_days fbd ON r.restaurant_id = fbd.restaurant_id
GROUP BY r.restaurant_id, r.name
ORDER BY r.restaurant_id;

-- Function to check table availability before reservation
CREATE OR REPLACE FUNCTION check_table_availability()
RETURNS TRIGGER AS $$
DECLARE
    total_tables_of_type INT;
    reserved_tables_of_type INT;
    total_tables_all_types INT;
    total_reservations_all_types INT;
    available_tables_of_type INT;
BEGIN
    -- Get total tables of requested type for this restaurant
    SELECT COUNT(*)
    INTO total_tables_of_type
    FROM tables
    WHERE restaurant_id = NEW.restaurant_id 
      AND table_type = NEW.table_type;
    
    -- If no tables of this type exist, reject immediately
    IF total_tables_of_type = 0 THEN
        RAISE EXCEPTION 'Table type "%" is not available at this restaurant', NEW.table_type;
    END IF;
    
    -- Get existing reservations for this table type on this date
    SELECT COUNT(*)
    INTO reserved_tables_of_type
    FROM reservation
    WHERE restaurant_id = NEW.restaurant_id
      AND reservation_date = NEW.reservation_date
      AND table_type = NEW.table_type;
    
    -- Calculate available tables of this type
    available_tables_of_type := total_tables_of_type - reserved_tables_of_type;
    
    -- If no tables of this type available, but restaurant might not be fully booked
    IF available_tables_of_type <= 0 THEN
        -- Check if restaurant is completely fully booked
        SELECT COUNT(*) INTO total_tables_all_types
        FROM tables
        WHERE restaurant_id = NEW.restaurant_id;
        
        SELECT COUNT(*) INTO total_reservations_all_types
        FROM reservation
        WHERE restaurant_id = NEW.restaurant_id
          AND reservation_date = NEW.reservation_date;
        
        -- If restaurant is completely fully booked
        IF total_reservations_all_types >= total_tables_all_types THEN
            RAISE EXCEPTION 'No available tables for this date';
        ELSE
            -- Restaurant not fully booked, but this table type is unavailable
            RAISE EXCEPTION 'Please select another table type';
        END IF;
    END IF;
    
    -- If we get here, reservation is valid
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before insert on reservation
CREATE TRIGGER trg_check_table_availability
    BEFORE INSERT ON reservation
    FOR EACH ROW
    EXECUTE FUNCTION check_table_availability();

-- Function to check reservation time against restaurant hours
CREATE OR REPLACE FUNCTION check_reservation_time()
RETURNS TRIGGER AS $$
DECLARE
    opening TIME;
    closing TIME;
    day_name TEXT;
BEGIN
    day_name := TRIM(TO_CHAR(NEW.reservation_date, 'Day'));
    
    SELECT open_time, close_time
    INTO opening, closing
    FROM restaurant_hours
    WHERE restaurant_id = NEW.restaurant_id
      AND day_of_week = day_name;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant is closed on %', day_name;
    END IF;

    -- Handle overnight hours properly
    IF closing > opening THEN
        -- Normal hours (e.g., 12:00 - 23:00)
        IF NEW.reservation_time >= opening AND NEW.reservation_time <= closing THEN
            RETURN NEW;
        END IF;
    ELSE
        -- Overnight hours (e.g., 17:00 - 01:00)
        IF NEW.reservation_time >= opening OR NEW.reservation_time <= closing THEN
            RETURN NEW;
        END IF;
    END IF;

    -- If we get here, reservation time is outside hours
    RAISE EXCEPTION 'Reservation time % is outside opening hours (% - %)', 
        NEW.reservation_time, opening, closing;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_reservation_time
BEFORE INSERT ON reservation
FOR EACH ROW
EXECUTE FUNCTION check_reservation_time();