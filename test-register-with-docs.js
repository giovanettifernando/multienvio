/**
 * Test script to simulate collector registration with documents
 * This helps debug why documents aren't being saved
 */

async function testRegisterWithDocuments() {
  console.log('🧪 Testing Collector Registration with Documents\n');

  const mockPayload = {
    pf: {
      nome: 'Test Collector with Docs',
      cpf: '12345678901',
      email: 'testdocs@example.com',
      password: 'senha123',
      confirmPassword: 'senha123',
      cnh: {
        number: '12345678901',
        category: 'B',
        expiresAt: '2029-12-31',
      },
      endereco: {
        cep: '87050-000',
        logradouro: 'Rua Test',
        numero: '123',
        complemento: null,
        bairro: 'Centro',
        cidade: 'Maringá',
        uf: 'PR',
      },
      celular: '44988076116',
      whatsapp: null,
      usarMesmoNumero: true,
    },
    pj: {
      razaoSocial: 'Test Company LTDA',
      cnpj: '12345678000199',
      endereco: {
        cep: '87050-000',
        logradouro: 'Rua Test',
        numero: '123',
        complemento: null,
        bairro: 'Centro',
        cidade: 'Maringá',
        uf: 'PR',
      },
      usarEnderecoFisico: false,
    },
    vehicle: {
      plate: 'ABC1234',
      brand: 'Toyota',
      model: 'Corolla',
      year: '2020',
    },
    documents: {
      cnhFiles: [
        {
          uid: 'cnh-1',
          name: 'cnh-frente.pdf',
          url: 'http://localhost:3000/test-cnh.pdf',
          status: 'done',
        },
      ],
      crlvFile: [
        {
          uid: 'crlv-1',
          name: 'crlv.pdf',
          url: 'http://localhost:3000/test-crlv.pdf',
          status: 'done',
        },
      ],
      pfAddressProofFile: [
        {
          uid: 'address-1',
          name: 'comprovante.pdf',
          url: 'http://localhost:3000/test-address.pdf',
          status: 'done',
        },
      ],
    },
    commission: {
      kind: 'fixa',
      amount: 0,
    },
    bank: {
      kind: 'pix',
      pixType: 'cnpj',
      pixKey: '12345678000199',
    },
  };

  console.log('📤 Sending registration request...\n');
  console.log('Documents in payload:');
  console.log('  - CNH files:', mockPayload.documents.cnhFiles.length);
  console.log('  - CRLV files:', mockPayload.documents.crlvFile.length);
  console.log('  - Address Proof files:', mockPayload.documents.pfAddressProofFile.length);
  console.log();

  try {
    const response = await fetch('http://localhost:3000/api/coletores/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockPayload),
    });

    const data = await response.json();

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Registration successful!');
      console.log('   Collector ID:', data.collector.id);
      console.log('\n🔍 Now check the server logs for:');
      console.log('   [register] DOCUMENTS_CHECK');
      console.log('   [register] DOCUMENTS_STRUCTURE');
      console.log('   [register] DOCUMENTS_TO_SAVE');
      console.log('   [register] DOCUMENTS_SAVED or DOCUMENTS_EMPTY');
      console.log('\n📊 Verify documents in database:');
      console.log(`   SELECT * FROM collector_documents WHERE "collectorId" = '${data.collector.id}';`);
    } else {
      console.log('\n❌ Registration failed');
      console.log('   Error:', data.message);
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error);
  }
}

testRegisterWithDocuments();
