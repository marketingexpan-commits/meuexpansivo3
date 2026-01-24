const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs } = require("firebase/firestore");

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

const testCodes = ['1852', '2287'];

async function verify() {
    console.log("--- VERIFYING RECONSTITUTED HISTORY ---");
    const studentsRef = collection(db, "students");
    for (const code of testCodes) {
        const q = query(studentsRef, where("code", "==", code));
        const snap = await getDocs(q);
        snap.forEach(doc => {
            const d = doc.data();
            console.log(`\nStudent: ${d.name} (#${d.code})`);
            console.log(JSON.stringify(d.enrollmentHistory, null, 2));
        });
    }
}

verify().catch(console.error);
