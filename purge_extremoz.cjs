const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs, writeBatch } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function purgeUnit(unitId) {
    console.log(`PURGING ALL DATA FOR UNIT: ${unitId}`);
    const q = query(collection(db, "students"), where("unit", "==", unitId));
    const snap = await getDocs(q);

    if (snap.empty) {
        console.log("No data found to delete.");
        return;
    }

    console.log(`Found ${snap.size} documents to delete.`);
    let batch = writeBatch(db);
    let count = 0;
    let deleted = 0;

    for (const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        deleted++;
        if (count >= 400) {
            await batch.commit();
            console.log(`- Deleted batch of 400 (Total: ${deleted})`);
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) await batch.commit();
    console.log(`DONE. Total deleted: ${deleted}`);
}

purgeUnit('unit_ex');
