const fs = require('fs');

const inFile = 'mysqldump-ANONIMIZADO.sql';
const outFile = 'mysqldump-utf8.sql';

console.log('Starting conversion...');
const readStream = fs.createReadStream(inFile, { encoding: 'utf16le' });
const writeStream = fs.createWriteStream(outFile, { encoding: 'utf8' });

readStream.on('data', (chunk) => {
    // UTF16LE bom is read as a character, we can remove it from the first chunk
    if (chunk.charCodeAt(0) === 0xFEFF) {
        chunk = chunk.slice(1);
    }
    writeStream.write(chunk);
});

readStream.on('end', () => {
    console.log('Conversion complete!');
    writeStream.end();
});

readStream.on('error', (err) => {
    console.error('Error reading:', err);
});

writeStream.on('error', (err) => {
    console.error('Error writing:', err);
});
