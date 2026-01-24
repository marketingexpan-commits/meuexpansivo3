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

async function check() {
    console.log("Searching for Student 142...");
    const q = query(collection(db, "students"), where("code", "==", "142"));
    const snap = await getDocs(q);

    if (snap.empty) {
        console.log("Student 142 NOT FOUND in Firestore.");
    } else {
        snap.forEach(doc => {
            const d = doc.data();
            console.log(`FOUND Student 142: ${d.name}`);
            console.log(`- Unit: ${d.unit}`);
            console.log(`- Status: ${d.status}`);
            console.log(`- Enrolled Years: ${JSON.stringify(d.enrolledYears)}`);
            console.log(`- Created At: ${d.createdAt}`);
        });
    }
}

check();
