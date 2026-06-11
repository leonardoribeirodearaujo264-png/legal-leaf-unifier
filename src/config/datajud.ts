// Maps J (justice) + TT (tribunal) → DataJud index name
const TRIBUNAL_INDEX: Record<string, string> = {
  // STF
  '1_00': 'api_publica_stf',
  // CNJ
  '2_00': 'api_publica_cnj',
  // STJ
  '3_00': 'api_publica_stj',
  // TRF (Justiça Federal — J=4)
  '4_01': 'api_publica_trf1', '4_02': 'api_publica_trf2',
  '4_03': 'api_publica_trf3', '4_04': 'api_publica_trf4',
  '4_05': 'api_publica_trf5', '4_06': 'api_publica_trf6',
  // TRT (Justiça do Trabalho — J=5)
  '5_00': 'api_publica_tst',
  '5_01': 'api_publica_trt1',  '5_02': 'api_publica_trt2',
  '5_03': 'api_publica_trt3',  '5_04': 'api_publica_trt4',
  '5_05': 'api_publica_trt5',  '5_06': 'api_publica_trt6',
  '5_07': 'api_publica_trt7',  '5_08': 'api_publica_trt8',
  '5_09': 'api_publica_trt9',  '5_10': 'api_publica_trt10',
  '5_11': 'api_publica_trt11', '5_12': 'api_publica_trt12',
  '5_13': 'api_publica_trt13', '5_14': 'api_publica_trt14',
  '5_15': 'api_publica_trt15', '5_16': 'api_publica_trt16',
  '5_17': 'api_publica_trt17', '5_18': 'api_publica_trt18',
  '5_19': 'api_publica_trt19', '5_20': 'api_publica_trt20',
  '5_21': 'api_publica_trt21', '5_22': 'api_publica_trt22',
  '5_23': 'api_publica_trt23', '5_24': 'api_publica_trt24',
  // TJE (Justiça Estadual — J=8)
  '8_01': 'api_publica_tjac', '8_02': 'api_publica_tjal',
  '8_03': 'api_publica_tjap', '8_04': 'api_publica_tjam',
  '8_05': 'api_publica_tjba', '8_06': 'api_publica_tjce',
  '8_07': 'api_publica_tjdft','8_08': 'api_publica_tjes',
  '8_09': 'api_publica_tjgo', '8_10': 'api_publica_tjma',
  '8_11': 'api_publica_tjmt', '8_12': 'api_publica_tjms',
  '8_13': 'api_publica_tjmg', '8_14': 'api_publica_tjpa',
  '8_15': 'api_publica_tjpb', '8_16': 'api_publica_tjpr',
  '8_17': 'api_publica_tjpe', '8_18': 'api_publica_tjpi',
  '8_19': 'api_publica_tjrj', '8_20': 'api_publica_tjrn',
  '8_21': 'api_publica_tjrs', '8_22': 'api_publica_tjro',
  '8_23': 'api_publica_tjrr', '8_24': 'api_publica_tjsc',
  '8_25': 'api_publica_tjse', '8_26': 'api_publica_tjsp',
  '8_27': 'api_publica_tjto',
  // JM (Justiça Militar — J=9)
  '9_01': 'api_publica_jmeu',
};

// CNJ process number format: NNNNNNN-DD.AAAA.J.TT.OOOO
const CNJ_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})\.(\d{4})$/;

export function parseProcessNumber(raw: string): {
  normalized: string;
  j: string;
  tt: string;
  index: string | null;
} | null {
  const cleaned = raw.replace(/\s/g, '');
  const match = cleaned.match(CNJ_REGEX);
  if (!match) return null;

  const j = match[4];
  const tt = match[5].padStart(2, '0');
  const key = `${j}_${tt}`;
  const index = TRIBUNAL_INDEX[key] ?? null;

  return { normalized: cleaned, j, tt, index };
}
