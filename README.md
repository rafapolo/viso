# 🕸️ VISO - Visualização e Análise de Despesas Parlamentares

> **Transparência através da visualização e consulta de dados públicos**

Uma plataforma completa para explorar os gastos dos deputados federais brasileiros através de visualizações interativas e consultas SQL diretas nos dados.

## 🎯 Por que isso importa?

### Dados Públicos = Poder Cidadão
- **Transparência**: Todo real gasto pelos deputados vem dos nossos impostos
- **Accountability**: Visualizar padrões de gastos ajuda a identificar irregularidades  
- **Democracia**: Cidadãos informados fazem escolhas melhores nas eleições
- **Fiscalização**: A sociedade civil pode acompanhar como o dinheiro público é usado

### O que você pode descobrir:
- 💰 **Quanto cada deputado gasta** e com quais empresas
- 🏛️ **Padrões por partido político** - quem gasta mais/menos
- 🏢 **Empresas que mais faturam** com dinheiro público
- 🔍 **Conexões suspeitas** entre políticos e fornecedores
- 📊 **Análises customizadas** através de consultas SQL

## 🚀 Duas Interfaces Poderosas

### 📊 **Visualização em Grafo** (`index.html`)
Interface principal com rede interativa de conexões entre deputados e empresas.

**Características:**
- **Nós vermelhos**: Deputados federais
- **Nós azuis**: Empresas fornecedoras  
- **Linhas**: Conexões financeiras (espessura proporcional aos valores)
- **Filtros inteligentes**: Partido, categoria, valor mínimo
- **Interatividade total**: Zoom, pan, drag, clique para detalhes

### 🗄️ **Interface de Banco de Dados** (`db.html`)
Ferramenta avançada para análises customizadas com SQL.

**Características:**
- **Editor SQL** com syntax highlighting (Monaco Editor)
- **Execução de queries** diretamente no navegador
- **Esquema interativo** da base de dados
- **Consultas pré-definidas** para análises comuns
- **Exportação** de resultados em CSV
- **Sistema de abas** para múltiplas consultas

## 🎮 Funcionalidades Detalhadas

### 📊 Rede Interativa
- **Filtros Dinâmicos**: Os valores min/max se ajustam automaticamente aos filtros aplicados
- **Estatísticas em Tempo Real**: Contadores de deputados, empresas, valores e transações
- **Painel de Detalhes**: Informações completas ao clicar em qualquer nó
- **Controles de Visualização**: Mostrar/ocultar nomes de empresas e valores
- **Navegação Fluida**: Zoom com mouse wheel, pan com drag

### 🗄️ Análise SQL Avançada
- **Consultas Pré-definidas**:
  - Ver primeiros 10 registros
  - Despesas por partido
  - Top categorias de gastos
  - Top deputados por valor gasto
  - Fornecedores multi-deputados
- **Editor Profissional**: Autocompletar, syntax highlighting
- **Execução Rápida**: Ctrl+Enter para executar queries
- **Resultados Paginados**: Visualização otimizada para grandes datasets
- **Sistema de Abas**: Organize múltiplas análises simultaneamente

### 🔄 Navegação Integrada
- **Botão "Viso DB"**: Na visualização → acesse o banco de dados
- **Botão "Ver Grafo"**: No banco → volte para a visualização
- **Design Consistente**: Headers uniformes entre as interfaces
- **Tema Escuro**: Interface otimizada para longas sessões de análise

## 📈 Exemplos de Análises

### Consultas SQL Úteis
```sql
-- Top 10 deputados que mais gastam
SELECT nome_parlamentar, sigla_partido, 
       SUM(valor_liquido) as total_gasto
FROM despesas 
GROUP BY nome_parlamentar, sigla_partido 
ORDER BY total_gasto DESC 
LIMIT 10;

-- Empresas que recebem de múltiplos partidos
SELECT fornecedor, 
       COUNT(DISTINCT sigla_partido) as num_partidos,
       SUM(valor_liquido) as total_recebido
FROM despesas 
GROUP BY fornecedor 
HAVING num_partidos > 3 
ORDER BY total_recebido DESC;

-- Gastos por categoria e partido
SELECT categoria_despesa, sigla_partido,
       SUM(valor_liquido) as total,
       COUNT(*) as transacoes
FROM despesas 
GROUP BY categoria_despesa, sigla_partido 
ORDER BY total DESC;
```

### Padrões Suspeitos
- Deputado que gasta exclusivamente com uma empresa
- Empresa que recebe de muitos deputados do mesmo partido
- Gastos muito acima da média em categorias específicas
- Fornecedores com valores únicos muito altos

## 🛠️ Tecnologias e Arquitetura

### Stack Tecnológico
- **Frontend**: HTML5, CSS3 (Tailwind), JavaScript ES6+
- **Processamento de Dados**: DuckDB WASM para consultas SQL no browser
- **Visualização**: D3.js para gráficos de rede interativos  
- **Editor**: Monaco Editor (VS Code web) para interface SQL
- **Dados**: Formato Parquet para performance otimizada
- **Deploy**: Funciona em qualquer servidor estático

### Estrutura do Projeto
```
viso/
├── index.html              # Visualização em grafo
├── db.html                 # Interface de banco de dados
├── public/
│   └── despesas.parquet    # Dataset principal
├── duckdb-ui-setup.sql     # Configurações do DuckDB
├── README-duckdb-ui.md     # Documentação técnica
└── README.md              # Esta documentação
```

### Performance e Otimizações
- **DuckDB WASM**: Consultas SQL extremamente rápidas no browser
- **Parquet**: Formato colunar comprimido para datasets grandes
- **Lazy Loading**: Carregamento progressivo de dados
- **Debounced Filters**: Filtros com delay para melhor UX
- **Results Pagination**: Limitação automática para visualização fluida

## 🚀 Como Usar

### 🌐 Acesso Online
Visite diretamente no seu navegador - funciona 100% client-side!

### 💻 Executar Localmente
```bash
# Clone o repositório
git clone https://github.com/rafapolo/viso.git
cd viso

# Inicie um servidor local (necessário devido ao CORS)
python -m http.server 8000
# OU
npx serve .
# OU
php -S localhost:8000

# Abra no navegador
http://localhost:8000
```

### 📱 Requisitos
- **Navegador moderno** com suporte a WebAssembly
- **JavaScript habilitado**
- **Conexão à internet** (para carregar bibliotecas CDN)
- **Mínimo 2GB RAM** (para datasets grandes)

## 🤝 Contribuindo

### Como Ajudar
- 🐛 **Reporte bugs** através das Issues
- 💡 **Sugira funcionalidades** novas
- 📊 **Contribua com dados** mais recentes
- 🎨 **Melhore a interface** e UX
- 📝 **Documente** casos de uso
- 🔧 **Otimize performance** das consultas

### Roadmap
- [ ] **Dados históricos**: Múltiplos anos de despesas
- [ ] **Comparações temporais**: Evolução dos gastos
- [ ] **Geolocalização**: Mapa de fornecedores por região
- [ ] **API REST**: Endpoints para desenvolvedores
- [ ] **Relatórios PDF**: Exportação de análises
- [ ] **Alertas**: Notificações de gastos suspeitos

## 📊 Dados e Fontes

### Origem dos Dados
- **Portal da Transparência da Câmara dos Deputados**
- **API Dados Abertos** da Câmara Federal
- **Lei de Acesso à Informação** (LAI)
- **Processamento**: Limpeza e normalização automatizada

### Atualização
- Dataset atual: **[inserir período dos dados]**
- Próxima atualização: **[inserir data prevista]**
- Frequência: **Mensal/Trimestral**

## 🌟 Impacto e Casos de Uso

### Profissionais
- **👨‍💼 Jornalistas**: Identificar pautas investigativas
- **⚖️ Advogados**: Casos de improbidade administrativa  
- **🎓 Pesquisadores**: Estudos sobre política e corrupção
- **🏛️ Ativistas**: Campanhas por transparência

### Cidadãos
- **🗳️ Eleitores**: Conhecer histórico dos candidatos
- **👥 Sociedade Civil**: Fiscalização popular
- **📚 Estudantes**: Aprendizado sobre democracia
- **🔍 Curiosos**: Exploração de dados públicos

### Resultados Esperados
- ✅ Mais cidadãos fiscalizando gastos públicos
- ✅ Deputados mais responsáveis com despesas
- ✅ Maior transparência no uso de recursos
- ✅ Democracia mais forte e participativa
- ✅ Jornalismo investigativo mais eficiente

## 🔒 Privacidade e Ética

### Dados Públicos
- **100% dados públicos** disponibilizados pelos próprios órgãos
- **Sem informações pessoais** sensíveis
- **Transparência obrigatória** por lei
- **Uso ético** para fortalecer a democracia

### Responsabilidade
- **Contexto é importante**: Analise sempre com cuidado
- **Não faça acusações** baseadas apenas nos dados
- **Cruzar fontes** para investigações sérias
- **Respeitar presunção** de inocência

---

## 🚀 Interfaces do Sistema

| Página | Função | Melhor Para |
|--------|--------|-------------|
| **index.html** | Visualização interativa | Exploração visual, padrões, conexões |
| **db.html** | Consultas SQL | Análises específicas, relatórios, dados precisos |

**💡 Dica**: Use as duas interfaces em conjunto! Explore visualmente no grafo e depois faça consultas específicas no banco de dados.

---

**🔗 Compartilhe**: Ajude outros cidadãos a descobrir como seus impostos são gastos.

**💡 Lembre-se**: Dados públicos pertencem ao povo. Use-os para tornar nossa democracia mais transparente!

---

*Desenvolvido com ❤️ para fortalecer a democracia brasileira*

*VISO - Porque transparência é a base da democracia*