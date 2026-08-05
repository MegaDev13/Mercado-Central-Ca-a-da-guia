import { DeliveryType, TaxBreakdown } from '../types';

export interface TaxInput {
  base_value: number;
  delivery_type: DeliveryType;
  is_ally: boolean;
  ally_house?: string | null;
}

export function calculateTaxes(input: TaxInput): TaxBreakdown {
  const { base_value, delivery_type, is_ally, ally_house } = input;

  let valueAfterAlly = base_value;
  let ally_discount = 0;

  if (is_ally) {
    ally_discount = base_value * 0.10;
    valueAfterAlly = base_value - ally_discount;
  }

  let delivery_adjustment = 0;
  let final_value = valueAfterAlly;

  if (delivery_type === 'domiciliar') {
    delivery_adjustment = valueAfterAlly * 0.30;
    final_value = valueAfterAlly + delivery_adjustment;
  } else if (delivery_type === 'retirada') {
    // só aplica se base >= 100
    if (base_value >= 100) {
      delivery_adjustment = -valueAfterAlly * 0.15;
      final_value = valueAfterAlly + delivery_adjustment;
    } else {
      delivery_adjustment = 0;
      final_value = valueAfterAlly;
    }
  }

  // Repartição da base (antes de taxas)
  const merchant_commission = base_value * 0.20;
  const producer_share = base_value * 0.50;
  const company_share_base = base_value * 0.30;

  // Extras: entrega vai pra companhia, desconto é absorvido pela companhia
  const company_extra = delivery_adjustment; // positivo = ganho, negativo = perda
  const company_final = company_share_base + company_extra + (is_ally ? -ally_discount : 0) + (is_ally ? ally_discount * 0 : 0);
  // Na verdade, se tem desconto aliado, a companhia absorve? Vamos definir que companhia absorve o desconto aliado também (perda)
  // Então company_final = base_company + delivery_adjustment - ally_discount (porque desconto reduz receita total)
  // Mas para rastreamento, vamos recalcular:
  // Receita final = base + delivery_adj - ally_discount
  // Distribuição: mercador 20% base, produtor 50% base, companhia recebe restante (final - mercador - produtor)
  const company_recebe = final_value - merchant_commission - producer_share;

  return {
    base_value,
    is_ally,
    ally_house: ally_house || null,
    ally_discount,
    delivery_type,
    delivery_adjustment,
    final_value,
    merchant_commission,
    producer_share,
    company_share_base,
    company_extra,
    company_final: company_recebe,
    total_profit_company: company_recebe,
  };
}

export function formatGold(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ouro`;
}

export function breakdownToText(b: TaxBreakdown): string {
  const lines = [
    `Base: ${b.base_value}`,
    b.is_ally ? `Aliado (${b.ally_house || 'aliado'}): -${b.ally_discount.toFixed(2)} (10%)` : 'Aliado: não',
    b.delivery_type === 'domiciliar' ? `Entrega domiciliar: +${b.delivery_adjustment.toFixed(2)} (30%)` :
    b.delivery_type === 'retirada' ? (b.base_value >=100 ? `Retirada: ${b.delivery_adjustment.toFixed(2)} (-15%)` : 'Retirada (<100, sem desconto)') : 'Entrega: não informada',
    `Final: ${b.final_value.toFixed(2)}`,
    `→ Mercador (20% base): ${b.merchant_commission.toFixed(2)}`,
    `→ Produtor (50% base): ${b.producer_share.toFixed(2)}`,
    `→ Companhia: ${b.company_final.toFixed(2)}`,
  ];
  return lines.join('\n');
}
