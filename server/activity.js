const crypto = require('crypto');
const db = require('./db');

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();

function logActivity(userId, type, message, contactId = null) {
  const id = uid();
  db.prepare(
    'INSERT INTO activities (id, user_id, type, message, contact_id, read, created_at) VALUES (?,?,?,?,?,0,?)'
  ).run(id, userId, type, message, contactId, nowISO());
  return id;
}

module.exports = { logActivity };
