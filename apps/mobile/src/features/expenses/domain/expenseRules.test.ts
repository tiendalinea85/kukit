import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canEditExpense, canVoidExpense, isVoided, EXPENSE_STATUSES, PAYMENT_METHODS } from './expenseRules.ts';

describe('ciclo de vida del estado de gasto', () => {
  it('expone los estados canónicos', () => {
    assert.deepEqual(EXPENSE_STATUSES, ['activo', 'pendiente', 'pagado', 'cancelado']);
  });

  it('expone los métodos de pago canónicos', () => {
    assert.deepEqual(PAYMENT_METHODS, ['efectivo', 'tarjeta', 'transferencia', 'otro']);
  });

  it('permite editar gastos no anulados', () => {
    assert.equal(canEditExpense('activo'), true);
    assert.equal(canEditExpense('pendiente'), true);
    assert.equal(canEditExpense('pagado'), true);
  });

  it('prohíbe editar un gasto anulado', () => {
    assert.equal(canEditExpense('cancelado'), false);
  });

  it('permite anular gastos no anulados', () => {
    assert.equal(canVoidExpense('activo'), true);
    assert.equal(canVoidExpense('pendiente'), true);
    assert.equal(canVoidExpense('pagado'), true);
  });

  it('prohíbe anular un gasto ya anulado', () => {
    assert.equal(canVoidExpense('cancelado'), false);
  });

  it('detecta gastos anulados', () => {
    assert.equal(isVoided('cancelado'), true);
    assert.equal(isVoided('activo'), false);
    assert.equal(isVoided('pagado'), false);
    assert.equal(isVoided('pendiente'), false);
  });
});
