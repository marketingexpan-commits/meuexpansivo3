
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    databaseURL: "https://meu-expansivo-app-default-rtdb.firebaseio.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateMessages() {
    console.log('Starting migration of schoolMessages (Client SDK)...');
    const messagesRef = collection(db, 'schoolMessages');
    const snapshot = await getDocs(messagesRef);

    let updatedCount = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const document of snapshot.docs) {
        const data = document.data();
        let updates = {};
        let needsUpdate = false;

        // Check if 'reply' exists and 'response' does not
        if (data.reply && !data.response) {
            updates.response = data.reply;
            needsUpdate = true;
        }

        // Check timestamp
        if (data.replyTimestamp && !data.responseTimestamp) {
            updates.responseTimestamp = data.replyTimestamp;
            needsUpdate = true;
        }

        if (needsUpdate) {
            batch.update(doc(db, 'schoolMessages', document.id), updates);
            batchCount++;
            updatedCount++;
        }

        if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
            console.log(`Committed batch of 400 updates...`);
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`Migration complete. Updated ${updatedCount} messages.`);
    process.exit(0);
}

migrateMessages().catch(error => {
    console.error(error);
    process.exit(1);
});
