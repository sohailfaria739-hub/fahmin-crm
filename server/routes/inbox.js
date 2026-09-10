const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

const mapMessage = doc => {
  const r = doc.data();
  return {
    id: doc.id,
    contactId: r.contact_id,
    sender: r.sender,
    body: r.body,
    read: !!r.read,
    createdAt: r.created_at
  };
};

router.get('/conversations', async (req, res) => {
  try {
    const [contactsSnap, messagesSnap] = await Promise.all([
      db.collection('contacts').where('user_id', '==', req.userId).get(),
      db.collection('conversation_messages').where('user_id', '==', req.userId).get()
    ]);

    const contacts = contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const contactMap = new Map(contacts.map(c => [c.id, c.name]));
    const messagesByContact = {};

    messages.forEach(m => {
      if (!messagesByContact[m.contact_id]) {
        messagesByContact[m.contact_id] = [];
      }
      messagesByContact[m.contact_id].push(m);
    });

    const conversations = [];
    for (const [contactId, msgs] of Object.entries(messagesByContact)) {
      if (!contactMap.has(contactId)) continue;
      msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastMsg = msgs[0];
      const unreadCount = msgs.filter(m => m.read === 0).length;

      conversations.push({
        contactId,
        contactName: contactMap.get(contactId),
        lastMessage: lastMsg.body,
        lastSender: lastMsg.sender,
        lastAt: lastMsg.created_at,
        unread: unreadCount,
      });
    }

    conversations.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
    res.json(conversations);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/conversations/:contactId', async (req, res) => {
  try {
    const contactDoc = await db.collection('contacts').doc(req.params.contactId).get();
    if (!contactDoc.exists || contactDoc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const messagesSnap = await db.collection('conversation_messages')
      .where('contact_id', '==', req.params.contactId)
      .where('user_id', '==', req.userId)
      .get();

    const messages = messagesSnap.docs.map(mapMessage).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const batch = db.batch();
    let hasUnread = false;
    messagesSnap.docs.forEach(doc => {
      if (doc.data().read === 0) {
        batch.update(doc.ref, { read: 1 });
        hasUnread = true;
      }
    });
    if (hasUnread) {
      await batch.commit();
    }

    res.json(messages);
  } catch (err) {
    console.error('Get conversation messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/conversations/:contactId', async (req, res) => {
  try {
    const contactDoc = await db.collection('contacts').doc(req.params.contactId).get();
    if (!contactDoc.exists || contactDoc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { body } = req.body || {};
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

    const id = uid();
    const created_at = nowISO();
    const messageData = {
      id,
      user_id: req.userId,
      contact_id: req.params.contactId,
      sender: 'agent',
      body: body.trim(),
      read: 1,
      created_at
    };

    await db.collection('conversation_messages').doc(id).set(messageData);
    const newDoc = await db.collection('conversation_messages').doc(id).get();
    res.status(201).json(mapMessage(newDoc));
  } catch (err) {
    console.error('Post message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;