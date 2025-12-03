#!/usr/bin/env node
/**
 * Test script for Correios label (rótulo) download
 * Usage: node scripts/test-correios-rotulo.mjs [tracking-code-or-id]
 */

import { createRequire } from 'module';
import { writeFileSync } from 'fs';

// Load environment from .env.local
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// We need to make an HTTP request to the API endpoint since we can't import TS directly
const BASE_URL = 'http://localhost:3000';

async function testRotuloDownload(codigo) {
  console.log('\n=== Testing Correios Rótulo Download ===\n');
  console.log(`Input: ${codigo}`);
  console.log(`Endpoint: POST ${BASE_URL}/api/admin/integrations/correios/rotulo`);
  console.log('');

  try {
    const response = await fetch(`${BASE_URL}/api/admin/integrations/correios/rotulo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real usage, auth cookie would be needed
      },
      body: JSON.stringify({ codigo }),
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (response.ok) {
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/pdf')) {
        const buffer = await response.arrayBuffer();
        const filename = `rotulo_${codigo}.pdf`;
        writeFileSync(filename, Buffer.from(buffer));
        console.log(`\n✅ SUCCESS! PDF saved to: ${filename}`);
        console.log(`   File size: ${buffer.byteLength} bytes`);
      } else {
        const data = await response.json();
        console.log('\n❌ Unexpected response format:');
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      console.log('\n❌ Error response:');
      console.log(JSON.stringify(errorData, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
  }
}

// Get tracking code from command line args
const codigo = process.argv[2] || 'AN312817735BR';
testRotuloDownload(codigo);
