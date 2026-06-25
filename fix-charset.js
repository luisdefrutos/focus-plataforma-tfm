const fs = require('fs');

const inFile = 'mysqldump-utf8.sql';
const outFile = 'mysqldump-utf8-fixed.sql';

console.log('Starting charset replacement...');
const readStream = fs.createReadStream(inFile, { encoding: 'utf8' });
const writeStream = fs.createWriteStream(outFile, { encoding: 'utf8' });

let buffer = '';

readStream.on('data', (chunk) => {
    // Replace cp850 with utf8mb4. Since it might cross chunk boundaries, this is a bit naive 
    // but the SET NAMES cp850 is usually right at the beginning (line 14 or so)
    // We can just do a simple replace on the chunk
    chunk = chunk.replace(/SET NAMES cp850/g, "SET NAMES utf8mb4");
    writeStream.write(chunk);
});

readStream.on('end', () => {
    console.log('Replacement complete!');
    writeStream.end();
});
