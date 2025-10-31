// Test script for /api/account/me endpoints
// Node.js 18+ has built-in fetch
const BASE_URL = 'http://localhost:3000';

async function testAccountEndpoints() {
  console.log('=== Testing /api/account/me endpoints ===\n');

  try {
    // Step 1: Login to get auth cookie
    console.log('1. Logging in as admin@enviolegal.com...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@enviolegal.com',
        password: 'admin123'
      })
    });

    if (!loginRes.ok) {
      const error = await loginRes.text();
      throw new Error(`Login failed: ${error}`);
    }

    const loginData = await loginRes.json();
    console.log('✅ Login successful:', loginData.user.email);

    // Extract cookie from response
    const setCookieHeader = loginRes.headers.get('set-cookie');
    if (!setCookieHeader) {
      throw new Error('No auth cookie received');
    }
    // Extract just the cookie value (before the first semicolon)
    const authCookie = setCookieHeader.split(';')[0];
    console.log('✅ Auth cookie received\n');

    // Step 2: Test GET /api/account/me
    console.log('2. Testing GET /api/account/me...');
    const getRes = await fetch(`${BASE_URL}/api/account/me`, {
      headers: {
        'Cookie': authCookie
      }
    });

    if (!getRes.ok) {
      const error = await getRes.text();
      throw new Error(`GET failed: ${error}`);
    }

    const getData = await getRes.json();
    console.log('✅ GET /api/account/me successful:');
    console.log(JSON.stringify(getData, null, 2));
    console.log();

    // Step 3: Test PUT /api/account/me with valid data
    console.log('3. Testing PUT /api/account/me with valid data...');
    const putRes = await fetch(`${BASE_URL}/api/account/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        name: 'Admin Atualizado',
        phone: '(11) 98765-4321',
        cpf: '123.456.789-09', // Valid CPF with checksum
      })
    });

    if (!putRes.ok) {
      const error = await putRes.text();
      throw new Error(`PUT failed: ${error}`);
    }

    const putData = await putRes.json();
    console.log('✅ PUT /api/account/me successful:');
    console.log(JSON.stringify(putData, null, 2));
    console.log();

    // Step 4: Test PUT with invalid CPF
    console.log('4. Testing PUT /api/account/me with invalid CPF...');
    const invalidCpfRes = await fetch(`${BASE_URL}/api/account/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        name: 'Admin Test',
        cpf: '123.456.789-00', // Invalid CPF checksum
      })
    });

    console.log(`Status: ${invalidCpfRes.status}`);
    const invalidCpfData = await invalidCpfRes.json();
    console.log('Response:', JSON.stringify(invalidCpfData, null, 2));
    console.log();

    // Step 5: Test PUT with invalid phone
    console.log('5. Testing PUT /api/account/me with invalid phone...');
    const invalidPhoneRes = await fetch(`${BASE_URL}/api/account/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        name: 'Admin Test',
        phone: '123', // Too short
      })
    });

    console.log(`Status: ${invalidPhoneRes.status}`);
    const invalidPhoneData = await invalidPhoneRes.json();
    console.log('Response:', JSON.stringify(invalidPhoneData, null, 2));
    console.log();

    // Step 6: Test PUT with attempt to change email
    console.log('6. Testing PUT /api/account/me with email change attempt...');
    const changeEmailRes = await fetch(`${BASE_URL}/api/account/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        name: 'Admin Test',
        email: 'newemail@example.com', // Should be rejected
      })
    });

    console.log(`Status: ${changeEmailRes.status}`);
    const changeEmailData = await changeEmailRes.json();
    console.log('Response:', JSON.stringify(changeEmailData, null, 2));
    console.log();

    console.log('=== All tests completed! ===');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAccountEndpoints();
