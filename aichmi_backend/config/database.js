import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER || 'sotiriskavadakis',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'aichmi',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Database connection error:', err);
});

// Create a wrapper to match the expected interface
const db = {
    execute: async (sql, params = []) => {
        try {
            const result = await pool.query(sql, params);
            // Return in MySQL format: [rows, fields]
            return [result.rows, result.fields];
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    },
    query: async (sql, params = []) => {
        const result = await pool.query(sql, params);
        return result.rows;
    },
    connect: async () => {
        return await pool.connect();
    }
};

export default db;