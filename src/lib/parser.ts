import { Sale, DeliveryType } from '../types';
import { detectAlly, parseMoneyValue, parseCurrency } from './normalize';
import { calculateTaxes } from './taxEngine';

// Escape regex special chars
function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Pega apenas até antes do cálculo de tesouraria para evitar capturar "Comissão Mercador"
function getMainBlock(text: string): string {
  let t = text;
  // corta antes do cálculo
  const idx = t.search(/✦\s*Cálculo de Tesouraria/i);
  if (idx > 0) t = t.slice(0, idx);
  return t;
}

function extractFieldStrict(mainText: string, labels: string[]): string | null {
  // Ordena por tamanho decrescente para priorizar labels longas
  const sorted = [...labels].sort((a,b)=> b.length - a.length);
  const lines = mainText.split('\n');

  for (const label of sorted) {
    const labelEsc = esc(label);
    // Regex com word boundary: \bLABEL\b
    // Tenta encontrar linha que contém ✦ + label
    for (let i=0;i<lines.length;i++) {
      const line = lines[i];
      // precisa conter o label com word boundary
      const re = new RegExp(`\\b${labelEsc}\\b`, 'i');
      if (!re.test(line)) continue;
      // Evita falsos positivos: linha não pode ser "Comissão Mercador" quando buscamos "Mercador" ???
      // Mas \b já evita Mercadoria, porém "Comissão Mercador" ainda iria casar se label = Mercador.
      // Para isso, se linha contém "Comissão" e buscamos mercador, ignore se estivermos no bloco principal (já cortamos cálculo, mas por segurança)
      if (/comissão/i.test(line) && /mercador/i.test(label)) continue;

      // 1) tenta pegar valor após : ou ➤ na mesma linha
      const afterColon = line.split(':').slice(1).join(':').trim();
      if (afterColon) {
        // remove ➤ inicial
        const cleaned = afterColon.replace(/^[➤\s]+/, '').trim();
        // se ainda tem conteúdo e não é outro marcador ✦
        if (cleaned && !cleaned.startsWith('✦') && cleaned.length>0 && cleaned.length<120) {
          // Validação: não pode ser vazio nem ser outro rótulo
          const lower = cleaned.toLowerCase();
          if (/(comprador|mercadoria|quantidade|valor|entrega|destino|mercador)/i.test(lower) && lower.length < 20) {
            // parece ser outro label, tenta próxima linha
          } else {
            return cleaned;
          }
        }
      }

      // 2) tenta próxima linha que começa com ➤
      if (i+1 < lines.length) {
        const next = lines[i+1].trim();
        if (next.startsWith('➤')) {
          const val = next.replace(/^[➤\s]+/, '').trim();
          // Validação de tamanho e conteúdo
          if (val && val.length>0 && val.length<120 && !val.startsWith('✦')) {
            // Evita capturar "ia" sozinho que vem de bug antigo
            if (val.toLowerCase() === 'ia' || val.toLowerCase() === 'ia,') continue;
            return val;
          }
        } else if (next && !next.startsWith('✦') && next.length>1 && next.length<120) {
          // fallback: linha seguinte sem ➤ mas com conteúdo
          // só se linha atual tinha : e ficou vazia
          if (afterColon === '' || afterColon === undefined) {
            if (next.toLowerCase() !== 'ia') return next;
          }
        }
      }
    }
  }
  return null;
}

// Mantém compatibilidade mas usa versão estrita
function extractFieldFlexibleStrict(mainText: string, keywords: string[]): string | null {
  const lines = mainText.split('\n');
  const sortedKw = [...keywords].sort((a,b)=> b.length - a.length);
  for (let i=0;i<lines.length;i++) {
    const line = lines[i].toLowerCase();
    for (const kw of sortedKw) {
      const re = new RegExp(`\\b${esc(kw)}\\b`, 'i');
      if (!re.test(line)) continue;
      if (/comissão/i.test(line) && kw.toLowerCase().includes('mercador')) continue;
      // pega após :
      const after = lines[i].split(':').slice(1).join(':').replace(/^[➤\s]+/, '').trim();
      if (after && after.length>0 && after.length<120 && !after.startsWith('✦') && after.toLowerCase()!=='ia') return after;
      if (i+1 < lines.length) {
        const nxt = lines[i+1].trim().replace(/^[➤\s]+/, '').trim();
        if (nxt && nxt.length>0 && nxt.length<120 && !nxt.startsWith('✦') && nxt.toLowerCase()!=='ia') return nxt;
      }
    }
  }
  return null;
}

function isValidName(val: string): boolean {
  if (!val) return false;
  const v = val.trim();
  if (v.length < 2) return false;
  if (v.length > 100) return false; // evita frases longas "Entre os reinos, conforme as leis..."
  if (v.toLowerCase() === 'ia') return false;
  if (/entre os reinos/i.test(v) && v.length > 30) return false; // bloqueia especificamente o bug relatado
  if (/conforme as leis/i.test(v)) return false;
  if (/comerciais vigentes/i.test(v)) return false;
  return true;
}

export function parseSingleFicha(raw: string, index: number): Partial<Sale> & { raw_text: string } {
  const text = raw.trim();
  if (!text) throw new Error('Ficha vazia');

  const mainText = getMainBlock(text);

  let comprador = extractFieldStrict(mainText, ['Comprador', 'Cliente', 'Adquirente']) 
    || extractFieldFlexibleStrict(mainText, ['comprador','cliente']) || 'Não informado';
  let mercadoria = extractFieldStrict(mainText, ['Mercadoria', 'Produto', 'Item']) 
    || extractFieldFlexibleStrict(mainText, ['mercadoria','produto']) || 'Não informado';
  let quantidadeRaw = extractFieldStrict(mainText, ['Quantidade', 'Qtd', 'Qnt']) 
    || extractFieldFlexibleStrict(mainText, ['quantidade','qtd']) || '1';
  let valorRaw = extractFieldStrict(mainText, ['Valor da Transação', 'Valor', 'Preço', 'Total']) 
    || extractFieldFlexibleStrict(mainText, ['valor','preço','transacao']) || '0';
  let metodo = extractFieldStrict(mainText, ['Método de Entrega', 'Entrega', 'Tipo de Entrega']) 
    || extractFieldFlexibleStrict(mainText, ['entrega','método']) || 'Não informado';
  let destino = extractFieldStrict(mainText, ['Reino de Destino', 'Destino', 'Local']) 
    || extractFieldFlexibleStrict(mainText, ['destino','reino']) || 'Não informado';
  let mercador = extractFieldStrict(mainText, ['Mercador Responsável', 'Mercador', 'Vendedor']) 
    || extractFieldFlexibleStrict(mainText, ['mercador','vendedor','responsavel']) || 'Não informado';

  // Validação final para evitar o bug relatado
  if (!isValidName(comprador)) comprador = 'Não informado';
  if (!isValidName(mercadoria)) mercadoria = 'Não informado';
  if (!isValidName(mercador)) mercador = 'Não informado';
  if (!isValidName(destino)) {
    // se destino contém frase longa proibida, tenta limpar
    if (destino.length > 100) destino = destino.slice(0,60);
    if (!isValidName(destino)) destino = 'Não informado';
  }

  const quantidadeMatch = quantidadeRaw.match(/([\d.,]+)/);
  const quantidade = quantidadeMatch ? parseFloat(quantidadeMatch[0].replace(',','.')) : 1;

  const { value: base_value } = parseMoneyValue(valorRaw);
  const currency = parseCurrency(valorRaw);

  let delivery_type: DeliveryType = 'nao_informado';
  const metodoLow = metodo.toLowerCase();
  if (metodoLow.includes('domiciliar')) delivery_type = 'domiciliar';
  else if (metodoLow.includes('retirada') || metodoLow.includes('retira')) delivery_type = 'retirada';
  else {
    if (/domiciliar/i.test(text)) delivery_type = 'domiciliar';
    else if (/retirada/i.test(text)) delivery_type = 'retirada';
  }

  const allyInfo = detectAlly(comprador);
  const allyHouseMatch = text.match(/gardener|lannister|stark/i);
  const finalAlly = allyInfo.isAlly || !!allyHouseMatch;
  const finalHouse = allyInfo.house || (allyHouseMatch ? (allyHouseMatch[0].toLowerCase().charAt(0).toUpperCase() + allyHouseMatch[0].slice(1).toLowerCase()) as any : null);

  const tax_breakdown = calculateTaxes({
    base_value,
    delivery_type,
    is_ally: finalAlly,
    ally_house: finalHouse
  });

  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{4}-\d{2}-\d{2})/);
  const now = new Date();
  const dateStr = dateMatch ? dateMatch[0] : now.toISOString();

  return {
    raw_text: text,
    buyer_name: comprador,
    merchant_name: mercador,
    product_name: mercadoria,
    quantity: quantidade,
    base_value,
    final_value: tax_breakdown.final_value,
    currency: currency as any,
    delivery_type,
    destination_name: destino,
    is_ally: finalAlly,
    ally_house: finalHouse,
    tax_breakdown,
    date: dateStr,
    created_at: now.toISOString(),
    status: 'pendente' as const,
    ficha_number: `F-${Date.now()}-${index}`,
  };
}

export function splitFichas(input: string): string[] {
  if (!input.trim()) return [];

  if (input.includes('══')) {
    const parts = input.split(/═{5,}/).map(p=>p.trim()).filter(p=>p.length>20);
    return parts.filter(p => /comprador|mercador|mercadoria|valor/i.test(p));
  }

  const ordemSplit = input.split(/📜\s*ORDEM DE AQUISIÇÃO|ORDEM DE AQUISIÇÃO/i);
  if (ordemSplit.length > 2) {
    return ordemSplit.map(p=>p.trim()).filter(p=>p.length>20 && /comprador|mercador/i.test(p)).map(p=> '📜 ORDEM DE AQUISIÇÃO\n' + p);
  }

  const blocks = input.split(/\n{3,}/).map(b=>b.trim()).filter(b=>b.length>30);
  if (blocks.length>1 && blocks.every(b=>/comprador|mercador|valor/i.test(b))) return blocks;

  return [input];
}

export function parseFichasBatch(input: string): { sales: ReturnType<typeof parseSingleFicha>[], errors: { index:number, raw:string, error:string }[] } {
  const blocks = splitFichas(input);
  const sales: any[] = [];
  const errors: any[] = [];
  blocks.forEach((block, idx)=>{
    try {
      const parsed = parseSingleFicha(block, idx);
      if (!parsed.base_value || parsed.base_value===0) {
        if (parsed.product_name === 'Não informado' && parsed.buyer_name==='Não informado') {
          throw new Error('Ficha incompleta');
        }
      }
      // Bloqueia fichas com nomes inválidos
      if (parsed.merchant_name === 'ia' || parsed.buyer_name === 'ia') {
        throw new Error('Ficha com extração inválida (ia)');
      }
      sales.push(parsed);
    } catch (e:any) {
      errors.push({ index: idx, raw: block.slice(0,200), error: e.message });
    }
  });
  return { sales, errors };
}

export function generateFichaText(sale: Partial<Sale> & { buyer_name:string, product_name:string, merchant_name:string, quantity:number, base_value:number, delivery_type:DeliveryType, destination_name:string, is_ally:boolean }): string {
  const tb = calculateTaxes({
    base_value: sale.base_value,
    delivery_type: sale.delivery_type,
    is_ally: sale.is_ally,
    ally_house: sale.ally_house
  });
  const now = new Date().toLocaleString('pt-BR');

  return `══════════════════════════════
📜 ORDEM DE AQUISIÇÃO
══════════════════════════════

✦ Comprador:
➤ ${sale.buyer_name}${sale.is_ally ? ` [ALIADO${sale.ally_house ? ` - ${sale.ally_house}` : ''}]` : ''}

✦ Mercadoria:
➤ ${sale.product_name}

✦ Quantidade:
➤ ${sale.quantity} unidades

✦ Valor da Transação (Base):
➤ ${sale.base_value} moedas de ouro

✦ Método de Entrega:
➤ ${sale.delivery_type === 'domiciliar' ? 'Domiciliar (+30%)' : sale.delivery_type === 'retirada' ? 'Retirada (-15% se ≥100)' : 'Não informado'}

✦ Reino de Destino:
➤ ${sale.destination_name}

✦ Mercador Responsável:
➤ ${sale.merchant_name}

✦ Cálculo de Tesouraria:
➤ Base: ${tb.base_value} ouro
${tb.is_ally ? `➤ Desconto Aliado (10%): -${tb.ally_discount.toFixed(2)} ouro` : '➤ Aliado: Não'}
${tb.delivery_type === 'domiciliar' ? `➤ Taxa Entrega (+30%): +${tb.delivery_adjustment.toFixed(2)} ouro` : tb.delivery_type === 'retirada' && tb.base_value>=100 ? `➤ Desconto Retirada (-15%): ${tb.delivery_adjustment.toFixed(2)} ouro` : '➤ Taxa Entrega: —'}
➤ Valor Final: ${tb.final_value.toFixed(2)} ouro
➤ Comissão Mercador (20% base): ${tb.merchant_commission.toFixed(2)} ouro
➤ Parte Produtor (50% base): ${tb.producer_share.toFixed(2)} ouro
➤ Parte Companhia: ${tb.company_final.toFixed(2)} ouro

✦ Data:
➤ ${now}

══════════════════════════════
Selo da Companhia Mercante Ravenport
══════════════════════════════`;
}
