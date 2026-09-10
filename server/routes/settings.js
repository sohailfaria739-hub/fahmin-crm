const express = require('express');
const db = require('../db');
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

function ensureRow(userId, fallbackName) {
  let row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare(
      'INSERT INTO settings (user_id, workspace_name, currency, timezone, desktop_notifications, followup_reminders, compact_cards, hot_lead_alerts, missed_contact_alerts, ai_assistant_enabled, updated_at) VALUES (?,?,?,?,1,1,0,1,1,1,?)'
    ).run(userId, fallbackName || 'My Workspace', 'PKR', 'Asia/Karachi', nowISO());
    row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  }
  return row;
}

router.get('/settings', (req, res) => {
  const user = db.prepare('SELECT name, agency FROM users WHERE id = ?').get(req.userId);
  const row = ensureRow(req.userId, user?.agency || (user?.name ? user.name + "'s Workspace" : null));
  res.json(mapSettings(row));
});

router.put('/settings', (req, res) => {
  const existing = ensureRow(req.userId);
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
  db.prepare(`UPDATE settings SET workspace_name=?, currency=?, timezone=?, desktop_notifications=?, followup_reminders=?, compact_cards=?, hot_lead_alerts=?, missed_contact_alerts=?, ai_assistant_enabled=?, updated_at=? WHERE user_id=?`)
    .run(f.workspaceName || null, f.currency, f.timezone, f.desktopNotifications, f.followupReminders, f.compactCards, f.hotLeadAlerts, f.missedContactAlerts, f.aiAssistantEnabled, nowISO(), req.userId);
  const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.userId);
  res.json(mapSettings(row));
});

module.exports = router;
