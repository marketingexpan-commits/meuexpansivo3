import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch, deleteDoc, setDoc } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG FROM migrate_messages.js
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

// --- CONFIGURATION ---
const DO_WIPE = true;
const SAFE_IDS = ['2222', '5556', 'Admin', 'admin', 'coordenacao'];
const BATCH_SIZE = 100;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// HELPERS
function parseDate(dateStr) {
    // Format: DD.MM.YYYY -> YYYY-MM-DD
    if (!dateStr || typeof dateStr !== 'string') return '';
    // Filter out the Excel epoch / invalid default date
    if (dateStr.includes('30.12.1899')) return '';

    if (dateStr.includes('.')) {
        const parts = dateStr.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    // Fallback for slashes if needed
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

function cleanCivil(val) {
    if (!val || val === '0') return '';
    return val;
}

const SHIFT_MAP = {
    'MANHA': 'shift_morning',
    'TARDE': 'shift_afternoon',
    'NOITE': 'shift_night',
    'INTEGRAL': 'shift_integral',
    'M': 'shift_morning',
    'T': 'shift_afternoon',
    'N': 'shift_night',
    'MANHA - MATUTINO': 'shift_morning',
    'TARDE - VESPERTINO': 'shift_afternoon',
    'SEMI-INTEGRAL': 'shift_integral'
};

const GRADE_MAP = {
    '2S': '2ª Série - Ensino Médio',
    '3S': '3ª Série - Ensino Médio',
    '1S': '1ª Série - Ensino Médio',
    '9A': '9º Ano - Fundamental II',
    '8A': '8º Ano - Fundamental II',
    '7A': '7º Ano - Fundamental II',
    '6A': '6º Ano - Fundamental II',
    '5A': '5º Ano - Fundamental I',
    '4A': '4º Ano - Fundamental I',
    '3A': '3º Ano - Fundamental I',
    '2A': '2º Ano - Fundamental I',
    '1A': '1º Ano - Fundamental I',
    'INF5': 'Nível V - Educação Infantil',
    'INF4': 'Nível IV - Educação Infantil',
    'INF3': 'Nível III - Educação Infantil',
    'INF2': 'Nível II - Educação Infantil',
    'INF1': 'Nível I - Educação Infantil',
    'N5': 'Nível V - Educação Infantil',
    'N4': 'Nível IV - Educação Infantil',
    'N3': 'Nível III - Educação Infantil',
    'N2': 'Nível II - Educação Infantil'
};

// 00 = Cursando, 01 = Transferido, 03 = Evadido, 09 = Trancado, 05 = Reservado, 88 = Reprovado, 99 = Aprovado, 10 = Ativo, 11 = Inativo.
const STATUS_MAP = {
    '00': 'CURSANDO',
    '01': 'TRANSFERIDO',
    '03': 'EVADIDO',
    '09': 'TRANCADO',
    '05': 'RESERVADO',
    '88': 'REPROVADO',
    '99': 'APROVADO',
    '10': 'ATIVO',
    '11': 'INATIVO',
    'N': 'CURSANDO',  // N = Normal/Cursando (found in CSV)
    '07': 'CURSANDO'  // Additional code found in CSV
};

function mapLocal(local) {
    if (!local) return '';
    if (local.toUpperCase().startsWith('U')) return 'Urbana';
    if (local.toUpperCase().startsWith('R')) return 'Rural';
    return local;
}

function cleanNumeric(str) {
    if (!str || typeof str !== 'string') return '';
    // Remove dots, dashes, spaces and anything non-numeric
    return str.replace(/\D/g, '');
}

// --- WIPE LOGIC ---
async function wipeDatabase() {
    console.log(`\n🔥 STARTING SAFE WIPE (Client SDK)...`);
    console.log(`🛡️  PROTECTED ACCOUNTS: ${SAFE_IDS.join(', ')}`);

    const studentsRef = collection(db, 'students');
    const snapshot = await getDocs(studentsRef);

    if (snapshot.empty) {
        console.log("   Database is already empty.");
        return;
    }

    let batch = writeBatch(db);
    let count = 0;
    let totalDeleted = 0;

    for (const document of snapshot.docs) {
        const id = document.id;
        const data = document.data();

        // Safety Check
        if (SAFE_IDS.includes(id) || (data.code && SAFE_IDS.includes(data.code))) {
            console.log(`   ⏭️  Skipping protected ID: ${id} (${data.name})`);
            continue;
        }

        // Add to Delete Batch
        batch.delete(doc(db, 'students', id));
        count++;
        totalDeleted++;

        if (count >= BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
            process.stdout.write('❌');
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`\n✅ WIPE COMPLETE. Deleted ${totalDeleted} students.`);
}

// --- IMPORT LOGIC (RELATIONAL) ---
async function importZN() {
    console.log(`\n📂 STARTING IMPORT (ZONA NORTE) with HISTORY...`);

    const dir = path.join(__dirname, '../dados_2026/ZN');
    const fileAlunos = path.join(dir, 'Alunos_ZN.csv');
    const fileMatriculas = path.join(dir, 'Matriculas_ZN.csv');

    if (!fs.existsSync(fileAlunos) || !fs.existsSync(fileMatriculas)) {
        console.error("❌ Missing CSV files in dados_2026/ZN");
        return;
    }

    // 1. Read Alunos
    console.log("   📖 Reading Alunos...");
    const contentAlunos = fs.readFileSync(fileAlunos, 'latin1');
    const linesAlunos = contentAlunos.split(/\r?\n/).filter(l => l.trim());

    // Header Map
    const hA = linesAlunos[0].split(';').map(h => h.trim().toUpperCase());
    const getIdx = (name) => hA.indexOf(name);
    // Find Header by partial match if needed (for OBSPREF)
    const getIdxLike = (partial) => hA.findIndex(h => h.includes(partial));

    const studentMap = new Map();
    let skipped = 0;

    // --- SMART LINE MERGING ---
    const mergedLines = [];
    let currentLine = '';

    for (let i = 1; i < linesAlunos.length; i++) {
        const line = linesAlunos[i].trim();
        if (!line) continue;

        const firstCol = line.split(';')[0];
        const cleanId = cleanNumeric(firstCol);

        // A new record must have a valid numeric ID <= 5 digits
        const isStartOfNewRecord = firstCol.length > 0 &&
            !isNaN(parseInt(firstCol)) &&
            cleanId.length > 0 &&
            cleanId.length <= 5;

        if (isStartOfNewRecord) {
            if (currentLine) mergedLines.push(currentLine);
            currentLine = line;
        } else {
            // Continuation: Append to previous
            if (currentLine) {
                // Use space separator for cleanliness
                currentLine += ' ' + line;
            }
        }
    }
    if (currentLine) mergedLines.push(currentLine);

    console.log(`   🔄 Merged split lines. Valid records to process: ${mergedLines.length}`);

    // Process merged lines
    for (let i = 0; i < mergedLines.length; i++) {
        const cols = mergedLines[i].split(';');
        const val = (idx) => idx > -1 && cols[idx] ? cols[idx].trim() : '';

        const rawCode = val(getIdx('CODIGO'));
        const code = cleanNumeric(rawCode);

        // Standard Skip checks
        if (!code || isNaN(parseInt(code))) continue;

        // Safety check again
        if (code.length > 5) {
            console.log(`   ⚠️  Record still invalid after merge: "${code}" - Skipping.`);
            uploadSkipped++;
            continue;
        }

        // -- MAPPING FIELDS --
        const aluno = {
            id: code,
            code: code,
            matricula: cleanNumeric(val(getIdx('MATRICULA'))),
            name: val(getIdx('ALUNO')).toUpperCase(),

            // Personal Dates
            data_nascimento: parseDate(val(getIdx('NASCIMENTO'))),
            data_inicio: parseDate(val(getIdx('DTINICIO'))),

            // Civil Doc
            nacionalidade: val(getIdx('ANACIONAL')),
            naturalidade: val(getIdx('ANATUAL')),
            uf_naturalidade: val(getIdx('NAUF')),
            sexo: val(getIdx('SEXO')),
            identidade_rg: val(getIdx('ARG')),
            rg_emissor: val(getIdx('ARGEMISS')),
            cpf_aluno: val(getIdx('ACPF')),
            socialName: val(getIdx('ALIAS')),

            // Certidão (Birth Certificate) - UI uses 'certidao_*' prefix
            certidao_tipo: 'Nascimento',
            certidao_numero: cleanCivil(val(getIdx('REGISTRO'))),
            certidao_livro: cleanCivil(val(getIdx('LIVRO'))),
            certidao_folha: cleanCivil(val(getIdx('FOLHA'))),
            certidao_cartorio: cleanCivil(val(getIdx('CARTORIO'))),
            certidao_data_emissao: parseDate(val(getIdx('DTREGISTRO'))),

            // Legacy / Fallback
            rg_numero_registro: val(getIdx('REGISTRO')),
            rg_livro: val(getIdx('LIVRO')),
            rg_folha: val(getIdx('FOLHA')),
            rg_cartorio: val(getIdx('CARTORIO')),
            data_registro: parseDate(val(getIdx('DTREGISTRO'))),

            // School Info
            procedencia_escolar: val(getIdx('PROCEDENCIA')),

            // Address
            endereco_logradouro: val(getIdx('AENDERECO')),
            endereco_numero: val(getIdx('ANUM')),
            endereco_complemento: val(getIdx('ACOMPLETO')),
            endereco_bairro: val(getIdx('ABAIRRO')),
            endereco_cidade: val(getIdx('ACIDADE')),
            endereco_uf: val(getIdx('AUF')),
            cep: val(getIdx('ACEP')),
            localizacao_tipo: mapLocal(val(getIdx('ALOCAL'))),
            telefone_contato: val(getIdx('ATELEFONE')),
            phoneNumber: val(getIdx('ATELEFONE')),

            // Financial
            bolsa_percentual: val(getIdx('BOLSA')),
            isScholarship: parseFloat(val(getIdx('BOLSA')).replace(',', '.') || '0') === 100,
            autorizacao_bolsa: val(getIdx('AUTORIZA')),

            // Religion
            religiao: val(getIdx('RELIGIAO')),
            ensino_religioso: val(getIdx('ORELIGIAO')) === 'S' ? 'Sim' : 'Não',

            // Family
            nome_pai: val(getIdx('PAI')),
            pai_profissao: val(getIdx('PPROFISSAO')),
            pai_nacionalidade: val(getIdx('PNACIONAL')),
            pai_telefone: val(getIdx('PFONE')),

            nome_mae: val(getIdx('MAE')),
            mae_profissao: val(getIdx('MPROFISSAO')),
            mae_nacionalidade: val(getIdx('MNACIONAL')),
            mae_telefone: val(getIdx('MFONE')),

            nome_responsavel: val(getIdx('RESPONSAVEL')),
            financialResponsible: val(getIdx('RESPONSAVEL')),
            cpf_responsavel: val(getIdx('RCPF')) || val(getIdx('ACPF')),
            rg_responsavel: val(getIdx('RRG')),
            telefone_responsavel: val(getIdx('RFONE')),
            contactPhone: val(getIdx('RFONE')),

            // Health setup
            ficha_saude: {
                observacoes_adicionais: '',
            },

            // Notes / Observations (Using OBSPREF as confirmed)
            observacoes_gerais: val(getIdxLike('OBSPREF')),

            // Defaults
            unit: 'unit_zn',
            role: 'STUDENT',
            isBlocked: false,
            password: '',
            createdAt: new Date().toISOString(),
            migrationSource: 'csv_2026_detailed',

            // Status from CODSIT in Alunos CSV
            status: STATUS_MAP[val(getIdx('CODSIT'))] || 'OUTRO',

            // HISTORY CONTAINER
            enrollmentHistory: [],
            enrolledYears: [] // For system-wide year filtering
        };

        studentMap.set(code, aluno);
    }

    // 2. Read Matriculas (HISTORY BUILDER)
    console.log("   📖 Reading Matriculas...");
    const contentMat = fs.readFileSync(fileMatriculas, 'latin1');
    const linesMat = contentMat.split(/\r?\n/).filter(l => l.trim());

    const hM = linesMat[0].split(';').map(h => h.trim().toUpperCase());
    const getIdxM = (name) => hM.indexOf(name);

    // Track 2026 matches
    let active2026Count = 0;

    for (let i = 1; i < linesMat.length; i++) {
        const cols = linesMat[i].split(';');
        const val = (idx) => idx > -1 && cols[idx] ? cols[idx].trim() : '';

        const rawCode = val(getIdxM('CODIGO'));
        const code = cleanNumeric(rawCode);
        const student = studentMap.get(code);

        if (student) {
            const rawYear = val(getIdxM('ANO')); // "2026.1" or "2013"
            const normalizedYear = rawYear.split('.')[0]; // "2026" or "2013"

            const rawGrade = val(getIdxM('CODSER'));
            const rawShift = val(getIdxM('TURNO'));
            // PRORITY: SITENC/SITUACAO usually more accurate for current state (00=Cursando)
            // CODSIT as fallback to keep Reprovado (88) and Evadido (03) varieties.
            const sitIdx = getIdxM('SITENC') > -1 && val(getIdxM('SITENC')) !== '' ? getIdxM('SITENC') :
                (getIdxM('SITUACAO') > -1 && val(getIdxM('SITUACAO')) !== '' ? getIdxM('SITUACAO') : getIdxM('CODSIT'));

            const rawStatus = val(sitIdx);
            const rawClass = val(getIdxM('TURMA'));

            const statusLabel = STATUS_MAP[rawStatus] || 'OUTRO';


            if (normalizedYear === '2026') {
                // Debug if still OUTRO
                if (statusLabel === 'OUTRO' && rawStatus !== '') {
                    // console.log(`   ⚠️  Unknown status code: ${rawStatus} for ${student.name}`);
                }
            }

            // Add to enrolledYears flat array
            if (!student.enrolledYears.includes(normalizedYear)) {
                student.enrolledYears.push(normalizedYear);
            }

            // Add to history
            // Add to history
            student.enrollmentHistory.push({
                year: normalizedYear,
                gradeLevel: GRADE_MAP[rawGrade] || rawGrade,
                schoolClass: rawClass,
                shift: SHIFT_MAP[rawShift] || '', // Reverted: No default fallback
                status: statusLabel,
                // unit: 'unit_zn' // Re-removed as it was duplicated in my mental model, keeping it as it was in file
                unit: 'unit_zn'
            });

            if (normalizedYear === '2026') active2026Count++;
        }
    }

    // 3. Post-Process: Sorting and Status
    for (const student of studentMap.values()) {
        // ALWAYS sort history DESCENDING (Newest at the top)
        if (student.enrollmentHistory.length > 0) {
            student.enrollmentHistory.sort((a, b) => b.year.localeCompare(a.year));

            // Set main fields from the LATEST enrollment (History[0])
            const latest = student.enrollmentHistory[0];
            student.gradeLevel = latest.gradeLevel;
            student.schoolClass = latest.schoolClass;
            student.shift = latest.shift;
        }

        // REMOVED: Fallback logic that set 2026 fields for non-2026 students.
        // If a student doesn't have an enrollment for 2026, gradeLevel/schoolClass/shift 
        // will remain empty for the ROOT, effectively hiding them from 2026 views 
        // due to strict enrolledYears filtering.
    }

    // 3. Batch Upload
    console.log(`   🚀 Uploading...`);
    let batch = writeBatch(db);
    let count = 0;
    let uploaded = 0;

    let uploadSkipped = 0;
    for (const student of studentMap.values()) {
        // SAFETY CHECK FOR FIREBASE DOC PATHS
        if (!student.code || typeof student.code !== 'string' || student.code.trim() === '') {
            console.log(`   ⚠️  Skipping student with invalid code: "${student.code}" (${student.name})`);
            uploadSkipped++;
            continue;
        }

        // GENERATE AUTO-ID (Random Alphanumeric)
        const ref = doc(collection(db, 'students'));
        const autoId = ref.id;

        // Update object with its new permanent Firebase ID
        student.id = autoId;

        batch.set(ref, student);

        count++;
        uploaded++;
        if (count >= BATCH_SIZE) {
            try {
                await batch.commit();
                process.stdout.write('.');
            } catch (err) {
                console.error(`\n❌ Batch commit failed at uploaded count ${uploaded}:`, err.message);
                throw err;
            }
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) {
        try {
            await batch.commit();
            console.log(`   ✅ Final batch for students committed.`);
            await sleep(500); // Small pause to avoid RESOURCE_EXHAUSTED
        } catch (err) {
            console.error(`\n❌ Final batch commit failed:`, err.message);
            throw err;
        }
    }
    console.log(`\n🎉 IMPORT COMPLETE. Total Uploaded: ${uploaded}, Skipped (CSV): ${skipped}, Skipped (Upload): ${uploadSkipped}`);
    process.exit(0);
}

async function main() {
    if (DO_WIPE) await wipeDatabase();
    await importZN();
}

main().catch(console.error);
