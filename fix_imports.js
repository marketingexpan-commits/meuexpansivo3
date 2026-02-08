const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // Replace './src/' with './'
            content = content.replace(/from '\.\/src\//g, "from './");
            content = content.replace(/from "\.\/src\//g, 'from "./');

            // Replace '../src/' with '../'
            content = content.replace(/from '\.\.\/src\//g, "from '../");
            content = content.replace(/from "\.\.\/src\//g, 'from "../');

            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated imports in: ${fullPath}`);
            }
        }
    }
}

const targetDir = path.join(__dirname, 'app-aluno', 'src');
console.log(`Starting migration in ${targetDir}...`);
processDir(targetDir);
console.log('Migration complete.');
