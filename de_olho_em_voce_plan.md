# De Olho em Você — Ciência de Dados Cívica Aplicada às Despesas Parlamentares

## Origem

Esta categoria de consultas foi criada com base no artigo acadêmico **"Ciência de Dados Cívica Aplicada à Transparência Legislativa: Um Framework para Interpretação Neutra de Dados Parlamentares"**, de autoria da Profª Dra. Karina Marra.

O trabalho propõe um framework metodológico para transformar dados legislativos brutos em informações estatisticamente contextualizadas e acessíveis ao público leigo, reduzindo vieses de interpretação e promovendo transparência institucional.

---

## Problema que as consultas resolvem

Dados parlamentares apresentados de forma absoluta (ex: "deputado X gastou R$50 milhões") são difíceis de interpretar sem contexto. O artigo propõe ferramentas estatísticas — como escore Z, ranking percentil e índice de participação — para responder à pergunta real: **esse valor é alto ou baixo em relação aos pares?**

---

## Consultas implementadas

### 1. Escore Z por deputado (`escore-z-por-deputado`)

**Fundamentação:** Seção 2 do artigo — fórmula `z = (x − μ) / σ`

Calcula o escore Z do total de despesas de cada parlamentar em relação à média nacional. Um z_score positivo indica gasto acima da média; negativo, abaixo.

- `media_nacional`: média de gastos de todos os deputados
- `z_score`: desvios padrão acima ou abaixo da média

---

### 2. Deputados fora do padrão — |z| ≥ 2 (`deputados-fora-do-padrao`)

**Fundamentação:** Seção 2.1 do artigo — exemplo prático com z = 2

Filtra apenas deputados cujo gasto está a dois ou mais desvios padrão da média nacional — o limiar estatístico clássico para identificar comportamentos atípicos.

- `posicao`: classifica como "Acima (≥2σ)" ou "Abaixo (≤-2σ)"

---

### 3. Ranking percentil nacional e por partido (`percentil-nacional-por-partido`)

**Fundamentação:** Seção 2 do artigo — contextualização estatística por fatores como partido

Usa `PERCENT_RANK()` para mostrar onde cada deputado se situa no ranking nacional e dentro do próprio partido. Um parlamentar no percentil 95 gasta mais do que 95% dos deputados.

- `percentil_nacional`: posição relativa entre todos os deputados
- `percentil_no_partido`: posição relativa dentro do partido

---

### 4. Z-score intrapartido (`z-score-intrapartido`)

**Fundamentação:** Seção 2 do artigo — "tamanho da bancada parlamentar do estado" como fator de contexto

Normaliza o gasto de cada deputado dentro do seu próprio partido. Identifica outliers que passariam despercebidos na comparação nacional — por exemplo, um parlamentar de partido pequeno que gasta muito acima dos colegas de bancada.

- `media_do_partido`: média de gastos dos deputados do mesmo partido
- `z_score_intrapartido`: desvios padrão dentro da bancada

---

### 5. Índice de engajamento legislativo (`indice-engajamento-legislativo`)

**Fundamentação:** Seção 4.3 do artigo — taxa de participação: `Participação = Votações Participadas / Votações Totais`

Adaptado para despesas: mede o nível de atividade de cada deputado comparado ao mais ativo, contando número de despesas, categorias utilizadas e fornecedores distintos.

- `indice_atividade_pct`: percentual de atividade em relação ao deputado mais ativo (0–100)
- `categorias_utilizadas`: diversidade de categorias de despesa
- `fornecedores_distintos`: número de fornecedores únicos utilizados

---

## Princípios metodológicos aplicados (Seção 7 do artigo)

| Princípio | Aplicação nesta categoria |
|---|---|
| Metodologia aberta | Todas as consultas SQL estão disponíveis e documentadas |
| Código aberto | Implementação integrada ao repositório público do VISO |
| Separação dados/opinião | As consultas apresentam apenas métricas estatísticas, sem classificações valorativas |

---

## Arquivos modificados

- `db.html` — nova categoria `civica` em `#sample-queries-list`
- `src/apps/db-app.js` — 5 novas entradas em `getQueryRegistry()`
