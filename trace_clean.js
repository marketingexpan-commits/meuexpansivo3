import { readFileSync } from 'fs';

function trace(query) {
    const content = readFileSync('./migration_data/Alunos.sql', 'utf8');
    const regex = /INSERT INTO ALUNO\s*\((.*?)\)\s*VALUES\s*\((.*?)\);/gs;
    let match;
    console.log(`\n--- TRACE: ${query} ---`);
    while ((match = regex.exec(content)) !== null) {
        const columns = match[1].split(',').map(c => c.trim());
        const values = match[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        if (values.some(v => v.toUpperCase().includes(query.toUpperCase()))) {
            console.log('Match in Alunos.sql:');
            columns.forEach((col, i) => {
                if (['CODIGO', 'MATRICULA', 'ALUNO'].includes(col)) {
                    console.log(`  ${col}: ${values[i]}`);
                }
            });

            const codigo = values[columns.indexOf('CODIGO')];
            traceMatriculas(codigo);
        }
    }
}

function traceMatriculas(codigo) {
    const content = readFileSync('./migration_data/Maticulas.sql', 'utf8');
    const regex = /INSERT INTO MATRICULA\s*\((.*?)\)\s*VALUES\s*\((.*?)\);/gs;
    let match;
    console.log(`Enrollments for CODIGO ${codigo}:`);
    while ((match = regex.exec(content)) !== null) {
        const columns = match[1].split(',').map(c => c.trim());
        const values = match[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        if (values[columns.indexOf('CODIGO')] === codigo) {
            console.log(`  Year: ${values[columns.indexOf('ANO')]} | Mat: ${values[columns.indexOf('MATRICULA')]}`);
        }
    }
}

trace('ISABELLA CAROLYNNA');
trace('ALICE LIANE');
trace('MARIA CLARA RODRIGUES');
