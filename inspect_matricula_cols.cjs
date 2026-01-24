const fs = require('fs');

function inspectFile(path, tableName) {
    const content = fs.readFileSync(path, 'latin1');
    const match = content.match(new RegExp(`INSERT INTO ${tableName}\\s*\\((.*?)\\)\\s*VALUES`, 'is'));
    if (match) {
        const cols = match[1].split(',').map(c => c.trim().toUpperCase());
        console.log(`Table: ${tableName}`);
        console.log(JSON.stringify(cols));
    }
}

inspectFile('./migration_data/Alunos.sql', 'ALUNO');
