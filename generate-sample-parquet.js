#!/usr/bin/env node

// Script to generate a sample parquet file for testing
import fs from 'fs';
import path from 'path';

// Expanded sample data for testing routing
const sampleData = [
  {
    nome_parlamentar: 'João Silva',
    sigla_partido: 'PT',
    fornecedor: 'Empresa A Ltda',
    categoria_despesa: 'COMBUSTÍVEIS E LUBRIFICANTES',
    subcategoria_despesa: 'Combustível',
    valor_liquido: 1500.50,
    data_emissao: '2023-01-15',
    ano_competencia: 2023
  },
  {
    nome_parlamentar: 'Maria Santos',
    sigla_partido: 'PSDB',
    fornecedor: 'Empresa B S.A.',
    categoria_despesa: 'PASSAGENS AÉREAS',
    subcategoria_despesa: 'Passagem Aérea Nacional',
    valor_liquido: 2500.00,
    data_emissao: '2023-02-20',
    ano_competencia: 2023
  },
  {
    nome_parlamentar: 'Pedro Costa',
    sigla_partido: 'PDT',
    fornecedor: 'Empresa A Ltda',
    categoria_despesa: 'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS',
    subcategoria_despesa: 'Locação de Veículos',
    valor_liquido: 800.75,
    data_emissao: '2023-03-10',
    ano_competencia: 2023
  },
  {
    nome_parlamentar: 'Ana Silva',
    sigla_partido: 'PMDB',
    fornecedor: 'Posto Portal da Posse Ltda',
    categoria_despesa: 'COMBUSTÍVEIS E LUBRIFICANTES', 
    subcategoria_despesa: 'Combustível',
    valor_liquido: 350.00,
    data_emissao: '2023-04-05',
    ano_competencia: 2023
  },
  {
    nome_parlamentar: 'Carlos Oliveira',
    sigla_partido: 'PSB',
    fornecedor: 'Matheus Vinicius Xavier Santos',
    categoria_despesa: 'CONSULTORIA, PESQUISA E TRABALHOS TÉCNICOS',
    subcategoria_despesa: 'Consultoria',
    valor_liquido: 5000.00,
    data_emissao: '2023-05-12',
    ano_competencia: 2023
  },
  {
    nome_parlamentar: 'Lucia Fernandes',
    sigla_partido: 'PP',
    fornecedor: 'Tech Solutions Ltda',
    categoria_despesa: 'LOCAÇÃO OU FRETAMENTO DE SOFTWARE',
    subcategoria_despesa: 'Software',
    valor_liquido: 1200.00,
    data_emissao: '2023-06-18',
    ano_competencia: 2023
  }
];

// Convert to CSV format
function arrayToCsv(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      // Escape quotes and wrap in quotes if contains comma or quote
      const escaped = String(val).replace(/"/g, '""');
      return escaped.includes(',') || escaped.includes('"') ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Generate CSV file first
const csvContent = arrayToCsv(sampleData);
const csvPath = './public/despesas_sample.csv';

fs.writeFileSync(csvPath, csvContent, 'utf8');
console.log(`✅ Generated sample CSV: ${csvPath}`);
console.log(`📊 Sample contains ${sampleData.length} records`);
console.log(`🏛️ Contains entities like: Posto Portal da Posse Ltda, Matheus Vinicius Xavier Santos`);
console.log('\n🔧 To test routing:');
console.log('   http://localhost:3001/empresa-posto-portal-da-posse-ltda');
console.log('   http://localhost:3001/empresa-matheus-vinicius-xavier-santos');
console.log('   http://localhost:3001/deputado-joao-silva-pt');