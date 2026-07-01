const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const SECRET = process.env.JWT_SECRET || 'companygrow_secret_key';

// Login Controller
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role
      },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Signup Controller
const signupUser = async (req, res) => {
  try {
    const { name, email, phone, password, experience, skills } = req.body;

    // Validation
    if (!name || !email || !phone || !password || experience === undefined || !skills) {
      return res.status(400).json({ 
        message: 'All fields are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Process skills (convert to array if it's a string)
    const skillsArray = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());

    // Create new user
    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      experience: parseInt(experience),
      skills: skillsArray,
      role: 'employee' // Using 'employee' as default since your enum is ['employee', 'manager', 'admin']
    });

    const savedUser = await newUser.save();

    // Generate JWT token (same way as login)
    const token = jwt.sign(
      { 
        id: savedUser._id, 
        email: savedUser.email,
        role: savedUser.role 
      },
      SECRET,
      { expiresIn: '24h' }
    );

    // Return user data and token (same format as login)
    res.status(201).json({
      token,
      _id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      message: 'Server error during signup' 
    });
  }
};

// Logout Controller
const logoutUser = async (req, res) => {
  try {
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { loginUser, signupUser, logoutUser };