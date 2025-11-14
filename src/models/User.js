const bcrypt = require('bcrypt');
const db = require('../../db');
const { validateEmail } = require('../utils/validation');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.email = data.email;
    this.password = data.password;
    this.created_at = data.created_at;
  }

  // Create a new user
  static async create(userData) {
    const { email, password } = userData;
    
    // Validation
    if (!email || !validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    const result = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashedPassword]
    );

    return new User(result.rows[0]);
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const result = await db.query(
        'SELECT id, email, password, created_at FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const result = await db.query(
        'SELECT id, email, created_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  // Verify password
  async verifyPassword(password) {
    try {
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  // Get user data without password
  toSafeObject() {
    return {
      id: this.id,
      email: this.email,
      created_at: this.created_at
    };
  }

  // Update user
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'password') {
        // Hash password if it's being updated
        values.push(await bcrypt.hash(value, 10));
      } else {
        values.push(value);
      }
      fields.push(`${key} = $${paramIndex}`);
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(this.id); // Add ID for WHERE clause
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} 
      RETURNING id, email, created_at
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Update current instance
    Object.assign(this, result.rows[0]);
    return this;
  }

  // Delete user
  async delete() {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [this.id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return true;
  }

  // Get all users (admin function)
  static async findAll(limit = 50, offset = 0) {
    const result = await db.query(
      'SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    return result.rows.map(row => new User(row));
  }

  // Count total users
  static async count() {
    const result = await db.query('SELECT COUNT(*) as total FROM users');
    return parseInt(result.rows[0].total);
  }
}

module.exports = User;