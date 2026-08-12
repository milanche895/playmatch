const express = require('express');
const multer = require('multer');
const User = require('../models/User');
const Match = require('../models/Match');
const auth = require('../middleware/auth');
const { uploadImageBuffer } = require('../utils/cloudinary');

const router = express.Router();

// Configure multer for memory storage (we'll upload to Cloudinary, not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Samo slike su dozvoljene (JPEG, PNG, GIF)'), false);
    }
  }
});

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

    // Prefer stored reliability score, keep fallback for older users
    const reliabilityScore = user.reliabilityScore !== undefined && user.reliabilityScore !== null
      ? Number(user.reliabilityScore)
      : Number(totalJoinMatch > 0 
        ? (((totalJoinMatch - totalCancelled) / totalJoinMatch) * 100).toFixed(1)
        : 100);

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
      reliabilityScore,
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

    // Prefer stored reliability score, keep fallback for older users
    const reliabilityScore = user.reliabilityScore !== undefined && user.reliabilityScore !== null
      ? Number(user.reliabilityScore)
      : Number(totalJoinMatch > 0 
        ? (((totalJoinMatch - totalCancelled) / totalJoinMatch) * 100).toFixed(1)
        : 100);

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
      reliabilityScore,
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

// Subscribe to push notifications (PWA Web Push)
router.post('/push-subscription', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu se pretplatiti na notifikacije' });
    }

    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Push subscription zahteva endpoint' });
    }

    // Save PWA push subscription
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

    res.json({ 
      message: 'Push subscription sačuvana'
    });
  } catch (e) {
    console.error('Push subscription error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Unsubscribe from push notifications
router.delete('/push-subscription', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    // Remove push subscription
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $unset: {
          pushSubscription: 1
        }
      },
      { new: true }
    );

    res.json({ message: 'Push subscription uklonjena' });
  } catch (e) {
    console.error('Push unsubscribe error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get push notification status
router.get('/push-subscription/status', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('pushSubscription notificationEnabled');
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    res.json({
      subscribed: user.pushSubscription !== null && user.pushSubscription !== undefined,
      enabled: user.notificationEnabled !== false
    });
  } catch (e) {
    console.error('Push subscription status error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get VAPID public key for PWA push notifications
router.get('/vapid-public-key', (req, res) => {
  try {
    const { getVapidPublicKey } = require('../utils/pushNotifications');
    const publicKey = getVapidPublicKey();
    res.json({ publicKey });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    res.status(500).json({ 
      message: 'VAPID public key nije konfigurisan',
      error: error.message 
    });
  }
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
        message: 'Nema push subscription. Otvori Notification Settings da se pretplatiš.'
      });
    }

    const { sendPushNotification } = require('../utils/pushNotifications');

    const testPayload = {
      title: 'Test Push Notifikacija 🧪',
      body: 'Ovo je test push notifikacija! Ako vidiš ovo, sve radi!',
      url: '/',
      image: '/icons/icon-192.png'
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

// Get matches created by the current player
router.get('/my-matches/created', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu videti svoje mečeve' });
    }

    const matches = await Match.find({ createdBy: user._id })
      .populate('fieldId', 'name sport lat lng')
      .populate('createdBy', 'name avatarUrl')
      .populate('players', 'name avatarUrl reliabilityScore ratingAvg sportSkillLevels')
      .sort({ dateTime: -1 }); // Sort by date, newest first

    res.json(matches);
  } catch (e) {
    console.error('Error fetching created matches:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get matches where the current player has joined
router.get('/my-matches/joined', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu videti svoje mečeve' });
    }

    const matches = await Match.find({
      players: { $in: [user._id] },
      createdBy: { $ne: user._id } // Exclude matches they created (those are in the other endpoint)
    })
      .populate('fieldId', 'name sport lat lng')
      .populate('createdBy', 'name avatarUrl')
      .populate('players', 'name avatarUrl reliabilityScore ratingAvg sportSkillLevels')
      .sort({ dateTime: -1 }); // Sort by date, newest first

    res.json(matches);
  } catch (e) {
    console.error('Error fetching joined matches:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Upload avatar image to Cloudinary
router.post('/upload-avatar', auth(true), upload.single('avatar'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Nijedna slika nije poslata' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ message: 'Cloudinary nije konfigurisan' });
    }

    // Upload to Cloudinary
    const publicId = `user-${user._id}-${Date.now()}`;
    const cloudinaryUrl = await uploadImageBuffer(
      req.file.buffer,
      'avatars',
      publicId
    );

    if (!cloudinaryUrl) {
      return res.status(500).json({ message: 'Greška pri upload-u slike' });
    }

    // Update user avatarUrl
    user.avatarUrl = cloudinaryUrl;
    await user.save();

    res.json({
      message: 'Slika profila je uspešno ažurirana',
      avatarUrl: cloudinaryUrl
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      message: 'Greška pri upload-u slike',
      error: error.message
    });
  }
});

// Get all unique players who joined matches created by the current user
router.get('/my-players', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu videti svoje igrače' });
    }

    // Find all matches created by this user where players joined
    const matches = await Match.find({
      createdBy: user._id,
      players: { $exists: true, $not: { $size: 0 } } // Matches with at least one player
    }).populate('players', '_id name email avatarUrl experience preferredSports reliabilityScore');

    // Extract unique players
    const uniquePlayers = new Map();
    
    matches.forEach(match => {
      match.players.forEach(player => {
        if (player._id.toString() !== user._id.toString()) {
          // Don't include the creator themselves
          if (!uniquePlayers.has(player._id.toString())) {
            uniquePlayers.set(player._id.toString(), {
              ...player.toObject(),
              matchesJoined: 1,
              matches: [{
                _id: match._id,
                sport: match.sport,
                dateTime: match.dateTime,
                fieldName: match.fieldId?.name || 'Nepoznat teren'
              }]
            });
          } else {
            // Player already exists, increment count and add match
            const existing = uniquePlayers.get(player._id.toString());
            existing.matchesJoined++;
            existing.matches.push({
              _id: match._id,
              sport: match.sport,
              dateTime: match.dateTime,
              fieldName: match.fieldId?.name || 'Nepoznat teren'
            });
          }
        }
      });
    });

    // Convert map to array and sort by number of matches joined (descending)
    const playersList = Array.from(uniquePlayers.values()).sort((a, b) => b.matchesJoined - a.matchesJoined);

    res.json(playersList);
  } catch (e) {
    console.error('Error fetching my players:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get blocked players list
router.get('/blocked-players', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('blockedPlayers', '_id name email avatarUrl');
    
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    res.json(user.blockedPlayers || []);
  } catch (e) {
    console.error('Error fetching blocked players:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Block a player
router.post('/block-player/:playerId', auth(true), async (req, res) => {
  try {
    const { playerId } = req.params;
    
    // Validate that the player exists
    const playerToBlock = await User.findById(playerId);
    if (!playerToBlock) {
      return res.status(404).json({ message: 'Igrač nije pronađen' });
    }

    // Prevent blocking yourself
    if (playerId === req.user.id) {
      return res.status(400).json({ message: 'Ne možete blokirati sebe' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    // Initialize blockedPlayers array if it doesn't exist
    if (!user.blockedPlayers) {
      user.blockedPlayers = [];
    }

    // Check if already blocked
    if (user.blockedPlayers.includes(playerId)) {
      return res.status(400).json({ message: 'Igrač je već blokiran' });
    }

    // Add player to blocked list
    user.blockedPlayers.push(playerId);
    await user.save();

    res.json({ message: 'Igrač je uspešno blokiran', blockedPlayers: user.blockedPlayers });
  } catch (e) {
    console.error('Error blocking player:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Unblock a player
router.delete('/block-player/:playerId', auth(true), async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    // Check if player is in blocked list
    if (!user.blockedPlayers || !user.blockedPlayers.includes(playerId)) {
      return res.status(400).json({ message: 'Igrač nije blokiran' });
    }

    // Remove player from blocked list
    user.blockedPlayers = user.blockedPlayers.filter(id => id.toString() !== playerId);
    await user.save();

    res.json({ message: 'Igrač je uspešno odblokiran', blockedPlayers: user.blockedPlayers });
  } catch (e) {
    console.error('Error unblocking player:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Check if current user is blocked by a specific user
router.get('/is-blocked-by/:userId', auth(true), async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    const isBlocked = user.blockedPlayers && user.blockedPlayers.includes(req.user.id);
    
    res.json({ isBlocked });
  } catch (e) {
    console.error('Error checking blocked status:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

module.exports = router;
