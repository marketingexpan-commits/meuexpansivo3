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

async function checkAlternativeSubjects() {
    console.log("Checking if collection 'subjects' exists and has ZDLHk7z94IX8dS3ysBVW...");
    try {
        const snap = await getDocs(collection(db, "subjects"));
        if (snap.empty) {
            console.log("Collection 'subjects' is empty or does not exist.");
        } else {
            console.log(`Collection 'subjects' has ${snap.size} documents.`);
            snap.forEach(d => {
                if (d.id === "ZDLHk7z94IX8dS3ysBVW") {
                    console.log(`FOUND in 'subjects' collection: ${JSON.stringify(d.data())}`);
                }
            });
        }
    } catch (e) {
        console.log("Error checking 'subjects' collection (likely does not exist).");
    }
}

checkAlternativeSubjects().catch(console.error);
