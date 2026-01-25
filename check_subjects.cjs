const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

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

async function checkSubjects() {
    console.log("--- CHECKING ACADEMIC SUBJECTS ---");
    const snap = await getDocs(collection(db, 'academic_subjects'));
    console.log(`Total subjects in DB: ${snap.size}`);

    if (snap.size > 0) {
        console.log("\nFirst 10 subjects:");
        snap.docs.slice(0, 10).forEach(d => {
            const data = d.data();
            console.log(`- [${d.id}] ${data.name} (Active: ${data.isActive !== false})`);
        });
    }
}

checkSubjects().catch(console.error);
