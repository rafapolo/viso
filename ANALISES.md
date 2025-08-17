### 2) Definições para Novas analises em db.html

Analise as 8 analises, e se valem a pena ser consideradas e integradas com as atuais, evitando redundancias com as atuais analises. As categorias atuais precisam ser refatoradas ou expandidas?

🔄 Padrões de Restituição
👉 Detectar restituições/retidos acima do normal que podem indicar inflar ou erro sistemático.

📑 Parcelamento Artificial
👉 Identificar notas fracionadas em muitas parcelas para disfarçar grandes despesas.

🎯 One-Hit Wonder
👉 Localizar fornecedores que aparecem só uma vez ou em um único mês com valor alto.

🛠️ Fornecedor Multiuso
👉 Encontrar empresas ligadas a várias categorias de despesa fora do esperado.

🏛️ Preferência Política
👉 Ver se fornecedores são usados de forma desproporcional por um partido específico.

📉 Líquido vs. Retido
👉 Analisar evolução de valores retidos para detectar padrões de uso indevido.

🧾 Duplicação Indireta
👉 Checar notas semelhantes entre deputados diferentes que podem ser replicadas.

📊 Concentração de Fornecedores
👉 Medir dependência de poucos fornecedores por deputado via índice de concentração.

# Implementacao Potencial

(1) V1_padroes_restituicao:
- Por (id_deputado, cnpj_cpf_fornecedor, categoria_despesa, ano_mes):
  taxa_retencao = SUM(valor_retido)/NULLIF(SUM(valor_documento),0)
  taxa_restituicao = SUM(valor_restituicao)/NULLIF(SUM(valor_documento),0)
  delta_liquido = SUM(valor_documento - COALESCE(valor_retido,0) - COALESCE(valor_restituicao,0) - COALESCE(valor_liquido,0))
- Flags mensais por categoria: >P90(taxa_restituicao) e >P90(taxa_retencao); inconsist_liquido se |delta_liquido| > 1% de SUM(valor_documento).

(2) V2_parcelamento_artificial:
- Grupo (id_deputado, cnpj_cpf_fornecedor, ano_mes).
- Série parcelada se COUNT(*) ≥ 3 AND stddev_pop(valor_documento)/avg(valor_documento) ≤ 0.1 AND (MAX(numero_parcela) ≥ 3 OR datas em sequência).
- Emitir: serie_id (dense_rank por janela), n_notas, valor_total, desvio_relativo, span_dias, flag=1.

(3) V3_one_hit_wonder:
- A (estrita): COUNT(*) = 1 no total.
- B (temporal): COUNT(DISTINCT ano_mes)=1 AND COUNT(*) ≤ 2.
- Marcar suspeito se valor_liquido ≥ P90(categoria_despesa).

(4) V4_fornecedor_multi_naturezas:
- Por fornecedor: n_categorias, n_subcats.
- flag_multiuso se n_categorias ≥ 3 OU (n_categorias ≥ 2 E n_subcats ≥ 4).
- diversity_index = 1 - SUM(share_cat^2).

(5) V5_preferencia_politica_fornecedor:
- share_partido_fornec = valor_liquido(partido,fornec)/valor_total_fornec.
- base_rate_partido = valor_total_partido/valor_total_geral.
- lift = share_partido_fornec / NULLIF(base_rate_partido,0).
- flag_preferencia se lift ≥ 2 E valor_total_fornec ≥ P75(fornec).
- (Opcional) χ² (partido×fornecedor) calculado em JS após SELECT de matriz.

(6) V6_evolucao_liquido_vs_retido:
- Por (id_deputado, ano_mes): ratio_retido = SUM(valor_retido)/SUM(valor_documento).
- z-score por deputado sobre a série; outlier se |z| ≥ 2.

(7) V7_duplicacao_indireta:
- Mesmo fornecedor, valor_documento dentro de ±1%, data_emissao no mesmo dia ou ±3 dias, id_deputado distintos.
- Agrupar e emitir pares/múltiplos, flag=1.

(8) V8_concentracao_fornecedores:
- Para cada deputado: shares s_i = valor_liquido_fornec_i / total_deputado.
- HHI = SUM(s_i^2); flag se HHI ≥ 0.25 OU top1_share ≥ 0.6.

R_deputado_risco / R_fornecedor_risco:
- score_risco = média ponderada das flags:
  pesos: {restituicao:1.0, parcelamento:1.0, onehit:1.2, multiuso:0.8, preferencia:0.8, evol_retido:1.0, dup:1.3, hhi:0.9}
- incluir n_flags, lista_flags, top contrapartes.

