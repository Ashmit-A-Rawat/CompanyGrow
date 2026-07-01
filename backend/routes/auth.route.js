const express = require('express');
const router = express.Router();
const { loginUser, logoutUser, signupUser } = require('../controllers/auth.controller');

// POST /api/auth/login
router.post('/login', loginUser);

// POST /api/auth/signup
router.post('/signup', signupUser);

// POST /api/auth/logout
router.post('/logout', logoutUser);

module.exports = router;