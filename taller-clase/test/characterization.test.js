// test/order_service.test.js
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const orderService = require('../src/legacy_order_service');

test.describe('Pruebas de Caracterización y Refactorización de Órdenes', () => {

  beforeEach(() => {
    // Restablecer el inventario a su estado inicial conocido antes de cada test
    orderService.resetInventory({
      'PROD-001': { name: 'Teclado Mecánico', stock: 20, price: 80.0 },
      'PROD-002': { name: 'Monitor 4K', stock: 10, price: 320.0 },
      'PROD-003': { name: 'Mouse Ergonómico', stock: 0, price: 45.0 },
      'PROD-004': { name: 'Cable USB-C', stock: 50, price: 12.0 }
    });
  });

  test('Debe procesar orden VIP local con descuento y envío gratis', () => {
    const orderRequest = {
      customer_id: 'CUST-TEST-1',
      user_type: 'VIP',
      coupon: 'DESC5',
      is_international: false,
      payment_method: 'CREDIT_CARD',
      card_number: '4111222233334444',
      items: [{ id: 'PROD-001', qty: 2 }] // 80 * 2 = 160
    };

    const result = orderService.processOrder(orderRequest);

    assert.equal(result.ok, true);
    assert.equal(result.data.subtotal, 160);
    assert.equal(result.data.discount, 13); // 160 * 0.05 (8) + 5 (DESC5) = 13
    assert.equal(result.data.shipping, 0); // Local > 100 gratis
    assert.equal(result.data.tax, 27.93); // (160 - 13) * 0.19 = 27.93
    assert.equal(result.data.total, 174.93);
    assert.equal(result.data.payment_status, 'PAID');
  });

  test('Debe rechazar orden cuando no hay stock disponible', () => {
    const orderRequest = {
      customer_id: 'CUST-TEST-2',
      user_type: 'REGULAR',
      payment_method: 'CASH',
      items: [{ id: 'PROD-003', qty: 1 }] // Stock 0
    };

    const result = orderService.processOrder(orderRequest);

    assert.equal(result.ok, false);
    assert.equal(result.msg, 'OUT_OF_STOCK_PROD-003');
  });

  test('Debe rechazar tarjeta de crédito con longitud insuficiente y aplicar rollback', () => {
    const orderRequest = {
      customer_id: 'CUST-TEST-3',
      user_type: 'REGULAR',
      payment_method: 'CREDIT_CARD',
      card_number: '123', // Inválida
      items: [{ id: 'PROD-001', qty: 1 }]
    };

    const initialStock = orderService.getInventory()['PROD-001'].stock;
    const result = orderService.processOrder(orderRequest);

    assert.equal(result.ok, false);
    assert.equal(result.msg, 'INVALID_CARD');
    // Verifica que el stock se haya devuelto al estado original
    assert.equal(orderService.getInventory()['PROD-001'].stock, initialStock);
  });
});