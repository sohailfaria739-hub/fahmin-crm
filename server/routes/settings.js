const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const nowISO = () => new Date().toISOString();

const mapSettings = r => ({
  workspaceName: r.workspace_name,
  currency: r.currency,
  timezone: r.timezone,
  desktopNotifications: !!r.desktop_notifications,
  followupReminders: !!r.followup_reminders,
  compactCards: !!r.compact_cards,
  hotLeadAlerts: !!r.hot_lead_alerts,
  missedContactAlerts: !!r.missed_contact_alerts,
  aiAssistantEnabled: !!r.ai_assistant_enabled,
});

async function ensureRow(userId, fallbackName) {
  const docRef = db.collection('settings').doc(userId);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    const defaultSettings = {
      user_id: userId,
      workspace_name: fallbackName || 'My Workspace',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      desktop_notifications: 1,
      followup_reminders: 1,
      compact_cards: 0,
      hot_lead_alerts: 1,
      missed_contact_alerts: 1,
      ai_assistant_enabled: 1,
      updated_at: nowISO()
    };
    await docRef.set(defaultSettings);
    const newDoc = await docRef.get();
    return newDoc.data();
  }
  return doc.data();
}

router.get('/settings', async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.userId).get();
    const user = userDoc.exists ? userDoc.data() : null;
    
    const fallback = user?.agency || (user?.name ? user.name + "'s Workspace" : null);
    const row = await ensureRow(req.userId, fallback);
    res.json(mapSettings(row));
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const docRef = db.collection('settings').doc(req.userId);
    const existing = await ensureRow(req.userId);

    const f = {
      workspaceName: req.body.workspaceName ?? existing.workspace_name,
      currency: req.body.currency ?? existing.currency,
      timezone: req.body.timezone ?? existing.timezone,
      desktopNotifications: req.body.desktopNotifications !== undefined ? (req.body.desktopNotifications ? 1 : 0) : existing.desktop_notifications,
      followupReminders: req.body.followupReminders !== undefined ? (req.body.followupReminders ? 1 : 0) : existing.followup_reminders,
      compactCards: req.body.compactCards !== undefined ? (req.body.compactCards ? 1 : 0) : existing.compact_cards,
      hotLeadAlerts: req.body.hotLeadAlerts !== undefined ? (req.body.hotLeadAlerts ? 1 : 0) : existing.hot_lead_alerts,
      missedContactAlerts: req.body.missedContactAlerts !== undefined ? (req.body.missedContactAlerts ? 1 : 0) : existing.missed_contact_alerts,
      aiAssistantEnabled: req.body.aiAssistantEnabled !== undefined ? (req.body.aiAssistantEnabled ? 1 : 0) : existing.ai_assistant_enabled,
    };

    const updateData = {
      workspace_name: f.workspaceName || null,
      currency: f.currency,
      timezone: f.timezone,
      desktop_notifications: f.desktopNotifications,
      followup_reminders: f.followupReminders,
      compact_cards: f.compactCards,
      hot_lead_alerts: f.hotLeadAlerts,
      missed_contact_alerts: f.missedContactAlerts,
      ai_assistant_enabled: f.aiAssistantEnabled,
      updated_at: nowISO()
    };

    await docRef.update(updateData);
    const updatedDoc = await docRef.get();
    res.json(mapSettings(updatedDoc.data()));
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;