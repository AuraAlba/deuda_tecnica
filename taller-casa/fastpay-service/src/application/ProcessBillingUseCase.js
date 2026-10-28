const Money = require('../domain/Money');

class ProcessBillingUseCase {
  constructor(subscriptionRepository, paymentGateway) {
    this.subscriptionRepository = subscriptionRepository;
    this.paymentGateway = paymentGateway;
    this.activeLocks = new Set();
  }

  _validateSubscriptionState(subscription, forceRetry) {
    if (subscription.status === "ACTIVE") {
      return null;
    }
    if (subscription.status === "SUSPENDED" && forceRetry) {
      subscription.status = "ACTIVE";
      return null;
    }
    return { success: false, code: "ERR_SUSPENDED", msg: "Cuenta inactiva o suspendida" };
  }

  async execute(subId, options = {}) {
    if (this.activeLocks.has(subId)) {
      throw new Error("ERR_CONCURRENT_TRANSACTION: Transacción bloqueada por concurrencia");
    }

    this.activeLocks.add(subId);
    try {
      const subscription = await this.subscriptionRepository.findById(subId);
      if (!subscription) {
        return { success: false, code: "ERR_SUB_NOT_FOUND", msg: "Suscripción no existe" };
      }

      const statusError = this.envioOValidacionState ? null : this._validateSubscriptionState(subscription, options.forceRetry);
      if (statusError) {
        return statusError;
      }

      const breakdown = subscription.calculateTaxesAndDiscounts(options.promoCode);
      const txRef = `TX_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const gatewayResult = await this.paymentGateway.charge(subscription, breakdown.finalTotal, txRef);
      if (!gatewayResult.success) {
        subscription.retryCount = (subscription.retryCount || 0) + 1;
        if (subscription.retryCount >= 3) subscription.status = "SUSPENDED";
        await this.subscriptionRepository.save(subscription);
        return { success: false, code: "GATEWAY_TIMEOUT", ref: txRef, retryCount: subscription.retryCount };
      }

      subscription.balance = subscription.balance.add(Money.fromDecimal(breakdown.finalTotal));
      subscription.lastBilledAt = new Date().toISOString();
      subscription.retryCount = 0;

      await this.subscriptionRepository.save(subscription);

      return {
        success: true,
        code: "BILLING_PROCESSED",
        subId: subscription.id,
        customer: subscription.customerEmail,
        breakdown,
        transactionReference: txRef,
        processedAt: subscription.lastBilledAt
      };
    } finally {
      this.activeLocks.delete(subId);
    }
  }
}

module.exports = ProcessBillingUseCase;
