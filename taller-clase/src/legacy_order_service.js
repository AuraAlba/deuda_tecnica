// ============================================================================
// SERVICIO DE PROCESAMIENTO DE ÓRDENES Y FACTURACIÓN (REFACTORIZADO)
// ============================================================================

const GLOBAL_CONFIG = {
  taxRate: 0.19,
  currency: 'USD',
  defaultFee: 4.5
};

// Base de datos en memoria encapsulada
let inventoryDatabase = {
  'PROD-001': { name: 'Teclado Mecánico', stock: 15, price: 80.0 },
  'PROD-002': { name: 'Monitor 4K', stock: 4, price: 320.0 },
  'PROD-003': { name: 'Mouse Ergonómico', stock: 0, price: 45.0 },
  'PROD-004': { name: 'Cable USB-C', stock: 50, price: 12.0 }
};

let processedOrdersRegistry = [];

/**
 * Valida la estructura básica de la solicitud de orden.
 */
function validateOrderRequest(orderRequest) {
  if (!orderRequest) {
    return { isValid: false, code: 'ERR_NULL_REQ' };
  }
  if (!orderRequest.customer_id || typeof orderRequest.customer_id !== 'string') {
    return { isValid: false, code: 'ERR_INVALID_CUST' };
  }
  if (!orderRequest.items || !Array.isArray(orderRequest.items) || orderRequest.items.length === 0) {
    return { isValid: false, code: 'EMPTY_CART' };
  }
  return { isValid: true };
}

/**
 * Valida disponibilidad y reserva el inventario de forma segura con soporte de reversión.
 */
function reserveInventory(items) {
  const processedItems = [];

  for (const item of items) {
    const product = inventoryDatabase[item.id];

    if (!product) {
      rollbackInventory(processedItems);
      return { success: false, code: 'PROD_NOT_FOUND_' + item.id };
    }

    if (product.stock < item.qty) {
      rollbackInventory(processedItems);
      return { success: false, code: 'OUT_OF_STOCK_' + item.id };
    }

    // Descontar stock provisional
    product.stock -= item.qty;
    const itemSubtotal = product.price * item.qty;

    processedItems.push({
      item_id: item.id,
      name: product.name,
      qty: item.qty,
      unit_price: product.price,
      subtotal: itemSubtotal
    });
  }

  return { success: true, processedItems };
}

/**
 * Revierte el stock en caso de fallo en el pago o validación posterior.
 */
function rollbackInventory(reservedItems) {
  for (const item of reservedItems) {
    if (inventoryDatabase[item.item_id]) {
      inventoryDatabase[item.item_id].stock += item.qty;
    }
  }
}

/**
 * Calcula los descuentos aplicables según el tipo de cliente y cupones.
 */
function calculateDiscounts(userType, coupon, subtotal) {
  let discountAmount = 0;

  if (userType === 'VIP') {
    discountAmount = subtotal > 200 ? subtotal * 0.10 : subtotal * 0.05;
  } else if (subtotal > 500) {
    discountAmount = subtotal * 0.08;
  }

  if (coupon === 'DESC5' && (subtotal - discountAmount) > 20) {
    discountAmount += 5.0;
  }

  if (coupon === 'FLASH25' && subtotal > 100) {
    discountAmount += subtotal * 0.25;
  }

  return discountAmount;
}

/**
 * Calcula impuestos y costos de envío.
 */
function calculateTaxesAndShipping(taxableBase, isInternational, itemCount) {
  const tax = taxableBase * GLOBAL_CONFIG.taxRate;
  let shipping = 0;
  let legacyCustomsFlag = 0;

  if (isInternational) {
    legacyCustomsFlag = 2; // Flag de aduanas heredado
    shipping = 25.0 + (itemCount * 2.5);
  } else {
    shipping = taxableBase < 100.0 ? GLOBAL_CONFIG.defaultFee : 0.0;
  }

  return { tax, shipping, legacyCustomsFlag };
}

/**
 * Simula la pasarela de pago.
 */
function processPayment(paymentMethod, cardNumber) {
  if (paymentMethod === 'CREDIT_CARD') {
    if (!cardNumber || cardNumber.length < 13) {
      return { status: 'FAILED', error: 'INVALID_CARD' };
    }
    return { status: 'PAID' };
  } else if (paymentMethod === 'CASH') {
    return { status: 'PENDING_CASH' };
  }
  return { status: 'UNSUPPORTED', error: 'UNSUPPORTED_PAYMENT' };
}

/**
 * Función principal orquestadora (pura en cuanto a no mutar el input original).
 */
function processOrder(orderRequest) {
  const validation = validateOrderRequest(orderRequest);
  if (!validation.isValid) {
    return { ok: false, msg: validation.code };
  }

  // 1. Reserva de Inventario
  const inventoryResult = reserveInventory(orderRequest.items);
  if (!inventoryResult.success) {
    return { ok: false, msg: inventoryResult.code };
  }

  const itemsProcessed = inventoryResult.processedItems;
  const subtotal = itemsProcessed.reduce((acc, item) => acc + item.subtotal, 0);

  // 2. Descuentos
  const discountAmount = calculateDiscounts(orderRequest.user_type, orderRequest.coupon, subtotal);
  let taxableBase = subtotal - discountAmount;
  if (taxableBase < 0) taxableBase = 0;

  // 3. Impuestos y Envío
  const { tax, shipping, legacyCustomsFlag } = calculateTaxesAndShipping(
    taxableBase,
    orderRequest.is_international,
    itemsProcessed.length
  );

  const finalTotal = taxableBase + tax + shipping;

  // 4. Pago
  const paymentResult = processPayment(orderRequest.payment_method, orderRequest.card_number);
  if (paymentResult.status === 'FAILED' || paymentResult.status === 'UNSUPPORTED') {
    rollbackInventory(itemsProcessed);
    return { ok: false, msg: paymentResult.error };
  }

  // 5. Construcción del registro de orden (evitando mutar orderRequest)
  const orderRecord = {
    order_id: 'ORD-' + Math.floor(Math.random() * 90000 + 10000),
    customer_id: orderRequest.customer_id,
    date: new Date().toISOString(),
    items: itemsProcessed,
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discountAmount.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    total: Number(finalTotal.toFixed(2)),
    payment_status: paymentResult.status,
    currency: GLOBAL_CONFIG.currency,
    legacy_code: legacyCustomsFlag
  };

  processedOrdersRegistry.push(orderRecord);
  return { ok: true, data: orderRecord };
}

function resetInventory(newInventoryState) {
  inventoryDatabase = JSON.parse(JSON.stringify(newInventoryState));
}

function getInventory() {
  return inventoryDatabase;
}

module.exports = {
  processOrder,
  resetInventory,
  getInventory,
  inventory: inventoryDatabase,
  processedOrders: processedOrdersRegistry
};