const express = require('express');
const Match = require('../models/Match');
const Field = require('../models/Field');
const User = require('../models/User');
const auth = require('../middleware/auth');

function matchesRoutesFactory(io) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const matches = await Match.find({})
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name')
      .sort({ dateTime: 1 });
    res.json(matches);
  });

  router.post('/', auth(true), async (req, res) => {
    try {
      const { sport, fieldId, dateTime, playersNeeded } = req.body;
      if (!sport || !fieldId || !dateTime || !playersNeeded) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      const field = await Field.findById(fieldId);
      if (!field) return res.status(404).json({ message: 'Field not found' });
      const match = await Match.create({
        sport,
        fieldId,
        dateTime: new Date(dateTime),
        playersNeeded,
        players: [req.user.id],
        createdBy: req.user.id,
        status: 'open'
      });
      const populated = await Match.findById(match._id)
        .populate('fieldId')
        .populate('players', 'name')
        .populate('createdBy', 'name');
      res.status(201).json(populated);
    } catch (e) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  router.get('/:id', async (req, res) => {
    const match = await Match.findById(req.params.id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name');
    if (!match) return res.status(404).json({ message: 'Not found' });
    res.json(match);
  });

  router.post('/:id/join', auth(true), async (req, res) => {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Not found' });
    const already = match.players.some((p) => p.toString() === req.user.id);
    if (!already) match.players.push(req.user.id);
    if (match.players.length >= match.playersNeeded) match.status = 'full';
    await match.save();
    const populated = await Match.findById(match._id)
      .populate('fieldId')
      .populate('players', 'name')
      .populate('createdBy', 'name');

    io.to(`match:${match._id.toString()}`).emit('match_updated', populated);
    res.json(populated);
  });

  return router;
}

module.exports = matchesRoutesFactory;


