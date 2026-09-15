const fs = require('fs');
async function run() {
  const fileContent = fs.readFileSync('./csv/inscripciones (3).xlsx - inscripciones.csv');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let body = `--${boundary}\r\n`;
  body += 'Content-Disposition: form-data; name="file"; filename="test.csv"\r\n';
  body += 'Content-Type: text/csv\r\n\r\n';
  body += fileContent.toString('utf8') + '\r\n';
  body += `--${boundary}--\r\n`;

  const res = await fetch('http://localhost:3000/convocatorias/0408ab9c-363b-4b5f-9dc0-aeefdc2bc631/planillas', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: body
  });
  console.log(res.status, await res.text());
}
run();
