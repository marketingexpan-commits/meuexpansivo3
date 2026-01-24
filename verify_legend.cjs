const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verify() {
    const studentsRef = collection(db, "students");

    const testCodes = ['2162', '9', '545', '685'];
    console.log("--- BATCH VERIFICATION OF STATUSES ---");

    for (const code of testCodes) {
        const q = query(studentsRef, where("code", "==", code));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log(`Code ${code}: Not found`);
        } else {
            snap.forEach(doc => {
                const d = doc.data();
                console.log(`Code ${code} | Name: ${d.name}`);
                console.log(`   Status: ${d.status}`);
            });
        }
    }
}

verify().catch(console.error);
