const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;

try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/^"|"$/g, '')
    ?.replace(/\\n/g, '\n');

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey
        })
      });

  db = getFirestore(app);

  console.log('Firestore connected successfully!');
} catch (error) {
  console.error('CRITICAL DB ERROR:', error.message);
}

module.exports = { db };