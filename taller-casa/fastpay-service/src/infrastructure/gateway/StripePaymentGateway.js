const PaymentGatewayPort = require('../../ports/PaymentGatewayPort');

class StripePaymentGateway extends PaymentGatewayPort {
  async charge(subscription, amount, reference) {
    if (subscription.cardLast4 === "9999") {
      return { success: false, error: "GATEWAY_TIMEOUT" };
    }
    return { success: true, reference };
  }
}

module.exports = StripePaymentGateway;
