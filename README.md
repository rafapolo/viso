# 🕸️ VISO - Visualização de Despesas Parlamentares

> **Transparência através da visualização de dados públicos**

Uma ferramenta interativa para explorar os gastos dos deputados federais brasileiros e suas conexões com empresas fornecedoras.

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

## 🎮 Funcionalidades

### 📊 Rede Interativa
- **Nós vermelhos**: Deputados federais
- **Nós azuis**: Empresas fornecedoras
- **Linhas**: Conexões financeiras (quanto mais grossa = mais dinheiro)

### 🔧 Controles Interativos
- **🎚️ Filtro por Partido**: Veja gastos de PT, PSDB, PL, etc.
- **📂 Filtro por Categoria**: Combustível, consultoria, aluguel...
- **💵 Valor Mínimo**: Ajuste para ver apenas gastos acima de R$ X
- **🏷️ Mostrar Empresas**: Exibe nomes das empresas na rede
- **💰 Mostrar Gastos**: Valores em R$ nas conexões

### 🔍 Exploração
- **Clique nos nós**: Veja detalhes financeiros
- **Arraste**: Reorganize a visualização
- **Zoom**: Use a roda do mouse ou botões de zoom

## 📈 Exemplos do que descobrir

### Padrões Suspeitos
- Deputado que gasta só com uma empresa
- Empresa que recebe de muitos deputados do mesmo partido
- Gastos muito acima da média

### Análises Possíveis
- Qual partido gasta mais com combustível?
- Quais empresas dominam contratos públicos?
- Há concentração de gastos em poucas empresas?

## 🛠️ Para Desenvolvedores

### Tecnologias
- **Frontend**: HTML5, CSS3, JavaScript
- **Dados**: DuckDB WASM + Parquet
- **Visualização**: D3.js
- **Deploy**: GitHub Pages, Netlify, Vercel

### Estrutura
```
viso/
├── index.html          # Aplicação completa
├── public/
│   └── despesas.parquet # Dados dos gastos
└── README.md           # Esta documentação
```

## 🤝 Contribuindo

## 🚀 Como usar

### Executar localmente
```bash
# Clone o repositório
git clone https://github.com/rafapolo/viso.git
cd viso
# Inicie um servidor local
python -m http.server 8000
# Abra no navegador
http://localhost:8000
```

### Como ajudar
- 🐛 **Reporte bugs** - encontrou algo estranho?
- 💡 **Sugira melhorias** - que análise falta?
- 📊 **Atualize dados** - tem dados mais recentes?
- 🎨 **Melhore a interface** - como tornar mais fácil de usar?

### Dados Abertos
Esta ferramenta usa dados públicos da Câmara dos Deputados, disponíveis em:
- **Portal da Transparência**
- **Dados Abertos da Câmara**
- **Lei de Acesso à Informação**

## 🌟 Impacto Social

### Casos de Uso
- **Jornalismo Investigativo**: Identificar pautas sobre gastos públicos
- **Ativismo Cívico**: Pressionar por mais transparência
- **Educação**: Ensinar sobre democracia e controle social
- **Pesquisa Acadêmica**: Estudos sobre política e corrupção

### Resultados Esperados
- ✅ Mais cidadãos fiscalizando gastos públicos
- ✅ Deputados mais cuidadosos com despesas
- ✅ Maior transparência no uso de recursos
- ✅ Democracia mais forte e participativa

---

**💡 Lembre-se**: Dados públicos pertencem ao povo. Use-os para tornar nossa democracia mais transparente!

**🔗 Compartilhe**: Ajude outros cidadãos a descobrir como seus impostos são gastos.

---
*Desenvolvido com ❤️ para fortalecer a democracia brasileira*