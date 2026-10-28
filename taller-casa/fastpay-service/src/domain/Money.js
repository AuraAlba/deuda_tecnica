class Money {
  constructor(amountInCents) {
    this.amountInCents = Math.round(amountInCents);
  }

  static fromDecimal(decimalAmount) {
    return new Money(Math.round(decimalAmount * 100));
  }

  toDecimal() {
    return this.amountInCents / 100;
  }

  add(other) {
    return new Money(this.amountInCents + other.amountInCents);
  }

  subtract(other) {
    return new Money(this.amountInCents - other.amountInCents);
  }

  multiply(factor) {
    return new Money(Math.round(this.amountInCents * factor));
  }
}

module.exports = Money;
