const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../dados_2026/ZN');

if (!fs.existsSync(targetDir)) {
    console.error(`Folder not found: ${targetDir}`);
    process.exit(1);
}

const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.csv'));

console.log(`🔍 Analyzing CSV files in ${targetDir}...\n`);

files.forEach(file => {
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, 'latin1'); // Trying latin1 for Windows Excel CSVs often
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

    console.log(`📄 File: ${file}`);
    const size = fs.statSync(filePath).size;
    console.log(`   Size: ${size} bytes`);
    console.log(`   Lines: ${lines.length}`);

    if (lines.length > 0) {
        console.log(`   Header: ${lines[0]}`);
        if (lines.length > 1) {
            console.log(`   Row 1:  ${lines[1]}`);
        }
    }
    console.log('---');
});
