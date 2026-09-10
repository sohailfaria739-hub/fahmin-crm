require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const crmRoutes = require('./routes/crm');
const callsRoutes = require('./routes/calls');
const inboxRoutes = require('./routes/inbox');
const settingsRoutes = require('./routes/settings');
const assistantRoutes = require('./routes/assistant');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'fahmin-crm-api' }));

app.use('/api/auth', authRoutes);
app.use('/api', crmRoutes);
app.use('/api', callsRoutes);
app.use('/api', inboxRoutes);
app.use('/api', settingsRoutes);
app.use('/api', assistantRoutes);

// Serve the frontend
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Fahmin CRM server running at http://localhost:${PORT}`);
});
