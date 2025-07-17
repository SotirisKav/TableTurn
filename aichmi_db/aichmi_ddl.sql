DROP DATABASE IF EXISTS aichmi;
CREATE DATABASE aichmi;

-- Connect to the new database
\c aichmi

DROP TABLE IF EXISTS response_templates CASCADE;
DROP TABLE IF EXISTS fully_booked_dates CASCADE;
DROP TABLE IF EXISTS wedding_dates CASCADE;
DROP TABLE IF EXISTS reservation CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS hotel CASCADE;
DROP TABLE IF EXISTS transfer_areas CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS owners CASCADE;
DROP TABLE IF EXISTS venue CASCADE;
DROP TABLE IF EXISTS bot_modules CASCADE;
DROP TABLE IF EXISTS bot_config CASCADE;
DROP TABLE IF EXISTS menu_item CASCADE;
DROP TABLE IF EXISTS table_inventory CASCADE;

-- Create ENUM types for PostgreSQL
CREATE TYPE subscription_status_enum AS ENUM ('active', 'canceled', 'past_due', 'unpaid');
CREATE TYPE oauth_provider_enum AS ENUM ('google', 'facebook', 'local');

CREATE TABLE venue (
    venue_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(50) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('restaurant', 'hotel')),
    rating NUMERIC(2,1) CHECK (rating >= 1 AND rating <= 5),
    pricing TEXT NOT NULL CHECK (pricing IN ('affordable', 'moderate', 'expensive')),
    image_url VARCHAR(500),
    description TEXT,
    cuisine VARCHAR(100)
);

CREATE TABLE owners (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255), -- nullable for OAuth users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    venue_id INT,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status subscription_status_enum DEFAULT NULL,
    oauth_provider oauth_provider_enum DEFAULT 'local',
    oauth_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id)
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

CREATE TABLE transfer_areas (
    area_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    price_4_or_less NUMERIC(5,2) NOT NULL CHECK (price_4_or_less >= 0),
    price_5_to_8 NUMERIC(5,2) NOT NULL CHECK (price_5_to_8 >= 0)
);

CREATE TABLE hotel (
    hotel_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(50) NOT NULL,
    transfer_price NUMERIC(5,2) DEFAULT 0 CHECK (transfer_price >= 0)
);

CREATE TABLE tables (
    table_id SERIAL PRIMARY KEY,
    table_type TEXT NOT NULL CHECK (table_type IN ('standard', 'grass', 'special')),
    table_price NUMERIC(5,2) DEFAULT 0 CHECK (table_price >= 0)
);

CREATE TABLE table_inventory (
    inventory_id SERIAL PRIMARY KEY,
    venue_id INT NOT NULL REFERENCES venue(venue_id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('standard', 'grass', 'special')),
    max_tables INT NOT NULL CHECK (max_tables >= 0)
);

CREATE TABLE menu_item (
    menu_item_id SERIAL PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venue(venue_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(8,2) NOT NULL,
    category VARCHAR(50), -- e.g. 'Appetizer', 'Main', 'Dessert', 'Drink'
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    available BOOLEAN DEFAULT TRUE
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
    table_type TEXT NOT NULL CHECK (table_type IN ('standard', 'grass', 'anniversary')),
    celebration_type TEXT CHECK (celebration_type IN ('birthday', 'anniversary', 'honeymoon', 'none')),
    cake BOOLEAN DEFAULT FALSE,
    cake_price NUMERIC(5,2) CHECK (cake_price >= 0),
    flowers BOOLEAN DEFAULT FALSE,
    flowers_price NUMERIC(5,2) CHECK (flowers_price >= 0),
    hotel_name TEXT,
    hotel_id INT,
    venue_id INT NOT NULL,
    FOREIGN KEY (hotel_id) REFERENCES hotel(hotel_id),
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE
);

CREATE TABLE wedding_dates (
    wedding_date_id SERIAL PRIMARY KEY,
    wedding_date DATE NOT NULL CHECK (wedding_date >= CURRENT_DATE),
    reservation_id INT NOT NULL,
    venue_id INT NOT NULL,
    FOREIGN KEY (reservation_id) REFERENCES reservation(reservation_id) ON DELETE CASCADE,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE
);

CREATE TABLE fully_booked_dates (
    fully_booked_date_id SERIAL PRIMARY KEY,
    fully_booked_date DATE NOT NULL CHECK (fully_booked_date >= CURRENT_DATE),
    venue_id INT NOT NULL,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE
);

-- for example create automated response for greeting or for reservation confirmation
CREATE TABLE response_templates (
    module_name TEXT PRIMARY KEY,
    template TEXT NOT NULL,
    venue_id INT NOT NULL,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE
);

-- for example response_style -> professional
CREATE TABLE bot_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    venue_id INT NOT NULL,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE
);

-- for example give greeting -> TRUE for specific venue
CREATE TABLE bot_modules (
    module_name TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    venue_id INT NOT NULL,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_stripe_customer ON owners(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_owner ON refresh_tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_reservation_venue ON reservation(venue_id);
CREATE INDEX IF NOT EXISTS idx_reservation_date ON reservation(reservation_date);