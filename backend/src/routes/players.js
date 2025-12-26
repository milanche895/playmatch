const express = require('express');
const User = require('../models/User');
const Match = require('../models/Match');
const auth = require('../middleware/auth');

const router = express.Router();

// Get player profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(400).json({ message: 'Korisnik nije igrač' });
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get current player's own profile
router.get('/profile', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(400).json({ message: 'Korisnik nije igrač' });
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update player profile
router.put('/profile', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu ažurirati profil' });
    }

    const { bio, skills, phone, location, preferredSports, experience, name, avatarUrl } = req.body;

    // Update allowed fields
    if (bio !== undefined) user.bio = bio;
    if (skills !== undefined) user.skills = skills;
    if (phone !== undefined) user.phone = phone;
    if (location !== undefined) user.location = location;
    if (preferredSports !== undefined) user.preferredSports = preferredSports;
    if (experience !== undefined) user.experience = experience;
    if (name !== undefined) user.name = name;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    await user.save();
    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get player analytics/statistics
router.get('/analytics/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(400).json({ message: 'Korisnik nije igrač' });
    }

    const now = new Date();

    // Get all matches where player is/was registered
    const allPlayerMatches = await Match.find({
      players: userId
    });

    // Calculate statistics
    const totalRegistered = allPlayerMatches.length;
    
    // Completed matches (successfully held)
    const completedMatches = allPlayerMatches.filter(m => m.status === 'completed');
    const totalCompleted = completedMatches.length;

    // Get all matches where player cancelled attendance (with comments)
    // Only count cancellations where player is NOT currently registered (not in players array)
    const matchesWithCancellations = await Match.find({
      'playerCancellations.playerId': userId
    }).populate('playerCancellations.playerId', 'name');

    // Count only cancellations where player is not currently in the players array
    // This means they cancelled and haven't rejoined
    const activeCancellations = matchesWithCancellations
      .filter(m => {
        // Check if player is NOT currently in players array
        const isCurrentlyRegistered = m.players.some(p => p.toString() === userId.toString());
        return !isCurrentlyRegistered;
      })
      .flatMap(m => m.playerCancellations || [])
      .filter(c => c.playerId && c.playerId.toString() === userId.toString());

    const totalCancelled = activeCancellations.length;
    const totalCancelledWithComment = activeCancellations.length;
    const cancellationsWithCommentText = activeCancellations.filter(c => c.comment && c.comment.trim()).length;

    // Matches where player left (we need to track this - for now, we'll check if match is cancelled/failed and player was in it)
    // This is a simplified version - ideally we'd track when a player leaves
    const matchesPlayerLeft = allPlayerMatches.filter(m => {
      // If match is cancelled/failed and player was registered, they likely didn't show up
      return (m.status === 'otkazano' || m.status === 'failed') && 
             m.players.includes(userId) &&
             new Date(m.dateTime) < now; // Match time has passed
    });

    // Full/Reserved matches (matches that were successfully reserved)
    const reservedMatches = allPlayerMatches.filter(m => 
      m.status === 'full' || m.status === 'completed'
    );
    const totalReserved = reservedMatches.length;

    // Reliability score calculation
    // Reliability = (completed matches) / (total registered matches that have passed their deadline)
    const pastMatches = allPlayerMatches.filter(m => 
      new Date(m.registrationDeadline) < now
    );
    const reliabilityScore = pastMatches.length > 0 
      ? ((totalCompleted / pastMatches.length) * 100).toFixed(1)
      : 100;

    // Show-up rate (how many times they actually showed up vs registered)
    const showUpRate = totalRegistered > 0
      ? ((totalCompleted / totalRegistered) * 100).toFixed(1)
      : 0;

    // Matches created by this player
    const matchesCreated = await Match.find({ createdBy: userId });
    const totalCreated = matchesCreated.length;

    res.json({
      totalRegistered,
      totalCompleted,
      totalCancelled,
      totalReserved,
      totalCreated,
      reliabilityScore: parseFloat(reliabilityScore),
      showUpRate: parseFloat(showUpRate),
      matchesPlayerLeft: matchesPlayerLeft.length,
      totalCancelledWithComment,
      cancellationsWithCommentText
    });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get current player's analytics
router.get('/analytics', auth(true), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(400).json({ message: 'Korisnik nije igrač' });
    }

    const now = new Date();

    // Get all matches where player is/was registered
    const allPlayerMatches = await Match.find({
      players: userId
    });

    // Calculate statistics
    const totalRegistered = allPlayerMatches.length;
    
    // Completed matches (successfully held)
    const completedMatches = allPlayerMatches.filter(m => m.status === 'completed');
    const totalCompleted = completedMatches.length;

    // Get all matches where player cancelled attendance (with comments)
    // Only count cancellations where player is NOT currently registered (not in players array)
    const matchesWithCancellations = await Match.find({
      'playerCancellations.playerId': userId
    }).populate('playerCancellations.playerId', 'name');

    // Count only cancellations where player is not currently in the players array
    // This means they cancelled and haven't rejoined
    const activeCancellations = matchesWithCancellations
      .filter(m => {
        // Check if player is NOT currently in players array
        const isCurrentlyRegistered = m.players.some(p => p.toString() === userId.toString());
        return !isCurrentlyRegistered;
      })
      .flatMap(m => m.playerCancellations || [])
      .filter(c => c.playerId && c.playerId.toString() === userId.toString());

    const totalCancelled = activeCancellations.length;
    const totalCancelledWithComment = activeCancellations.length;
    const cancellationsWithCommentText = activeCancellations.filter(c => c.comment && c.comment.trim()).length;

    // Matches where player left
    const matchesPlayerLeft = allPlayerMatches.filter(m => {
      return (m.status === 'otkazano' || m.status === 'failed') && 
             m.players.includes(userId) &&
             new Date(m.dateTime) < now;
    });

    // Full/Reserved matches
    const reservedMatches = allPlayerMatches.filter(m => 
      m.status === 'full' || m.status === 'completed'
    );
    const totalReserved = reservedMatches.length;

    // Reliability score
    const pastMatches = allPlayerMatches.filter(m => 
      new Date(m.registrationDeadline) < now
    );
    const reliabilityScore = pastMatches.length > 0 
      ? ((totalCompleted / pastMatches.length) * 100).toFixed(1)
      : 100;

    // Show-up rate
    const showUpRate = totalRegistered > 0
      ? ((totalCompleted / totalRegistered) * 100).toFixed(1)
      : 0;

    // Matches created by this player
    const matchesCreated = await Match.find({ createdBy: userId });
    const totalCreated = matchesCreated.length;

    res.json({
      totalRegistered,
      totalCompleted,
      totalCancelled,
      totalReserved,
      totalCreated,
      reliabilityScore: parseFloat(reliabilityScore),
      showUpRate: parseFloat(showUpRate),
      matchesPlayerLeft: matchesPlayerLeft.length,
      totalCancelledWithComment,
      cancellationsWithCommentText
    });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

module.exports = router;
