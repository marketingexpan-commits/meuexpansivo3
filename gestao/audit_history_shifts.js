
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

async function auditHistoryShifts() {
    console.log('Auditing Enrollment History Shifts...');
    try {
        const snapshot = await getDocs(collection(db, 'students'));
        let totalHistoryRecords = 0;
        let legacyHistoryCount = 0;
        const historyShiftCounts = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.enrollmentHistory && Array.isArray(data.enrollmentHistory)) {
                data.enrollmentHistory.forEach(h => {
                    totalHistoryRecords++;
                    const shift = h.shift;
                    historyShiftCounts[shift] = (historyShiftCounts[shift] || 0) + 1;

                    if (shift === 'Matutino' || shift === 'Vespertino') {
                        legacyHistoryCount++;
                    }
                });
            }
        });

        console.log(`Total Enrollment History Records: ${totalHistoryRecords}`);
        console.log(`Legacy History Shifts (Matutino/Vespertino): ${legacyHistoryCount}`);
        console.log('Distribution:', JSON.stringify(historyShiftCounts, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

auditHistoryShifts();
