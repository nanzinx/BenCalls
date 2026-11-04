// Tipos do domínio do BenCalls. Espelham as tabelas da BenApi e as novas do §13.2 do escopo.

export type StatusChamado =
  | 'Em Análise'
  | 'Pendente'
  | 'Em Execução'
  | 'Aguardando Consenso'
  | 'Concluído'
  | 'Cancelado'
  | 'Negado';

export type Prioridade = 'Crítica' | 'Alta' | 'Média' | 'Baixa';

export type StatusItem =
  | 'Novo'
  | 'Em uso'
  | 'Disponível (usado)'
  | 'Em manutenção'
  | 'Em garantia'
  | 'Quebrado'
  | 'Descartado';

export type Lado = 'E' | 'D';
export type Papel = 'SUP' | 'SUB' | 'LID';
export type Posicao = { papel: Papel; lado?: never; num?: never } | { lado: Lado; num: number; papel?: never };
export type Token = 'grupo' | 'lado' | 'posicao' | 'item';
export type LocalFora = 'ALM' | 'MNT' | 'GAR' | 'BXA';

/** Mesa (Workspaces/Desk_Groups/Positions). */
export interface Layout {
  id?: string;
  base: string;
  nome?: string;
  sala?: string;
  centro: Papel[];
  esq: number;
  dir: number;
  inicio?: 'sup' | 'porta';
  padrao: Token[];
  sep?: string;
  itens?: string[];
  desativadas?: Record<string, boolean>;
  rodape?: string;
  supervisorId?: string;
}

export interface Historico {
  status: StatusChamado;
  at: number;
  just?: string;
  user?: string;
}

export interface RegistroTriagem {
  texto?: string;
  st: 'feito' | 'imposs';
  motivo?: string;
  at: number;
}

/** O mínimo de um chamado que as regras precisam. */
export interface ChamadoBase {
  id?: number;
  status: StatusChamado;
  slaMin: number;
  hist: Historico[];
  criadoEm?: number;
  sitId?: string | null;
  outros?: boolean;
}
