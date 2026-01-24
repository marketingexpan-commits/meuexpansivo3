const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, limit, getDocs } = require("firebase/firestore");

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

async function checkFields() {
    console.log("--- Checking Student Fields for Localização mapping ---");
    const studentsRef = collection(db, "students");

    // Get a few students, specifically from unit_qui or any unit
    const q = query(studentsRef, limit(20));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log("No students found.");
        return;
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`\nID: ${doc.id} | Name: ${data.name}`);

        // Print all keys to find anything related to location
        const keys = Object.keys(data).filter(k => k.toLowerCase().includes('loc') || k.toLowerCase().includes('zona') || k.toLowerCase().includes('end'));
        if (keys.length > 0) {
            console.log("Found keys:", keys);
            keys.forEach(k => console.log(`  ${k}: ${data[k]}`));
        } else {
            // Print top-level keys to see what we have
            console.log("Existing top-level keys:", Object.keys(data).slice(0, 15).join(", ") + "...");
        }
    });
}

checkFields().catch(console.error);
