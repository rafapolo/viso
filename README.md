## 🕸️ VISO - Visualização e Análise de Despesas Parlamentares

Visualize os gastos dos deputados federais brasileiros através de visualizações interativas e consultas SQL diretas nos dados das Despesas da Camara dos Deputados.

![viso ui graph](.doc/viso_ui_graph.png)

![viso ui db](./doc/viso_ui_db.png)


### O que você pode descobrir:
- 💰 **Quanto cada deputado gasta** e com quais empresas
- 🏛️ **Padrões por partido político** - quem gasta mais/menos
- 🏢 **Empresas que mais faturam** com dinheiro público
- 🔍 **Conexões suspeitas** entre políticos e fornecedores
- 📊 **Análises customizadas** através de consultas SQL


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


**💡 Dica**: Use as duas interfaces em conjunto! Explore visualmente no grafo e depois faça consultas específicas no banco de dados em SQL.

---

**🔗 Compartilhe**: Ajude outros cidadãos a descobrir como seus impostos são gastos.

---

### Publiconomia aplicada!

*Desenvolvido com ❤️ para fortalecer a democracia brasileira*

*VISO - Porque transparência é a base da democracia*