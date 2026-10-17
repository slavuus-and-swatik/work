'use client';

import { Minus, Plus } from 'lucide-react';

export function CartQuantityControl({
  quantity,
  max = 99,
  disabled = false,
  onAdd,
  onChange,
}: {
  quantity: number;
  max?: number;
  disabled?: boolean;
  onAdd: () => void;
  onChange: (delta: number) => void;
}) {
  if (quantity === 0) {
    return <button type="button" className="product-add-btn" disabled={disabled} onClick={onAdd}>
      {disabled ? 'Нет в наличии' : 'В корзину'}
    </button>;
  }

  return <div className="cart-quantity-control" aria-label={`Количество в корзине: ${quantity}`}>
    <button type="button" aria-label="Уменьшить количество" onClick={() => onChange(-1)}><Minus size={16} /></button>
    <span aria-live="polite">{quantity}</span>
    <button type="button" aria-label="Увеличить количество" disabled={disabled || quantity >= max} onClick={() => onChange(1)}><Plus size={16} /></button>
  </div>;
}
