const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');
const { seedForUser } = require('../seed');

const router = express.Router();
const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, agency: u.agency || null, createdAt: u.created_at };
}

router.post('/signup', (req, res) => {
  const { name, email, password, agency } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const id = uid();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, agency, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name.trim(), email.toLowerCase().trim(), password_hash, agency ? agency.trim() : null, nowISO());

  // Seed a fresh account with sample CRM data so the dashboard isn't empty
  seedForUser(id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

router.put('/profile', requireAuth, (req, res) => {
  const { name, agency } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE users SET name = ?, agency = ? WHERE id = ?').run(name.trim(), agency ? agency.trim() : null, req.userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: publicUser(user) });
});

router.put('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
  const password_hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, req.userId);
  res.json({ ok: true });
});

module.exports = router;
