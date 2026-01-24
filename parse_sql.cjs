const fs = require('fs');

async function parseFirstInsert() {
    const content = fs.readFileSync('migration_data/Alunos.sql', 'latin1');
    const match = content.match(/INSERT INTO ALUNO \((.*?)\) VALUES \((.*?)\)/is);

    if (match) {
        const columns = match[1].split(',').map(c => c.trim());
        const values = match[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        console.log("--- SQL COLUMNS AND VALUES EXAMPLE ---");
        columns.forEach((col, i) => {
            console.log(`${col}: ${values[i]}`);
        });
    } else {
        console.log("No INSERT statement found.");
        // Try a different match if the first one fails
        const headerMatch = content.match(/INSERT INTO ALUNO \((.*?)\)/i);
        if (headerMatch) {
            console.log("Columns found (no values match):");
            console.log(headerMatch[1]);
        }
    }
}

parseFirstInsert();
