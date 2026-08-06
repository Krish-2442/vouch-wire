const fs = require('fs');
const p = 'docker/mongo/init-replica-set.sh';
const c = fs.readFileSync(p, 'utf8');
fs.writeFileSync(p, c.replace(/\r\n/g, '\n'));
console.log('Fixed CRLF in', p);
