const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();
const FEED_LIMIT = 50;

// Current user's notification feed (newest first) + unread counter
router.get('/', auth(true), async (req, res) => {
  try {
    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(FEED_LIMIT).lean(),
      Notification.countDocuments({ userId: req.user.id, readAt: { $exists: false } }),
    ]);
    res.json({ items, unreadCount });
  } catch (e) {
    console.error('Get notifications error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Mark everything as read
router.post('/read-all', auth(true), async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('Read-all notifications error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Mark a single notification as read
router.post('/:id/read', auth(true), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Neispravan ID' });
    }
    await Notification.updateOne(
      { _id: req.params.id, userId: req.user.id, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('Read notification error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

module.exports = router;
