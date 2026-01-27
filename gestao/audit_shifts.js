
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    databaseURL: "https://meu-expansivo-app-default-rtdb.firebaseio.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function auditShifts() {
    console.log('Verifying Shift Counts...');
    try {
        const snapshot = await getDocs(collection(db, 'students'));
        const shiftCounts = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            let shift = data.shift;
            if (shift === undefined || shift === null) shift = 'UNDEFINED';
            else if (shift === '') shift = 'EMPTY';

            shiftCounts[shift] = (shiftCounts[shift] || 0) + 1;
        });

        console.log('Final Distribution:', JSON.stringify(shiftCounts, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

auditShifts();
