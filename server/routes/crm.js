const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../auth');
const { logActivity } = require('../activity');

const router = express.Router();
router.use(requireAuth);

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

// ---- helpers to map snake_case rows -> camelCase API shape ----
const mapContact = r => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, status: r.status, budget: r.budget, source: r.source, notes: r.notes, createdAt: r.created_at });
const mapProperty = r => ({ id: r.id, title: r.title, address: r.address, type: r.type, price: r.price, status: r.status, beds: r.beds, baths: r.baths, area: r.area, notes: r.notes, createdAt: r.created_at });
const mapDeal = r => ({ id: r.id, contactId: r.contact_id, propertyId: r.property_id, stage: r.stage, value: r.value, notes: r.notes, createdAt: r.created_at });
const mapTask = r => ({ id: r.id, title: r.title, dueDate: r.due_date, contactId: r.contact_id, done: !!r.done, createdAt: r.created_at });
const mapActivity = r => ({ id: r.id, type: r.type, message: r.message, contactId: r.contact_id, read: !!r.read, createdAt: r.created_at });

// ============ CONTACTS ============
router.get('/contacts', (req, res) => {
  const rows = db.prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  res.json(rows.map(mapContact));
});

router.post('/contacts', (req, res) => {
  const { name, phone, email, status, budget, source, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = uid();
  const created_at = nowISO();
  db.prepare(
    'INSERT INTO contacts (id, user_id, name, phone, email, status, budget, source, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, req.userId, name.trim(), phone || null, email || null, status || 'New', budget || null, source || null, notes || null, created_at);
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  logActivity(req.userId, 'lead', `New lead added: ${row.name}`, id);
  res.status(201).json(mapContact(row));
});

router.put('/contacts/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });
  const f = { ...existing, ...req.body };
  db.prepare(
    'UPDATE contacts SET name=?, phone=?, email=?, status=?, budget=?, source=?, notes=? WHERE id=? AND user_id=?'
  ).run(f.name, f.phone || null, f.email || null, f.status || 'New', f.budget || null, f.source || null, f.notes || null, req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(mapContact(row));
});

router.delete('/contacts/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });
  db.prepare('DELETE FROM deals WHERE contact_id = ? AND user_id = ?').run(req.params.id, req.userId);
  db.prepare('DELETE FROM tasks WHERE contact_id = ? AND user_id = ?').run(req.params.id, req.userId);
  db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.status(204).end();
});

// ============ PROPERTIES ============
router.get('/properties', (req, res) => {
  const rows = db.prepare('SELECT * FROM properties WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  res.json(rows.map(mapProperty));
});

router.post('/properties', (req, res) => {
  const { title, address, type, price, status, beds, baths, area, notes } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const id = uid();
  const created_at = nowISO();
  db.prepare(
    'INSERT INTO properties (id, user_id, title, address, type, price, status, beds, baths, area, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(id, req.userId, title.trim(), address || null, type || 'House', price || null, status || 'Available', beds || null, baths || null, area || null, notes || null, created_at);
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  logActivity(req.userId, 'property', `New listing added: ${row.title}`);
  res.status(201).json(mapProperty(row));
});

router.put('/properties/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM properties WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Listing not found' });
  const f = { ...existing, ...req.body };
  db.prepare(
    'UPDATE properties SET title=?, address=?, type=?, price=?, status=?, beds=?, baths=?, area=?, notes=? WHERE id=? AND user_id=?'
  ).run(f.title, f.address || null, f.type || 'House', f.price || null, f.status || 'Available', f.beds || null, f.baths || null, f.area || null, f.notes || null, req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json(mapProperty(row));
});

router.delete('/properties/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM properties WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Listing not found' });
  db.prepare('DELETE FROM deals WHERE property_id = ? AND user_id = ?').run(req.params.id, req.userId);
  db.prepare('DELETE FROM properties WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.status(204).end();
});

// ============ DEALS ============
router.get('/deals', (req, res) => {
  const rows = db.prepare('SELECT * FROM deals WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  res.json(rows.map(mapDeal));
});

router.post('/deals', (req, res) => {
  const { contactId, propertyId, stage, value, notes } = req.body || {};
  if (!contactId || !propertyId) return res.status(400).json({ error: 'Contact and property are required' });
  const id = uid();
  const created_at = nowISO();
  db.prepare(
    'INSERT INTO deals (id, user_id, contact_id, property_id, stage, value, notes, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(id, req.userId, contactId, propertyId, stage || 'New Lead', value || null, notes || null, created_at);
  const row = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  const contact = db.prepare('SELECT name FROM contacts WHERE id = ?').get(contactId);
  logActivity(req.userId, 'deal', `New deal opened${contact ? ' with ' + contact.name : ''}`, contactId);
  res.status(201).json(mapDeal(row));
});

router.put('/deals/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM deals WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });
  const f = { contactId: req.body.contactId ?? existing.contact_id, propertyId: req.body.propertyId ?? existing.property_id, stage: req.body.stage ?? existing.stage, value: req.body.value ?? existing.value, notes: req.body.notes ?? existing.notes };
  db.prepare(
    'UPDATE deals SET contact_id=?, property_id=?, stage=?, value=?, notes=? WHERE id=? AND user_id=?'
  ).run(f.contactId, f.propertyId, f.stage, f.value || null, f.notes || null, req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (req.body.stage && req.body.stage !== existing.stage) {
    const contact = db.prepare('SELECT name FROM contacts WHERE id = ?').get(row.contact_id);
    logActivity(req.userId, 'deal', `${contact ? contact.name : 'A deal'} moved to "${row.stage}"`, row.contact_id);
  }
  res.json(mapDeal(row));
});

router.delete('/deals/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM deals WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });
  db.prepare('DELETE FROM deals WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.status(204).end();
});

// ============ TASKS ============
router.get('/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC').all(req.userId);
  res.json(rows.map(mapTask));
});

router.post('/tasks', (req, res) => {
  const { title, dueDate, contactId } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required' });
  const id = uid();
  const created_at = nowISO();
  db.prepare(
    'INSERT INTO tasks (id, user_id, title, due_date, contact_id, done, created_at) VALUES (?,?,?,?,?,0,?)'
  ).run(id, req.userId, title.trim(), dueDate || null, contactId || null, created_at);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(mapTask(row));
});

router.put('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const f = {
    title: req.body.title ?? existing.title,
    dueDate: req.body.dueDate ?? existing.due_date,
    contactId: req.body.contactId ?? existing.contact_id,
    done: req.body.done !== undefined ? (req.body.done ? 1 : 0) : existing.done,
  };
  db.prepare('UPDATE tasks SET title=?, due_date=?, contact_id=?, done=? WHERE id=? AND user_id=?')
    .run(f.title, f.dueDate || null, f.contactId || null, f.done, req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (req.body.done !== undefined && f.done && !existing.done) {
    logActivity(req.userId, 'task', `Task completed: ${row.title}`, row.contact_id);
  }
  res.json(mapTask(row));
});

router.delete('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.status(204).end();
});

// ============ MESSAGES / ACTIVITY FEED ============
router.get('/activities', (req, res) => {
  const rows = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(rows.map(mapActivity));
});

router.put('/activities/:id/read', (req, res) => {
  const existing = db.prepare('SELECT id FROM activities WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Message not found' });
  db.prepare('UPDATE activities SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  res.json(mapActivity(row));
});

router.put('/activities/read-all', (req, res) => {
  db.prepare('UPDATE activities SET read = 1 WHERE user_id = ?').run(req.userId);
  res.json({ ok: true });
});

router.delete('/activities/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM activities WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Message not found' });
  db.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.status(204).end();
});

// ============ BULK (one round trip for initial app load) ============
router.get('/all', (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at ASC').all(req.userId).map(mapContact);
  const properties = db.prepare('SELECT * FROM properties WHERE user_id = ? ORDER BY created_at ASC').all(req.userId).map(mapProperty);
  const deals = db.prepare('SELECT * FROM deals WHERE user_id = ? ORDER BY created_at ASC').all(req.userId).map(mapDeal);
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC').all(req.userId).map(mapTask);
  const activities = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC').all(req.userId).map(mapActivity);
  const calls = db.prepare('SELECT * FROM calls WHERE user_id = ? ORDER BY scheduled_at ASC').all(req.userId).map(r => ({
    id: r.id, contactId: r.contact_id, phone: r.phone, scheduledAt: r.scheduled_at, notes: r.notes, status: r.status, createdAt: r.created_at,
  }));
  const conversations = db.prepare(`
    SELECT c.id as contact_id, c.name as contact_name,
           m.body as last_body, m.sender as last_sender, m.created_at as last_at,
           (SELECT COUNT(*) FROM conversation_messages WHERE contact_id = c.id AND user_id = ? AND read = 0) as unread
    FROM contacts c
    JOIN conversation_messages m ON m.id = (
      SELECT id FROM conversation_messages WHERE contact_id = c.id AND user_id = ? ORDER BY created_at DESC LIMIT 1
    )
    WHERE c.user_id = ?
    ORDER BY m.created_at DESC
  `).all(req.userId, req.userId, req.userId).map(r => ({
    contactId: r.contact_id, contactName: r.contact_name, lastMessage: r.last_body, lastSender: r.last_sender, lastAt: r.last_at, unread: r.unread,
  }));
  res.json({ contacts, properties, deals, tasks, activities, calls, conversations });
});

module.exports = router;
