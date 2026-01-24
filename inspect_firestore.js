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

async function inspectStudents() {
    console.log("--- Inspecting Students for unit_qui ---");
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("unit", "==", "unit_qui"), limit(10));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log("No students found for unit_qui.");
        return;
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`Name: ${data.name}`);
        console.log(`Code: ${data.code}`);
        console.log(`OldCode: ${data.oldCode}`);
        console.log(`EnrolledYears: ${JSON.stringify(data.enrolledYears)}`);
        console.log("---");
    });
}

inspectStudents().catch(console.error);
