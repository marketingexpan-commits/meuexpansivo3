const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function findStudent() {
    const snapshot = await db.collection('students').get();

    console.log('Searching for Thiago Quintiliano...');

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.toLowerCase().includes('thiago quintiliano')) {
            console.log(`FOUND: ${data.name} | ID: ${doc.id} | Code: ${data.code} | Unit: ${data.unit}`);
        }
    });
}

findStudent().catch(console.error);
