import fetch from 'node-fetch';

(async () => {
  try {
    const res = await fetch('https://crimson-hub-backend-deployment-production.up.railway.app/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstname: 'Test',
        lastname: 'User',
        email: 'testsignup+1@example.com',
        password: 'Password123',
        phone: '09123456789',
        department: 'CS',
        role_id: '1'
      })
    });
    console.log('STATUS', res.status);
    console.log('HEADERS', res.headers.raw());
    const body = await res.text();
    console.log('BODY', body);
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
