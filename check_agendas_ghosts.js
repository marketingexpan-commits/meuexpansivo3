import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

const GHOST_IDS = ["ZDLHk7z94IX8dS3ysBVW", "W9wsEMSR2kOtKZmT3nCt", "W9wsEMSR22kOtKZmT3nCt"];

async function checkMore() {
    const collections = ["daily_agendas", "exam_guides"];

    for (const col of collections) {
        console.log(`Checking ${col}...`);
        const snap = await getDocs(collection(db, col));
        snap.forEach(d => {
            const data = d.data();
            if (GHOST_IDS.includes(data.subject)) {
                console.log(`MATCH in ${col}: Doc ${d.id}, Subject: ${data.subject}`);
            }
        });
    }
}

checkMore().catch(console.error);
