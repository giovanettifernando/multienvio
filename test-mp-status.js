const { MercadoPagoConfig, Payment } = require('mercadopago');

async function checkPaymentStatus() {
  const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    options: { timeout: 5000 },
  });

  const payment = new Payment(client);

  try {
    const result = await payment.get({ id: '1342664963' });

    console.log('\n=== STATUS DO PAGAMENTO NO MP ===');
    console.log('ID:', result.id);
    console.log('Status:', result.status);
    console.log('Status Detail:', result.status_detail);
    console.log('Date Created:', result.date_created);
    console.log('Date Approved:', result.date_approved);
    console.log('Transaction Amount:', result.transaction_amount);
    console.log('Payment Type:', result.payment_type_id);
    console.log('\n=================================\n');
  } catch (error) {
    console.error('Erro ao consultar MP:', error.message);
  }
}

checkPaymentStatus();
