import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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

async function run() {
    console.log("--- PROCURANDO ALUNA ARYELLA ---");

    const studentsSnap = await getDocs(collection(db, "students"));
    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const aryella = students.find(s => s.name?.toLowerCase().includes("aryella"));

    if (!aryella) {
        console.error("Aluna Aryella não encontrada na coleção 'students'.");
        return;
    }

    console.log(`\nCadastro de Aryella no banco:`);
    console.log(`ID: ${aryella.id}`);
    console.log(`Nome: ${aryella.name}`);
    console.log(`Matrícula/Código: ${aryella.code}`);
    console.log(`Unidade Atual (student.unit): ${aryella.unit}`);
    console.log(`Série/Turma/Turno: ${aryella.gradeLevel} - ${aryella.schoolClass} - ${aryella.shift}`);
    console.log(`Histórico de Matrículas (enrollmentHistory):`, JSON.stringify(aryella.enrollmentHistory, null, 2));

    console.log(`\n--- BUSCANDO REGISTROS DE CHAMADA (ATTENDANCE) ---`);
    const attendanceSnap = await getDocs(collection(db, "attendance"));
    const allAttendance = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const aryellaAttendance = allAttendance.filter(record => 
        record.studentStatus && record.studentStatus[aryella.id] !== undefined
    );

    console.log(`Total de registros de chamada encontrados para a Aryella: ${aryellaAttendance.length}`);

    // Agrupar e exibir chamadas dela
    aryellaAttendance.sort((a, b) => a.date.localeCompare(b.date));
    aryellaAttendance.forEach(record => {
        const status = record.studentStatus[aryella.id];
        console.log(`Data: ${record.date} | Disciplina: ${record.discipline} | Unidade da Chamada: ${record.unit} | Status: ${status} | ID Chamada: ${record.id}`);
    });
}

run().catch(console.error);
