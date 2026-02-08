import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch, query, where } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const SAFE_IDS = ['2222', '5556', 'Admin', 'admin', 'coordenacao'];
const BATCH_SIZE = 100;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const SHIFT_MAP = {
    'MANHA': 'shift_morning', 'TARDE': 'shift_afternoon', 'NOITE': 'shift_night',
    'INTEGRAL': 'shift_integral', 'M': 'shift_morning', 'T': 'shift_afternoon',
    'N': 'shift_night', 'MANHA - MATUTINO': 'shift_morning',
    'TARDE - VESPERTINO': 'shift_afternoon', 'SEMI-INTEGRAL': 'shift_integral',
    'VESPERTINO': 'shift_afternoon', 'MATUTINO': 'shift_morning'
};

const GRADE_MAP = {
    '2S': '2ª Série - Ensino Médio', '3S': '3ª Série - Ensino Médio', '1S': '1ª Série - Ensino Médio',
    '9A': '9º Ano - Fundamental II', '8A': '8º Ano - Fundamental II', '7A': '7º Ano - Fundamental II',
    '6A': '6º Ano - Fundamental II', '5A': '5º Ano - Fundamental I', '4A': '4º Ano - Fundamental I',
    '3A': '3º Ano - Fundamental I', '2A': '2º Ano - Fundamental I', '1A': '1º Ano - Fundamental I',
    'INF5': 'Nível V - Educação Infantil', 'INF4': 'Nível IV - Educação Infantil',
    'INF3': 'Nível III - Educação Infantil', 'INF2': 'Nível II - Educação Infantil',
    'INF1': 'Nível I - Educação Infantil', 'N5': 'Nível V - Educação Infantil',
    'N4': 'Nível IV - Educação Infantil', 'N3': 'Nível III - Educação Infantil',
    'N2': 'Nível II - Educação Infantil'
};

const STATUS_MAP = {
    '00': 'CURSANDO', '01': 'TRANSFERIDO', '03': 'EVADIDO', '09': 'TRANCADO',
    '05': 'RESERVADO', '88': 'REPROVADO', '99': 'APROVADO', '10': 'ATIVO',
    '11': 'INATIVO', 'N': 'CURSANDO', '07': 'CURSANDO'
};

// --- HELPERS ---
function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string' || dateStr.includes('30.12.1899')) return '';
    const sep = dateStr.includes('.') ? '.' : (dateStr.includes('/') ? '/' : null);
    if (sep) {
        const parts = dateStr.split(sep);
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

function cleanNumeric(str) {
    return str ? str.toString().replace(/\D/g, '') : '';
}

function cleanCivil(val) {
    if (!val || val === '0') return '';
    return val;
}

function mapLocal(local) {
    if (!local) return '';
    if (local.toUpperCase().startsWith('U')) return 'Urbana';
    if (local.toUpperCase().startsWith('R')) return 'Rural';
    return local;
}

// --- WIPE LOGIC (Targeted per Unit) ---
async function wipeDatabase(unitFilter = null) {
    console.log(`\n🔥 STARTING ${unitFilter ? `UNIT WIPE (${unitFilter})` : 'FULL WIPE'}...`);

    let q = collection(db, 'students');
    if (unitFilter) {
        q = query(q, where('unit', '==', unitFilter));
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.log("   Nothing to delete.");
        return;
    }

    let batch = writeBatch(db);
    let count = 0;
    let totalDeleted = 0;

    for (const document of snapshot.docs) {
        const id = document.id;
        const data = document.data();

        if (SAFE_IDS.includes(id) || (data.code && SAFE_IDS.includes(data.code))) {
            continue;
        }

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

    if (count > 0) await batch.commit();
    console.log(`\n✅ WIPE COMPLETE. Deleted ${totalDeleted} students.`);
}

// --- GENERALIZED IMPORT LOGIC ---
async function importUnit(config, limit = null) {
    const { id: unitId, folder, label, filePrefix } = config;
    console.log(`\n📂 IMPORTING UNIT: ${label} (Folder: ${folder}) ${limit ? `[LIMIT: ${limit}]` : ''}`);

    const dir = path.join(__dirname, `../dados_2026/${folder}`);
    const prefix = filePrefix || folder;
    const fileAlunos = path.join(dir, `Alunos_${prefix}.csv`);
    const fileMatriculas = path.join(dir, `Matriculas_${prefix}.csv`);

    if (!fs.existsSync(fileAlunos) || !fs.existsSync(fileMatriculas)) {
        console.error(`❌ Files missing in ${dir}`);
        return;
    }

    // 1. Read Alunos
    console.log("   📖 Processing Alunos CSV...");
    const contentAlunos = fs.readFileSync(fileAlunos, 'latin1');
    const linesAlunos = contentAlunos.split(/\r?\n/).filter(l => l.trim());
    const hA = linesAlunos[0].split(';').map(h => h.trim().toUpperCase());
    const getIdx = (n) => hA.indexOf(n);
    const getIdxLike = (p) => hA.findIndex(h => h.includes(p));

    const studentMap = new Map();
    let currentLine = '';
    const mergedLines = [];

    for (let i = 1; i < linesAlunos.length; i++) {
        const line = linesAlunos[i].trim();
        const firstCol = line.split(';')[0];
        const cleanId = cleanNumeric(firstCol);
        if (firstCol && !isNaN(parseInt(firstCol)) && cleanId.length > 0 && cleanId.length <= 5) {
            if (currentLine) mergedLines.push(currentLine);
            currentLine = line;
        } else if (currentLine) {
            currentLine += ' ' + line;
        }
    }
    if (currentLine) mergedLines.push(currentLine);

    // Process rows
    for (const mergedLine of mergedLines) {
        const cols = mergedLine.split(';');
        const val = (idx) => idx > -1 && cols[idx] ? cols[idx].trim() : '';
        const code = cleanNumeric(val(getIdx('CODIGO')));

        if (!code || isNaN(parseInt(code))) continue;

        const aluno = {
            id: '', // Set on upload
            code: code,
            matricula: cleanNumeric(val(getIdx('MATRICULA'))),
            name: val(getIdx('ALUNO')).toUpperCase(),

            // Personal
            data_nascimento: parseDate(val(getIdx('NASCIMENTO'))),
            data_inicio: parseDate(val(getIdx('DTINICIO'))),
            sexo: val(getIdx('SEXO')),
            identidade_rg: val(getIdx('ARG')),
            rg_emissor: val(getIdx('ARGEMISS')),
            cpf_aluno: val(getIdx('ACPF')),
            nacionalidade: val(getIdx('ANACIONAL')),
            naturalidade: val(getIdx('ANATUAL')),
            uf_naturalidade: val(getIdx('NAUF')),
            socialName: val(getIdx('ALIAS')),

            // Documentation
            certidao_tipo: 'Nascimento',
            certidao_numero: cleanCivil(val(getIdx('REGISTRO'))),
            certidao_livro: cleanCivil(val(getIdx('LIVRO'))),
            certidao_folha: cleanCivil(val(getIdx('FOLHA'))),
            certidao_cartorio: cleanCivil(val(getIdx('CARTORIO'))),
            certidao_data_emissao: parseDate(val(getIdx('DTREGISTRO'))),

            // Academic
            procedencia_escolar: val(getIdx('PROCEDENCIA')),
            bolsa_percentual: val(getIdx('BOLSA')),
            isScholarship: parseFloat(val(getIdx('BOLSA')).replace(',', '.') || '0') === 100,
            autorizacao_bolsa: val(getIdx('AUTORIZA')),

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

            // Family
            nome_pai: val(getIdx('PAI')),
            pai_profissao: val(getIdx('PPROFISSAO')),
            pai_nacionalidade: val(getIdx('PNACIONAL')),
            pai_naturalidade: val(getIdx('PNATURAL')),
            pai_telefone: val(getIdx('PFONE')),
            pai_local_trabalho: val(getIdx('PENDTRABALHO')),

            nome_mae: val(getIdx('MAE')),
            mae_profissao: val(getIdx('MPROFISSAO')),
            mae_naturalidade: val(getIdx('MNATURAL')),
            mae_nacionalidade: val(getIdx('MNACIONAL')),
            mae_telefone: val(getIdx('MFONE')),
            mae_local_trabalho: val(getIdx('MENDTRABALHO')),

            pai_renda_mensal: val(getIdx('PRENDA')),
            mae_renda_mensal: val(getIdx('MRENDA')),

            // Responsible
            nome_responsavel: val(getIdx('RESPONSAVEL')),
            financialResponsible: val(getIdx('RESPONSAVEL')),
            cpf_responsavel: val(getIdx('RCPF')) || val(getIdx('ACPF')),
            rg_responsavel: val(getIdx('RRG')),
            telefone_responsavel: val(getIdx('RFONE')),
            email_responsavel: val(getIdx('REMAIL')),
            contactPhone: val(getIdx('RFONE')),

            // Religion
            religiao: val(getIdx('RELIGIAO')),
            ensino_religioso: val(getIdx('ORELIGIAO')) === 'S' ? 'Sim' : 'Não',

            // Health
            ficha_saude: {
                asma: val(getIdx('ASMA')) === 'S',
                bronquite: val(getIdx('BRONQUITE')) === 'S',
                diabetes: val(getIdx('DIABETES')) === 'S',
                epilepsia: val(getIdx('EPLEPSIA')) === 'S',
                hipertensao: val(getIdx('HIPERTENSAO')) === 'S',
                reumatismo: val(getIdx('REUMATISMO')) === 'S',
                deficiencia_fisica: val(getIdx('DFISICA')) === 'S',
                deficiencia_auditiva: val(getIdx('DAUDITIVA')) === 'S',
                deficiencia_visual: val(getIdx('DVISUAL')) === 'S',
                deficiencia_fala: val(getIdx('DFALA')) === 'S',
                alergias: val(getIdx('ALERGIAS')),
                tratamento: val(getIdx('REALIZANDOTRATAMENTO')),
                plano_saude: val(getIdx('PLANODESAUDE')),
                observacoes_adicionais: val(getIdx('OUTDOENCA')),
            },

            // Observations
            observacoes_gerais: val(getIdxLike('OBSPREF')),

            // Meta
            unit: unitId,
            role: 'STUDENT',
            status: STATUS_MAP[val(getIdx('CODSIT'))] || 'OUTRO',
            enrollmentHistory: [],
            enrolledYears: [],
            createdAt: new Date().toISOString()
        };

        studentMap.set(code, aluno);
        if (limit && studentMap.size >= limit) break;
    }

    // 2. Read Matriculas
    console.log("   📖 Processing Matriculas CSV...");
    const contentMat = fs.readFileSync(fileMatriculas, 'latin1');
    const linesMat = contentMat.split(/\r?\n/).filter(l => l.trim());
    const hM = linesMat[0].split(';').map(h => h.trim().toUpperCase());
    const getIdxM = (n) => hM.indexOf(n);

    for (let i = 1; i < linesMat.length; i++) {
        const cols = linesMat[i].split(';');
        const val = (idx) => idx > -1 && cols[idx] ? cols[idx].trim() : '';
        const code = cleanNumeric(val(getIdxM('CODIGO')));
        const student = studentMap.get(code);

        if (student) {
            const rawYear = val(getIdxM('ANO')).split('.')[0];
            const sitIdx = [getIdxM('SITENC'), getIdxM('SITUACAO'), getIdxM('CODSIT')].find(idx => idx > -1 && val(idx) !== '');

            if (!student.enrolledYears.includes(rawYear)) student.enrolledYears.push(rawYear);

            student.enrollmentHistory.push({
                year: rawYear,
                gradeLevel: GRADE_MAP[val(getIdxM('CODSER'))] || val(getIdxM('CODSER')),
                schoolClass: val(getIdxM('TURMA')),
                shift: SHIFT_MAP[val(getIdxM('TURNO'))] || '',
                status: STATUS_MAP[val(sitIdx)] || 'OUTRO',
                unit: unitId
            });
        }
    }

    // 3. Sort & Sync Root
    for (const student of studentMap.values()) {
        if (student.enrollmentHistory.length > 0) {
            student.enrollmentHistory.sort((a, b) => b.year.localeCompare(a.year));
            const latest = student.enrollmentHistory[0];
            student.gradeLevel = latest.gradeLevel;
            student.schoolClass = latest.schoolClass;
            student.shift = latest.shift;
        }
    }

    // 4. Batch Upload
    console.log(`   🚀 Uploading ${studentMap.size} records...`);
    let batch = writeBatch(db);
    let count = 0;
    for (const student of studentMap.values()) {
        const ref = doc(collection(db, 'students'));
        student.id = ref.id;
        batch.set(ref, student);
        count++;
        if (count >= BATCH_SIZE) {
            await batch.commit();
            process.stdout.write('.');
            batch = writeBatch(db);
            count = 0;
        }
    }
    if (count > 0) await batch.commit();
    console.log(`\n🎉 DONE: Imported ${studentMap.size} students for ${label}.`);
}

// --- EXECUTION ---
async function main() {
    const ZN_CONFIG = { id: 'unit_zn', folder: 'ZN', label: 'Zona Norte' };

    // Wipe only Zona Norte (to allow re-runs)
    await wipeDatabase(ZN_CONFIG.id);

    // Full import for Zona Norte
    await importUnit(ZN_CONFIG);
}

main().catch(console.error);
