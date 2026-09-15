const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:holaquehace@localhost:5432/becas?schema=public' });
async function main() {
  await client.connect();
  const res = await client.query(`SELECT * FROM padron_academico WHERE dni='40501524'`);
  console.log('CORREA SAPIEGA:', res.rows[0]);
}
main().finally(() => client.end());

