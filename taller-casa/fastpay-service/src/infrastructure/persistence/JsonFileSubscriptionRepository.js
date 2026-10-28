const fs = require('fs');
const Subscription = require('../../domain/Subscription');
const SubscriptionRepositoryPort = require('../../ports/SubscriptionRepositoryPort');

class JsonFileSubscriptionRepository extends SubscriptionRepositoryPort {
  constructor(filePath) {
    super();
    this.filePath = filePath;
  }

  async findAll() {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    const data = JSON.parse(raw);
    return data.map(item => new Subscription(item));
  }

  async findById(id) {
    const subs = await this.findAll();
    return subs.find(s => s.id === id) || null;
  }

  async save(subscription) {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    const data = JSON.parse(raw);
    const index = data.findIndex(s => s.id === subscription.id);
    
    const plainData = {
      ...subscription,
      amount: subscription.amount.toDecimal(),
      balance: subscription.balance.toDecimal()
    };

    if (index >= 0) {
      data[index] = plainData;
    } else {
      data.push(plainData);
    }

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

module.exports = JsonFileSubscriptionRepository;
