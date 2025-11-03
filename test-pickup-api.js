// Test script for Pickup Points API
const testPoint = {
  razaoSocial: "Ponto de Coleta Teste LTDA",
  nomeFantasia: "Ponto Teste Central",
  cnpj: "12345678000100",
  ie: "123456789",
  email: "contato@pontoteste.com.br",
  telefone: "11999887766",
  cep: "01310100",
  logradouro: "Avenida Paulista",
  numero: "1000",
  complemento: "Loja 5",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
  geo: {
    lat: -23.5617,
    lng: -46.6561
  },
  paymentMethod: {
    kind: "pix",
    pixType: "cnpj",
    pixKey: "12345678000100"
  },
  payoutDay: 15,
  minPayoutAmount: 100.00,
  commissionPerItem: 2.50,
  capacityPerDay: 50
};

async function login() {
  const response = await fetch('http://localhost:3000/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@enviolegal.com',
      password: 'admin123',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Login failed: ${error.message}`);
  }

  const cookie = response.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('No cookie received');
  }

  const tokenMatch = cookie.match(/admin_auth=([^;]+)/);
  if (!tokenMatch) {
    throw new Error('Token not found in cookie');
  }

  return tokenMatch[1];
}

async function createPickupPoint(token) {
  console.log('\n🔵 Creating pickup point...');
  const response = await fetch('http://localhost:3000/api/admin/pickup-points', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_auth=${token}`,
    },
    body: JSON.stringify(testPoint),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Failed to create:', error);
    throw new Error(`Create failed: ${error.message}`);
  }

  const data = await response.json();
  console.log('✅ Created:', data.point);
  return data.point;
}

async function listPickupPoints(token) {
  console.log('\n🔵 Listing pickup points...');
  const response = await fetch('http://localhost:3000/api/admin/pickup-points', {
    headers: {
      'Cookie': `admin_auth=${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`List failed: ${error.message}`);
  }

  const data = await response.json();
  console.log(`✅ Found ${data.total} points`);
  console.log('Items:', data.items);
  return data;
}

async function updatePickupPoint(token, id) {
  console.log('\n🔵 Updating pickup point...');
  const response = await fetch(`http://localhost:3000/api/admin/pickup-points/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `admin_auth=${token}`,
    },
    body: JSON.stringify({
      nomeFantasia: "Ponto Teste Atualizado",
      capacityPerDay: 100,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Update failed: ${error.message}`);
  }

  const data = await response.json();
  console.log('✅ Updated:', data.point);
  return data.point;
}

async function toggleStatus(token, id) {
  console.log('\n🔵 Toggling status...');
  const response = await fetch(`http://localhost:3000/api/admin/pickup-points/${id}/status`, {
    method: 'POST',
    headers: {
      'Cookie': `admin_auth=${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Toggle failed: ${error.message}`);
  }

  const data = await response.json();
  console.log('✅ Toggled:', data.point);
  return data.point;
}

async function deletePickupPoint(token, id) {
  console.log('\n🔵 Deleting pickup point...');
  const response = await fetch(`http://localhost:3000/api/admin/pickup-points/${id}`, {
    method: 'DELETE',
    headers: {
      'Cookie': `admin_auth=${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Delete failed: ${error.message}`);
  }

  const data = await response.json();
  console.log('✅ Deleted:', data.message);
}

async function runTests() {
  try {
    console.log('🚀 Starting Pickup Points API tests...\n');

    // Login
    console.log('🔵 Logging in...');
    const token = await login();
    console.log('✅ Logged in successfully');

    // Create
    const created = await createPickupPoint(token);

    // List
    await listPickupPoints(token);

    // Update
    await updatePickupPoint(token, created.id);

    // Toggle status
    await toggleStatus(token, created.id);

    // List again
    await listPickupPoints(token);

    // Delete
    await deletePickupPoint(token, created.id);

    // List final
    await listPickupPoints(token);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
