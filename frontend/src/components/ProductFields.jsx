import CommercialFields from './CommercialFields';

function ProductFields({ form, onChange, commercialRequired = true, errors = {} }) {
  return (
    <>
      <label>Nome do produto<input name="nome" value={form.nome} onChange={onChange} required /></label>
      <label>Descrição<textarea name="descricao" value={form.descricao} onChange={onChange} required /></label>
      <CommercialFields form={form} onChange={onChange} required={commercialRequired} errors={errors} />
      <label>
        Categoria
        <select name="categoria" value={form.categoria} onChange={onChange} required>
          <option value="">Selecione a categoria</option>
          {['Hortaliças', 'Frutas', 'Cereais', 'Tubérculos', 'Leguminosas', 'Outros'].map((category) =>
            <option key={category} value={category}>{category}</option>)}
          {form.categoria && !['Hortaliças', 'Frutas', 'Cereais', 'Tubérculos', 'Leguminosas', 'Outros'].includes(form.categoria) &&
            <option value={form.categoria}>{form.categoria}</option>}
        </select>
      </label>
      <label>URL da imagem (opcional)<input name="imagem" value={form.imagem} onChange={onChange} /></label>
      <label>Localização<input name="localizacao" value={form.localizacao} onChange={onChange} required /></label>
    </>
  );
}

export default ProductFields;
