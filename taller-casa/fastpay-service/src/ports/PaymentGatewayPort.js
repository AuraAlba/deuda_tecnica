class PaymentGatewayPort {
  async charge(_subscription, _amount, _reference) {
    throw new Error("ERR_NOT_IMPLEMENTED");
  }
}

module.exports = PaymentGatewayPort;
