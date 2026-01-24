const fs = require('fs');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs, writeBatch } = require("firebase/firestore");

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

async function deepSync() {
    console.log("--- STARTING FINAL DATA SYNC (SMART STATUS INFERENCE) ---");

    // 1. Parse Enrollments (Maticulas.sql) to find Last Year per Student
    console.log("Reading Maticulas.sql...");
    const matriculasContent = fs.readFileSync('./migration_data/Maticulas.sql', 'latin1');
    const lastYearMap = {}; // CODIGO -> Max Year (int)

    const matInserts = matriculasContent.split(';');
    matInserts.forEach(seg => {
        const match = seg.match(/INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
        if (match) {
            const colNames = match[1].split(',').map(c => c.trim().toUpperCase());
            const valStr = match[2].trim().replace(/\)$/s, '');
            const vals = valStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));

            const obj = {};
            colNames.forEach((col, i) => { if (i < vals.length) obj[col] = vals[i]; });

            if (obj.CODIGO && obj.ANO) {
                const year = parseInt(obj.ANO.split('.')[0]); // "2025.1" -> 2025
                if (!lastYearMap[obj.CODIGO] || year > lastYearMap[obj.CODIGO]) {
                    lastYearMap[obj.CODIGO] = year;
                }
            }
        }
    });
    console.log(`Mapped max enrollment years for ${Object.keys(lastYearMap).length} students.`);


    // 2. Parse Students (Alunos.sql)
    console.log("Reading Alunos.sql...");
    const alumnosContent = fs.readFileSync('./migration_data/Alunos.sql', 'latin1');
    const sqlData = {};

    function parseSqlValues(str) {
        const results = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === "'" && (i === 0 || str[i - 1] !== "\\")) {
                inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
                results.push(current.trim().replace(/^'|'$/g, ''));
                current = "";
            } else {
                current += char;
            }
        }
        results.push(current.trim().replace(/^'|'$/g, ''));
        return results;
    }

    const inserts = alumnosContent.split(';');
    inserts.forEach(seg => {
        const match = seg.match(/INSERT INTO ALUNO\s*\((.*?)\)\s*VALUES\s*\((.*)/is);
        if (match) {
            const colNamesFromSeg = match[1].split(',').map(c => c.trim().toUpperCase());
            const valStr = match[2].trim().replace(/\)$/s, '');
            const vals = parseSqlValues(valStr);

            const obj = {};
            colNamesFromSeg.forEach((col, i) => {
                if (i < vals.length) obj[col] = vals[i];
            });

            if (obj.CODIGO) {
                sqlData[obj.CODIGO] = obj;
            }
        }
    });
    console.log(`Mapped ${Object.keys(sqlData).length} unique student profiles.`);

    // 3. Fetch Firestore Students
    console.log("Fetching Firestore students...");
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("unit", "==", "unit_qui"));
    const querySnapshot = await getDocs(q);
    console.log(`Fetched ${querySnapshot.size} students to update.`);

    let updatedCount = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const studentDoc of querySnapshot.docs) {
        const data = studentDoc.data();
        const code = String(data.code);
        const sql = sqlData[code];
        const lastYear = lastYearMap[code] || 0;

        if (sql) {
            const updates = {};

            // --- ALL PREVIOUS MAPPINGS (Preserved) ---
            if (sql.ALUNO && data.name !== sql.ALUNO) updates.name = sql.ALUNO;
            if (sql.DTINICIO && data.data_inicio !== sql.DTINICIO) updates.data_inicio = sql.DTINICIO;
            if (sql.NASCIMENTO && data.data_nascimento !== sql.NASCIMENTO) updates.data_nascimento = sql.NASCIMENTO;
            if (sql.SEXO && data.sexo !== sql.SEXO) updates.sexo = sql.SEXO;
            if (sql.ANACIONAL && data.nacionalidade !== sql.ANACIONAL) updates.nacionalidade = sql.ANACIONAL;
            if (sql.ANATUAL && data.naturalidade !== sql.ANATUAL) updates.naturalidade = sql.ANATUAL;
            if (sql.NAUF && data.uf_naturalidade !== sql.NAUF) updates.uf_naturalidade = sql.NAUF;
            if (sql.ALIAS && data.alias !== sql.ALIAS) updates.alias = sql.ALIAS;

            // Identity
            if (sql.ARG && data.identidade_rg !== sql.ARG) updates.identidade_rg = sql.ARG;
            if (sql.ARGEMISS && data.rg_emissor !== sql.ARGEMISS) updates.rg_emissor = sql.ARGEMISS;
            if (sql.ACPF && sql.ACPF.replace(/\D/g, '').length >= 11) {
                if (data.cpf_aluno !== sql.ACPF) updates.cpf_aluno = sql.ACPF;
            }

            // Registry Data
            if (sql.REGISTRO && data.certidao_numero !== sql.REGISTRO) updates.certidao_numero = sql.REGISTRO;
            if (sql.LIVRO && data.certidao_livro !== sql.LIVRO) updates.certidao_livro = sql.LIVRO;
            if (sql.FOLHA && data.certidao_folha !== sql.FOLHA) updates.certidao_folha = sql.FOLHA;
            if (sql.CARTORIO && data.certidao_cartorio !== sql.CARTORIO) updates.certidao_cartorio = sql.CARTORIO;
            if (sql.DTREGISTRO && data.certidao_data_emissao !== sql.DTREGISTRO) updates.certidao_data_emissao = sql.DTREGISTRO;

            // Filiation
            if (sql.PAI && data.nome_pai !== sql.PAI) updates.nome_pai = sql.PAI;
            if (sql.MAE && data.nome_mae !== sql.MAE) updates.nome_mae = sql.MAE;
            if (sql.PFONE && data.pai_telefone !== sql.PFONE) updates.pai_telefone = sql.PFONE;
            if (sql.MFONE && data.mae_telefone !== sql.MFONE) updates.mae_telefone = sql.MFONE;
            if (sql.PPROFISSAO && data.pai_profissao !== sql.PPROFISSAO) updates.pai_profissao = sql.PPROFISSAO;
            if (sql.PNATURAL && data.pai_naturalidade !== sql.PNATURAL) updates.pai_naturalidade = sql.PNATURAL;
            if (sql.MPROFISSAO && data.mae_profissao !== sql.MPROFISSAO) updates.mae_profissao = sql.MPROFISSAO;
            if (sql.MNATURAL && data.mae_naturalidade !== sql.MNATURAL) updates.mae_naturalidade = sql.MNATURAL;

            // Responsible
            if (sql.RESPONSAVEL && data.nome_responsavel !== sql.RESPONSAVEL) updates.nome_responsavel = sql.RESPONSAVEL;
            if (sql.RFONE && data.telefone_responsavel !== sql.RFONE) updates.telefone_responsavel = sql.RFONE;
            if (sql.RCPF && data.cpf_responsavel !== sql.RCPF) updates.cpf_responsavel = sql.RCPF;
            if (sql.RRG && data.rg_responsavel !== sql.RRG) updates.rg_responsavel = sql.RRG;
            if (sql.REMAIL && data.email_responsavel !== sql.REMAIL) updates.email_responsavel = sql.REMAIL;

            // Address
            if (sql.AENDERECO && data.endereco_logradouro !== sql.AENDERECO) updates.endereco_logradouro = sql.AENDERECO;
            if (sql.ANUM && data.endereco_numero !== sql.ANUM) updates.endereco_numero = sql.ANUM;
            if (sql.ABAIRRO && data.endereco_bairro !== sql.ABAIRRO) updates.endereco_bairro = sql.ABAIRRO;
            if (sql.ACIDADE && data.endereco_cidade !== sql.ACIDADE) updates.endereco_cidade = sql.ACIDADE;
            if (sql.AUF && data.endereco_uf !== sql.AUF) updates.endereco_uf = sql.AUF;
            if (sql.ACEP && data.cep !== sql.ACEP) updates.cep = sql.ACEP;
            if (sql.PROCEDENCIA && data.procedencia_escolar !== sql.PROCEDENCIA) updates.procedencia_escolar = sql.PROCEDENCIA;
            if (sql.RELIGIAO && data.religiao !== sql.RELIGIAO) updates.religiao = sql.RELIGIAO;
            if (sql.ALOCAL) {
                const val = String(sql.ALOCAL).trim().toUpperCase();
                let zona = null;
                if (val === 'U') zona = 'Urbana';
                else if (val === 'R') zona = 'Rural';

                if (zona && data.localizacao_tipo !== zona) {
                    updates.localizacao_tipo = zona;
                }
            }

            // Scholarship & Authorization
            if (sql.BOLSA && data.bolsa_percentual !== sql.BOLSA) {
                updates.bolsa_percentual = sql.BOLSA;
                if (parseInt(sql.BOLSA) >= 100) updates.isScholarship = true;
            }
            if (sql.AUTORIZA && data.autorizacao_bolsa !== sql.AUTORIZA) updates.autorizacao_bolsa = sql.AUTORIZA;

            // --- SMART STATUS LOGIC (Official Legend) ---
            const statusMap = {
                '00': 'CURSANDO',
                '01': 'TRANSFERIDO',
                '03': 'EVADIDO',
                '09': 'TRANCADO',
                '05': 'RESERVADO',
                '10': 'ATIVO',
                '88': 'REPROVADO',
                '99': 'APROVADO'
            };

            const legacyStatus = statusMap[sql.CODSIT];

            if (legacyStatus) {
                // Special check: Only mark as CURSANDO/ATIVO if it's recent (>= 2024)
                // To avoid marking students from 2015 as "CURSANDO" just because codsit is 00
                const isRecent = lastYear >= 2024;
                const isActiveStatus = ['CURSANDO', 'ATIVO', 'RESERVADO'].includes(legacyStatus);

                if (isActiveStatus) {
                    const finalStatus = isRecent ? legacyStatus : 'CONCLUÍDO';
                    if (data.status !== finalStatus) updates.status = finalStatus;
                } else {
                    // Constant statuses like TRANSFERIDO, EVADIDO, etc.
                    if (data.status !== legacyStatus) updates.status = legacyStatus;
                }
            } else if (lastYear > 0 && lastYear < 2024) {
                // No specific code, but it's an old record
                if (data.status !== 'CONCLUÍDO') updates.status = 'CONCLUÍDO';
            }

            if (Object.keys(updates).length > 0) {
                batch.update(studentDoc.ref, updates);
                batchCount++;
                updatedCount++;

                if (batchCount >= 450) {
                    await batch.commit();
                    console.log(`Commit: ${updatedCount} students...`);
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }
        }
    }

    if (batchCount > 0) await batch.commit();
    console.log(`--- SYNC COMPLETED: ${updatedCount} updated ---`);
}

deepSync().catch(console.error);
