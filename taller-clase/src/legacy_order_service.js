// ============================================================================
// SERVICIO DE PROCESAMIENTO DE ÓRDENES Y FACTURACIÓN (LEGACY CORE)
// ADVERTENCIA DEL EQUIPO ANTERIOR:
// "Este código fue escrito con urgencia en 2021 para el Black Friday.
// Nadie recuerda por qué 'aux_flag' debe estar en 2 para pedidos internacionales.
// Favor NO TOCAR sin avisar a soporte."
// ============================================================================

var processedOrders = [];
var last_discount = 0;
var err_count = 0;
var global_config_cache = { t: 0.19, cur: 'USD', fee: 4.5 };

// Base de datos simulada en memoria (altamente acoplada)
var inventory = {
  'PROD-001': { name: 'Teclado Mecánico', stock: 15, price: 80.0 },
  'PROD-002': { name: 'Monitor 4K', stock: 4, price: 320.0 },
  'PROD-003': { name: 'Mouse Ergonómico', stock: 0, price: 45.0 }, // Sin stock
  'PROD-004': { name: 'Cable USB-C', stock: 50, price: 12.0 }
};

/**
 * Función monstruo: calcula totales, valida inventario, aplica descuentos,
 * genera factura, simula pasarela y muta el pedido original.
 */
function process_order(req_data) {
  var x = req_data;
  var flag = false;
  var aux = 0;
  var d = 0;
  var tmp_total = 0;
  var items_processed = [];

  // 1. Validación cruda y desordenada
  if (!x) {
    err_count++;
    return { ok: false, msg: 'ERR_NULL_REQ' };
  }

  if (!x.customer_id || typeof x.customer_id !== 'string') {
    return { ok: false, msg: 'ERR_INVALID_CUST' };
  }

  if (!x.items || !Array.isArray(x.items) || x.items.length === 0) {
    return { ok: false, msg: 'EMPTY_CART' };
  }

  // 2. Lógica de inventario y cálculo de subtotal (con efectos secundarios)
  for (var i = 0; i < x.items.length; i++) {
    var it = x.items[i];
    var p = inventory[it.id];

    if (!p) {
      return { ok: false, msg: 'PROD_NOT_FOUND_' + it.id };
    }

    if (p.stock < it.qty) {
      return { ok: false, msg: 'OUT_OF_STOCK_' + it.id };
    }

    // Descuenta stock inmediatamente sin rollback si falla más adelante
    p.stock = p.stock - it.qty;

    var item_sub = p.price * it.qty;
    tmp_total = tmp_total + item_sub;

    items_processed.push({
      item_id: it.id,
      name: p.name,
      qty: it.qty,
      unit_price: p.price,
      subtotal: item_sub
    });
  }

  // 3. Reglas de Descuentos Spaghetti
  // Si el cliente es VIP y gasta más de 200 -> 10%
  // Si gasta más de 500 -> 15%
  // Si tiene cupón 'DESC5' -> $5 fijos
  if (x.user_type === 'VIP') {
    if (tmp_total > 200) {
      d = tmp_total * 0.10;
    } else {
      d = tmp_total * 0.05;
    }
  } else {
    if (tmp_total > 500) {
      d = tmp_total * 0.08;
    }
  }

  if (x.coupon === 'DESC5' && (tmp_total - d) > 20) {
    d = d + 5.0;
  }

  if (x.coupon ==="FLASH25"){
    if(tmp_total > 100) {
      d += tmp_total *0.25;
    }
  } else if (x.coupon === 'DESC5' && (tmp_total -d) >20){
    d += 5.0;
  }

  last_discount = d;
  var base_taxable = tmp_total - d;
  if (base_taxable < 0) base_taxable = 0;

  // 4. Impuestos y tarifas de envío mágicas
  var tax = base_taxable * global_config_cache.t;
  var shipping = 0;

  if (x.is_international) {
    aux = 2; // Magic flag: cobro especial de aduanas
    shipping = 25.0 + (items_processed.length * 2.5);
  } else {
    if (base_taxable < 100.0) {
      shipping = global_config_cache.fee;
    } else {
      shipping = 0.0; // Envío gratis local
    }
  }

  var final_total = base_taxable + tax + shipping;

  // 5. Simulación de pasarela de pago (acoplada con console.log y mutación)
  var payment_status = 'PENDING';
  if (x.payment_method === 'CREDIT_CARD') {
    if (!x.card_number || x.card_number.length < 13) {
      // Intenta rollback manual sucio
      for (var k = 0; k < items_processed.length; k++) {
        inventory[items_processed[k].item_id].stock += items_processed[k].qty;
      }
      return { ok: false, msg: 'INVALID_CARD' };
    }
    payment_status = 'PAID';
  } else if (x.payment_method === 'CASH') {
    payment_status = 'PENDING_CASH';
  } else {
    // Método no soportado
    for (var j = 0; j < items_processed.length; j++) {
      inventory[items_processed[j].item_id].stock += items_processed[j].qty;
    }
    return { ok: false, msg: 'UNSUPPORTED_PAYMENT' };
  }

  // 6. Mutación peligrosa del payload de entrada
  x.calculated_total = final_total;
  x.applied_discount = d;
  x.tax = tax;
  x.shipping = shipping;

  var order_record = {
    order_id: 'ORD-' + Math.floor(Math.random() * 90000 + 10000),
    customer_id: x.customer_id,
    date: new Date().toISOString(),
    items: items_processed,
    subtotal: tmp_total,
    discount: Number(d.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    total: Number(final_total.toFixed(2)),
    payment_status: payment_status,
    currency: global_config_cache.cur,
    legacy_code: aux
  };

  processedOrders.push(order_record);
  return { ok: true, data: order_record };
}

// Exportación sin tipado ni contratos
module.exports = {
  process_order: process_order,
  inventory: inventory,
  processedOrders: processedOrders
};
