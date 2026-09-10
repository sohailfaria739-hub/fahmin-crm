const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { signToken, requireAuth } = require('../auth');
const { seedForUser } = require('../seed');

const router = express.Router();
const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, agency: u.agency || null, createdAt: u.createdAt || u.created_at };
}

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, agency } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const normalizedEmail = email.toLowerCase().trim();
    const existingSnapshot = await db.collection('users').where('email', '==', normalizedEmail).get();
    if (!existingSnapshot.empty) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const id = uid();
    const password_hash = bcrypt.hashSync(password, 10);
    const userData = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      password_hash,
      agency: agency ? agency.trim() : null,
      created_at: nowISO()
    };

    await db.collection('users').doc(id).set(userData);

    // Seed a fresh account with sample CRM data
    seedForUser(id);

    const token = signToken(userData);
    res.status(201).json({ token, user: publicUser(userData) });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const snapshot = await db.collection('users').where('email', '==', normalizedEmail).get();
    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.userId).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(doc.data()) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, agency } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const updateData = {
      name: name.trim(),
      agency: agency ? agency.trim() : null
    };

    await db.collection('users').doc(req.userId).update(updateData);

    const doc = await db.collection('users').doc(req.userId).get();
    res.json({ user: publicUser(doc.data()) });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const doc = await db.collection('users').doc(req.userId).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });

    const user = doc.data();
    const ok = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const password_hash = bcrypt.hashSync(newPassword, 10);
    await db.collection('users').doc(req.userId).update({ password_hash });

    res.json({ ok: true });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;