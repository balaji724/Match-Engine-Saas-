import fs from 'fs';
import path from 'path';
import * as xlsxModule from 'xlsx';
const XLSX = (xlsxModule as any).default || xlsxModule;
import * as archiverModule from 'archiver';

const archiver = (archiverModule as any).default || archiverModule;

export interface RecordItem {
  id: string;
  company?: string;
  domain?: string;
  address?: string;
  email?: string;
  phone?: string;
  pincode?: string;
  [key: string]: any;
}

export interface MatchedResultRow {
  A_ID: string;
  B_ID: string;
  Company_A: string;
  Company_B: string;
  Domain_A: string;
  Domain_B: string;
  Address_A: string;
  Address_B: string;
  Email_A: string;
  Email_B: string;
  Phone_A: string;
  Phone_B: string;
  Pincode_A: string;
  Pincode_B: string;
  Company_Score: number;
  Domain_Score: number;
  Address_Score: number;
  Email_Score: number;
  Phone_Score: number;
  Pincode_Score: number;
  Overall_Score: number;
  Result: 'MATCH' | 'PARTIAL MATCH' | 'NOT MATCH';
  Matched_Fields: string;
  Reason: string;
}

export interface MatchWeights {
  company_name: number; // default 30
  domain: number;       // default 25
  address: number;      // default 20
  email: number;        // default 10
  phone: number;        // default 10
  pincode: number;      // default 5
}

export interface MatchThresholds {
  match: number;         // default 90
  partial_match: number; // default 60
}

export interface MatchJobConfig {
  mapping: {
    company_name?: { a?: string; b?: string };
    domain?: { a?: string; b?: string };
    address?: { a?: string; b?: string };
    email?: { a?: string; b?: string };
    phone?: { a?: string; b?: string };
    pincode?: { a?: string; b?: string };
  };
  weights: MatchWeights;
  thresholds: MatchThresholds;
}

// Legal company suffix regexes
const LEGAL_SUFFIXES = [
  /\bINCORPORATED\b/gi, /\bINC\b/gi, /\bLLC\b/gi, /\bL\.L\.C\b/gi,
  /\bCORPORATION\b/gi, /\bCORP\b/gi, /\bLIMITED\b/gi, /\bLTD\b/gi,
  /\bCOMPANY\b/gi, /\bCO\b/gi, /\bGROUP\b/gi, /\bHOLDINGS\b/gi,
  /\bENTERPRISES\b/gi, /\bTECHNOLOGIES\b/gi, /\bTECH\b/gi,
  /\bSOLUTIONS\b/gi, /\bSERVICES\b/gi, /\bPVT\b/gi, /\bPRIVATE\b/gi,
  /\bGMBH\b/gi, /\bS\.A\b/gi, /\bPLC\b/gi
];

export function normalizeCompany(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).toUpperCase().trim();
  str = str.replace(/[\.,\-\'\"/\\#&()\[\]]/g, ' ');
  for (const suffix of LEGAL_SUFFIXES) {
    str = str.replace(suffix, ' ');
  }
  return str.replace(/\s+/g, ' ').trim();
}

export function normalizeDomain(val: any): string {
  if (!val) return '';
  let str = String(val).toLowerCase().trim();
  str = str.replace(/^https?:\/\//, '');
  str = str.replace(/^www\./, '');
  str = str.split('/')[0].split('?')[0].split(':')[0];
  return str.trim();
}

export function normalizePhone(val: any): string {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function normalizeEmail(val: any): string {
  if (!val) return '';
  return String(val).toLowerCase().trim();
}

export function normalizePincode(val: any): string {
  if (!val) return '';
  const clean = String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
  return clean.slice(0, 6);
}

export function normalizeAddress(val: any): string {
  if (!val) return '';
  let str = String(val).toUpperCase().trim();
  str = str.replace(/\b(SUITE|STE|APT|UNIT|FL|FLOOR|BLDG)\b.*/gi, '');
  str = str.replace(/\bSTREET\b/gi, 'ST');
  str = str.replace(/\bAVENUE\b/gi, 'AVE');
  str = str.replace(/\bBOULEVARD\b/gi, 'BLVD');
  str = str.replace(/\bROAD\b/gi, 'RD');
  str = str.replace(/\bDRIVE\b/gi, 'DR');
  str = str.replace(/[\.,\-\'\"/\\#]/g, ' ');
  return str.replace(/\s+/g, ' ').trim();
}

// Levenshtein distance
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val = row[j - 1];
      if (a[i - 1] !== b[j - 1]) {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 0;
  if (a === b) return 100;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshtein(a, b);
  return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));
}

// Token Sort Ratio
export function tokenSortSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = a.split(/\s+/).filter(Boolean).sort().join(' ');
  const tokensB = b.split(/\s+/).filter(Boolean).sort().join(' ');
  return stringSimilarity(tokensA, tokensB);
}

// Jaro-Winkler similarity
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  const m = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - m);
    const end = Math.min(i + m + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  const score = jaro + prefix * 0.1 * (1 - jaro);
  return Math.round(score * 100);
}

export function scoreCompany(cA: string, cB: string): number {
  if (!cA || !cB) return 0;
  if (cA === cB) return 100;
  const tokenScore = tokenSortSimilarity(cA, cB);
  const jwScore = jaroWinkler(cA, cB);
  return Math.max(tokenScore, jwScore);
}

export function scoreDomain(dA: string, dB: string): number {
  if (!dA || !dB) return 0;
  if (dA === dB) return 100;
  if (dA.endsWith(`.${dB}`) || dB.endsWith(`.${dA}`)) return 90;
  return stringSimilarity(dA, dB);
}

export function scoreEmail(eA: string, eB: string): number {
  if (!eA || !eB) return 0;
  if (eA === eB) return 100;
  const domA = eA.includes('@') ? eA.split('@')[1] : '';
  const domB = eB.includes('@') ? eB.split('@')[1] : '';
  if (domA && domA === domB) {
    const userA = eA.split('@')[0];
    const userB = eB.split('@')[0];
    return Math.round(70 + (stringSimilarity(userA, userB) * 0.3));
  }
  return 0;
}

export function scorePhone(pA: string, pB: string): number {
  if (!pA || !pB) return 0;
  if (pA === pB && pA.length >= 7) return 100;
  if (pA.length >= 7 && pB.length >= 7 && (pA.endsWith(pB.slice(-7)) || pB.endsWith(pA.slice(-7)))) {
    return 80;
  }
  return 0;
}

export function scorePincode(pinA: string, pinB: string): number {
  if (!pinA || !pinB) return 0;
  if (pinA === pinB) return 100;
  if (pinA.length >= 3 && pinB.length >= 3 && pinA.slice(0, 3) === pinB.slice(0, 3)) {
    return 70;
  }
  return 0;
}

export function scoreAddress(aA: string, aB: string): number {
  if (!aA || !aB) return 0;
  if (aA === aB) return 100;
  return tokenSortSimilarity(aA, aB);
}

export function evaluateRowPair(
  rowA: any,
  rowB: any,
  weights: MatchWeights,
  thresholds: MatchThresholds
): MatchedResultRow {
  const cScore = scoreCompany(rowA.norm_company, rowB.norm_company);
  const dScore = scoreDomain(rowA.norm_domain, rowB.norm_domain);
  const aScore = scoreAddress(rowA.norm_address, rowB.norm_address);
  const eScore = scoreEmail(rowA.norm_email, rowB.norm_email);
  const pScore = scorePhone(rowA.norm_phone, rowB.norm_phone);
  const pinScore = scorePincode(rowA.norm_pincode, rowB.norm_pincode);

  let activeWeight = 0;
  let weightedSum = 0;

  if (rowA.norm_company || rowB.norm_company) {
    const w = weights.company_name || 30;
    activeWeight += w;
    weightedSum += cScore * w;
  }
  if (rowA.norm_domain || rowB.norm_domain) {
    const w = weights.domain || 25;
    activeWeight += w;
    weightedSum += dScore * w;
  }
  if (rowA.norm_address || rowB.norm_address) {
    const w = weights.address || 20;
    activeWeight += w;
    weightedSum += aScore * w;
  }
  if (rowA.norm_email || rowB.norm_email) {
    const w = weights.email || 10;
    activeWeight += w;
    weightedSum += eScore * w;
  }
  if (rowA.norm_phone || rowB.norm_phone) {
    const w = weights.phone || 10;
    activeWeight += w;
    weightedSum += pScore * w;
  }
  if (rowA.norm_pincode || rowB.norm_pincode) {
    const w = weights.pincode || 5;
    activeWeight += w;
    weightedSum += pinScore * w;
  }

  const overallScore = activeWeight > 0 ? Math.round((weightedSum / activeWeight) * 10) / 10 : 0;

  const matchedFieldsList: string[] = [];
  if (cScore >= 80) matchedFieldsList.push('Company');
  if (dScore >= 80) matchedFieldsList.push('Domain');
  if (aScore >= 75) matchedFieldsList.push('Address');
  if (eScore >= 80) matchedFieldsList.push('Email');
  if (pScore >= 80) matchedFieldsList.push('Phone');
  if (pinScore >= 80) matchedFieldsList.push('Pincode');

  let result: 'MATCH' | 'PARTIAL MATCH' | 'NOT MATCH';
  let reason: string;

  if (overallScore >= thresholds.match) {
    result = 'MATCH';
    reason = `High confidence match across ${matchedFieldsList.join(', ') || 'attributes'} (${overallScore}% >= ${thresholds.match}%)`;
  } else if (overallScore >= thresholds.partial_match) {
    result = 'PARTIAL MATCH';
    reason = `Partial similarity in ${matchedFieldsList.join(', ') || 'attributes'} (${overallScore}% >= ${thresholds.partial_match}%)`;
  } else {
    result = 'NOT MATCH';
    reason = `Insufficient score (${overallScore}% < ${thresholds.partial_match}%)`;
  }

  return {
    A_ID: String(rowA.raw_id || ''),
    B_ID: String(rowB.raw_id || ''),
    Company_A: String(rowA.raw_company || ''),
    Company_B: String(rowB.raw_company || ''),
    Domain_A: String(rowA.raw_domain || ''),
    Domain_B: String(rowB.raw_domain || ''),
    Address_A: String(rowA.raw_address || ''),
    Address_B: String(rowB.raw_address || ''),
    Email_A: String(rowA.raw_email || ''),
    Email_B: String(rowB.raw_email || ''),
    Phone_A: String(rowA.raw_phone || ''),
    Phone_B: String(rowB.raw_phone || ''),
    Pincode_A: String(rowA.raw_pincode || ''),
    Pincode_B: String(rowB.raw_pincode || ''),
    Company_Score: cScore,
    Domain_Score: dScore,
    Address_Score: aScore,
    Email_Score: eScore,
    Phone_Score: pScore,
    Pincode_Score: pinScore,
    Overall_Score: overallScore,
    Result: result,
    Matched_Fields: matchedFieldsList.join(', ') || 'None',
    Reason: reason,
  };
}

/**
 * Builds candidate generation blocking indexes to avoid O(N*M) Cartesian explosion.
 */
export function buildCandidateIndex(recordsB: any[]): Map<string, number[]> {
  const index = new Map<string, number[]>();

  const addKey = (key: string, idx: number) => {
    if (!key || key.length < 2) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key)!.push(idx);
  };

  recordsB.forEach((b, idx) => {
    if (b.norm_domain) addKey(`dom:${b.norm_domain}`, idx);
    if (b.norm_phone && b.norm_phone.length >= 7) addKey(`ph:${b.norm_phone}`, idx);
    if (b.norm_email) addKey(`em:${b.norm_email}`, idx);
    if (b.norm_company) {
      const words = b.norm_company.split(' ');
      if (words[0] && words[0].length >= 3) addKey(`cw:${words[0]}`, idx);
      if (words.length > 1 && words[1].length >= 3) addKey(`cw:${words[1]}`, idx);
    }
    if (b.norm_pincode) addKey(`pin:${b.norm_pincode}`, idx);
  });

  return index;
}

export async function packageExcelResults(
  jobId: string,
  results: MatchedResultRow[],
  summaryData: {
    totalRecords: number;
    matchCount: number;
    partialMatchCount: number;
    notMatchCount: number;
    elapsedMs: number;
    rowsPerSecond: number;
    weights: MatchWeights;
    thresholds: MatchThresholds;
    fileAName: string;
    fileBName: string;
  },
  outputDir: string
): Promise<{ zipPath: string; summaryPath: string; chunkFiles: string[] }> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const CHUNK_SIZE = 50000;
  const chunkFiles: string[] = [];
  const totalChunks = Math.max(1, Math.ceil(results.length / CHUNK_SIZE));

  // 1. Generate chunked excel files: results_001.xlsx, results_002.xlsx...
  for (let c = 0; c < totalChunks; c++) {
    const chunkRows = results.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
    const chunkNum = String(c + 1).padStart(3, '0');
    const chunkFilename = `results_${chunkNum}.xlsx`;
    const chunkPath = path.join(outputDir, chunkFilename);

    const worksheet = XLSX.utils.json_to_sheet(chunkRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Results_Part_${chunkNum}`);
    XLSX.writeFile(workbook, chunkPath);
    chunkFiles.push(chunkPath);
  }

  // 2. Generate summary.xlsx & Master match_results.xlsx
  const summaryRows = [
    { Metric: 'Job ID', Value: jobId },
    { Metric: 'File A', Value: summaryData.fileAName },
    { Metric: 'File B', Value: summaryData.fileBName },
    { Metric: 'Total Records Evaluated', Value: summaryData.totalRecords },
    { Metric: 'MATCH Count', Value: summaryData.matchCount },
    { Metric: 'MATCH Percentage', Value: `${Math.round((summaryData.matchCount / (summaryData.totalRecords || 1)) * 1000) / 10}%` },
    { Metric: 'PARTIAL MATCH Count', Value: summaryData.partialMatchCount },
    { Metric: 'PARTIAL MATCH Percentage', Value: `${Math.round((summaryData.partialMatchCount / (summaryData.totalRecords || 1)) * 1000) / 10}%` },
    { Metric: 'NOT MATCH Count', Value: summaryData.notMatchCount },
    { Metric: 'NOT MATCH Percentage', Value: `${Math.round((summaryData.notMatchCount / (summaryData.totalRecords || 1)) * 1000) / 10}%` },
    { Metric: 'Processing Time (Seconds)', Value: (summaryData.elapsedMs / 1000).toFixed(2) },
    { Metric: 'Throughput (Rows/Second)', Value: summaryData.rowsPerSecond.toFixed(0) },
    { Metric: 'MATCH Threshold', Value: `${summaryData.thresholds.match}%` },
    { Metric: 'PARTIAL MATCH Threshold', Value: `${summaryData.thresholds.partial_match}%` },
    { Metric: 'Company Weight', Value: summaryData.weights.company_name },
    { Metric: 'Domain Weight', Value: summaryData.weights.domain },
    { Metric: 'Address Weight', Value: summaryData.weights.address },
    { Metric: 'Email Weight', Value: summaryData.weights.email },
    { Metric: 'Phone Weight', Value: summaryData.weights.phone },
    { Metric: 'Pincode Weight', Value: summaryData.weights.pincode },
  ];

  const summaryPath = path.join(outputDir, 'summary.xlsx');
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  const summaryWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(summaryWb, summaryWs, 'Match_Summary');
  XLSX.writeFile(summaryWb, summaryPath);

  // Master Excel file (match_results.xlsx) with Results sheet + Summary sheet
  const masterPath = path.join(outputDir, 'match_results.xlsx');
  const masterWb = XLSX.utils.book_new();
  const resultsWs = XLSX.utils.json_to_sheet(results.slice(0, 1000000));
  XLSX.utils.book_append_sheet(masterWb, resultsWs, 'Matched_Results');
  XLSX.utils.book_append_sheet(masterWb, summaryWs, 'Executive_Summary');
  XLSX.writeFile(masterWb, masterPath);

  // Master CSV file (match_results.csv)
  const csvPath = path.join(outputDir, 'match_results.csv');
  const csvData = XLSX.utils.sheet_to_csv(resultsWs);
  fs.writeFileSync(csvPath, csvData, 'utf-8');

  // 3. Create match_results.zip
  const zipPath = path.join(outputDir, 'match_results.zip');
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive =
      typeof (archiverModule as any).ZipArchive === 'function'
        ? new (archiverModule as any).ZipArchive({ zlib: { level: 9 } })
        : typeof (archiverModule as any).create === 'function'
        ? (archiverModule as any).create('zip', { zlib: { level: 9 } })
        : typeof archiver === 'function'
        ? archiver('zip', { zlib: { level: 9 } })
        : new (archiver as any)('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err: any) => reject(err));

    archive.pipe(output);

    // Add summary.xlsx
    archive.file(summaryPath, { name: 'summary.xlsx' });

    // Add all result chunks
    for (const file of chunkFiles) {
      archive.file(file, { name: path.basename(file) });
    }

    archive.finalize();
  });

  return { zipPath, summaryPath, chunkFiles };
}
