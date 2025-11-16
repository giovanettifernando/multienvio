/**
 * Debug script to test Nominatim geocoding for specific CEPs
 */

const CEP_TEST = '58035-100';

async function testNominatim() {
  console.log(`\nTesting Nominatim for CEP ${CEP_TEST}...\n`);

  // 1. Get CEP data from BrasilAPI
  const cepResponse = await fetch(`https://brasilapi.com.br/api/cep/v2/58035100`);
  const cepData = await cepResponse.json();

  console.log('BrasilAPI data:');
  console.log(JSON.stringify(cepData, null, 2));
  console.log();

  // Test TENTATIVA A - Full address
  if (cepData.street && cepData.neighborhood) {
    const addressParts = [
      cepData.street,
      cepData.neighborhood,
      cepData.city,
      cepData.state,
      'Brazil',
    ].filter(Boolean);

    const fullAddress = addressParts.join(', ');
    console.log('TENTATIVA A - Full address:', fullAddress);

    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`;
      console.log('URL:', nominatimUrl);

      const response = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'Envio Legal App' },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data && data.length > 0) {
          console.log(`✅ SUCCESS - Lat: ${data[0].lat}, Lng: ${data[0].lon}`);
        } else {
          console.log('❌ No results');
        }
      } else {
        console.log(`❌ Error: Status ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }

  console.log('\n---\n');

  // Test TENTATIVA B - CEP isolated
  const zipcodeParts = [
    '58035100',
    cepData.city,
    cepData.state,
    'Brazil',
  ];

  const zipcodeQuery = zipcodeParts.join(', ');
  console.log('TENTATIVA B - CEP isolated:', zipcodeQuery);

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zipcodeQuery)}&limit=1`;
    console.log('URL:', nominatimUrl);

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'Envio Legal App' },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));

      if (data && data.length > 0) {
        console.log(`✅ SUCCESS - Lat: ${data[0].lat}, Lng: ${data[0].lon}`);
      } else {
        console.log('❌ No results');
      }
    } else {
      console.log(`❌ Error: Status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testNominatim();
