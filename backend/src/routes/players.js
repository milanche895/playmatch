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

    const { bio, skills, phone, location, preferredSports, experience, name, avatarUrl, notificationEnabled, notificationRadius } = req.body;

    // Update allowed fields
    if (bio !== undefined) user.bio = bio;
    if (skills !== undefined) user.skills = skills;
    if (phone !== undefined) user.phone = phone;
    if (location !== undefined) user.location = location;
    if (preferredSports !== undefined) user.preferredSports = preferredSports;
    if (experience !== undefined) user.experience = experience;
    if (name !== undefined) user.name = name;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (notificationEnabled !== undefined) user.notificationEnabled = notificationEnabled;
    if (notificationRadius !== undefined) {
      const radius = parseFloat(notificationRadius);
      if (radius >= 0 && radius <= 100) {
        user.notificationRadius = radius;
      }
    }

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

    const userObjectId = user._id; // Use ObjectId from found user

    // totalRegistered: Mečevi koje je igrač kreirao
    const createdMatches = await Match.find({
      createdBy: userObjectId
    });
    const totalRegistered = createdMatches.length;

    // totalJoinMatch: Broj mečeva gde se igrač prijavio (bio u players array-u)
    const joinedMatches = await Match.find({
      players: userObjectId
    });
    const totalJoinMatch = joinedMatches.length;

    // totalReserved: Mečevi koji su uspešno popunjeni i odigrani (status === 'completed')
    const reservedMatches = joinedMatches.filter(m => m.status === 'completed');
    const totalReserved = reservedMatches.length;

    // Get all matches where player cancelled attendance
    const matchesWithCancellations = await Match.find({
      'playerCancellations.playerId': userId
    });

    // totalCancelled: Mečevi gde se igrač prvo prijavio pa otkazao
    // (ima cancellation record i nije trenutno u players array-u)
    const activeCancellations = matchesWithCancellations
      .filter(m => {
        // Check if player is NOT currently in players array (prvo se prijavio pa otkazao)
        const isCurrentlyRegistered = m.players.some(p => p.toString() === userId.toString());
        return !isCurrentlyRegistered;
      })
      .flatMap(m => m.playerCancellations || [])
      .filter(c => c.playerId && c.playerId.toString() === userId.toString());

    const totalCancelled = activeCancellations.length;

    // totalCancelledWithComment: Otkazivanja sa komentarom
    const cancellationsWithComment = activeCancellations.filter(c => c.comment && c.comment.trim().length > 0);
    const totalCancelledWithComment = cancellationsWithComment.length;

    // Reliability score calculation
    // Reliability = ((total join - cancelled) / total join) * 100
    const reliabilityScore = totalJoinMatch > 0 
      ? (((totalJoinMatch - totalCancelled) / totalJoinMatch) * 100).toFixed(1)
      : 100;

    // Organizer success rate: percentage of successfully completed matches out of all created matches
    const completedCreatedMatches = createdMatches.filter(m => m.status === 'completed');
    const organizerSuccessRate = totalRegistered > 0
      ? ((completedCreatedMatches.length / totalRegistered) * 100).toFixed(1)
      : 0;

    res.json({
      totalRegistered: totalRegistered || 0,
      totalJoinMatch: totalJoinMatch || 0,
      totalReserved: totalReserved || 0,
      totalCancelled: totalCancelled || 0,
      totalCancelledWithComment: totalCancelledWithComment || 0,
      reliabilityScore: parseFloat(reliabilityScore),
      organizerSuccessRate: parseFloat(organizerSuccessRate)
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

    const userObjectId = user._id; // Use ObjectId from found user

    // totalRegistered: Mečevi koje je igrač kreirao
    const createdMatches = await Match.find({
      createdBy: userObjectId
    });
    const totalRegistered = createdMatches.length;

    // totalJoinMatch: Broj mečeva gde se igrač prijavio (bio u players array-u)
    const joinedMatches = await Match.find({
      players: userObjectId
    });
    const totalJoinMatch = joinedMatches.length;

    // totalReserved: Mečevi koji su uspešno popunjeni i odigrani (status === 'completed')
    const reservedMatches = joinedMatches.filter(m => m.status === 'completed');
    const totalReserved = reservedMatches.length;

    // Get all matches where player cancelled attendance
    const matchesWithCancellations = await Match.find({
      'playerCancellations.playerId': userObjectId
    });

    // totalCancelled: Mečevi gde se igrač prvo prijavio pa otkazao
    // (ima cancellation record i nije trenutno u players array-u)
    const activeCancellations = matchesWithCancellations
      .filter(m => {
        // Check if player is NOT currently in players array (prvo se prijavio pa otkazao)
        const isCurrentlyRegistered = m.players.some(p => p.toString() === userObjectId.toString());
        return !isCurrentlyRegistered;
      })
      .flatMap(m => m.playerCancellations || [])
      .filter(c => c.playerId && c.playerId.toString() === userObjectId.toString());

    const totalCancelled = activeCancellations.length;

    // totalCancelledWithComment: Otkazivanja sa komentarom
    const cancellationsWithComment = activeCancellations.filter(c => c.comment && c.comment.trim().length > 0);
    const totalCancelledWithComment = cancellationsWithComment.length;

    // Reliability score calculation
    // Reliability = ((total join - cancelled) / total join) * 100
    const reliabilityScore = totalJoinMatch > 0 
      ? (((totalJoinMatch - totalCancelled) / totalJoinMatch) * 100).toFixed(1)
      : 100;

    // Organizer success rate: percentage of successfully completed matches out of all created matches
    const completedCreatedMatches = createdMatches.filter(m => m.status === 'completed');
    const organizerSuccessRate = totalRegistered > 0
      ? ((completedCreatedMatches.length / totalRegistered) * 100).toFixed(1)
      : 0;

    res.json({
      totalRegistered: totalRegistered || 0,
      totalJoinMatch: totalJoinMatch || 0,
      totalReserved: totalReserved || 0,
      totalCancelled: totalCancelled || 0,
      totalCancelledWithComment: totalCancelledWithComment || 0,
      reliabilityScore: parseFloat(reliabilityScore),
      organizerSuccessRate: parseFloat(organizerSuccessRate)
    });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Update player location (for notifications)
router.post('/location', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu ažurirati lokaciju' });
    }

    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'Lat i lng su obavezni' });
    }

    // Use findByIdAndUpdate to avoid triggering unique index validation issues
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          lastKnownLocation: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            updatedAt: new Date()
          }
        }
      },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    res.json({ message: 'Lokacija ažurirana', location: updatedUser.lastKnownLocation });
  } catch (e) {
    console.error('Location update error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Subscribe to push notifications
router.post('/push-subscription', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu se pretplatiti na notifikacije' });
    }

    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Nevažeća push subscription' });
    }

    // Use findByIdAndUpdate to avoid triggering unique index validation issues
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          pushSubscription: subscription
        }
      },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    res.json({ message: 'Push subscription sačuvana' });
  } catch (e) {
    console.error('Push subscription error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  const { getVapidPublicKey } = require('../utils/pushNotifications');
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(500).json({ message: 'VAPID keys nisu konfigurisane' });
  }
  res.json({ publicKey });
});

// Test push notification endpoint (for testing purposes)
router.post('/test-push', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    
    if (!user.pushSubscription) {
      return res.status(400).json({ 
        message: 'Nema push subscription. Otvori profil stranicu da se pretplatiš.' 
      });
    }

    const { sendPushNotification } = require('../utils/pushNotifications');
    
    const testPayload = {
      title: 'Test Push Notifikacija 🧪',
      body: 'Ovo je test push notifikacija! Ako vidiš ovo, sve radi!',
      url: '/',
      icon: '/icons/icon-192.png'
    };

    await sendPushNotification(user.pushSubscription, testPayload);
    
    res.json({ 
      message: 'Test push notifikacija je poslata!',
      success: true 
    });
  } catch (error) {
    console.error('Error sending test push:', error);
    res.status(500).json({ 
      message: 'Greška pri slanju test push notifikacije',
      error: error.message 
    });
  }
});

module.exports = router;
