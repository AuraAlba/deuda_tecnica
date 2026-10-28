const Money = require('./Money');

class Subscription {
  constructor(data) {
    this.id = data.id;
    this.customerEmail = data.customerEmail;
    this.plan = data.plan;
    this.amount = Money.fromDecimal(data.amount);
    this.currency = data.currency || "USD";
    this.country = data.country;
    this.billingCycle = data.billingCycle;
    this.status = data.status;
    this.paymentMethod = data.paymentMethod;
    this.cardLast4 = data.cardLast4;
    this.balance = Money.fromDecimal(data.balance || 0);
    this.lastBilledAt = data.lastBilledAt;
    this.retryCount = data.retryCount || 0;
  }

  _calculateCountryTaxes() {
    const taxRules = {
      CO: () => ({ taxRate: 0.19, surcharge: this.amount.toDecimal() > 200 ? 4.5 : 0 }),
      MX: () => ({ taxRate: 0.16, surcharge: this.paymentMethod === "WIRE_TRANSFER" ? 8.0 : 0 }),
      AR: () => ({ taxRate: 0.56, surcharge: 12.5 }),
      US: () => ({ taxRate: 0.0825, surcharge: 0 })
    };

    const rule = taxRules[this.country];
    return rule ? rule() : { taxRate: 0.10, surcharge: 0 };
  }

  _calculateDiscount(promoCode) {
    if (this.plan === "ENTERPRISE_PLUS") {
      return this.billingCycle === "ANNUAL" ? this.amount.multiply(0.15).toDecimal() : 25.0;
    }
    if (this.plan === "ENTERPRISE" && promoCode === "FAST2026") {
      return 30.0;
    }
    return 0;
  }

  calculateTaxesAndDiscounts(promoCode) {
    const { taxRate, surcharge } = this._calculateCountryTaxes();
    const discount = this._calculateDiscount(promoCode);

    const baseDec = this.amount.toDecimal();
    const taxable = baseDec - discount;
    const taxes = taxable * taxRate;
    const finalTotal = taxable + taxes + surcharge;

    return {
      baseAmount: baseDec,
      discount,
      taxes,
      surcharge,
      finalTotal
    };
  }
}

module.exports = Subscription;
