const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { logActivity } = require('../activity');

const router = express.Router();
router.use(requireAuth);

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

const mapCall = doc => {
  const r = doc.data();
  return {
    id: doc.id,
    contactId: r.contact_id,
    phone: r.phone,
    scheduledAt: r.scheduled_at,
    notes: r.notes,
    status: r.status,
    createdAt: r.created_at,
  };
};

router.get('/calls', async (req, res) => {
  try {
    const snapshot = await db.collection('calls').where('user_id', '==', req.userId).get();
    const calls = snapshot.docs.map(mapCall).sort((a, b) => {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });
    res.json(calls);
  } catch (err) {
    console.error('Get calls error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/calls', async (req, res) => {
  try {
    const { contactId, phone, scheduledAt, notes } = req.body || {};
    if (!contactId) return res.status(400).json({ error: 'A lead is required' });

    const contactDoc = await db.collection('contacts').doc(contactId).get();
    if (!contactDoc.exists || contactDoc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const contact = contactDoc.data();

    const id = uid();
    const created_at = nowISO();
    const callData = {
      id,
      user_id: req.userId,
      contact_id: contactId,
      phone: phone || contact.phone || null,
      scheduled_at: scheduledAt || null,
      notes: notes || null,
      status: 'pending',
      created_at
    };

    await db.collection('calls').doc(id).set(callData);
    await logActivity(req.userId, 'call', `Call scheduled with ${contact.name}`, contactId);

    const newDoc = await db.collection('calls').doc(id).get();
    res.status(201).json(mapCall(newDoc));
  } catch (err) {
    console.error('Post call error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/calls/:id', async (req, res) => {
  try {
    const docRef = db.collection('calls').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Call not found' });
    }
    const existing = doc.data();

    const f = {
      phone: req.body.phone ?? existing.phone,
      scheduledAt: req.body.scheduledAt ?? existing.scheduled_at,
      notes: req.body.notes ?? existing.notes,
      status: req.body.status ?? existing.status,
    };

    const updateData = {
      phone: f.phone || null,
      scheduled_at: f.scheduledAt || null,
      notes: f.notes || null,
      status: f.status
    };

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    const updatedRow = updatedDoc.data();

    if (req.body.status === 'completed' && existing.status !== 'completed') {
      let contactName = '';
      const contactDoc = await db.collection('contacts').doc(updatedRow.contact_id).get();
      if (contactDoc.exists) {
        contactName = contactDoc.data().name;
      }
      await logActivity(req.userId, 'call', `Call completed${contactName ? ' with ' + contactName : ''}`, updatedRow.contact_id);
    }

    res.json(mapCall(updatedDoc));
  } catch (err) {
    console.error('Put call error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/calls/:id', async (req, res) => {
  try {
    const docRef = db.collection('calls').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Call not found' });
    }
    await docRef.delete();
    res.status(204).end();
  } catch (err) {
    console.error('Delete call error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;