import fetch from 'node-fetch';

const base = 'https://crimson-hub-backend-deployment-production.up.railway.app';

async function test(path) {
  try {
    const res = await fetch(base + path, { method: 'GET' });
    const body = await res.text();
    console.log('PATH', path, 'STATUS', res.status);
    console.log('BODY', body);
  } catch (err) {
    console.error('ERROR', path, err);
  }
}

(async () => {
  await test('/');
  await test('/api/auth/test-email');
})();
