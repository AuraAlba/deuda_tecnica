const express = require('express');
const path = require('path');
const JsonFileSubscriptionRepository = require('../persistence/JsonFileSubscriptionRepository');
const StripePaymentGateway = require('../gateway/StripePaymentGateway');
const ProcessBillingUseCase = require('../../application/ProcessBillingUseCase');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, '../../../data/subscriptions.json');
const repo = new JsonFileSubscriptionRepository(dbPath);
const gateway = new StripePaymentGateway();
const billingUseCase = new ProcessBillingUseCase(repo, gateway);

app.get('/health', (req, res) => {
  res.json({ service: "fastpay-billing-service", version: "2.0.0-hexagonal", status: "HEALTHY" });
});

app.post('/api/subscriptions/:id/bill', async (req, res) => {
  try {
    const result = await billingUseCase.execute(req.params.id, req.body);
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (err) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Servidor Hexagonal activo en puerto ${PORT}`));
}

module.exports = app;
