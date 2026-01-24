const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs, limit } = require("firebase/firestore");

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

const units = ['unit_zn', 'unit_bs', 'unit_ext', 'unit_qui'];

async function auditUnits() {
    const studentsRef = collection(db, "students");
    for (const unit of units) {
        console.log(`Auditing unit: ${unit}...`);
        const q = query(studentsRef, where("unit", "==", unit), limit(5));
        const snap = await getDocs(q);
        if (snap.empty) {
            console.log(`  No students found for ${unit}.`);
        } else {
            snap.forEach(doc => {
                const data = doc.data();
                console.log(`  Code ${data.code} | Name: ${data.name} | FIL: ${data.FIL || 'MISSING'}`);
            });
        }
    }
}

auditUnits().catch(console.error);
