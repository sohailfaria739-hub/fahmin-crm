const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: 'AQ.Ab8RN6ICZMnvyyWvJmkk-_bnDlZFZqryTuZS' });

function buildContext(userId) {
  const contacts = db.prepare('SELECT * FROM contacts WHERE user_id = ?').all(userId);
  const deals = db.prepare('SELECT * FROM deals WHERE user_id = ?').all(userId);
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? AND done = 0').all(userId);
  const calls = db.prepare("SELECT * FROM calls WHERE user_id = ? AND status = 'pending'").all(userId);

  const contactName = (id) => contacts.find(c => c.id === id)?.name || 'Unknown lead';
  const hot = contacts.filter(c => c.status === 'Qualified' || c.status === 'Contacted');
  const nurturing = contacts.filter(c => c.status === 'Nurturing');
  const newLeads = contacts.filter(c => c.status === 'New');

  const lines = [];
  lines.push(`Total leads: ${contacts.length}`);
  lines.push(`Lead breakdown: ${['New', 'Contacted', 'Qualified', 'Nurturing', 'Lost'].map(s => `${s}: ${contacts.filter(c => c.status === s).length}`).join(', ')}`);
  lines.push('');
  lines.push('Hot / high-priority leads (Contacted or Qualified):');
  hot.slice(0, 15).forEach(c => lines.push(`- ${c.name} (${c.status}, budget ${c.budget || 'n/a'}, source ${c.source || 'n/a'})${c.notes ? ' — ' + c.notes : ''}`));
  if (!hot.length) lines.push('- none right now');
  lines.push('');
  lines.push('Open pipeline deals:');
  deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').slice(0, 15).forEach(d => lines.push(`- ${contactName(d.contact_id)}: stage "${d.stage}", value ${d.value || 'n/a'}`));
  lines.push('');
  lines.push('Pending tasks / follow-ups:');
  tasks.slice(0, 15).forEach(t => lines.push(`- ${t.title} (due ${t.due_date || 'no date'}, lead: ${t.contact_id ? contactName(t.contact_id) : 'n/a'})`));
  if (!tasks.length) lines.push('- none pending');
  lines.push('');
  lines.push('Pending scheduled calls:');
  calls.slice(0, 15).forEach(c => lines.push(`- ${contactName(c.contact_id)} at ${c.scheduled_at || 'unscheduled'}${c.notes ? ' — ' + c.notes : ''}`));
  if (!calls.length) lines.push('- none pending');

  return lines.join('\n');
}

router.post('/assistant/ask', async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'A message is required' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'AI Assistant is not configured yet. Set GEMINI_API_KEY in server/.env and restart the server.',
    });
  }

  const context = buildContext(req.userId);
  const system = `You are the AI Sales Copilot inside Fahmin, a real estate CRM. You help the agent by analyzing their leads, pipeline, tasks and calls, prioritizing hot prospects, and drafting short follow-up messages when asked. Be concise (a few sentences or a short list), practical, and specific — reference lead names and numbers from the data below rather than speaking generically. If the data doesn't contain what's needed to answer, say so plainly.

Current CRM data snapshot:
${context}`;

  try {
    const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: [
    { role: 'user', parts: [{ text: system }, { text: message.trim() }] }
  ]
});

    const reply = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) || "I couldn't come up with a response — try rephrasing that.";

    res.json({ reply });
  } catch (err) {
    console.error('Gemini API error:', err);
    res.status(502).json({ error: 'The AI assistant is temporarily unavailable. Please try again.' });
  }
});

module.exports = router;