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

async function checkTeachers() {
    console.log("Checking teachers for ghost IDs in their 'subjects' array...");
    const snap = await getDocs(collection(db, "teachers"));
    snap.forEach(d => {
        const data = d.data();
        if (data.subjects && Array.isArray(data.subjects)) {
            const ghosts = data.subjects.filter(s => GHOST_IDS.includes(s));
            if (ghosts.length > 0) {
                console.log(`TEACHER FOUND with Ghost IDs! ID: ${d.id}, Name: ${data.name}, Ghosts: ${JSON.stringify(ghosts)}`);
            }
        }
    });
}

checkTeachers().catch(console.error);
