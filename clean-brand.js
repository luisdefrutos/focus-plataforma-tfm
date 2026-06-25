const fs = require('fs');
const path = require('path');

const DIRECTORIES = ['app/src', 'docs', 'README.md', 'CONTEXTO_IDE.md', 'GUIA_INSTALACION_Y_CURSO.md'];
const REPLACEMENTS = [
  { regex: /TÜV SÜD/g, replacement: 'TÜV LFD' },
  { regex: /TUV SUD/g, replacement: 'TUV LFD' },
  { regex: /ATISAE/g, replacement: 'INSPECCION_SA' },
  { regex: /0158/g, replacement: '9999' },
  { regex: /0135/g, replacement: '8888' },
];

function processPath(target) {
  const fullPath = path.resolve(__dirname, target);
  if (!fs.existsSync(fullPath)) return;
  
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    fs.readdirSync(fullPath).forEach(file => {
      processPath(path.join(target, file));
    });
  } else if (stat.isFile()) {
    if (!fullPath.match(/\.(md|tsx|ts|html|txt|json)$/)) return;
    if (fullPath.includes('node_modules')) return;
    if (fullPath.includes('.next')) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    for (const { regex, replacement } of REPLACEMENTS) {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Updated ${target}`);
    }
  }
}

console.log('Iniciando limpieza de marca...');
DIRECTORIES.forEach(processPath);
console.log('Limpieza completada.');
