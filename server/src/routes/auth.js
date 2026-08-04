const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Users = require('../db/queries/users');
const { authenticateWithAD } = require('../auth/ldap');
const authMiddleware = require('../middleware/auth');
const { seedGeneralChannel } = require('../db/seed');
const db = require('../db');
const { mapUser } = require('../db/mappers');

const router = express.Router();

async function subscribeToGeneral(userId, io) {
  const general = await db('channels').where('name', 'General').where('type', 'public').first();
  if (!general) return;
  const existing = await db('channel_members')
    .where({ channel_id: general.id, user_id: userId })
    .first();
  if (existing) return;
  await db('channel_members').insert({ channel_id: general.id, user_id: userId });
  console.log(`subscribeToGeneral: user ${userId} subscribed to General`);
  if (io) {
    const members = await db('channel_members')
      .join('users', 'users.id', 'channel_members.user_id')
      .where('channel_members.channel_id', general.id)
      .select('users.id', 'users.username', 'users.display_name', 'users.avatar', 'users.status');
    io.emit('channel-updated', { channelId: general.id, members, memberCount: members.length });
  }
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите имя пользователя и пароль' });
    }

    let user;
    try {
      const adUser = await authenticateWithAD(username, password);
      const existing = await Users.findByUsername(adUser.username);
      const emailToSave = (existing && existing.email) ? existing.email : (adUser.email || '');
      console.log('LOGIN DEBUG:', { username, existingEmail: existing?.email, adEmail: adUser.email, emailToSave, hasExisting: !!existing });
      user = await Users.upsertByUsername({
        username: adUser.username,
        display_name: adUser.displayName || adUser.username,
        email: emailToSave,
        ad_synced: true,
        last_seen: new Date()
      });
      console.log('LOGIN DEBUG after upsert:', { email: user.email });
    } catch (adError) {
      console.error('AD authentication failed:', adError.message);
      user = await Users.findByUsername(username);
      if (!user || !user.password) {
        return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      }

      user = await Users.updateById(user.id, { last_seen: new Date() });
    }

    await seedGeneralChannel();
    await subscribeToGeneral(user.id, req.app.get('io'));

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

    console.log('LOGIN RESPONSE:', { email: user.email, displayName: user.display_name });
    res.json({
      token,
      user: mapUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    const existingUser = await Users.findByUsernameOrEmail(username, email);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await Users.create({
      username,
      email: email || '',
      password: hashedPassword,
      display_name: displayName || username
    });

    await seedGeneralChannel();
    await subscribeToGeneral(user.id, req.app.get('io'));

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: mapUser(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: mapUser(req.user) });
});

router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await Users.findAllExcept(req.userId);
    res.json({ users: users.map(mapUser) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    await Users.updateById(req.userId, { status, last_seen: new Date() });
    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName, avatar, email } = req.body;
    console.log('PROFILE UPDATE:', { userId: req.userId, email });

    const update = {};
    if (displayName !== undefined) update.display_name = displayName;
    if (avatar !== undefined) update.avatar = avatar;
    if (email !== undefined) update.email = email;

    const updatedUser = await Users.updateById(req.userId, update);
    console.log('PROFILE UPDATE result:', { email: updatedUser.email });

    res.json({ user: mapUser(updatedUser) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
