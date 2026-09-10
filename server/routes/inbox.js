const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

const mapMessage = r => ({ id: r.id, contactId: r.contact_id, sender: r.sender, body: r.body, read: !!r.read, createdAt: r.created_at });

// List one row per lead that has at least one message, newest activity first
router.get('/conversations', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id as contact_id, c.name as contact_name,
           m.body as last_body, m.sender as last_sender, m.created_at as last_at,
           (SELECT COUNT(*) FROM conversation_messages WHERE contact_id = c.id AND user_id = ? AND read = 0) as unread
    FROM contacts c
    JOIN conversation_messages m ON m.id = (
      SELECT id FROM conversation_messages WHERE contact_id = c.id AND user_id = ? ORDER BY created_at DESC LIMIT 1
    )
    WHERE c.user_id = ?
    ORDER BY m.created_at DESC
  `).all(req.userId, req.userId, req.userId);
  res.json(rows.map(r => ({
    contactId: r.contact_id,
    contactName: r.contact_name,
    lastMessage: r.last_body,
    lastSender: r.last_sender,
    lastAt: r.last_at,
    unread: r.unread,
  })));
});

router.get('/conversations/:contactId', (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(req.params.contactId, req.userId);
  if (!contact) return res.status(404).json({ error: 'Lead not found' });
  const rows = db.prepare('SELECT * FROM conversation_messages WHERE contact_id = ? AND user_id = ? ORDER BY created_at ASC').all(req.params.contactId, req.userId);
  // Opening the thread marks incoming messages as read
  db.prepare("UPDATE conversation_messages SET read = 1 WHERE contact_id = ? AND user_id = ? AND read = 0").run(req.params.contactId, req.userId);
  res.json(rows.map(mapMessage));
});

router.post('/conversations/:contactId', (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(req.params.contactId, req.userId);
  if (!contact) return res.status(404).json({ error: 'Lead not found' });
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
  const id = uid();
  const created_at = nowISO();
  db.prepare(
    'INSERT INTO conversation_messages (id, user_id, contact_id, sender, body, read, created_at) VALUES (?,?,?,?,?,1,?)'
  ).run(id, req.userId, req.params.contactId, 'agent', body.trim(), created_at);
  const row = db.prepare('SELECT * FROM conversation_messages WHERE id = ?').get(id);
  res.status(201).json(mapMessage(row));
});

module.exports = router;
