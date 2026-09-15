const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:holaquehace@localhost:5432/becas?schema=public' });
async function main() {
  await client.connect();
  await client.query(`UPDATE padron_academico SET regularizadas=46, aprobadas=42, aplazos=0, promedio='8.03' WHERE dni='40501524'`);
  console.log('Correa Sapiega updated');
  client.end();
}
main();

