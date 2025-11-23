import { invalidateConfigCache } from '@/lib/mercadopago/config';

console.log('Limpando cache da configuração do Mercado Pago...');
invalidateConfigCache();
console.log('✅ Cache limpo com sucesso!');
console.log('\nReinicie o servidor para aplicar as mudanças.');
