const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const axios = require('axios');
const User = require('../models/User');

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
  const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:5050';
  console.log("1"+backendUrl);
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${backendUrl}/api/auth/google/callback`;
  console.log("2"+callbackUrl);
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackUrl
  },
  async (accessToken, refreshToken, profile, done) => {
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
          user.avatarUrl = profile.photos[0].value;
        }
        // Update name if not set
        if (!user.name || user.name.trim() === '') {
          user.name = profile.displayName || profile.name.givenName + ' ' + profile.name.familyName;
        }
        await user.save();
        return done(null, user);
      }

      // Create new user with all available profile data
      // Role will be set in callback from session
      user = await User.create({
        name: profile.displayName || (profile.name ? profile.name.givenName + ' ' + profile.name.familyName : 'User'),
        email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
        provider: 'google',
        providerId: profile.id,
        providerData: { 
          accessToken, 
          refreshToken,
          displayName: profile.displayName,
          name: profile.name,
          emails: profile.emails
        },
        avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        role: 'player' // Default, will be updated in callback if session has role
      });
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Configure Facebook OAuth Strategy (redirect flow)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:5050';
  const callbackUrl = process.env.FACEBOOK_CALLBACK_URL || `${backendUrl}/api/auth/facebook/callback`;
  
  passport.use('facebook', new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: callbackUrl,
    profileFields: ['id', 'displayName', 'email', 'picture', 'first_name', 'last_name']
  },
  async (accessToken, refreshToken, profile, done) => {
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
        // Update avatar if not set
        if (!user.avatarUrl && profile.photos && profile.photos[0]) {
          user.avatarUrl = profile.photos[0].value;
        }
        // Update name if not set
        if (!user.name || user.name.trim() === '') {
          user.name = profile.displayName || (profile.name ? profile.name.givenName + ' ' + profile.name.familyName : 'User');
        }
        await user.save();
        return done(null, user);
      }

      // Create new user with all available profile data
      user = await User.create({
        name: profile.displayName || (profile.name ? profile.name.givenName + ' ' + profile.name.familyName : 'User'),
        email: userEmail,
        provider: 'facebook',
        providerId: profile.id,
        providerData: { 
          accessToken, 
          refreshToken,
          displayName: profile.displayName,
          name: profile.name
        },
        avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        role: 'player' // Default, will be updated in callback if session has role
      });

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

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
      role: role || 'player',
      provider: 'local'
    });
    
    // Generate token
    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    
    // Set cookie before sending response
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

// Google OAuth routes
router.get('/google', (req, res, next) => {
  // Get role from state parameter
  const state = req.query.state;
  let role = 'player'; // default
  
  if (state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      if (stateData.role && (stateData.role === 'player' || stateData.role === 'court')) {
        role = stateData.role;
      }
    } catch (e) {
      console.error('Error parsing state:', e);
    }
  }
  
  // Store role in session for use in callback
  req.session.oauthRole = role;
  
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { session: true, failureRedirect: '/login?error=google_auth_failed' }),
  async (req, res) => {
    try {
      const user = req.user;
      // Get role from session if available (only set during registration)
      const role = req.session?.oauthRole;
      delete req.session?.oauthRole;
      console.log(1);
      
      // Only update role for new users (registration)
      // Check if user was just created (has default role 'player' and role exists in session)
      // OR check if user was created within last 5 seconds (new user)
      const userCreatedRecently = (Date.now() - new Date(user.createdAt).getTime()) < 5000;
      const hasDefaultRole = user.role === 'player' || !user.role;
      console.log(2);
      if (role && (role === 'player' || role === 'court') && (userCreatedRecently || hasDefaultRole)) {
        // This is a new user (registration), set the role
        user.role = role;
        await user.save();
      }
      console.log(3);
      // If role doesn't exist in session or user is not new, keep existing role (login)
      
      const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      setTokenCookie(res, user._id.toString(), req);
      console.log(4);
      // Redirect to frontend with token
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000' || 'https://playmatch-1.onrender.com';
      console.log("3"+frontendUrl);
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role
      }))}`);
      console.log(5);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      console.log(enc);
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000' || 'https://playmatch-1.onrender.com';
      console.log(6);
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      console.log(7);
    }
  }
);

// Facebook OAuth routes (redirect flow)
router.get('/facebook', (req, res, next) => {
  // Get role from state parameter
  const state = req.query.state;
  let role = 'player'; // default
  
  if (state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      if (stateData.role && (stateData.role === 'player' || stateData.role === 'court')) {
        role = stateData.role;
      }
    } catch (e) {
      console.error('Error parsing state:', e);
    }
  }
  
  // Store role in session for use in callback
  req.session.oauthRole = role;
  
  // Only request public_profile scope - email is requested via profileFields
  passport.authenticate('facebook', { scope: ['public_profile'] })(req, res, next);
});

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: true, failureRedirect: '/login?error=facebook_auth_failed' }),
  async (req, res) => {
    try {
      const user = req.user;
      // Get role from session if available (only set during registration)
      const role = req.session?.oauthRole;
      delete req.session?.oauthRole;
      
      // Only update role for new users (registration)
      // Check if user was just created (has default role 'player' or was created within last 5 seconds)
      const userCreatedRecently = (Date.now() - new Date(user.createdAt).getTime()) < 5000;
      const hasDefaultRole = user.role === 'player' || !user.role;
      
      if (role && (role === 'player' || role === 'court') && (userCreatedRecently || hasDefaultRole)) {
        // This is a new user (registration), set the role
        user.role = role;
        await user.save();
      }
      // If role doesn't exist in session or user is not new, keep existing role (login)
      
      const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      setTokenCookie(res, user._id.toString(), req);
      
      // Redirect to frontend with token
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role
      }))}`);
    } catch (error) {
      console.error('Facebook OAuth callback error:', error);
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
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
        user.avatarUrl = fbProfile.picture.data.url;
      }
      // Update name if not set
      if (!user.name || user.name.trim() === '') {
        user.name = fbProfile.name || igProfile.username || `${fbProfile.first_name || ''} ${fbProfile.last_name || ''}`.trim();
      }
      await user.save();
    } else {
      // New user - registration (use role from request)
      user = await User.create({
        name: fbProfile.name || igProfile.username || `${fbProfile.first_name || ''} ${fbProfile.last_name || ''}`.trim() || 'User',
        email: fbProfile.email || `${igProfile.id}@instagram.com`,
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
        avatarUrl: fbProfile.picture && fbProfile.picture.data ? fbProfile.picture.data.url : null,
        role: selectedRole // Use role from request (only sent during registration)
      });
    }

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    setTokenCookie(res, user._id.toString(), req);
    
    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      avatarUrl: user.avatarUrl,
      role: user.role,
      token
    });
  } catch (error) {
    console.error('Instagram OAuth error:', error);
    res.status(401).json({ message: 'Instagram authentication failed' });
  }
});

module.exports = router;


