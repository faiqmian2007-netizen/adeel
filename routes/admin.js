const express = require('express');
const { userStorage } = require('./auth');

const router = express.Router();

// Simple admin authentication middleware
const adminAuth = (req, res, next) => {
  const adminToken = req.header('Admin-Auth');
  
  if (!adminToken || adminToken !== 'admin_logged_in') {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  
  next();
};

// Get all users
router.get('/users', adminAuth, (req, res) => {
  try {
    const users = userStorage.getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get pending users only
router.get('/users/pending', adminAuth, (req, res) => {
  try {
    const users = userStorage.getAllPendingUsers();
    res.json({ users });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// Get approved users only
router.get('/users/approved', adminAuth, (req, res) => {
  try {
    const users = userStorage.getAllApprovedUsers();
    res.json({ users });
  } catch (error) {
    console.error('Error fetching approved users:', error);
    res.status(500).json({ error: 'Failed to fetch approved users' });
  }
});

// Approve a user
router.post('/approve', adminAuth, (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = userStorage.approveUser(userId, 'admin');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      message: 'User approved successfully',
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Get user stats
router.get('/stats', adminAuth, (req, res) => {
  try {
    const allUsers = userStorage.getAllUsers();
    const pendingUsers = userStorage.getAllPendingUsers();
    const approvedUsers = userStorage.getAllApprovedUsers();
    
    res.json({
      total: allUsers.length,
      pending: pendingUsers.length,
      approved: approvedUsers.length
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;