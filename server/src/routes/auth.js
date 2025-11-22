const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function setTokenCookie(res, userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'dev_secret', {
    expiresIn: '7d'
  });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, avatarUrl } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, avatarUrl });
    setTokenCookie(res, user._id.toString());
    res.json({ _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    setTokenCookie(res, user._id.toString());
    res.json({ _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;


