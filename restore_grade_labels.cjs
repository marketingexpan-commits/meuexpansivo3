const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, writeBatch } = require("firebase/firestore");

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

// Reverse Map: ID -> Friendly Label
const ID_TO_LABEL = {
    'grade_bercario': 'Berçário',
    'grade_nivel_1': 'Nível I',
    'grade_nivel_2': 'Nível II',
    'grade_nivel_3': 'Nível III',
    'grade_nivel_4': 'Nível IV',
    'grade_nivel_5': 'Nível V',
    'grade_1_ano': '1º Ano',
    'grade_2_ano': '2º Ano',
    'grade_3_ano': '3º Ano',
    'grade_4_ano': '4º Ano',
    'grade_5_ano': '5º Ano',
    'grade_6_ano': '6º Ano',
    'grade_7_ano': '7º Ano',
    'grade_8_ano': '8º Ano',
    'grade_9_ano': '9º Ano',
    'grade_1_ser': '1ª Série',
    'grade_2_ser': '2ª Série',
    'grade_3_ser': '3ª Série'
};

async function restoreLabels() {
    console.log("--- RESTORING GRADE LABELS (ID -> NAME) ---");
    const snap = await getDocs(collection(db, "students"));
    let batch = writeBatch(db);
    let count = 0;
    let updates = 0;

    for (const d of snap.docs) {
        const s = d.data();
        let needsUpdate = false;
        const updateData = {};

        const currentGrade = s.gradeLevel;

        // Check if current Grade is an ID (starts with grade_)
        if (currentGrade && currentGrade.startsWith('grade_')) {
            const label = ID_TO_LABEL[currentGrade];
            if (label) {
                updateData.gradeLevel = label;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            batch.update(d.ref, updateData);
            count++;
            updates++;
        }

        if (count >= 400) {
            await batch.commit();
            console.log(`Restored ${updates} labels...`);
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) await batch.commit();
    console.log(`--- FINISHED: ${updates} students restored to Standard Labels ---`);
}

restoreLabels().catch(console.error);
