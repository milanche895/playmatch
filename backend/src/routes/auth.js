const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function setTokenCookie(res, userId, req = null) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
  // Use secure cookies in production (HTTPS), but allow insecure in development
  // On Render, we're behind a proxy, so check x-forwarded-proto header
  const isHttps = req && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  const isProduction = process.env.NODE_ENV === 'production';
  const useSecure = isProduction && isHttps;
  
  res.cookie('token', token, { 
    httpOnly: true, 
    sameSite: 'lax', 
    secure: useSecure, // Secure cookies only in production with HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, avatarUrl, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Nedostaju polja' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email je već u upotrebi' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      name, 
      email, 
      password: hashed, 
      avatarUrl,
      role: role || 'player'
    });
    
    // Generate token
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    
    // Set cookie before sending response
    setTokenCookie(res, user._id.toString(), req);
    
    // Log for debugging
    console.log('User registered:', user.email, 'Role:', user.role, 'ID:', user._id);
    
    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      avatarUrl: user.avatarUrl,
      role: user.role,
      token // Include token in response for localStorage
    });
  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Neispravni podaci za prijavu' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Neispravni podaci za prijavu' });
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    setTokenCookie(res, user._id.toString(), req);
    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      avatarUrl: user.avatarUrl,
      role: user.role,
      token // Include token in response for localStorage
    });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Niste autentifikovani' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = await User.findById(payload.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Korisnik nije pronađen' });
    res.json(user);
  } catch (e) {
    res.status(401).json({ message: 'Nevažeći token' });
  }
});

module.exports = router;


