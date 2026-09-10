const crypto = require('crypto');
const db = require('./db');

const uid = () => crypto.randomBytes(12).toString('hex');
const nowISO = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);

function seedForUser(userId) {
  const c1 = uid(), c2 = uid(), c3 = uid(), c4 = uid(), c5 = uid();
  const p1 = uid(), p2 = uid(), p3 = uid(), p4 = uid();
  const now = nowISO();
  const today = todayISO();

  const insertContact = db.prepare(
    'INSERT INTO contacts (id, user_id, name, phone, email, status, budget, source, notes, created_at) VALUES (@id,@user_id,@name,@phone,@email,@status,@budget,@source,@notes,@created_at)'
  );
  const insertProperty = db.prepare(
    'INSERT INTO properties (id, user_id, title, address, type, price, status, beds, baths, area, notes, created_at) VALUES (@id,@user_id,@title,@address,@type,@price,@status,@beds,@baths,@area,@notes,@created_at)'
  );
  const insertDeal = db.prepare(
    'INSERT INTO deals (id, user_id, contact_id, property_id, stage, value, notes, created_at) VALUES (@id,@user_id,@contact_id,@property_id,@stage,@value,@notes,@created_at)'
  );
  const insertTask = db.prepare(
    'INSERT INTO tasks (id, user_id, title, due_date, contact_id, done, created_at) VALUES (@id,@user_id,@title,@due_date,@contact_id,@done,@created_at)'
  );
  const insertCall = db.prepare(
    'INSERT INTO calls (id, user_id, contact_id, phone, scheduled_at, notes, status, created_at) VALUES (@id,@user_id,@contact_id,@phone,@scheduled_at,@notes,@status,@created_at)'
  );
  const insertMessage = db.prepare(
    'INSERT INTO conversation_messages (id, user_id, contact_id, sender, body, read, created_at) VALUES (@id,@user_id,@contact_id,@sender,@body,@read,@created_at)'
  );

  const contacts = [
    { id: c1, user_id: userId, name: 'Amina Sheikh', phone: '0300-1234567', email: 'amina@example.com', status: 'Qualified', budget: 25000000, source: 'Referral', notes: '1-kanal DHA Phase 6', created_at: now },
    { id: c2, user_id: userId, name: 'Bilal Raza', phone: '0321-9876543', email: 'bilal@example.com', status: 'Contacted', budget: 8000000, source: 'Facebook', notes: 'First-time buyer, financing', created_at: now },
    { id: c3, user_id: userId, name: 'Sana Tariq', phone: '0333-4455667', email: 'sana@example.com', status: 'New', budget: 15000000, source: 'Walk-in', notes: 'Looking for apartment', created_at: now },
    { id: c4, user_id: userId, name: 'Usman Farooq', phone: '0345-1122334', email: 'usman@example.com', status: 'Nurturing', budget: 40000000, source: 'Website', notes: 'Commercial plaza', created_at: now },
    { id: c5, user_id: userId, name: 'Fatima Noor', phone: '0311-9988776', email: 'fatima@example.com', status: 'New', budget: 12000000, source: 'Instagram', notes: 'Investment property', created_at: now },
  ];
  const properties = [
    { id: p1, user_id: userId, title: '1 Kanal Modern House', address: 'Block H, DHA Phase 6, Lahore', type: 'House', price: 26500000, status: 'Available', beds: 5, baths: 6, area: '1 Kanal', notes: 'Corner plot, renovated', created_at: now },
    { id: p2, user_id: userId, title: '3 Bed Apartment', address: 'Bahria Town, Lahore', type: 'Apartment', price: 8200000, status: 'Under Offer', beds: 3, baths: 3, area: '1800 sqft', notes: 'Club house view', created_at: now },
    { id: p3, user_id: userId, title: '8 Marla Commercial Plot', address: 'Main Blvd, Gulberg, Lahore', type: 'Commercial', price: 42000000, status: 'Available', beds: 0, baths: 0, area: '8 Marla', notes: 'High footfall', created_at: now },
    { id: p4, user_id: userId, title: '4 Bed Luxury Villa', address: 'Sector Z, DHA Phase 8, Lahore', type: 'House', price: 55000000, status: 'Available', beds: 4, baths: 5, area: '1.5 Kanal', notes: 'Smart home', created_at: now },
  ];
  const deals = [
    { id: uid(), user_id: userId, contact_id: c1, property_id: p1, stage: 'Negotiation', value: 26000000, notes: 'Price negotiation ongoing', created_at: now },
    { id: uid(), user_id: userId, contact_id: c2, property_id: p2, stage: 'Viewing', value: 8200000, notes: 'Second viewing scheduled', created_at: now },
    { id: uid(), user_id: userId, contact_id: c4, property_id: p3, stage: 'New Lead', value: 42000000, notes: 'Initial interest', created_at: now },
    { id: uid(), user_id: userId, contact_id: c5, property_id: p4, stage: 'Offer Made', value: 53000000, notes: 'Offer submitted', created_at: now },
  ];
  const tasks = [
    { id: uid(), user_id: userId, title: 'Call Amina about final offer', due_date: today, contact_id: c1, done: 0, created_at: now },
    { id: uid(), user_id: userId, title: 'Send Bilal financing options', due_date: today, contact_id: c2, done: 0, created_at: now },
    { id: uid(), user_id: userId, title: 'Follow up with Sana on requirements', due_date: today, contact_id: c3, done: 0, created_at: now },
    { id: uid(), user_id: userId, title: 'Prepare commercial comparison for Usman', due_date: today, contact_id: c4, done: 1, created_at: now },
  ];

  const calls = [
    { id: uid(), user_id: userId, contact_id: c1, phone: '0300-1234567', scheduled_at: today + 'T15:30', notes: 'Discuss final offer on DHA Phase 6 house', status: 'pending', created_at: now },
    { id: uid(), user_id: userId, contact_id: c3, phone: '0333-4455667', scheduled_at: today + 'T11:00', notes: 'Understand apartment requirements', status: 'pending', created_at: now },
  ];
  const messages = [
    { id: uid(), user_id: userId, contact_id: c2, sender: 'lead', body: "Hi, I'm interested in the 3 bed apartment in Bahria Town.", read: 0, created_at: now },
    { id: uid(), user_id: userId, contact_id: c2, sender: 'agent', body: 'Hi Bilal! Thanks for reaching out — would you like to book a viewing this week?', read: 1, created_at: now },
    { id: uid(), user_id: userId, contact_id: c5, sender: 'lead', body: 'Is the investment property still available?', read: 0, created_at: now },
  ];

  const tx = db.transaction(() => {
    contacts.forEach(c => insertContact.run(c));
    properties.forEach(p => insertProperty.run(p));
    deals.forEach(d => insertDeal.run(d));
    tasks.forEach(t => insertTask.run(t));
    calls.forEach(c => insertCall.run(c));
    messages.forEach(m => insertMessage.run(m));
  });
  tx();
}

module.exports = { seedForUser };
