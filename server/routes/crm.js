const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { logActivity } = require('../activity');

const router = express.Router();
router.use(requireAuth);

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

// ---- helpers to map Firestore docs -> API shape ----
const mapContact = doc => {
  const r = doc.data();
  return { id: doc.id, name: r.name, phone: r.phone, email: r.email, status: r.status, budget: r.budget, source: r.source, notes: r.notes, createdAt: r.created_at };
};
const mapProperty = doc => {
  const r = doc.data();
  return { id: doc.id, title: r.title, address: r.address, type: r.type, price: r.price, status: r.status, beds: r.beds, baths: r.baths, area: r.area, notes: r.notes, createdAt: r.created_at };
};
const mapDeal = doc => {
  const r = doc.data();
  return { id: doc.id, contactId: r.contact_id, propertyId: r.property_id, stage: r.stage, value: r.value, notes: r.notes, createdAt: r.created_at };
};
const mapTask = doc => {
  const r = doc.data();
  return { id: doc.id, title: r.title, dueDate: r.due_date, contactId: r.contact_id, done: !!r.done, createdAt: r.created_at };
};
const mapActivity = doc => {
  const r = doc.data();
  return { id: doc.id, type: r.type, message: r.message, contactId: r.contact_id, read: !!r.read, createdAt: r.created_at };
};

// ============ CONTACTS ============
router.get('/contacts', async (req, res) => {
  try {
    const snapshot = await db.collection('contacts').where('user_id', '==', req.userId).get();
    const contacts = snapshot.docs.map(mapContact).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(contacts);
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const { name, phone, email, status, budget, source, notes } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const id = uid();
    const created_at = nowISO();
    const contactData = {
      id,
      user_id: req.userId,
      name: name.trim(),
      phone: phone || null,
      email: email || null,
      status: status || 'New',
      budget: budget || null,
      source: source || null,
      notes: notes || null,
      created_at
    };
    await db.collection('contacts').doc(id).set(contactData);
    await logActivity(req.userId, 'lead', `New lead added: ${contactData.name}`, id);
    res.status(201).json({
      id,
      name: contactData.name,
      phone: contactData.phone,
      email: contactData.email,
      status: contactData.status,
      budget: contactData.budget,
      source: contactData.source,
      notes: contactData.notes,
      createdAt: contactData.created_at
    });
  } catch (err) {
    console.error('Post contact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const docRef = db.collection('contacts').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const existing = doc.data();
    const f = { ...existing, ...req.body };
    const updateData = {
      name: f.name,
      phone: f.phone || null,
      email: f.email || null,
      status: f.status || 'New',
      budget: f.budget || null,
      source: f.source || null,
      notes: f.notes || null
    };
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.json(mapContact(updatedDoc));
  } catch (err) {
    console.error('Put contact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    const docRef = db.collection('contacts').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const dealsSnap = await db.collection('deals').where('contact_id', '==', req.params.id).where('user_id', '==', req.userId).get();
    const batch = db.batch();
    dealsSnap.docs.forEach(d => batch.delete(d.ref));

    const tasksSnap = await db.collection('tasks').where('contact_id', '==', req.params.id).where('user_id', '==', req.userId).get();
    tasksSnap.docs.forEach(t => batch.delete(t.ref));

    batch.delete(docRef);
    await batch.commit();

    res.status(204).end();
  } catch (err) {
    console.error('Delete contact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PROPERTIES ============
router.get('/properties', async (req, res) => {
  try {
    const snapshot = await db.collection('properties').where('user_id', '==', req.userId).get();
    const properties = snapshot.docs.map(mapProperty).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(properties);
  } catch (err) {
    console.error('Get properties error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/properties', async (req, res) => {
  try {
    const { title, address, type, price, status, beds, baths, area, notes } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const id = uid();
    const created_at = nowISO();
    const propData = {
      id,
      user_id: req.userId,
      title: title.trim(),
      address: address || null,
      type: type || 'House',
      price: price || null,
      status: status || 'Available',
      beds: beds || null,
      baths: baths || null,
      area: area || null,
      notes: notes || null,
      created_at
    };
    await db.collection('properties').doc(id).set(propData);
    await logActivity(req.userId, 'property', `New listing added: ${propData.title}`);
    res.status(201).json({
      id,
      title: propData.title,
      address: propData.address,
      type: propData.type,
      price: propData.price,
      status: propData.status,
      beds: propData.beds,
      baths: propData.baths,
      area: propData.area,
      notes: propData.notes,
      createdAt: propData.created_at
    });
  } catch (err) {
    console.error('Post property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/properties/:id', async (req, res) => {
  try {
    const docRef = db.collection('properties').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const existing = doc.data();
    const f = { ...existing, ...req.body };
    const updateData = {
      title: f.title,
      address: f.address || null,
      type: f.type || 'House',
      price: f.price || null,
      status: f.status || 'Available',
      beds: f.beds || null,
      baths: f.baths || null,
      area: f.area || null,
      notes: f.notes || null
    };
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.json(mapProperty(updatedDoc));
  } catch (err) {
    console.error('Put property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/properties/:id', async (req, res) => {
  try {
    const docRef = db.collection('properties').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const dealsSnap = await db.collection('deals').where('property_id', '==', req.params.id).where('user_id', '==', req.userId).get();
    const batch = db.batch();
    dealsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(docRef);
    await batch.commit();

    res.status(204).end();
  } catch (err) {
    console.error('Delete property error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ DEALS ============
router.get('/deals', async (req, res) => {
  try {
    const snapshot = await db.collection('deals').where('user_id', '==', req.userId).get();
    const deals = snapshot.docs.map(mapDeal).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json(deals);
  } catch (err) {
    console.error('Get deals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/deals', async (req, res) => {
  try {
    const { contactId, propertyId, stage, value, notes } = req.body || {};
    if (!contactId || !propertyId) return res.status(400).json({ error: 'Contact and property are required' });
    const id = uid();
    const created_at = nowISO();
    const dealData = {
      id,
      user_id: req.userId,
      contact_id: contactId,
      property_id: propertyId,
      stage: stage || 'New Lead',
      value: value || null,
      notes: notes || null,
      created_at
    };
    await db.collection('deals').doc(id).set(dealData);

    let contactName = '';
    const contactDoc = await db.collection('contacts').doc(contactId).get();
    if (contactDoc.exists) {
      contactName = contactDoc.data().name;
    }
    await logActivity(req.userId, 'deal', `New deal opened${contactName ? ' with ' + contactName : ''}`, contactId);
    res.status(201).json({
      id,
      contactId: dealData.contact_id,
      propertyId: dealData.property_id,
      stage: dealData.stage,
      value: dealData.value,
      notes: dealData.notes,
      createdAt: dealData.created_at
    });
  } catch (err) {
    console.error('Post deal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/deals/:id', async (req, res) => {
  try {
    const docRef = db.collection('deals').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    const existing = doc.data();
    const f = {
      contactId: req.body.contactId ?? existing.contact_id,
      propertyId: req.body.propertyId ?? existing.property_id,
      stage: req.body.stage ?? existing.stage,
      value: req.body.value ?? existing.value,
      notes: req.body.notes ?? existing.notes
    };
    const updateData = {
      contact_id: f.contactId,
      property_id: f.propertyId,
      stage: f.stage,
      value: f.value || null,
      notes: f.notes || null
    };
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    const updatedRow = updatedDoc.data();

    if (req.body.stage && req.body.stage !== existing.stage) {
      let contactName = 'A deal';
      const contactDoc = await db.collection('contacts').doc(updatedRow.contact_id).get();
      if (contactDoc.exists) {
        contactName = contactDoc.data().name;
      }
      await logActivity(req.userId, 'deal', `${contactName} moved to "${updatedRow.stage}"`, updatedRow.contact_id);
    }
    res.json(mapDeal(updatedDoc));
  } catch (err) {
    console.error('Put deal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/deals/:id', async (req, res) => {
  try {
    const docRef = db.collection('deals').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    await docRef.delete();
    res.status(204).end();
  } catch (err) {
    console.error('Delete deal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ TASKS ============
router.get('/tasks', async (req, res) => {
  try {
    const snapshot = await db.collection('tasks').where('user_id', '==', req.userId).get();
    const tasks = snapshot.docs.map(mapTask).sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { title, dueDate, contactId } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required' });
    const id = uid();
    const created_at = nowISO();
    const taskData = {
      id,
      user_id: req.userId,
      title: title.trim(),
      due_date: dueDate || null,
      contact_id: contactId || null,
      done: 0,
      created_at
    };
    await db.collection('tasks').doc(id).set(taskData);
    res.status(201).json({
      id,
      title: taskData.title,
      dueDate: taskData.due_date,
      contactId: taskData.contact_id,
      done: false,
      createdAt: taskData.created_at
    });
  } catch (err) {
    console.error('Post task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const docRef = db.collection('tasks').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const existing = doc.data();
    const newDone = req.body.done !== undefined ? (req.body.done ? 1 : 0) : existing.done;
    const f = {
      title: req.body.title ?? existing.title,
      dueDate: req.body.dueDate ?? existing.due_date,
      contactId: req.body.contactId ?? existing.contact_id,
      done: newDone
    };
    const updateData = {
      title: f.title,
      due_date: f.dueDate || null,
      contact_id: f.contactId || null,
      done: f.done
    };
    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    const updatedRow = updatedDoc.data();

    if (req.body.done !== undefined && f.done && !existing.done) {
      await logActivity(req.userId, 'task', `Task completed: ${updatedRow.title}`, updatedRow.contact_id);
    }
    res.json(mapTask(updatedDoc));
  } catch (err) {
    console.error('Put task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    const docRef = db.collection('tasks').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await docRef.delete();
    res.status(204).end();
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ MESSAGES / ACTIVITY FEED ============
router.get('/activities', async (req, res) => {
  try {
    const snapshot = await db.collection('activities').where('user_id', '==', req.userId).get();
    const activities = snapshot.docs.map(mapActivity).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(activities);
  } catch (err) {
    console.error('Get activities error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/activities/:id/read', async (req, res) => {
  try {
    const docRef = db.collection('activities').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    await docRef.update({ read: 1 });
    const updatedDoc = await docRef.get();
    res.json(mapActivity(updatedDoc));
  } catch (err) {
    console.error('Activity read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/activities/read-all', async (req, res) => {
  try {
    const snapshot = await db.collection('activities').where('user_id', '==', req.userId).get();
    const batch = db.batch();
    snapshot.docs.forEach(d => batch.update(d.ref, { read: 1 }));
    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    console.error('Read all activities error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/activities/:id', async (req, res) => {
  try {
    const docRef = db.collection('activities').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.userId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    await docRef.delete();
    res.status(204).end();
  } catch (err) {
    console.error('Delete activity error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ BULK (one round trip for initial app load) ============
router.get('/all', async (req, res) => {
  try {
    const [contactsSnap, propertiesSnap, dealsSnap, tasksSnap, activitiesSnap, callsSnap, messagesSnap] = await Promise.all([
      db.collection('contacts').where('user_id', '==', req.userId).get(),
      db.collection('properties').where('user_id', '==', req.userId).get(),
      db.collection('deals').where('user_id', '==', req.userId).get(),
      db.collection('tasks').where('user_id', '==', req.userId).get(),
      db.collection('activities').where('user_id', '==', req.userId).get(),
      db.collection('calls').where('user_id', '==', req.userId).get(),
      db.collection('conversation_messages').where('user_id', '==', req.userId).get()
    ]);

    const contacts = contactsSnap.docs.map(mapContact).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const properties = propertiesSnap.docs.map(mapProperty).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const deals = dealsSnap.docs.map(mapDeal).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const tasks = tasksSnap.docs.map(mapTask).sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    const activities = activitiesSnap.docs.map(mapActivity).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const calls = callsSnap.docs.map(doc => {
      const r = doc.data();
      return {
        id: doc.id,
        contactId: r.contact_id,
        phone: r.phone,
        scheduledAt: r.scheduled_at,
        notes: r.notes,
        status: r.status,
        createdAt: r.created_at
      };
    }).sort((a, b) => {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });

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
        unread: unreadCount
      });
    }
    conversations.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

    res.json({ contacts, properties, deals, tasks, activities, calls, conversations });
  } catch (err) {
    console.error('Get all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;