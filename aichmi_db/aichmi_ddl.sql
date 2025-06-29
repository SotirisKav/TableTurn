DROP DATABASE IF EXISTS aichmi;
CREATE DATABASE aichmi;

DROP TABLE IF EXISTS response_templates;
DROP TABLE IF EXISTS fully_booked_dates;
DROP TABLE IF EXISTS wedding_dates;
DROP TABLE IF EXISTS reservation;
DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS hotel;
DROP TABLE IF EXISTS transfer_areas;
DROP TABLE IF EXISTS owner;
DROP TABLE IF EXISTS venue;
DROP TABLE IF EXISTS customer;
DROP TABLE IF EXISTS bot_modules;
DROP TABLE IF EXISTS bot_config;

CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    CONSTRAINT customer_email_format CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$')
);

CREATE TABLE venue (
    venue_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(50) NOT NULL,
    venue_type TEXT NOT NULL CHECK (venue_type IN ('restaurant', 'hotel'))
);

CREATE TABLE owner (
    owner_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    venue_id INT NOT NULL,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id) ON DELETE CASCADE
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
    table_type TEXT NOT NULL CHECK (table_type IN ('standard', 'grass', 'anniversary')),
    table_price NUMERIC(5,2) DEFAULT 0 CHECK (table_price >= 0)
);

CREATE TABLE reservation (
    reservation_id SERIAL PRIMARY KEY,
    reservation_date DATE NOT NULL CHECK (reservation_date >= CURRENT_DATE),
    reservation_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    guests INT NOT NULL CHECK (guests > 0),
    table_type TEXT NOT NULL CHECK (table_type IN ('standard', 'grass', 'anniversary')),
    table_price NUMERIC(5,2) DEFAULT 0 CHECK (table_price >= 0),
    celebration_type TEXT CHECK (celebration_type IN ('birthday', 'anniversary', 'honeymoon', 'none')),
    cake BOOLEAN DEFAULT FALSE,
    cake_price NUMERIC(5,2) CHECK (cake_price >= 0),
    flowers BOOLEAN DEFAULT FALSE,
    flowers_price NUMERIC(5,2) CHECK (flowers_price >= 0),
    hotel_name TEXT,
    hotel_id INT,
    customer_id INT NOT NULL,
    FOREIGN KEY (hotel_id) REFERENCES hotel(hotel_id),
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE
);

CREATE TABLE wedding_dates (
    wedding_date_id SERIAL PRIMARY KEY,
    wedding_date DATE NOT NULL CHECK (wedding_date >= CURRENT_DATE),
    customer_id INT NOT NULL,
    reservation_id INT NOT NULL,
    venue_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE,
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