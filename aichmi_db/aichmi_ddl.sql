DROP DATABASE IF EXISTS aichmi;
CREATE DATABASE aichmi;
USE aichmi;

DROP TABLE IF EXISTS wedding_dates;
DROP TABLE IF EXISTS reservation;
DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS hotel;
DROP TABLE IF EXISTS owner;
DROP TABLE IF EXISTS venue;
DROP TABLE IF EXISTS customer;

CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20)
);

CREATE TABLE venue (
    venue_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(50) NOT NULL,
    venue_type TEXT NOT NULL CHECK(venue_type IN ('restaurant', 'hotel'))
);

CREATE TABLE owner (
    owner_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    venue_id INT NOT NULL,
    FOREIGN KEY (venue_id) REFERENCES venue(venue_id)
);

CREATE TABLE hotel (
    hotel_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    area VARCHAR(50) NOT NULL,
    transfer_price NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE tables (
    table_id SERIAL PRIMARY KEY,
    table_type TEXT NOT NULL CHECK(table_type IN ('standard', 'grass', 'anniversary')),
    table_price NUMERIC(5,2) DEFAULT 0
);

CREATE TABLE reservation (
    reservation_id SERIAL PRIMARY KEY,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    guests INT NOT NULL CHECK (guests > 0),
    table_type TEXT NOT NULL CHECK(table_type IN ('standard', 'grass', 'anniversary')),
    table_price NUMERIC(5,2) DEFAULT 0,
    celebration_type TEXT,
    cake BOOLEAN DEFAULT FALSE,
    cake_price NUMERIC(5,2),
    flowers BOOLEAN DEFAULT FALSE,
    flowers_price NUMERIC(5,2),
    hotel_name TEXT,
    hotel_id INT,
    customer_id INT NOT NULL,
    FOREIGN KEY (hotel_id) REFERENCES hotel(hotel_id),
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);

CREATE TABLE wedding_dates (
    wedding_date_id SERIAL PRIMARY KEY,
    wedding_date DATE NOT NULL,
    customer_id INT NOT NULL,
    reservation_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    FOREIGN KEY (reservation_id) REFERENCES reservation(reservation_id)
);