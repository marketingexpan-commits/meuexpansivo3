import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, limit, getDocs } from "firebase/firestore";

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

async function checkOldCode() {
    console.log("Checking if ANY student has oldCode populated...");
    const studentsRef = collection(db, "students");
    // We can't query by != undefined easily in client SDK, so we'll just check a larger sample
    const q = query(studentsRef, where("unit", "==", "unit_qui"), limit(100));
    const querySnapshot = await getDocs(q);

    let foundOldCodeCount = 0;
    querySnapshot.forEach(doc => {
        if (doc.data().oldCode !== undefined) {
            foundOldCodeCount++;
            if (foundOldCodeCount < 5) {
                console.log(`ID: ${doc.id} | Name: ${doc.data().name} | oldCode: ${doc.data().oldCode}`);
            }
        }
    });

    console.log(`Total records checked: ${querySnapshot.size}`);
    console.log(`Records with oldCode: ${foundOldCodeCount}`);
}

checkOldCode().catch(console.error);
