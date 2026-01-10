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

// Subscribe to push notifications (OneSignal or FCM)
router.post('/push-subscription', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    if (user.role !== 'player') {
      return res.status(403).json({ message: 'Samo igrači mogu se pretplatiti na notifikacije' });
    }

    const { provider, subscription } = req.body;
    
    if (!provider || !['onesignal', 'fcm'].includes(provider)) {
      return res.status(400).json({ message: 'Provider mora biti "onesignal" ili "fcm"' });
    }

    const updateData = {
      notificationProvider: provider
    };

    if (provider === 'onesignal') {
      // OneSignal: subscription should contain playerExternalId
      if (!subscription || !subscription.playerExternalId) {
        return res.status(400).json({ message: 'OneSignal subscription zahteva playerExternalId' });
      }
      updateData.oneSignalUserId = subscription.playerExternalId;
      // Clear FCM tokens when switching to OneSignal
      updateData.fcmTokens = [];
    } else if (provider === 'fcm') {
      // FCM: subscription should contain fcmToken
      if (!subscription || !subscription.fcmToken) {
        return res.status(400).json({ message: 'FCM subscription zahteva fcmToken' });
      }

      const deviceInfo = subscription.deviceInfo || {};
      const fcmTokenEntry = {
        token: subscription.fcmToken,
        deviceInfo: {
          userAgent: deviceInfo.userAgent || req.headers['user-agent'] || '',
          platform: deviceInfo.platform || 'web',
          language: deviceInfo.language || req.headers['accept-language'] || 'en'
        },
        createdAt: new Date(),
        lastSeenAt: new Date()
      };

      // Add or update FCM token (avoid duplicates)
      const existingTokens = user.fcmTokens || [];
      const tokenIndex = existingTokens.findIndex(t => t.token === subscription.fcmToken);
      
      if (tokenIndex >= 0) {
        // Update existing token using $set operator
        updateData[`fcmTokens.${tokenIndex}.lastSeenAt`] = new Date();
        if (deviceInfo.userAgent) {
          updateData[`fcmTokens.${tokenIndex}.deviceInfo`] = fcmTokenEntry.deviceInfo;
        }
      } else {
        // Add new token
        updateData.$push = { fcmTokens: fcmTokenEntry };
      }

      // Clear OneSignal userId when switching to FCM
      updateData.oneSignalUserId = null;
    }

    // Use findByIdAndUpdate to avoid triggering unique index validation issues
    const updateQuery = { $set: updateData };
    if (updateData.$push) {
      updateQuery.$push = updateData.$push;
      delete updateData.$push;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateQuery,
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    res.json({ 
      message: 'Push subscription sačuvana',
      provider: provider
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

    const { provider, fcmToken } = req.body;

    if (provider === 'fcm' && fcmToken) {
      // Remove specific FCM token
      await User.findByIdAndUpdate(
        req.user.id,
        { $pull: { fcmTokens: { token: fcmToken } } },
        { new: true }
      );
    } else {
      // Remove all notification subscriptions
      await User.findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            notificationProvider: null,
            oneSignalUserId: null
          },
          $unset: {
            fcmTokens: 1
          }
        },
        { new: true }
      );
    }

    res.json({ message: 'Push subscription uklonjena' });
  } catch (e) {
    console.error('Push unsubscribe error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// Get push notification provider and status
router.get('/push-subscription/status', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notificationProvider oneSignalUserId fcmTokens notificationEnabled');
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }

    const { getProvider } = require('../utils/pushNotifications');
    const activeProvider = getProvider();

    res.json({
      provider: user.notificationProvider,
      activeProvider: activeProvider,
      enabled: user.notificationEnabled !== false,
      oneSignalUserId: user.oneSignalUserId,
      fcmTokenCount: user.fcmTokens ? user.fcmTokens.length : 0
    });
  } catch (e) {
    console.error('Push subscription status error:', e);
    res.status(500).json({ message: 'Greška servera' });
  }
});

// DEPRECATED: Get VAPID public key (kept for backward compatibility, returns null)
router.get('/vapid-public-key', (req, res) => {
  console.warn('⚠️  /vapid-public-key endpoint is deprecated. VAPID is no longer supported.');
  res.status(410).json({ 
    message: 'VAPID is deprecated. Please use OneSignal or FCM.',
    deprecated: true
  });
});

// Test push notification endpoint (for testing purposes)
router.post('/test-push', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen' });
    }
    
    const { getProvider } = require('../utils/pushNotifications');
    const provider = getProvider();
    const { sendPushNotification } = require('../utils/pushNotifications');

    let subscription = null;

    if (provider === 'onesignal') {
      if (!user.oneSignalUserId) {
        return res.status(400).json({ 
          message: 'Nema OneSignal subscription. Otvori Notification Settings da se pretplatiš.' 
        });
      }
      subscription = { playerExternalId: user.oneSignalUserId };
    } else if (provider === 'fcm') {
      if (!user.fcmTokens || user.fcmTokens.length === 0) {
        return res.status(400).json({ 
          message: 'Nema FCM subscription. Otvori Notification Settings da se pretplatiš.' 
        });
      }
      subscription = { fcmToken: user.fcmTokens[0].token };
    } else {
      return res.status(500).json({ 
        message: 'Push notification provider nije konfigurisan' 
      });
    }

    const testPayload = {
      title: 'Test Push Notifikacija 🧪',
      body: 'Ovo je test push notifikacija! Ako vidiš ovo, sve radi!',
      url: '/',
      image: '/icons/icon-192.png'
    };

    await sendPushNotification(subscription, testPayload);
    
    res.json({ 
      message: 'Test push notifikacija je poslata!',
      success: true,
      provider: provider
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
