const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, writeBatch } = require("firebase/firestore");

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

async function cleanup() {
    console.log("--- STARTING ACADEMIC DATA CLEANUP ---");

    const collections = ['academic_subjects', 'academic_grades', 'academic_matrices'];

    for (const collName of collections) {
        console.log(`Cleaning collection: ${collName}...`);
        const snap = await getDocs(collection(db, collName));
        const batch = writeBatch(db);
        let count = 0;

        snap.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
            console.log(`  Deleted ${count} documents.`);
        } else {
            console.log(`  Collection already empty.`);
        }
    }

    console.log("--- CLEANUP FINISHED ---");
}

cleanup().catch(console.error);
