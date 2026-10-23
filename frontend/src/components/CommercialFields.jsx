import { UNITS } from '../utils/commercial';
import { useId } from 'react';
import FieldError from './FieldError';

function CommercialFields({ form, onChange, required = true, errors = {} }) {
  const prefix = useId();
  const fractional = ['kg', 'litro'].includes(form.unidade);
  return (
    <fieldset className="commercial-fields">
      <legend>Quantidade e preço</legend>
      <div className="commercial-grid">
        <div><label>
          Quantidade disponível
          <input name="quantidadeDisponivel" type="text" inputMode={fractional ? 'decimal' : 'numeric'}
            aria-invalid={Boolean(errors.quantidadeDisponivel)} aria-describedby={errors.quantidadeDisponivel ? `${prefix}-quantity-error` : undefined}
            value={form.quantidadeDisponivel} onChange={onChange} required={required} autoComplete="off" />
        </label><FieldError id={`${prefix}-quantity-error`} message={errors.quantidadeDisponivel} /></div>
        <div><label>
          Unidade
          <select name="unidade" value={form.unidade} onChange={onChange} required={required}
            aria-invalid={Boolean(errors.unidade)} aria-describedby={errors.unidade ? `${prefix}-unit-error` : undefined}>
            <option value="">Selecione a unidade</option>
            {UNITS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label><FieldError id={`${prefix}-unit-error`} message={errors.unidade} /></div>
        <div><label>
          Preço por {form.unidade || 'unidade selecionada'} (MT)
          <input name="precoUnitario" type="text" inputMode="decimal" value={form.precoUnitario}
            aria-invalid={Boolean(errors.precoUnitario)} aria-describedby={errors.precoUnitario ? `${prefix}-price-error` : undefined}
            onChange={onChange} required={required} autoComplete="off" />
        </label><FieldError id={`${prefix}-price-error`} message={errors.precoUnitario} /></div>
        <p className="field-help">Moeda: MT (MZN). Até 6 casas decimais. Use vírgula ou ponto, sem separadores de milhares.
          {' '}kg e litro permitem frações; unidade e saco exigem inteiros. O peso de um saco não é presumido.</p>
      </div>
    </fieldset>
  );
}

export default CommercialFields;
