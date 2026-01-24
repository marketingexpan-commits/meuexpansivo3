const fs = require('fs');

function getUniqueColumns() {
    const content = fs.readFileSync('migration_data/Alunos.sql', 'latin1');
    const inserts = content.split(';');
    const uniqueCols = new Set();

    inserts.forEach(seg => {
        const match = seg.match(/INSERT INTO ALUNO\s*\((.*?)\)/is);
        if (match) {
            match[1].split(',').forEach(c => uniqueCols.add(c.trim().toUpperCase()));
        }
    });

    console.log("--- UNIQUE COLUMNS IN ALUNO TABLE ---");
    console.log(Array.from(uniqueCols).sort().join('\n'));
}

getUniqueColumns();
