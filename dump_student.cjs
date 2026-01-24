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

async function inspectFirstStudent() {
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log("No students found.");
        return;
    }

    const doc = querySnapshot.docs[0];
    console.log("--- FULL STUDENT DATA ---");
    console.log(JSON.stringify(doc.data(), null, 2));
}

inspectFirstStudent().catch(console.error);
