import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expenseSchema, expenseDetailSchema, PAYMENT_METHODS, EXPENSE_STATUSES } from './expenseSchema.ts';

const validInput = {
  name: 'Luz eléctrica',
  description: 'Factura de ENEL de agosto',
  amount: 125.5,
  category_id: 'cat-1',
  type_id: 'type-1',
  payment_method: 'efectivo',
  status: 'pagado',
  date: '2026-08-15',
  time: '10:30:00',
  notes: 'Pagar antes del 20',
};

describe('expenseSchema', () => {
  it('acepta un gasto válido', () => {
    const result = expenseSchema.safeParse(validInput);
    assert.ok(result.success);
  });

  it('recorta el nombre y la descripción', () => {
    const result = expenseSchema.safeParse({ ...validInput, name: '  Luz  ', description: '  nota  ' });
    assert.ok(result.success);
    assert.equal(result.success && result.data.name, 'Luz');
    assert.equal(result.success && result.data.description, 'nota');
  });

  it('rechaza un nombre vacío', () => {
    const result = expenseSchema.safeParse({ ...validInput, name: '   ' });
    assert.ok(!result.success);
  });

  it('rechaza un monto negativo', () => {
    const result = expenseSchema.safeParse({ ...validInput, amount: -5 });
    assert.ok(!result.success);
  });

  it('coerce strings a números', () => {
    const result = expenseSchema.safeParse({ ...validInput, amount: '50', status: undefined });
    assert.ok(result.success);
    assert.equal(result.success && result.data.amount, 50);
  });

  it('defaults status a activo cuando se omite', () => {
    const result = expenseSchema.safeParse({ ...validInput, status: undefined });
    assert.ok(result.success);
    assert.equal(result.success && result.data.status, 'activo');
  });

  it('rechaza un método de pago inválido', () => {
    const result = expenseSchema.safeParse({ ...validInput, payment_method: 'crypto' });
    assert.ok(!result.success);
  });

  it('rechaza un estado inválido', () => {
    const result = expenseSchema.safeParse({ ...validInput, status: 'borrado' });
    assert.ok(!result.success);
  });

  it('rechaza una fecha mal formada', () => {
    const result = expenseSchema.safeParse({ ...validInput, date: '15/08/2026' });
    assert.ok(!result.success);
  });

  it('rechaza hora vacía', () => {
    const result = expenseSchema.safeParse({ ...validInput, time: '' });
    assert.ok(!result.success);
  });

  it('acepta campos opcionales ausentes', () => {
    const result = expenseSchema.safeParse({
      name: 'Gasto',
      amount: 10,
      payment_method: 'efectivo',
      date: '2026-08-15',
      time: '10:00:00',
    });
    assert.ok(result.success);
  });

  it('expone los catálogos canónicos', () => {
    assert.deepEqual(EXPENSE_STATUSES, ['activo', 'pendiente', 'pagado', 'cancelado']);
    assert.deepEqual(PAYMENT_METHODS, ['efectivo', 'tarjeta', 'transferencia', 'otro']);
  });
});

describe('expenseDetailSchema', () => {
  it('acepta un detalle válido', () => {
    const result = expenseDetailSchema.safeParse({ product_name: 'Cable', quantity: 2, unit_price: 25 });
    assert.ok(result.success);
  });

  it('rechaza detalle sin nombre', () => {
    const result = expenseDetailSchema.safeParse({ product_name: '', quantity: 1, unit_price: 1 });
    assert.ok(!result.success);
  });

  it('rechaza cantidad cero o negativa', () => {
    assert.ok(!expenseDetailSchema.safeParse({ product_name: 'X', quantity: 0, unit_price: 1 }).success);
    assert.ok(!expenseDetailSchema.safeParse({ product_name: 'X', quantity: -1, unit_price: 1 }).success);
  });

  it('rechaza precio negativo', () => {
    const result = expenseDetailSchema.safeParse({ product_name: 'X', quantity: 1, unit_price: -3 });
    assert.ok(!result.success);
  });
});
