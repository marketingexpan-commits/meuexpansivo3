import { readFileSync } from 'fs';

function findStudentInSql(nameSnippet) {
    const alumnosContent = readFileSync('./migration_data/Alunos.sql', 'utf8');
    const alumnoRegex = /INSERT INTO ALUNO\s*\([^]*?VALUES\s*\((.*?)\);/gs;
    let match;
    console.log(`Searching for "${nameSnippet}" in Alunos.sql...`);
    while ((match = alumnoRegex.exec(alumnosContent)) !== null) {
        if (match[0].toUpperCase().includes(nameSnippet.toUpperCase())) {
            const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
            console.log('Match found in Alunos.sql:');
            console.log('  Raw values snippet:', match[1].substring(0, 200) + '...');
            console.log('  CODIGO (index 0):', values[0]);
            console.log('  MATRICULA (index 1):', values[1]);
            console.log('  ALUNO Name (index 3):', values[3]);
            return values[0]; // Return CODIGO for further search
        }
    }
    return null;
}

function findEnrollmentsInSql(codigo) {
    if (!codigo) return;
    const matriculasContent = readFileSync('./migration_data/Maticulas.sql', 'utf8');
    const matriculaRegex = /INSERT INTO MATRICULA\s*\([^]*?VALUES\s*\((.*?)\);/gs;
    let match;
    console.log(`\nSearching for enrollments for CODIGO "${codigo}" in Matriculas.sql...`);
    while ((match = matriculaRegex.exec(matriculasContent)) !== null) {
        const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        if (values[1] === codigo) {
            console.log(`  Found: Year ${values[0]} | MATRICULA in MAT table: ${values[2]} | Grad: ${values[3]} | Serie: ${values[4]}`);
        }
    }
}

const isabellaCodigo = findStudentInSql('ISABELLA CAROLYNNA');
findEnrollmentsInSql(isabellaCodigo);

const aliceCodigo = findStudentInSql('ALICE LIANE MEDEIROS COSTAOBREGA');
findEnrollmentsInSql(aliceCodigo);
