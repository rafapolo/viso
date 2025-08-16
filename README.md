# 🕸️ VISO - Visualização Integrada da Situação Oficial

Explore gastos de deputados federais através de visualizações interativas e consultas SQL diretas com os dados da Câmara dos Deputados.

![viso ui graph](./docs/viso_ui_graph.png)

![viso ui db](./docs/viso_ui_db.png)

## 🎯 O que você pode descobrir
- **Quanto cada deputado gasta** e conexões com empresas
- **Padrões suspeitos** entre políticos e fornecedores  
- **Análises customizadas** através de consultas SQL

## 🔧 Duas Interfaces Integradas

### 📊 Visualização em Rede
Interface principal com grafo interativo de conexões deputado-empresa.
- **Nós azuis**: Deputados | **Nós vermelhos**: Fornecedores
- **Filtros inteligentes**: partido, categoria, valor mínimo
- **Interativo**: zoom, pan, clique para detalhes

### 🗄️ Explorador SQL 
Ferramenta para análises avançadas com consultas personalizadas.
- **Consultas pré-definidas** para análises comuns
- **Editor profissional** com syntax highlighting
- **Execução rápida** (Ctrl+Enter) e resultados paginados
- **Sistema de abas** para múltiplas análises

## 🛠️ Stack Tecnológico
- **Frontend**: HTML5, Tailwind CSS, JavaScript ES6+
- **Banco**: DuckDB WASM para SQL no browser
- **Visualização**: D3.js para gráficos interativos
- **Editor**: Monaco (VS Code web)
- **Dados**: Parquet para performance otimizada

## 📈 Casos de Uso
**Profissionais**: Jornalistas investigativos, pesquisadores, advogados, ativistas  
**Cidadãos**: Fiscalização popular, conhecer candidatos, aprendizado democrático

**Resultados esperados**: Maior transparência, deputados mais responsáveis, democracia fortalecida

## 🔒 Ética e Responsabilidade
- **100% dados públicos** oficiais da Câmara dos Deputados  
- **Uso responsável**: contextualize sempre, não faça acusações sem investigação aprofundada
- **Presunção de inocência**: dados mostram gastos, não comprovam irregularidades

---

💡 **Dica**: Use ambas interfaces! Explore visualmente no grafo, depois faça consultas específicas no SQL.

## 🧪 Testes

O VISO inclui uma suíte abrangente de testes para garantir qualidade e confiabilidade:

### Executar Todos os Testes
```bash
./run-tests.sh all
```

### Tipos de Teste
- **Unit Tests**: Funções individuais e utilitários
- **Integration Tests**: Interações entre componentes
- **E2E Tests**: Jornadas completas do usuário

### Comandos Disponíveis
```bash
./run-tests.sh setup      # Instalar dependências
./run-tests.sh unit       # Testes unitários
./run-tests.sh integration # Testes de integração
./run-tests.sh e2e        # Testes end-to-end
./run-tests.sh coverage   # Relatório de cobertura
```

### Tecnologias de Teste
- **Jest**: Framework de testes unitários e integração
- **Playwright**: Testes E2E com automação de navegador
- **Mocks Customizados**: DuckDB, D3.js, Monaco Editor

📚 **Documentação Completa**: [tests/README.md](tests/README.md)

---

*Desenvolvido para fortalecer a democracia brasileira através da transparência*
