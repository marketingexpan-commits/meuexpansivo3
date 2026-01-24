const fs = require('fs');
const content = fs.readFileSync('migration_data/Alunos.sql', 'latin1');
const matchCols = content.match(/INSERT INTO ALUNO\s*\((.*?)\)/is);

if (matchCols) {
    const cols = matchCols[1].split(',').map(c => c.trim().toUpperCase());
    const codsitIdx = cols.indexOf('CODSIT');
    const alunoIdx = cols.indexOf('ALUNO');

    const matches = content.matchAll(/VALUES\s*\((.*?)\)/gis);
    const stats = {};

    for (const m of matches) {
        const valStr = m[1].trim();
        // Simple CSV split (not handling commas inside quotes for now, but good enough for code lookup)
        const vals = valStr.split(',').map(v => v.trim().replace(/^'|'$/g, ''));

        const code = vals[codsitIdx] || 'NULL';
        const name = vals[alunoIdx] || 'Unknown';

        if (!stats[code]) {
            stats[code] = { count: 0, examples: [] };
        }
        stats[code].count++;
        if (stats[code].examples.length < 5) {
            stats[code].examples.push(name);
        }
    }

    console.log('--- ANALYSIS OF CODSIT (Situação) ---');
    const sorted = Object.entries(stats).sort((a, b) => b[1].count - a[1].count);

    sorted.forEach(([code, data]) => {
        // Filter out obvious noise (phone numbers or long text) unless it's frequent
        if (code.length < 10 || data.count > 1) {
            console.log(`Code [${code}]: ${data.count} students`);
            console.log(`   Examples: ${data.examples.join(', ')}`);
        }
    });
} else {
    console.log('Could not parse ALUNO table columns.');
}
