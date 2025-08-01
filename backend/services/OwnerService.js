import pool from '../config/database.js';

const OwnerService = {
  async getOwnerByVenueId(venue_id) {
    const { rows } = await pool.query('SELECT * FROM owner WHERE venue_id = $1', [venue_id]);
    return rows[0];
  }
};

export default OwnerService;