// Sample data for tests

export interface DespesaRecord {
  nome_parlamentar: string;
  sigla_partido: string;
  fornecedor: string;
  categoria_despesa: string;
  valor_liquido: number;
  data_emissao: string;
  ano_competencia: number;
  num_transacoes: number;
  valor_total: number;
}

export interface AggregatedRecord {
  nome_parlamentar: string;
  sigla_partido: string;
  fornecedor: string;
  valor_total: number;
  num_transacoes: number;
}

export interface FilterOptions {
  parties: string[];
  categories: string[];
}

export interface SchemaColumn {
  column_name: string;
  column_type: string;
  null: string;
}

export interface QueryResult {
  data: DespesaRecord[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: string;
}

export interface NetworkLink {
  source: string;
  target: string;
  value: number;
  transactions: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export const sampleDespesasData: DespesaRecord[] = [
  {
    nome_parlamentar: 'João Silva',
    sigla_partido: 'PARTIDO',
    fornecedor: 'Empresa A Ltda',
    categoria_despesa: 'COMBUSTÍVEIS E LUBRIFICANTES',
    valor_liquido: 1500.50,
    data_emissao: '2023-01-15',
    ano_competencia: 2023,
    num_transacoes: 3,
    valor_total: 4501.50,
  },
  {
    nome_parlamentar: 'Maria Santos',
    sigla_partido: 'OUTRO',
    fornecedor: 'Empresa B S.A.',
    categoria_despesa: 'PASSAGENS AÉREAS',
    valor_liquido: 2500.00,
    data_emissao: '2023-02-20',
    ano_competencia: 2023,
    num_transacoes: 1,
    valor_total: 2500.00,
  },
  {
    nome_parlamentar: 'Pedro Costa',
    sigla_partido: 'PARTIDO',
    fornecedor: 'Empresa A Ltda',
    categoria_despesa: 'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS',
    valor_liquido: 800.75,
    data_emissao: '2023-03-10',
    ano_competencia: 2023,
    num_transacoes: 2,
    valor_total: 1601.50,
  },
];

export const sampleAggregatedData: AggregatedRecord[] = [
  {
    nome_parlamentar: 'João Silva',
    sigla_partido: 'PARTIDO',
    fornecedor: 'Empresa A Ltda',
    valor_total: 4501.50,
    num_transacoes: 3,
  },
  {
    nome_parlamentar: 'Maria Santos',
    sigla_partido: 'OUTRO',
    fornecedor: 'Empresa B S.A.',
    valor_total: 2500.00,
    num_transacoes: 1,
  },
];

export const sampleFilterOptions: FilterOptions = {
  parties: ['PARTIDO', 'OUTRO'],
  categories: ['COMBUSTÍVEIS E LUBRIFICANTES', 'PASSAGENS AÉREAS', 'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS'],
};

export const sampleSchema: SchemaColumn[] = [
  { column_name: 'nome_parlamentar', column_type: 'VARCHAR', null: 'YES' },
  { column_name: 'sigla_partido', column_type: 'VARCHAR', null: 'YES' },
  { column_name: 'valor_liquido', column_type: 'DOUBLE', null: 'YES' },
  { column_name: 'data_emissao', column_type: 'DATE', null: 'YES' },
];

export const sampleQueryResult: QueryResult = {
  data: sampleDespesasData,
  columns: ['nome_parlamentar', 'sigla_partido', 'fornecedor', 'categoria_despesa', 'valor_liquido'],
  rowCount: 3,
  executionTime: 45.6,
};

export const sampleNetworkData: NetworkData = {
  nodes: [
    { id: 'dep_joao', label: 'João Silva (PARTIDO)', type: 'deputado' },
    { id: 'dep_maria', label: 'Maria Santos (OUTRO)', type: 'deputado' },
    { id: 'emp_a', label: 'Empresa A Ltda', type: 'fornecedor' },
    { id: 'emp_b', label: 'Empresa B S.A.', type: 'fornecedor' },
  ],
  links: [
    { source: 'dep_joao', target: 'emp_a', value: 4501.50, transactions: 3 },
    { source: 'dep_maria', target: 'emp_b', value: 2500.00, transactions: 1 },
  ],
};
