const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const { uploadImageFromUrl } = require('../utils/cloudinary');
const auth = require('../middleware/auth');
const { getOAuthCallbackUrl } = require('../publicUrl');
const {
  isEmailVerified,
  hashVerificationToken,
  issueAndSendVerificationEmail,
  RESEND_COOLDOWN_MS,
} = require('../utils/emailVerification');

const router = express.Router();

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Configure Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: getOAuthCallbackUrl(null, 'google'),
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ 
        $or: [
          { email: profile.emails[0].value },
          { provider: 'google', providerId: profile.id }
        ]
      });

      if (user) {
        // Update existing user with OAuth data
        if (user.provider !== 'google' || user.providerId !== profile.id) {
          user.provider = 'google';
          user.providerId = profile.id;
          user.providerData = { accessToken, refreshToken };
        }
        // Update avatar if not set or if new one is available
        if (!user.avatarUrl && profile.photos && profile.photos[0]) {
          // Upload to Cloudinary if Cloudinary is configured
          if (process.env.CLOUDINARY_CLOUD_NAME) {
            try {
              const cloudinaryUrl = await uploadImageFromUrl(
                profile.photos[0].value,
                'avatars',
                `user-${user._id}`
              );
              user.avatarUrl = cloudinaryUrl;
            } catch (error) {
              console.error('Error uploading avatar to Cloudinary:', error);
              user.avatarUrl = profile.photos[0].value; // Fallback to original URL
            }
          } else {
            user.avatarUrl = profile.photos[0].value;
          }
        }
        // Update name if not set
        if (!user.name || user.name.trim() === '') {
          user.name = profile.displayName || profile.name.givenName + ' ' + profile.name.familyName;
        }
        if (!user.emailVerified) {
          user.emailVerified = true;
        }
        applyOAuthOnboarding(user, getOnboardingFromReq(req));
        await user.save();
        return done(null, user);
      }

      // Create new user with all available profile data
      const onboarding = getOnboardingFromReq(req);
      const { sanitizeGameIds } = require('../constants/games');
      let avatarUrl = null;
      if (profile.photos && profile.photos[0]) {
        // Upload to Cloudinary if Cloudinary is configured
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            avatarUrl = await uploadImageFromUrl(
              profile.photos[0].value,
              'avatars',
              `user-google-${profile.id}`
            );
          } catch (error) {
            console.error('Error uploading avatar to Cloudinary:', error);
            avatarUrl = profile.photos[0].value; // Fallback to original URL
          }
        } else {
          avatarUrl = profile.photos[0].value;
        }
      }

      user = await User.create({
        name: profile.displayName || (profile.name ? profile.name.givenName + ' ' + profile.name.familyName : 'User'),
        email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
        emailVerified: true,
        provider: 'google',
        providerId: profile.id,
        providerData: { 
          accessToken, 
          refreshToken,
          displayName: profile.displayName,
          name: profile.name,
          emails: profile.emails
        },
        avatarUrl: avatarUrl,
        role: onboarding.role === 'court' ? 'court' : 'player',
        preferredSports: sanitizeGameIds(onboarding.preferredSports),
      });
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Configure Facebook OAuth Strategy (redirect flow)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use('facebook', new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: getOAuthCallbackUrl(null, 'facebook'),
    profileFields: ['id', 'displayName', 'email', 'picture', 'first_name', 'last_name'],
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      // Try to get email from profile, if not available, fetch from Graph API
      let email = null;
      if (profile.emails && profile.emails[0] && profile.emails[0].value) {
        email = profile.emails[0].value;
      } else {
        // Try to get email from Facebook Graph API
        try {
          const fbResponse = await axios.get(`https://graph.facebook.com/v18.0/me`, {
            params: {
              access_token: accessToken,
              fields: 'email'
            }
          });
          if (fbResponse.data && fbResponse.data.email) {
            email = fbResponse.data.email;
          }
        } catch (graphError) {
          console.log('Could not fetch email from Graph API:', graphError.message);
        }
      }
      
      // Use email or fallback to Facebook ID
      const userEmail = email || `${profile.id}@facebook.com`;
      
      let user = await User.findOne({ 
        $or: [
          { email: userEmail !== `${profile.id}@facebook.com` ? userEmail : null },
          { provider: 'facebook', providerId: profile.id }
        ]
      });

      if (user) {
        // Update existing user with OAuth data
        if (user.provider !== 'facebook' || user.providerId !== profile.id) {
          user.provider = 'facebook';
          user.providerId = profile.id;
          user.providerData = { accessToken, refreshToken };
        }
        // Update email if we have a real email and user doesn't have one
        if (email && (!user.email || user.email.includes('@facebook.com') || user.email.includes('@instagram.com'))) {
          user.email = email;
        }
        if (!user.emailVerified) {
          user.emailVerified = true;
        }
        // Update avatar if not set
        if (!user.avatarUrl && profile.photos && profile.photos[0]) {
          // Upload to Cloudinary if Cloudinary is configured
          if (process.env.CLOUDINARY_CLOUD_NAME) {
            try {
              const cloudinaryUrl = await uploadImageFromUrl(
                profile.photos[0].value,
                'avatars',
                `user-${user._id}`
              );
              user.avatarUrl = cloudinaryUrl;
            } catch (error) {
              console.error('Error uploading avatar to Cloudinary:', error);
              user.avatarUrl = profile.photos[0].value; // Fallback to original URL
            }
          } else {
            user.avatarUrl = profile.photos[0].value;
          }
        }
        // Update name if not set
        if (!user.name || user.name.trim() === '') {
          user.name = profile.displayName || (profile.name ? profile.name.givenName + ' ' + profile.name.familyName : 'User');
        }
        applyOAuthOnboarding(user, getOnboardingFromReq(req));
        await user.save();
        return done(null, user);
      }

      // Create new user with all available profile data
      let avatarUrl = null;
      if (profile.photos && profile.photos[0]) {
        // Upload to Cloudinary if Cloudinary is configured
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            avatarUrl = await uploadImageFromUrl(
              profile.photos[0].value,
              'avatars',
              `user-facebook-${profile.id}`
            );
          } catch (error) {
            console.error('Error uploading avatar to Cloudinary:', error);
            avatarUrl = profile.photos[0].value; // Fallback to original URL
          }
        } else {
          avatarUrl = profile.photos[0].value;
        }
      }

      user = await User.create({
        name: profile.displayName || (profile.name ? profile.name.givenName + ' ' + profile.name.familyName : 'User'),
        email: userEmail,
        emailVerified: true,
        provider: 'facebook',
        providerId: profile.id,
        providerData: { 
          accessToken, 
          refreshToken,
          displayName: profile.displayName,
          name: profile.name
        },
        avatarUrl: avatarUrl,
        role: getOnboardingFromReq(req).role === 'court' ? 'court' : 'player',
        preferredSports: require('../constants/games').sanitizeGameIds(
          getOnboardingFromReq(req).preferredSports
        ),
      });

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}
function parseOAuthState(state) {
  const result = { role: null, preferredSports: [] };
  if (!state || typeof state !== 'string') return result;

  let parsed = null;
  try {
    parsed = JSON.parse(state);
  } catch {
    try {
      parsed = JSON.parse(decodeURIComponent(state));
    } catch (e) {
      console.error('Error parsing OAuth state:', e);
      return result;
    }
  }

  if (parsed.role === 'player' || parsed.role === 'court') {
    result.role = parsed.role;
  }
  if (Array.isArray(parsed.preferredSports)) {
    result.preferredSports = parsed.preferredSports;
  }
  return result;
}

function getOnboardingFromReq(req) {
  const fromQuery = parseOAuthState(req?.query?.state);
  const fromSession = {
    role: req?.session?.oauthRole || null,
    preferredSports: Array.isArray(req?.session?.oauthPreferredSports)
      ? req.session.oauthPreferredSports
      : [],
  };
  return {
    role: fromQuery.role || fromSession.role,
    preferredSports: fromQuery.preferredSports.length
      ? fromQuery.preferredSports
      : fromSession.preferredSports,
  };
}

/** Apply role + games from register wizard. Works for new users and unfinished onboarding. */
function applyOAuthOnboarding(user, onboarding) {
  const { sanitizeGameIds } = require('../constants/games');
  const sports = sanitizeGameIds(onboarding?.preferredSports);
  const role = onboarding?.role === 'player' || onboarding?.role === 'court' ? onboarding.role : null;
  if (!role && sports.length === 0) return false;

  const neverOnboarded = !Array.isArray(user.preferredSports) || user.preferredSports.length === 0;
  const createdRecently =
    user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 120000;

  if (!createdRecently && !neverOnboarded) return false;

  if (role) user.role = role;
  if (sports.length > 0) user.preferredSports = sports;
  return true;
}

function consumeOAuthOnboarding(req, user) {
  const onboarding = getOnboardingFromReq(req);
  if (req.session) {
    delete req.session.oauthRole;
    delete req.session.oauthPreferredSports;
  }
  return applyOAuthOnboarding(user, onboarding);
}

function setTokenCookie(res, userId) {
  const token = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '7d' }
  );

  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: isProduction,
  });
}


router.post('/register', async (req, res) => {
  try {
    const { name, email, password, avatarUrl, role, preferredSports, referredBy } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Nedostaju polja' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email je već u upotrebi' });
    const hashed = await bcrypt.hash(password, 10);

    const { sanitizeGameIds } = require('../constants/games');
    const sports = sanitizeGameIds(preferredSports);
    if (role !== 'player' && role !== 'court') {
      return res.status(400).json({ message: 'Izaberite da li ste igrač ili teren' });
    }
    const resolvedRole = role;

    if (sports.length === 0) {
      return res.status(400).json({
        message:
          resolvedRole === 'court'
            ? 'Izaberite kategorije i igre koje vaše mesto nudi'
            : 'Izaberite barem jednu igru',
      });
    }

    const createPayload = {
      name,
      email,
      password: hashed,
      avatarUrl,
      role: resolvedRole,
      provider: 'local',
      preferredSports: sports,
      emailVerified: false,
    };

    // Optional referral — store referrer; +2 credits granted on first completed match
    if (referredBy && mongoose.Types.ObjectId.isValid(String(referredBy))) {
      const referrer = await User.findById(referredBy).select('_id');
      if (referrer) {
        createPayload.referredBy = referrer._id;
      }
    }

    const user = await User.create(createPayload);

    // Prevent self-referral edge case (shouldn't happen on create, but guard if same id somehow)
    if (user.referredBy && user.referredBy.toString() === user._id.toString()) {
      user.referredBy = undefined;
      await user.save();
    }

    try {
      await issueAndSendVerificationEmail(user, req);
    } catch (emailError) {
      console.error('Verification email failed after register:', emailError.message);
    }
    
    // Generate token
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    
    // Set cookie before sending response
    setTokenCookie(res, user._id.toString());
    
    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      avatarUrl: user.avatarUrl,
      role: user.role,
      preferredSports: user.preferredSports || [],
      credits: user.credits ?? 3,
      xp: user.xp ?? 0,
      level: user.level ?? 1,
      emailVerified: false,
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
    
    // Check if user is OAuth user (no password)
    if (user.provider !== 'local' && !user.password) {
      return res.status(401).json({ 
        message: 'Ovaj nalog je povezan sa ' + user.provider + '. Molimo koristite ' + user.provider + ' prijavu.' 
      });
    }
    
    if (!user.password) {
      return res.status(401).json({ message: 'Neispravni podaci za prijavu' });
    }
    
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Neispravni podaci za prijavu' });
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    setTokenCookie(res, user._id.toString());
    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      avatarUrl: user.avatarUrl,
      role: user.role,
      preferredSports: user.preferredSports || [],
      notificationEnabled: user.notificationEnabled,
      notificationRadius: user.notificationRadius,
      emailVerified: isEmailVerified(user),
      provider: user.provider,
      token // Include token in response for localStorage
    });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ ok: true });
});

router.get('/me', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -emailVerifyTokenHash');
    if (!user) return res.status(404).json({ message: 'Korisnik nije pronađen' });
    if (!user.emailVerified && user.provider && user.provider !== 'local') {
      user.emailVerified = true;
      await user.save();
    }
    const payload = user.toObject();
    payload.emailVerified = isEmailVerified(user);
    res.json(payload);
  } catch (e) {
    res.status(401).json({ message: 'Nevažeći token' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      return res.status(400).json({ message: 'Nedostaje verifikacioni link' });
    }

    const tokenHash = hashVerificationToken(token);
    let user = await User.findOne({ emailVerifyTokenHash: tokenHash }).select('-password');

    if (!user) {
      return res.status(400).json({ message: 'Link je nevažeći ili je istekao' });
    }

    if (!user.emailVerified) {
      if (!user.emailVerifyExpires || user.emailVerifyExpires <= new Date()) {
        return res.status(400).json({ message: 'Link je nevažeći ili je istekao' });
      }
      await User.updateOne(
        { _id: user._id },
        { $set: { emailVerified: true }, $unset: { emailVerifyExpires: 1 } }
      );
      user.emailVerified = true;
    }

    setTokenCookie(res, user._id.toString());
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      preferredSports: user.preferredSports || [],
      emailVerified: true,
      provider: user.provider,
    });
  } catch (e) {
    console.error('Verify email error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/resend-verification', auth(true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Korisnik nije pronađen' });

    if (isEmailVerified(user)) {
      return res.status(400).json({
        message: 'Email je već potvrđen',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    if (user.emailVerifySentAt && Date.now() - new Date(user.emailVerifySentAt).getTime() < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - new Date(user.emailVerifySentAt).getTime())) / 1000
      );
      return res.status(429).json({
        message: `Sačekaj ${retryAfterSeconds}s pre ponovnog slanja`,
        retryAfterSeconds,
      });
    }

    await issueAndSendVerificationEmail(user, req);
    res.json({ ok: true, message: 'Verifikacioni link je poslat' });
  } catch (e) {
    console.error('Resend verification error:', e);
    if (e.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Slanje emaila nije podešeno. Pokušaj kasnije.' });
    }
    const brevoMessage = e.response?.data?.message;
    res.status(500).json({ message: brevoMessage || 'Slanje linka nije uspelo' });
  }
});

// Google OAuth routes
router.get('/google', (req, res, next) => {
  const onboarding = parseOAuthState(req.query.state);
  req.session.oauthRole = onboarding.role;
  req.session.oauthPreferredSports = onboarding.preferredSports;

  const callbackURL = getOAuthCallbackUrl(req, 'google');
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;

  req.session.save((err) => {
    if (err) console.error('OAuth session save failed:', err);
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      callbackURL,
      ...(state ? { state } : {}),
    })(req, res, next);
  });
});

router.get('/google/callback',
  (req, res, next) => {
    const callbackURL = getOAuthCallbackUrl(req, 'google');
    passport.authenticate('google', {
      session: true,
      failureRedirect: '/login?error=google_auth_failed',
      callbackURL,
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user;
      const isNewUser = consumeOAuthOnboarding(req, user);
      if (isNewUser) {
        await user.save();
      }

      setTokenCookie(res, user._id.toString());
      const newUserQuery = isNewUser ? '&newUser=1' : '';
      res.redirect(`/auth/callback?user=${encodeURIComponent(JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredSports: user.preferredSports || [],
        emailVerified: isEmailVerified(user),
        provider: user.provider,
      }))}${newUserQuery}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/login?error=oauth_failed');
    }
  }
);

// Facebook OAuth routes (redirect flow)
router.get('/facebook', (req, res, next) => {
  const onboarding = parseOAuthState(req.query.state);
  req.session.oauthRole = onboarding.role;
  req.session.oauthPreferredSports = onboarding.preferredSports;

  const callbackURL = getOAuthCallbackUrl(req, 'facebook');
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;

  req.session.save((err) => {
    if (err) console.error('OAuth session save failed:', err);
    passport.authenticate('facebook', {
      scope: ['public_profile'],
      callbackURL,
      ...(state ? { state } : {}),
    })(req, res, next);
  });
});

router.get('/facebook/callback',
  (req, res, next) => {
    const callbackURL = getOAuthCallbackUrl(req, 'facebook');
    passport.authenticate('facebook', {
      session: true,
      failureRedirect: '/login?error=facebook_auth_failed',
      callbackURL,
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user;
      const isNewUser = consumeOAuthOnboarding(req, user);
      if (isNewUser) {
        await user.save();
      }

      setTokenCookie(res, user._id.toString());
      const newUserQuery = isNewUser ? '&newUser=1' : '';
      res.redirect(`/auth/callback?user=${encodeURIComponent(JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredSports: user.preferredSports || [],
        emailVerified: isEmailVerified(user),
        provider: user.provider,
      }))}${newUserQuery}`);
    } catch (error) {
      console.error('Facebook OAuth callback error:', error);
      res.redirect('/login?error=oauth_failed');
    }
  }
);

// Instagram OAuth - uses Facebook token (Instagram Basic Display API requires Facebook login)
router.post('/instagram', async (req, res) => {
  try {
    const { accessToken, role } = req.body;
    if (!accessToken) {
      return res.status(400).json({ message: 'Instagram access token is required' });
    }

    const selectedRole = (role === 'player' || role === 'court') ? role : 'player';

    // Verify token with Instagram/Facebook
    // Instagram Basic Display API uses Facebook token
    const igResponse = await axios.get(`https://graph.instagram.com/me`, {
      params: {
        access_token: accessToken,
        fields: 'id,username'
      }
    });

    // Also get user info from Facebook with more fields
    const fbResponse = await axios.get(`https://graph.facebook.com/v18.0/me`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,email,picture,first_name,last_name'
      }
    });

    const igProfile = igResponse.data;
    const fbProfile = fbResponse.data;
    
    // Find or create user
    let user = await User.findOne({ 
      $or: [
        { email: fbProfile.email },
        { provider: 'instagram', providerId: igProfile.id }
      ]
    });

    if (user) {
      // Existing user - login (don't change role)
      // Update existing user with OAuth data
      if (user.provider !== 'instagram' || user.providerId !== igProfile.id) {
        user.provider = 'instagram';
        user.providerId = igProfile.id;
        user.providerData = { 
          accessToken, 
          username: igProfile.username,
          name: fbProfile.name,
          email: fbProfile.email
        };
      }
      // Update avatar if not set
      if (!user.avatarUrl && fbProfile.picture && fbProfile.picture.data) {
        // Upload to Cloudinary if Cloudinary is configured
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            const cloudinaryUrl = await uploadImageFromUrl(
              fbProfile.picture.data.url,
              'avatars',
              `user-${user._id}`
            );
            user.avatarUrl = cloudinaryUrl;
          } catch (error) {
            console.error('Error uploading avatar to Cloudinary:', error);
            user.avatarUrl = fbProfile.picture.data.url; // Fallback to original URL
          }
        } else {
          user.avatarUrl = fbProfile.picture.data.url;
        }
      }
      // Update name if not set
      if (!user.name || user.name.trim() === '') {
        user.name = fbProfile.name || igProfile.username || `${fbProfile.first_name || ''} ${fbProfile.last_name || ''}`.trim();
      }
      if (fbProfile.email && !user.emailVerified) {
        user.emailVerified = true;
      }
      await user.save();
    } else {
      // New user - registration (use role from request)
      let avatarUrl = null;
      if (fbProfile.picture && fbProfile.picture.data) {
        // Upload to Cloudinary if Cloudinary is configured
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            avatarUrl = await uploadImageFromUrl(
              fbProfile.picture.data.url,
              'avatars',
              `user-instagram-${igProfile.id}`
            );
          } catch (error) {
            console.error('Error uploading avatar to Cloudinary:', error);
            avatarUrl = fbProfile.picture.data.url; // Fallback to original URL
          }
        } else {
          avatarUrl = fbProfile.picture.data.url;
        }
      }

      user = await User.create({
        name: fbProfile.name || igProfile.username || `${fbProfile.first_name || ''} ${fbProfile.last_name || ''}`.trim() || 'User',
        email: fbProfile.email || `${igProfile.id}@instagram.com`,
        emailVerified: true,
        provider: 'instagram',
        providerId: igProfile.id,
        providerData: { 
          accessToken, 
          username: igProfile.username,
          name: fbProfile.name,
          email: fbProfile.email,
          first_name: fbProfile.first_name,
          last_name: fbProfile.last_name
        },
        avatarUrl: avatarUrl,
        role: selectedRole // Use role from request (only sent during registration)
      });
    }

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    setTokenCookie(res, user._id.toString());
    
    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: isEmailVerified(user),
      provider: user.provider,
      token
    });
  } catch (error) {
    console.error('Instagram OAuth error:', error);
    res.status(401).json({ message: 'Instagram authentication failed' });
  }
});

module.exports = router;


