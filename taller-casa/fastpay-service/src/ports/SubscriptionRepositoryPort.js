class SubscriptionRepositoryPort {
  async findById(_id) { 
    throw new Error("ERR_NOT_IMPLEMENTED"); 
  }

  async findAll() { 
    throw new Error("ERR_NOT_IMPLEMENTED"); 
  }

  async save(_subscription) { 
    throw new Error("ERR_NOT_IMPLEMENTED"); 
  }
}

module.exports = SubscriptionRepositoryPort;
