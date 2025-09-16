const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Generate unique approval key
const generateApprovalKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 12; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `APV-${key.substring(0, 4)}-${key.substring(4, 8)}-${key.substring(8, 12)}`;
};

class User {
  constructor(email, password, name) {
    this.id = uuidv4();
    this.email = email;
    this.password = password;
    this.name = name;
    this.createdAt = new Date();
    this.servers = [];
    this.isApproved = false;
    this.approvalKey = generateApprovalKey();
    this.approvedAt = null;
    this.approvedBy = null;
  }

  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 12);
  }

  async comparePassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  toJSON() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}

// Temporary in-memory storage (replace with database later)
class UserStorage {
  constructor() {
    this.users = new Map();
  }

  async create(userData) {
    const { email, password, name } = userData;
    
    // Check if user already exists
    if (this.findByEmail(email)) {
      throw new Error('User already exists');
    }

    const user = new User(email, password, name);
    await user.hashPassword();
    
    this.users.set(user.id, user);
    return user;
  }

  findByEmail(email) {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  findById(id) {
    return this.users.get(id);
  }

  async authenticate(email, password) {
    const user = this.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return user;
  }

  getAllUsers() {
    return Array.from(this.users.values()).map(user => user.toJSON());
  }

  deleteUser(id) {
    return this.users.delete(id);
  }

  approveUser(userId, approvedBy = 'admin') {
    const user = this.findById(userId);
    if (user) {
      user.isApproved = true;
      user.approvedAt = new Date();
      user.approvedBy = approvedBy;
      return user;
    }
    return null;
  }

  getAllPendingUsers() {
    return Array.from(this.users.values())
      .filter(user => !user.isApproved)
      .map(user => user.toJSON());
  }

  getAllApprovedUsers() {
    return Array.from(this.users.values())
      .filter(user => user.isApproved)
      .map(user => user.toJSON());
  }
}

module.exports = { User, UserStorage };