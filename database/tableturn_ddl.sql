-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS response_templates CASCADE;
DROP TABLE IF EXISTS restaurant_hours CASCADE;
DROP TABLE IF EXISTS reservation CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
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
    min_reservation_gap_hours INT DEFAULT 2 CHECK (min_reservation_gap_hours >= 0),
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



CREATE TABLE tables (
    table_id SERIAL PRIMARY KEY,
    table_name VARCHAR(10) NOT NULL,
    table_type TEXT,
    table_price NUMERIC(5,2) DEFAULT 0 CHECK (table_price >= 0),
    capacity INT NOT NULL DEFAULT 4 CHECK (capacity > 0),
    description TEXT,
    embedding vector(768),
    restaurant_id INT NOT NULL,
    x_coordinate FLOAT DEFAULT 0,
    y_coordinate FLOAT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
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
    celebration_type TEXT,
    cake BOOLEAN DEFAULT FALSE,
    cake_price NUMERIC(5,2) CHECK (cake_price >= 0),
    flowers BOOLEAN DEFAULT FALSE,
    flowers_price NUMERIC(5,2) CHECK (flowers_price >= 0),
    table_id INT, -- for specific table reservations
    restaurant_id INT NOT NULL,
    FOREIGN KEY (table_id) REFERENCES tables(table_id),
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

-- This simple trigger remains, as it's a separate concern.
CREATE OR REPLACE FUNCTION check_reservation_time()
RETURNS TRIGGER AS $$
DECLARE
    opening TIME;
    closing TIME;
    day_name TEXT;
BEGIN
    day_name := TRIM(TO_CHAR(NEW.reservation_date, 'Day'));
    SELECT open_time, close_time INTO opening, closing
    FROM restaurant_hours
    WHERE restaurant_id = NEW.restaurant_id AND day_of_week = day_name;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant is closed on %s', day_name;
    END IF;

    -- Handle overnight hours properly
    IF closing < opening THEN
        IF NOT (NEW.reservation_time >= opening OR NEW.reservation_time <= closing) THEN
            RAISE EXCEPTION 'Reservation time % is outside opening hours (% - %)', NEW.reservation_time, opening, closing;
        END IF;
    ELSE
        IF NOT (NEW.reservation_time BETWEEN opening AND closing) THEN
            RAISE EXCEPTION 'Reservation time % is outside opening hours (% - %)', NEW.reservation_time, opening, closing;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- THE "HARD CHECK" - This single function validates and assigns a table during booking.
CREATE OR REPLACE FUNCTION assign_available_table()
RETURNS TRIGGER AS $$
DECLARE
    found_table_id INT;
    min_gap INT;
BEGIN
    -- This trigger only runs if a table_id has NOT been pre-assigned.
    IF NEW.table_id IS NULL THEN
        -- Step 1: Get the minimum reservation gap for this specific restaurant.
        SELECT COALESCE(min_reservation_gap_hours, 2) INTO min_gap
        FROM restaurant WHERE restaurant_id = NEW.restaurant_id;

        -- Step 2: Find the best available table that meets all criteria.
        SELECT t.table_id INTO found_table_id
        FROM tables AS t
        WHERE
            t.restaurant_id = NEW.restaurant_id
            AND t.table_type = NEW.table_type
            AND t.capacity >= NEW.guests
            AND NOT EXISTS (
                SELECT 1 FROM reservation AS r
                WHERE r.table_id = t.table_id
                  AND r.reservation_date = NEW.reservation_date
                  AND ABS(EXTRACT(EPOCH FROM (r.reservation_time - NEW.reservation_time))) < (min_gap * 3600)
            )
        ORDER BY t.capacity ASC, t.table_id ASC
        LIMIT 1;

        -- Step 3: Assign the found table_id or raise an error if no table was found.
        IF found_table_id IS NOT NULL THEN
            NEW.table_id := found_table_id;
        ELSE
            RAISE EXCEPTION 'No available tables match the specified criteria (Type: %, Guests: %) for the requested time.', NEW.table_type, NEW.guests;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- THE "SOFT CHECK" - This function is for the agent to query availability.
CREATE OR REPLACE FUNCTION get_available_table_types(
    p_restaurant_id INT,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_guests INT
)
RETURNS TABLE(table_type TEXT, table_price NUMERIC, capacity INT) AS $$
DECLARE
    min_gap INT;
BEGIN
    SELECT COALESCE(min_reservation_gap_hours, 2) INTO min_gap
    FROM restaurant WHERE restaurant_id = p_restaurant_id;

    RETURN QUERY
    SELECT DISTINCT ON (t.table_type)
        t.table_type,
        t.table_price,
        t.capacity
    FROM tables AS t
    WHERE
        t.restaurant_id = p_restaurant_id
        AND t.capacity >= p_guests
        AND NOT EXISTS (
            SELECT 1 FROM reservation AS r
            WHERE r.table_id = t.table_id
              AND r.reservation_date = p_reservation_date
              AND ABS(EXTRACT(EPOCH FROM (r.reservation_time - p_reservation_time))) < (min_gap * 3600)
        )
    ORDER BY t.table_type, t.capacity ASC;
END;
$$ LANGUAGE plpgsql;


-- === TRIGGERS ===

-- Trigger to check if the reservation is within opening hours.
CREATE TRIGGER trg_check_reservation_time
    BEFORE INSERT ON reservation
    FOR EACH ROW
    EXECUTE FUNCTION check_reservation_time();

-- The main trigger to validate availability and assign a table.
CREATE TRIGGER trg_assign_available_table
    BEFORE INSERT ON reservation
    FOR EACH ROW
    WHEN (NEW.table_id IS NULL)
    EXECUTE FUNCTION assign_available_table();


-- === DASHBOARD FUNCTIONS ===

-- Function to clean up expired reservations
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    gap_hours INT;
    cutoff_time TIMESTAMP;
    expired_table RECORD;
BEGIN
    -- Process each restaurant separately due to different gap hours
    FOR gap_hours IN 
        SELECT DISTINCT min_reservation_gap_hours FROM restaurant 
        WHERE min_reservation_gap_hours IS NOT NULL
    LOOP
        -- Calculate cutoff time (current time minus gap hours)
        cutoff_time := NOW() - (COALESCE(gap_hours, 2) || ' hours')::INTERVAL;
        
        -- Find tables that should be unreserved
        FOR expired_table IN
            SELECT DISTINCT t.table_id, t.restaurant_id, r.min_reservation_gap_hours
            FROM tables t
            JOIN restaurant r ON t.restaurant_id = r.restaurant_id
            LEFT JOIN reservation res ON t.table_id = res.table_id
            WHERE t.status = 'reserved'
              AND r.min_reservation_gap_hours = gap_hours
              AND (
                  res.table_id IS NULL 
                  OR (res.reservation_date + res.reservation_time + (COALESCE(r.min_reservation_gap_hours, 2) || ' hours')::INTERVAL) < NOW()
              )
        LOOP
            -- Reset table status to available
            UPDATE tables
            SET status = 'available'
            WHERE table_id = expired_table.table_id 
              AND restaurant_id = expired_table.restaurant_id;
              
            RAISE NOTICE 'Table % (restaurant %) status reset to available', 
                expired_table.table_id, expired_table.restaurant_id;
        END LOOP;
    END LOOP;
END;
$function$;

-- Function to get current table status
CREATE OR REPLACE FUNCTION public.get_current_table_status(p_table_id integer, p_restaurant_id integer)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    gap_hours INT;
    current_stored_status VARCHAR(20);
    active_reservation_count INT;
    curr_time TIMESTAMP;
BEGIN
    -- Get current time
    curr_time := NOW();
    
    -- Get the restaurant's gap hours
    SELECT min_reservation_gap_hours
    INTO gap_hours
    FROM restaurant
    WHERE restaurant_id = p_restaurant_id;
    
    -- Default gap to 2 hours if not set
    gap_hours := COALESCE(gap_hours, 2);
    
    -- Check for active reservations within the gap window around NOW()
    SELECT COUNT(*)
    INTO active_reservation_count
    FROM reservation
    WHERE table_id = p_table_id
      AND restaurant_id = p_restaurant_id
      AND (reservation_date + reservation_time - (gap_hours || ' hours')::INTERVAL) <= curr_time
      AND (reservation_date + reservation_time + (gap_hours || ' hours')::INTERVAL) >= curr_time;
    
    -- Get current stored status (for manually set occupied status)
    SELECT status INTO current_stored_status
    FROM tables
    WHERE table_id = p_table_id AND restaurant_id = p_restaurant_id;
    
    -- Priority logic:
    -- 1. If there are active reservations within gap window -> 'reserved'
    -- 2. If manually set to 'occupied' and no conflicting reservations -> 'occupied'  
    -- 3. Otherwise -> 'available'
    IF active_reservation_count > 0 THEN
        RETURN 'reserved';
    ELSIF current_stored_status = 'occupied' THEN
        RETURN 'occupied';
    ELSE
        RETURN 'available';
    END IF;
END;
$function$;