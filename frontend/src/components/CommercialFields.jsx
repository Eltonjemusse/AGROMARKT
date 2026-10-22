import { UNITS } from '../utils/commercial';

function CommercialFields({ form, onChange, required = true }) {
  const fractional = ['kg', 'litro'].includes(form.unidade);
  return (
    <fieldset className="commercial-fields">
      <legend>Quantidade e preço</legend>
      <div className="commercial-grid">
        <label>
          Quantidade disponível
          <input name="quantidadeDisponivel" type="text" inputMode={fractional ? 'decimal' : 'numeric'}
            value={form.quantidadeDisponivel} onChange={onChange} required={required} autoComplete="off" />
        </label>
        <label>
          Unidade
          <select name="unidade" value={form.unidade} onChange={onChange} required={required}>
            <option value="">Selecione a unidade</option>
            {UNITS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Preço por {form.unidade || 'unidade selecionada'} (MT)
          <input name="precoUnitario" type="text" inputMode="decimal" value={form.precoUnitario}
            onChange={onChange} required={required} autoComplete="off" />
        </label>
        <p className="field-help">Moeda: MT (MZN). Até 6 casas decimais. Use vírgula ou ponto, sem separadores de milhares.
          {' '}kg e litro permitem frações; unidade e saco exigem inteiros. O peso de um saco não é presumido.</p>
      </div>
    </fieldset>
  );
}

export default CommercialFields;
