
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';

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

async function findDuplicates() {
    console.log("Iniciando busca por duplicatas...");
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        const students = [];

        querySnapshot.forEach((doc) => {
            students.push({ id: doc.id, ...doc.data() });
        });

        const codeMap = new Map();

        students.forEach(student => {
            const code = String(student.code).trim();
            if (!code) return;

            if (!codeMap.has(code)) {
                codeMap.set(code, []);
            }
            codeMap.get(code).push(student);
        });

        const duplicates = [];
        for (const [code, list] of codeMap.entries()) {
            if (list.length > 1) {
                duplicates.push({
                    code,
                    students: list.map(s => ({
                        id: s.id,
                        name: s.name,
                        unit: s.unit || 'Sem Unidade',
                        grade: s.gradeLevel,
                        class: s.schoolClass,
                        status: s.status
                    }))
                });
            }
        }

        fs.writeFileSync('duplicates.json', JSON.stringify(duplicates, null, 2));
        console.log("duplicates.json salvo com sucesso.");

    } catch (error) {
        console.error("Erro ao buscar duplicatas:", error);
    }
}

findDuplicates();
