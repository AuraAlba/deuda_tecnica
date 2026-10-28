const test = require('node:test');
const assert = require('node:assert');
const Money = require('../src/domain/Money');
const Subscription = require('../src/domain/Subscription');
const ProcessBillingUseCase = require('../src/application/ProcessBillingUseCase');

// Mocks para los puertos (Repositorio y Pasarela)
class MockRepository {
  constructor(initialSubscription) {
    this.subscription = initialSubscription;
  }
  async findById(_id) {
    return this.subscription;
  }
  async save(subscription) {
    this.subscription = subscription;
    return true;
  }
}

class MockGateway {
  constructor(success = true) {
    this.success = success;
  }
  async charge(_subscription, _amount, _reference) {
    return { success: this.success, reference: 'TX_TEST_123' };
  }
}

test('Money Value Object maneja precisión monetaria basada en centavos', () => {
  const m1 = Money.fromDecimal(10.50);
  const m2 = Money.fromDecimal(5.25);
  const sum = m1.add(m2);
  assert.strictEqual(sum.toDecimal(), 15.75);
});

test('ProcessBillingUseCase procesa el cobro exitosamente para una suscripción activa', async () => {
  const subData = {
    id: 'sub_101',
    customerEmail: 'carlos.mendoza@empresa-alfa.com',
    plan: 'ENTERPRISE',
    amount: 200.00,
    currency: 'USD',
    country: 'US',
    billingCycle: 'MONTHLY',
    status: 'ACTIVE',
    paymentMethod: 'CREDIT_CARD',
    cardLast4: '4242',
    balance: 0
  };

  const repo = new MockRepository(new Subscription(subData));
  const gateway = new MockGateway(true);
  const useCase = new ProcessBillingUseCase(repo, gateway);

  const result = await useCase.execute('sub_101');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.code, 'BILLING_PROCESSED');
  assert.strictEqual(result.subId, 'sub_101');
});

test('ProcessBillingUseCase maneja fallos de pasarela e incrementa reintentos', async () => {
  const subData = {
    id: 'sub_104',
    customerEmail: 'usuario.moroso@freemail.com',
    plan: 'STARTER',
    amount: 29.00,
    currency: 'USD',
    country: 'AR',
    billingCycle: 'MONTHLY',
    status: 'ACTIVE',
    paymentMethod: 'CREDIT_CARD',
    cardLast4: '9999',
    balance: 0,
    retryCount: 0
  };

  const repo = new MockRepository(new Subscription(subData));
  const gateway = new MockGateway(false); // Simula fallo o timeout de pasarela
  const useCase = new ProcessBillingUseCase(repo, gateway);

  const result = await useCase.execute('sub_104');
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.code, 'GATEWAY_TIMEOUT');
  assert.strictEqual(result.retryCount, 1);
});

test('ProcessBillingUseCase rechaza suscripciones inexistentes', async () => {
  const repo = new MockRepository(null);
  const gateway = new MockGateway(true);
  const useCase = new ProcessBillingUseCase(repo, gateway);

  const result = await useCase.execute('sub_inexistente');
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.code, 'ERR_SUB_NOT_FOUND');
});
