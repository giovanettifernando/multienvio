// SMTP Connection Test Script
const nodemailer = require('nodemailer');

async function testSMTPConnection() {
  console.log('=== Testing SMTP Connection ===\n');

  const configs = [
    {
      name: 'Port 465 (SSL/TLS)',
      host: 'smtp.titan.email',
      port: 465,
      secure: true,
      auth: {
        user: 'enviolegal@app.neoera.com.br',
        pass: 'Jedi2025@#',
      },
    },
    {
      name: 'Port 587 (STARTTLS)',
      host: 'smtp.titan.email',
      port: 587,
      secure: false,
      auth: {
        user: 'enviolegal@app.neoera.com.br',
        pass: 'Jedi2025@#',
      },
    },
  ];

  for (const config of configs) {
    console.log(`\nTesting: ${config.name}`);
    console.log(`Host: ${config.host}`);
    console.log(`Port: ${config.port}`);
    console.log(`Secure: ${config.secure}`);
    console.log(`User: ${config.auth.user}`);

    const transporter = nodemailer.createTransport(config);

    try {
      console.log('Verifying connection...');
      await transporter.verify();
      console.log('✓ Connection successful!');

      // Try sending a test email
      console.log('Sending test email...');
      const info = await transporter.sendMail({
        from: `"Envio Legal Test" <${config.auth.user}>`,
        to: config.auth.user, // Send to self
        subject: 'Test Email - SMTP Configuration',
        text: 'This is a test email to verify SMTP configuration.',
        html: '<p>This is a test email to verify SMTP configuration.</p>',
      });
      console.log('✓ Email sent successfully!');
      console.log('Message ID:', info.messageId);
      console.log('Response:', info.response);

      return config; // Return successful config
    } catch (error) {
      console.log('✗ Error:', error.message);
      if (error.code) {
        console.log('Error Code:', error.code);
      }
      if (error.responseCode) {
        console.log('Response Code:', error.responseCode);
      }
      if (error.response) {
        console.log('Server Response:', error.response);
      }
    }
  }

  console.log('\n=== All configurations failed ===');
  console.log('\nPossible issues:');
  console.log('1. Credentials are incorrect');
  console.log('2. SMTP access needs to be enabled in Titan Email settings');
  console.log('3. Two-factor authentication requires an app-specific password');
  console.log('4. Firewall blocking SMTP ports (465, 587)');
  console.log('5. Account requires additional verification');
}

testSMTPConnection()
  .then(() => {
    console.log('\n=== Test complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  });
