const fs = require('fs');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, writeBatch, doc } = require("firebase/firestore");

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

const statusMap = {
    '00': 'CURSANDO', '01': 'TRANSFERIDO', '03': 'EVADIDO', '09': 'TRANCADO',
    '05': 'RESERVADO', '10': 'ATIVO', '88': 'REPROVADO', '99': 'APROVADO'
};

function getGradeLabel(grau, ser) {
    let segment = '';
    const s = ser.toUpperCase();
    if (s.startsWith('N') || s === 'BE') segment = 'Educação Infantil';
    else if (['1A', '2A', '3A', '4A', '5A'].includes(s)) segment = 'Fundamental I';
    else if (['6A', '7A', '8A', '9A'].includes(s)) segment = 'Fundamental II';
    else if (s.endsWith('S') || ['1S', '2S', '3S'].includes(s)) segment = 'Ensino Médio';

    let label = ser;
    if (s.endsWith('A')) label = s.replace('A', 'º Ano');
    else if (s.endsWith('S')) label = s.replace('S', 'ª Série');
    else if (s.startsWith('N')) {
        const num = s.replace('N', '');
        const romanMap = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V' };
        label = `Nível ${romanMap[num] || num}`;
    }

    return segment ? `${label} - ${segment}` : label;
}

const cleanObject = (obj) => {
    const cleaned = { ...obj };
    Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === undefined || cleaned[key] === "NULL") cleaned[key] = "";
        else if (cleaned[key] !== null && typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key])) {
            cleaned[key] = cleanObject(cleaned[key]);
        }
    });
    return cleaned;
};

async function masterReconcile(unitId, alunosFile, matriculasFile) {
    console.log(`\n>>> STARTING RECONCILE: ${unitId} <<<`);

    // 1. Fetch CURRENT students to build the map (Unit + Code)
    const currentSnap = await getDocs(collection(db, "students"));
    const studentMap = {}; // "unit_code" -> docId
    currentSnap.forEach(d => {
        const data = d.data();
        if (data.unit && data.code) {
            studentMap[`${data.unit}_${data.code}`] = d.id;
        }
    });
    console.log(`- Database has ${currentSnap.size} students across all units.`);

    // 2. Parse Matriculas
    console.log(`- Parsing ${matriculasFile}...`);
    const matContent = fs.readFileSync(matriculasFile, 'latin1');
    const historyMap = {};
    const yearsMap = {};

    matContent.split(';').forEach(seg => {
        const match = seg.match(/INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
        if (match) {
            const cols = match[1].split(',').map(c => c.trim().toUpperCase());
            const vals = match[2].trim().replace(/\)$/s, '').split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            const obj = {};
            cols.forEach((c, i) => { if (i < vals.length) obj[c] = vals[i]; });
            if (obj.CODIGO && obj.ANO) {
                const year = obj.ANO.split('.')[0];
                if (!historyMap[obj.CODIGO]) historyMap[obj.CODIGO] = [];
                if (!yearsMap[obj.CODIGO]) yearsMap[obj.CODIGO] = new Set();
                historyMap[obj.CODIGO].push({
                    year, unit: unitId, gradeLevel: getGradeLabel(obj.CODGRAU, obj.CODSER),
                    schoolClass: obj.TURMA || 'A',
                    shift: (obj.TURCOD === 'T' || obj.TURNO === 'VESPERTINO') ? 'Vespertino' : 'Matutino',
                    status: statusMap[obj.CODSIT] || 'CONCLUÍDO'
                });
                yearsMap[obj.CODIGO].add(year);
            }
        }
    });

    // 3. Parse Alunos
    console.log(`- Parsing ${alunosFile}...`);
    const alContent = fs.readFileSync(alunosFile, 'latin1');
    const headerMatch = alContent.match(/INSERT INTO ALUNO\s*\((.*?)\)/is);
    if (!headerMatch) throw new Error("Header not found");
    const alCols = headerMatch[1].split(',').map(c => c.trim().toUpperCase());

    function parseSqlValues(str) {
        const results = []; let current = ""; let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === "'" && (i === 0 || str[i - 1] !== "\\")) inQuotes = !inQuotes;
            else if (char === "," && !inQuotes) { results.push(current.trim().replace(/^'|'$/g, '')); current = ""; }
            else current += char;
        }
        results.push(current.trim().replace(/^'|'$/g, ''));
        return results;
    }

    const imports = [];
    alContent.split(';').forEach(seg => {
        const match = seg.match(/VALUES\s*\((.*)/is);
        if (match) {
            const vals = parseSqlValues(match[1].trim().replace(/\)$/s, ''));
            const sql = {};
            alCols.forEach((c, i) => { sql[c] = vals[i]; });

            if (sql.CODIGO) {
                const history = historyMap[sql.CODIGO] || [];
                history.sort((a, b) => parseInt(b.year) - parseInt(a.year));
                const latest = history[0];
                const years = yearsMap[sql.CODIGO] || new Set();

                const existingDocId = studentMap[`${unitId}_${sql.CODIGO}`];

                const sData = {
                    code: sql.CODIGO, name: sql.ALUNO, unit: unitId,
                    numero_inscricao: sql.MATRICULA, // Map No. Inscrição from SQL
                    // New Status Logic: Prioritize 2026/2025 as current academic cycle
                    status: (years.has('2026') || years.has('2025')) ? 'CURSANDO' : (years.has('2024') ? 'ATIVO' : (years.size > 0 ? 'CONCLUÍDO' : 'INATIVO')),
                    isBlocked: false, id_antigo: sql.CODIGO,
                    gradeLevel: latest ? latest.gradeLevel : 'N/A',
                    schoolClass: latest ? latest.schoolClass : 'A',
                    shift: latest ? latest.shift : 'Matutino',
                    data_inicio: sql.DTINICIO, data_nascimento: sql.NASCIMENTO, sexo: sql.SEXO,
                    nacionalidade: sql.ANACIONAL, naturalidade: sql.ANATUAL, uf_naturalidade: sql.NAUF,
                    alias: sql.ALIAS || (sql.ALUNO ? sql.ALUNO.split(' ')[0] : ""),
                    cpf_aluno: sql.ACPF,
                    identidade_rg: sql.ARG, // Back to Identificação (ARG) mapping
                    rg_emissor: sql.ARGEMISS, endereco_logradouro: sql.AENDERECO, endereco_numero: sql.ANUM,
                    endereco_complemento: sql.ACOMPLETO, endereco_bairro: sql.ABAIRRO, endereco_cidade: sql.ACIDADE,
                    endereco_uf: sql.AUF, cep: sql.ACEP,
                    localizacao_tipo: sql.ALOCAL === 'U' ? 'Urbana' : (sql.ALOCAL === 'R' ? 'Rural' : null),
                    nome_pai: sql.PAI, pai_telefone: sql.PFONE, pai_profissao: sql.PPROFISSAO,
                    pai_nacionalidade: sql.PNACIONAL, pai_local_trabalho: sql.PENDTRABALHO,
                    nome_mae: sql.MAE, mae_telefone: sql.MFONE, mae_profissao: sql.MPROFISSAO,
                    mae_nacionalidade: sql.MNACIONAL, mae_local_trabalho: sql.MENDTRABALHO,
                    nome_responsavel: sql.RESPONSAVEL, cpf_responsavel: sql.RCPF, rg_responsavel: sql.RRG,
                    email_responsavel: sql.REMAIL, telefone_responsavel: sql.RFONE,
                    bolsa_percentual: sql.BOLSA, isScholarship: parseInt(sql.BOLSA) >= 100,
                    autorizacao_bolsa: sql.AUTORIZA, // Legacy discount authorization
                    observacoes_gerais: sql.OBSPREF, // Legacy observations

                    // Civil Documentation (Restored to original correct mapping)
                    certidao_numero: sql.REGISTRO,
                    certidao_livro: sql.LIVRO,
                    certidao_folha: sql.FOLHA,
                    certidao_cartorio: sql.CARTORIO,
                    data_registro: sql.DTREGISTRO,
                    certidao_data_emissao: sql.DTREGISTRO,

                    ficha_saude: {
                        plano_saude: sql.PLANODESAUDE, alergias: sql.ALERGIAS, instrucoes_febre: sql.EMCASODEFEBRE,
                        doencas_cronicas: [sql.ASMA === 'S' ? 'Asma' : null, sql.DIABETES === 'S' ? 'Diabetes' : null, sql.EPLEPSIA === 'S' ? 'Epilepsia' : null, sql.HIPERTENSAO === 'S' ? 'Hipertensao' : null].filter(Boolean)
                    },
                    enrolledYears: Array.from(years).sort(), enrollmentHistory: history,
                    lastUpdated: new Date().toISOString(),
                    password: "" // Forced empty
                };

                imports.push({ id: existingDocId, data: cleanObject(sData) });
            }
        }
    });

    console.log(`- Firestore: Reconciling ${imports.length} students...`);
    let added = 0; let updated = 0;

    // Batch commit logic
    for (let i = 0; i < imports.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = imports.slice(i, i + 400);
        chunk.forEach(item => {
            if (item.id) {
                batch.update(doc(db, "students", item.id), item.data);
                updated++;
            } else {
                batch.set(doc(collection(db, "students")), item.data);
                added++;
            }
        });
        await batch.commit();
        console.log(`  - Commited ${added + updated} processed...`);
    }

    console.log(`>>> FINISHED ${unitId}: Added ${added}, Updated ${updated} <<<`);
}

async function runAll() {
    const tasks = [
        { id: 'unit_bs', a: './migration_data/Alunos_BS.sql', m: './migration_data/Maticulas_BS.sql' },
        { id: 'unit_zn', a: './migration_data/Alunos_ZN.sql', m: './migration_data/Maticulas_ZN.sql' },
        { id: 'unit_qui', a: './migration_data/Alunos_Quintas.sql', m: './migration_data/Maticulas_Quintas.sql' },
        // { id: 'unit_ex', a: './migration_data/Alunos_Extremoz.sql.sql', m: './migration_data/Maticulas_Extremoz.sql' } // DUPLICATE of Quintas - Disabled
    ];

    for (const task of tasks) {
        if (fs.existsSync(task.a) && fs.existsSync(task.m)) {
            await masterReconcile(task.id, task.a, task.m);
        } else {
            console.log(`\n[!] Skipping ${task.id}: Files not found at ${task.a} or ${task.m}`);
        }
    }

    console.log("\n--- MISSION ACCOMPLISHED ---");
}

runAll().catch(console.error);
