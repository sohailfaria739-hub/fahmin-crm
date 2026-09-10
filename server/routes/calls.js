const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../auth');
const { logActivity } = require('../activity');

const router = express.Router();
router.use(requireAuth);

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

const mapCall = r => ({
  id: r.id,
  contactId: r.contact_id,
  phone: r.phone,
  scheduledAt: r.scheduled_at,
  notes: r.notes,
  status: r.status,
  createdAt: r.created_at,
});

router.get('/calls', (req, res) => {
  const rows = db.prepare('SELECT * FROM calls WHERE user_id = ? ORDER BY scheduled_at ASC').all(req.userId);
  res.json(rows.map(mapCall));
});

router.post('/calls', (req, res) => {
  const { contactId, phone, scheduledAt, notes } = req.body || {};
  if (!contactId) return res.status(400).json({ error: 'A lead is required' });
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(contactId, req.userId);
  if (!contact) return res.status(404).json({ error: 'Lead not found' });
  const id = uid();
  const created_at = nowISO();
  db.prepare(
    'INSERT INTO calls (id, user_id, contact_id, phone, scheduled_at, notes, status, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(id, req.userId, contactId, phone || contact.phone || null, scheduledAt || null, notes || null, 'pending', created_at);
  const row = db.prepare('SELECT * FROM calls WHERE id = ?').get(id);
  logActivity(req.userId, 'call', `Call scheduled with ${contact.name}`, contactId);
  res.status(201).json(mapCall(row));
});

router.put('/calls/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM calls WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Call not found' });
  const f = {
    phone: req.body.phone ?? existing.phone,
    scheduledAt: req.body.scheduledAt ?? existing.scheduled_at,
    notes: req.body.notes ?? existing.notes,
    status: req.body.status ?? existing.status,
  };
  db.prepare('UPDATE calls SET phone=?, scheduled_at=?, notes=?, status=? WHERE id=? AND user_id=?')
    .run(f.phone || null, f.scheduledAt || null, f.notes || null, f.status, req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (req.body.status === 'completed' && existing.status !== 'completed') {
    const contact = db.prepare('SELECT name FROM contacts WHERE id = ?').get(row.contact_id);
    logActivity(req.userId, 'call', `Call completed${contact ? ' with ' + contact.name : ''}`, row.contact_id);
  }
  res.json(mapCall(row));
});

router.delete('/calls/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM calls WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Call not found' });
  db.prepare('DELETE FROM calls WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.status(204).end();
});

module.exports = router;
