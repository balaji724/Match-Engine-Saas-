import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import * as xlsxModule from 'xlsx';
const XLSX = (xlsxModule as any).default || xlsxModule;
import crypto from 'crypto';
import { db, FileRecord, MatchingJobRecord, MatchingConfigRecord } from './src/server/db.ts';
import {
  normalizeCompany,
  normalizeDomain,
  normalizePhone,
  normalizeEmail,
  normalizePincode,
  normalizeAddress,
  evaluateRowPair,
  buildCandidateIndex,
  packageExcelResults,
  MatchedResultRow
} from './src/server/matcher.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PROCESSING_DIR = path.join(DATA_DIR, 'processing');
const RESULTS_DIR = path.join(DATA_DIR, 'results');
const TEMP_DIR = path.join(DATA_DIR, 'temp');

[DATA_DIR, UPLOADS_DIR, PROCESSING_DIR, RESULTS_DIR, TEMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Safe filename sanitizer
function sanitizeFilename(filename: string, mimetype?: string): string {
  const base = path.basename(filename || 'dataset');
  const clean = base.replace(/[\x00/\\?%*:|"<>~#]/g, '_');
  let ext = path.extname(clean).toLowerCase();

  // If no extension or generic extension, try detecting from mimetype or default to .xlsx
  if (!ext || ext === '.bin' || ext === '.tmp') {
    if (mimetype?.includes('csv') || mimetype?.includes('text')) {
      ext = '.csv';
    } else {
      ext = '.xlsx';
    }
  }

  const nameOnly = path.basename(clean, ext).replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 80);
  return `${nameOnly || 'dataset'}${ext}`;
}

// Multer upload configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const fileId = `f_${crypto.randomBytes(6).toString('hex')}`;
    const safeName = sanitizeFilename(file.originalname, file.mimetype);
    cb(null, `${fileId}__${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const validExts = ['.xlsx', '.xls', '.csv', '.tsv', ''];

    if (
      validExts.includes(ext) ||
      mime.includes('spreadsheet') ||
      mime.includes('excel') ||
      mime.includes('csv') ||
      mime.includes('octet-stream') ||
      !ext
    ) {
      cb(null, true);
    } else {
      cb(null, true); // Permissive: let XLSX parser validate contents
    }
  },
});

// Helper to parse file rows & columns with multi-sheet & header fallback
function parseFilePreview(filePath: string): { columns: string[]; rowCount: number; sampleRows: any[] } {
  try {
    const workbook = XLSX.readFile(filePath, { sheetRows: 50000 });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { columns: [], rowCount: 0, sampleRows: [] };
    }

    // Find first non-empty sheet
    let activeSheet = workbook.Sheets[workbook.SheetNames[0]];
    for (const name of workbook.SheetNames) {
      const s = workbook.Sheets[name];
      if (s && s['!ref']) {
        activeSheet = s;
        break;
      }
    }

    // Try standard object json
    let rawRows: any[] = XLSX.utils.sheet_to_json(activeSheet, { defval: '' });

    if (rawRows.length > 0) {
      const columns = Object.keys(rawRows[0]).filter((c) => c && !c.startsWith('__EMPTY'));
      return {
        columns: columns.length > 0 ? columns : Object.keys(rawRows[0]),
        rowCount: rawRows.length,
        sampleRows: rawRows.slice(0, 10),
      };
    }

    // Fallback: array of arrays (e.g. if row 1 has headers but no data or irregular keys)
    const matrix: any[][] = XLSX.utils.sheet_to_json(activeSheet, { header: 1, defval: '' });
    if (matrix.length > 0) {
      const headers = matrix[0]
        .map((h: any, i: number) => String(h || `Col_${i + 1}`).trim())
        .filter(Boolean);

      const sampleRows = matrix.slice(1, 11).map((rowArr) => {
        const obj: any = {};
        headers.forEach((h: string, idx: number) => {
          obj[h] = rowArr[idx] !== undefined ? String(rowArr[idx]) : '';
        });
        return obj;
      });

      return {
        columns: headers,
        rowCount: Math.max(0, matrix.length - 1),
        sampleRows,
      };
    }

    return { columns: [], rowCount: 0, sampleRows: [] };
  } catch (err: any) {
    console.error('Error parsing uploaded file:', err);
    throw new Error(`Failed to parse file: ${err.message || 'Corrupted or unsupported format'}`);
  }
}

// ==========================================
// API ROUTES (/api/v1/...)
// ==========================================

// 1. POST /api/v1/files/upload
app.post('/api/v1/files/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, path: filePath, size, originalname, mimetype } = req.file;
    const fileId = filename.includes('__')
      ? filename.split('__')[0]
      : filename.startsWith('f_')
      ? filename.split('_').slice(0, 2).join('_')
      : `f_${crypto.randomBytes(6).toString('hex')}`;

    const { columns, rowCount, sampleRows } = parseFilePreview(filePath);

    const record: FileRecord = {
      id: fileId,
      filename,
      original_name: sanitizeFilename(originalname),
      file_size: size,
      mime_type: mimetype || 'application/octet-stream',
      row_count: rowCount,
      columns,
      preview_rows: sampleRows,
      storage_path: filePath,
      created_at: new Date().toISOString(),
    };

    db.files.set(fileId, record);
    db.save();

    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// 2. GET /api/v1/files/:file_id
app.get('/api/v1/files/:file_id', (req: Request, res: Response) => {
  const file = db.files.get(req.params.file_id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json(file);
});

// 3. DELETE /api/v1/files/:file_id
app.delete('/api/v1/files/:file_id', (req: Request, res: Response) => {
  const file = db.files.get(req.params.file_id);
  if (!file) return res.status(404).json({ error: 'File not found' });

  try {
    if (fs.existsSync(file.storage_path)) {
      fs.unlinkSync(file.storage_path);
    }
  } catch (e) {
    console.error('Failed to unlink file:', e);
  }

  db.files.delete(req.params.file_id);
  db.save();
  res.json({ success: true, message: 'File deleted' });
});

// 4. POST /api/v1/jobs
app.post('/api/v1/jobs', (req: Request, res: Response) => {
  try {
    const { name, file_a_id, file_b_id } = req.body;
    if (!file_a_id) {
      return res.status(400).json({ error: 'file_a_id is required' });
    }

    const resolvedFileBId = file_b_id || file_a_id;
    const fileA = db.files.get(file_a_id);
    const fileB = db.files.get(resolvedFileBId);

    if (!fileA || !fileB) {
      return res.status(404).json({ error: 'Specified file does not exist' });
    }

    const jobId = `job_${crypto.randomBytes(6).toString('hex')}`;
    const newJob: MatchingJobRecord = {
      id: jobId,
      name: name || `Dataset-${fileA.original_name.replace(/\.[^/.]+$/, '')}-Matching`,
      file_a_id,
      file_b_id: resolvedFileBId,
      status: 'MAPPING',
      progress: 0,
      current_stage: 'Awaiting Column Mapping',
      total_rows: fileA.row_count,
      processed_rows: 0,
      matches_count: 0,
      partial_matches_count: 0,
      not_matches_count: 0,
      elapsed_ms: 0,
      rows_per_second: 0,
      created_at: new Date().toISOString(),
    };

    // Auto-detect columns mapping File A -> File B
    const mapCol = (candidates: string[], cols: string[], preferKeyword?: string) => {
      const lower = cols.map((c) => ({ col: c, l: c.toLowerCase().replace(/[^a-z0-9]/g, '') }));
      if (preferKeyword) {
        const prefFound = lower.find((item) => item.l.includes(preferKeyword));
        if (prefFound) return prefFound.col;
      }
      for (const cand of candidates) {
        const found = lower.find((item) => item.l.includes(cand));
        if (found) return found.col;
      }
      return '';
    };

    const autoMapping = {
      company_name: {
        a: mapCol(['company', 'firm', 'organization', 'name', 'account', 'vendor'], fileA.columns, 'input') || fileA.columns[0] || '',
        b: mapCol(['company', 'firm', 'organization', 'name', 'account', 'vendor'], fileB.columns, 'output') ||
           mapCol(['company', 'firm', 'organization', 'name', 'account', 'vendor'], fileB.columns, 'ref') ||
           (fileB.columns.length > 1 ? fileB.columns[1] : fileB.columns[0]) || '',
      },
      domain: {
        a: mapCol(['domain', 'website', 'url', 'web', 'site'], fileA.columns),
        b: mapCol(['domain', 'website', 'url', 'web', 'site'], fileB.columns),
      },
      address: {
        a: mapCol(['address', 'street', 'location', 'addr', 'city'], fileA.columns),
        b: mapCol(['address', 'street', 'location', 'addr', 'city'], fileB.columns),
      },
      email: {
        a: mapCol(['email', 'mail'], fileA.columns),
        b: mapCol(['email', 'mail'], fileB.columns),
      },
      phone: {
        a: mapCol(['phone', 'tel', 'mobile', 'cell', 'contact'], fileA.columns),
        b: mapCol(['phone', 'tel', 'mobile', 'cell', 'contact'], fileB.columns),
      },
      pincode: {
        a: mapCol(['pincode', 'pin', 'zip', 'postal', 'postcode'], fileA.columns),
        b: mapCol(['pincode', 'pin', 'zip', 'postal', 'postcode'], fileB.columns),
      },
    };

    const config: MatchingConfigRecord = {
      id: `cfg_${crypto.randomBytes(6).toString('hex')}`,
      job_id: jobId,
      mapping: autoMapping,
      weights: {
        company_name: 30,
        domain: 25,
        address: 20,
        email: 10,
        phone: 10,
        pincode: 5,
      },
      thresholds: {
        match: 90,
        partial_match: 60,
      },
      updated_at: new Date().toISOString(),
    };

    db.matching_jobs.set(jobId, newJob);
    db.matching_configs.set(jobId, config);
    db.save();

    res.status(201).json(newJob);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Job creation failed' });
  }
});

// 5. GET /api/v1/jobs
app.get('/api/v1/jobs', (_req: Request, res: Response) => {
  const list = Array.from(db.matching_jobs.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const total = list.length;
  const completed = list.filter((j) => j.status === 'COMPLETED').length;
  const processing = list.filter((j) => j.status === 'PROCESSING').length;
  const failed = list.filter((j) => j.status === 'FAILED').length;

  res.json({
    metrics: {
      total_jobs: total,
      completed_jobs: completed,
      processing_jobs: processing,
      failed_jobs: failed,
    },
    jobs: list,
  });
});

// 6. GET /api/v1/jobs/:job_id
app.get('/api/v1/jobs/:job_id', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const config = db.matching_configs.get(job.id);
  const fileA = db.files.get(job.file_a_id);
  const fileB = db.files.get(job.file_b_id);

  res.json({
    ...job,
    config,
    file_a: fileA,
    file_b: fileB,
  });
});

// 7. POST /api/v1/jobs/:job_id/mapping
app.post('/api/v1/jobs/:job_id/mapping', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const mapping = req.body;
  let config = db.matching_configs.get(job.id);
  if (!config) {
    config = {
      id: `cfg_${crypto.randomBytes(6).toString('hex')}`,
      job_id: job.id,
      mapping,
      weights: { company_name: 30, domain: 25, address: 20, email: 10, phone: 10, pincode: 5 },
      thresholds: { match: 90, partial_match: 60 },
      updated_at: new Date().toISOString(),
    };
  } else {
    config.mapping = mapping;
    config.updated_at = new Date().toISOString();
  }

  job.status = 'CONFIGURED';
  job.current_stage = 'Awaiting Rule Confirmation';
  db.matching_configs.set(job.id, config);
  db.matching_jobs.set(job.id, job);
  db.save();

  res.json({ success: true, mapping: config.mapping });
});

// 8. GET /api/v1/jobs/:job_id/mapping
app.get('/api/v1/jobs/:job_id/mapping', (req: Request, res: Response) => {
  const config = db.matching_configs.get(req.params.job_id);
  if (!config) return res.status(404).json({ error: 'Mapping not found for this job' });
  res.json(config.mapping);
});

// 9. POST /api/v1/jobs/:job_id/rules
app.post('/api/v1/jobs/:job_id/rules', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { weights, thresholds } = req.body;
  let config = db.matching_configs.get(job.id);
  if (!config) {
    return res.status(404).json({ error: 'Config not found for job' });
  }

  if (weights) config.weights = { ...config.weights, ...weights };
  if (thresholds) config.thresholds = { ...config.thresholds, ...thresholds };
  config.updated_at = new Date().toISOString();

  job.status = 'CONFIGURED';
  job.current_stage = 'Rules Configured - Ready to Start';
  db.matching_configs.set(job.id, config);
  db.matching_jobs.set(job.id, job);
  db.save();

  res.json({ success: true, config });
});

// 10. GET /api/v1/jobs/:job_id/rules
app.get('/api/v1/jobs/:job_id/rules', (req: Request, res: Response) => {
  const config = db.matching_configs.get(req.params.job_id);
  if (!config) return res.status(404).json({ error: 'Rules not found for job' });
  res.json({ weights: config.weights, thresholds: config.thresholds });
});

// Active job runners tracker for cancellation
const activeJobTokens = new Map<string, boolean>();

// 11. POST /api/v1/jobs/:job_id/start (Async background job execution)
app.post('/api/v1/jobs/:job_id/start', async (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const config = db.matching_configs.get(job.id);
  const fileA = db.files.get(job.file_a_id);
  const fileB = db.files.get(job.file_b_id);

  if (!config || !fileA || !fileB) {
    return res.status(400).json({ error: 'Job cannot start: missing config or files' });
  }

  // Update status immediately and return
  job.status = 'PROCESSING';
  job.progress = 5;
  job.current_stage = 'Initializing Inverted Indexes & Normalizing Data';
  job.started_at = new Date().toISOString();
  db.matching_jobs.set(job.id, job);
  db.save();

  activeJobTokens.set(job.id, true);

  // Return immediately to frontend
  res.json({ success: true, message: 'Matching job started in background', job_id: job.id });

  // RUN BACKGROUND ENGINE
  setTimeout(async () => {
    const startTime = Date.now();
    try {
      // 1. Read files
      const wbA = XLSX.readFile(fileA.storage_path);
      const rowsA: any[] = XLSX.utils.sheet_to_json(wbA.Sheets[wbA.SheetNames[0]], { defval: '' });

      const wbB = XLSX.readFile(fileB.storage_path);
      const rowsB: any[] = XLSX.utils.sheet_to_json(wbB.Sheets[wbB.SheetNames[0]], { defval: '' });

      job.total_rows = rowsA.length;
      job.progress = 15;
      job.current_stage = 'Normalizing Attributes & Extracting Canonical Keys';
      db.save();

      // Mapping extractors
      const mapA = config.mapping;
      const getVal = (row: any, key?: string) => (key && row[key] !== undefined ? String(row[key]) : '');

      // Normalize records B
      const normB = rowsB.map((r, idx) => {
        const c = getVal(r, mapA.company_name?.b);
        const d = getVal(r, mapA.domain?.b);
        const a = getVal(r, mapA.address?.b);
        const e = getVal(r, mapA.email?.b);
        const p = getVal(r, mapA.phone?.b);
        const pin = getVal(r, mapA.pincode?.b);
        return {
          raw_id: `B_${idx + 1}`,
          raw_company: c,
          raw_domain: d,
          raw_address: a,
          raw_email: e,
          raw_phone: p,
          raw_pincode: pin,
          norm_company: normalizeCompany(c),
          norm_domain: normalizeDomain(d),
          norm_address: normalizeAddress(a),
          norm_email: normalizeEmail(e),
          norm_phone: normalizePhone(p),
          norm_pincode: normalizePincode(pin),
        };
      });

      // Normalize records A
      const normA = rowsA.map((r, idx) => {
        const c = getVal(r, mapA.company_name?.a);
        const d = getVal(r, mapA.domain?.a);
        const a = getVal(r, mapA.address?.a);
        const e = getVal(r, mapA.email?.a);
        const p = getVal(r, mapA.phone?.a);
        const pin = getVal(r, mapA.pincode?.a);
        return {
          raw_id: `A_${idx + 1}`,
          raw_company: c,
          raw_domain: d,
          raw_address: a,
          raw_email: e,
          raw_phone: p,
          raw_pincode: pin,
          norm_company: normalizeCompany(c),
          norm_domain: normalizeDomain(d),
          norm_address: normalizeAddress(a),
          norm_email: normalizeEmail(e),
          norm_phone: normalizePhone(p),
          norm_pincode: normalizePincode(pin),
        };
      });

      job.progress = 30;
      job.current_stage = 'Building Inverted Index & Generating Candidate Blocks';
      db.save();

      // Build inverted index blocking on B (Domain, Phone, Email, Company words, Pincode)
      const bIndex = buildCandidateIndex(normB);

      job.progress = 40;
      job.current_stage = 'Evaluating Candidates with Multi-attribute Fuzzy Scoring';
      db.save();

      const isSelfMatch = fileA.id === fileB.id;
      const results: MatchedResultRow[] = [];
      let matchCount = 0;
      let partialCount = 0;
      let notMatchCount = 0;

      for (let i = 0; i < normA.length; i++) {
        // Check cancellation
        if (!activeJobTokens.get(job.id)) {
          job.status = 'CANCELLED';
          job.current_stage = 'Job cancelled by user';
          db.save();
          return;
        }

        const a = normA[i];
        // Find candidates from B via inverted index
        const candidateIndices = new Set<number>();
        if (a.norm_domain) {
          (bIndex.get(`dom:${a.norm_domain}`) || []).forEach((idx) => candidateIndices.add(idx));
        }
        if (a.norm_phone && a.norm_phone.length >= 7) {
          (bIndex.get(`ph:${a.norm_phone}`) || []).forEach((idx) => candidateIndices.add(idx));
        }
        if (a.norm_email) {
          (bIndex.get(`em:${a.norm_email}`) || []).forEach((idx) => candidateIndices.add(idx));
        }
        if (a.norm_company) {
          const words = a.norm_company.split(' ');
          if (words[0] && words[0].length >= 3) {
            (bIndex.get(`cw:${words[0]}`) || []).forEach((idx) => candidateIndices.add(idx));
          }
          if (words.length > 1 && words[1].length >= 3) {
            (bIndex.get(`cw:${words[1]}`) || []).forEach((idx) => candidateIndices.add(idx));
          }
        }
        if (a.norm_pincode) {
          (bIndex.get(`pin:${a.norm_pincode}`) || []).forEach((idx) => candidateIndices.add(idx));
        }

        const isSameColumn = isSelfMatch && (mapA.company_name?.a === mapA.company_name?.b);
        if (isSameColumn) {
          candidateIndices.delete(i);
        } else {
          // If comparing two columns in same sheet or across files, row i of B is the direct counterpart
          if (i < normB.length) {
            candidateIndices.add(i);
          }
        }

        let bestPair: MatchedResultRow | null = null;
        let bestScore = -1;

        const candidatesToScore = isSameColumn
          ? Array.from(candidateIndices)
          : candidateIndices.size > 0
          ? Array.from(candidateIndices)
          : Array.from({ length: Math.min(normB.length, 30) }, (_, k) => k);

        for (const bIdx of candidatesToScore) {
          if (isSameColumn && bIdx === i) continue;
          const b = normB[bIdx];
          const evaluated = evaluateRowPair(a, b, config.weights, config.thresholds);
          if (evaluated.Overall_Score > bestScore) {
            bestScore = evaluated.Overall_Score;
            bestPair = evaluated;
            if (bestScore >= 95) break; // Early exit on near-perfect match
          }
        }

        if (!bestPair) {
          if (isSelfMatch) {
            bestPair = {
              A_ID: String(a.raw_id || `A_${i + 1}`),
              B_ID: 'UNIQUE',
              Company_A: String(a.raw_company || ''),
              Company_B: '—',
              Domain_A: String(a.raw_domain || ''),
              Domain_B: '—',
              Address_A: String(a.raw_address || ''),
              Address_B: '—',
              Email_A: String(a.raw_email || ''),
              Email_B: '—',
              Phone_A: String(a.raw_phone || ''),
              Phone_B: '—',
              Pincode_A: String(a.raw_pincode || ''),
              Pincode_B: '—',
              Company_Score: 0,
              Domain_Score: 0,
              Address_Score: 0,
              Email_Score: 0,
              Phone_Score: 0,
              Pincode_Score: 0,
              Overall_Score: 0,
              Result: 'NOT MATCH',
              Matched_Fields: 'None',
              Reason: 'Unique record in Dataset A (no duplicate detected)',
            };
          } else {
            const dummyB = normB[0] || { raw_id: 'NONE', raw_company: '', raw_domain: '', raw_address: '', raw_email: '', raw_phone: '', raw_pincode: '' };
            bestPair = evaluateRowPair(a, dummyB, config.weights, config.thresholds);
          }
        }

        results.push(bestPair);
        if (bestPair.Result === 'MATCH') matchCount++;
        else if (bestPair.Result === 'PARTIAL MATCH') partialCount++;
        else notMatchCount++;

        // Update progress periodically
        if (i % 25 === 0 || i === normA.length - 1) {
          const processed = i + 1;
          const elapsed = Math.max(1, Date.now() - startTime);
          job.processed_rows = processed;
          job.matches_count = matchCount;
          job.partial_matches_count = partialCount;
          job.not_matches_count = notMatchCount;
          job.elapsed_ms = elapsed;
          job.rows_per_second = Math.round((processed / (elapsed / 1000)) * 10) / 10;
          job.progress = Math.min(85, Math.round(40 + (processed / normA.length) * 45));
          db.save();
        }
      }

      job.progress = 88;
      job.current_stage = 'Partitioning Results into Excel Workbooks & Creating ZIP Archive';
      db.save();

      // Package Excel results (results_001.xlsx, summary.xlsx, match_results.zip)
      const jobResultsDir = path.join(RESULTS_DIR, job.id);
      const elapsedTotal = Date.now() - startTime;
      const rowsPerSec = Math.round((normA.length / (elapsedTotal / 1000 || 1)) * 10) / 10;

      const { zipPath, summaryPath, chunkFiles } = await packageExcelResults(
        job.id,
        results,
        {
          totalRecords: normA.length,
          matchCount,
          partialMatchCount: partialCount,
          notMatchCount,
          elapsedMs: elapsedTotal,
          rowsPerSecond: rowsPerSec,
          weights: config.weights,
          thresholds: config.thresholds,
          fileAName: fileA.original_name,
          fileBName: fileB.original_name,
        },
        jobResultsDir
      );

      // Register result files in DB
      chunkFiles.forEach((cf, idx) => {
        const stat = fs.statSync(cf);
        const rfId = `res_${job.id}_${idx + 1}`;
        db.result_files.set(rfId, {
          id: rfId,
          job_id: job.id,
          filename: path.basename(cf),
          file_type: 'EXCEL_CHUNK',
          file_size: stat.size,
          record_count: Math.min(50000, results.length),
          download_path: cf,
          created_at: new Date().toISOString(),
        });
      });

      // Register ZIP
      const zipStat = fs.statSync(zipPath);
      const zipId = `zip_${job.id}`;
      db.result_files.set(zipId, {
        id: zipId,
        job_id: job.id,
        filename: 'match_results.zip',
        file_type: 'ZIP_ARCHIVE',
        file_size: zipStat.size,
        record_count: results.length,
        download_path: zipPath,
        created_at: new Date().toISOString(),
      });

      // Register Summary Excel
      const sumStat = fs.statSync(summaryPath);
      const sumId = `sum_${job.id}`;
      db.result_files.set(sumId, {
        id: sumId,
        job_id: job.id,
        filename: 'summary.xlsx',
        file_type: 'SUMMARY_EXCEL',
        file_size: sumStat.size,
        record_count: 1,
        download_path: summaryPath,
        created_at: new Date().toISOString(),
      });

      // Cache results for UI
      db.job_results.set(job.id, results);

      job.status = 'COMPLETED';
      job.progress = 100;
      job.current_stage = 'Matching Finished & Excel Packages Ready';
      job.completed_at = new Date().toISOString();
      job.elapsed_ms = elapsedTotal;
      job.rows_per_second = rowsPerSec;
      job.matches_count = matchCount;
      job.partial_matches_count = partialCount;
      job.not_matches_count = notMatchCount;
      db.save();
    } catch (err: any) {
      console.error('Job execution error:', err);
      job.status = 'FAILED';
      job.error_message = err.message || 'Processing failed';
      job.current_stage = 'Execution error';
      db.save();
    } finally {
      activeJobTokens.delete(job.id);
    }
  }, 50);
});

// 12. POST /api/v1/jobs/:job_id/cancel
app.post('/api/v1/jobs/:job_id/cancel', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  activeJobTokens.set(job.id, false);
  job.status = 'CANCELLED';
  job.current_stage = 'Job cancelled by user';
  db.save();

  res.json({ success: true, message: 'Job cancellation requested' });
});

// 13. DELETE /api/v1/jobs/:job_id
app.delete('/api/v1/jobs/:job_id', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Clean directory
  const jobResultsDir = path.join(RESULTS_DIR, job.id);
  if (fs.existsSync(jobResultsDir)) {
    fs.rmSync(jobResultsDir, { recursive: true, force: true });
  }

  // Delete result_files records
  Array.from(db.result_files.keys()).forEach((k) => {
    if (k.includes(job.id)) db.result_files.delete(k);
  });

  db.matching_configs.delete(job.id);
  db.job_results.delete(job.id);
  db.matching_jobs.delete(job.id);
  db.save();

  res.json({ success: true, message: 'Job and artifacts removed' });
});

// 14. GET /api/v1/jobs/:job_id/progress
app.get('/api/v1/jobs/:job_id/progress', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    current_stage: job.current_stage,
    total_rows: job.total_rows,
    processed_rows: job.processed_rows,
    matches_count: job.matches_count,
    partial_matches_count: job.partial_matches_count,
    not_matches_count: job.not_matches_count,
    elapsed_ms: job.elapsed_ms,
    rows_per_second: job.rows_per_second,
    error_message: job.error_message,
  });
});

// 15. GET /api/v1/jobs/:job_id/summary
app.get('/api/v1/jobs/:job_id/summary', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const config = db.matching_configs.get(job.id);
  const fileA = db.files.get(job.file_a_id);
  const fileB = db.files.get(job.file_b_id);

  res.json({
    job,
    config,
    file_a: fileA,
    file_b: fileB,
    metrics: {
      total_records: job.total_rows,
      match: job.matches_count,
      match_pct: Math.round((job.matches_count / (job.total_rows || 1)) * 1000) / 10,
      partial_match: job.partial_matches_count,
      partial_match_pct: Math.round((job.partial_matches_count / (job.total_rows || 1)) * 1000) / 10,
      not_match: job.not_matches_count,
      not_match_pct: Math.round((job.not_matches_count / (job.total_rows || 1)) * 1000) / 10,
      processing_time_sec: Math.round((job.elapsed_ms / 1000) * 100) / 100,
      rows_per_second: job.rows_per_second,
    },
  });
});

// 16. GET /api/v1/jobs/:job_id/results (Supports filtering & pagination)
app.get('/api/v1/jobs/:job_id/results', (req: Request, res: Response) => {
  const job = db.matching_jobs.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  let results = db.job_results.get(job.id);

  // If not in cache, load from results_001.xlsx
  if (!results) {
    const chunk1 = path.join(RESULTS_DIR, job.id, 'results_001.xlsx');
    if (fs.existsSync(chunk1)) {
      const wb = XLSX.readFile(chunk1);
      results = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      db.job_results.set(job.id, results || []);
    } else {
      results = [];
    }
  }

  const { filter, search, min_score, page = '1', limit = '50' } = req.query;

  let filtered = results || [];

  if (filter && filter !== 'ALL') {
    filtered = filtered.filter((r) => r.Result === filter);
  }

  if (min_score) {
    const minS = parseFloat(String(min_score));
    if (!isNaN(minS)) {
      filtered = filtered.filter((r) => r.Overall_Score >= minS);
    }
  }

  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter(
      (r) =>
        String(r.Company_A || '').toLowerCase().includes(q) ||
        String(r.Company_B || '').toLowerCase().includes(q) ||
        String(r.Domain_A || '').toLowerCase().includes(q) ||
        String(r.Domain_B || '').toLowerCase().includes(q) ||
        String(r.Email_A || '').toLowerCase().includes(q) ||
        String(r.Email_B || '').toLowerCase().includes(q)
    );
  }

  const p = Math.max(1, parseInt(String(page)) || 1);
  const l = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));
  const offset = (p - 1) * l;
  const paginated = filtered.slice(offset, offset + l);

  res.json({
    total: filtered.length,
    page: p,
    limit: l,
    total_pages: Math.ceil(filtered.length / l),
    items: paginated,
  });
});

// 17. GET /api/v1/jobs/:job_id/download and download.xlsx
const handleDownloadRoute = (req: Request, res: Response) => {
  const { job_id } = req.params;
  const { type = 'excel', chunk = '1' } = req.query;

  const jobResultsDir = path.join(RESULTS_DIR, job_id);

  let targetPath = '';
  let downloadName = '';
  let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (type === 'excel' || type === 'xlsx') {
    targetPath = path.join(jobResultsDir, 'match_results.xlsx');
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(jobResultsDir, 'results_001.xlsx');
    }
    downloadName = `match_results_${job_id}.xlsx`;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (type === 'csv') {
    targetPath = path.join(jobResultsDir, 'match_results.csv');
    downloadName = `match_results_${job_id}.csv`;
    contentType = 'text/csv; charset=utf-8';
  } else if (type === 'summary') {
    targetPath = path.join(jobResultsDir, 'summary.xlsx');
    downloadName = `summary_${job_id}.xlsx`;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (type === 'chunk') {
    const cNum = String(chunk).padStart(3, '0');
    targetPath = path.join(jobResultsDir, `results_${cNum}.xlsx`);
    downloadName = `results_${cNum}_${job_id}.xlsx`;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (type === 'zip') {
    targetPath = path.join(jobResultsDir, 'match_results.zip');
    downloadName = `match_results_${job_id}.zip`;
    contentType = 'application/zip';
  } else {
    targetPath = path.join(jobResultsDir, 'match_results.xlsx');
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(jobResultsDir, 'results_001.xlsx');
    }
    downloadName = `match_results_${job_id}.xlsx`;
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  // If file does not exist on disk, regenerate on the fly from memory results
  if (!fs.existsSync(targetPath)) {
    const results = db.job_results.get(job_id);
    if (results && results.length > 0) {
      if (!fs.existsSync(jobResultsDir)) fs.mkdirSync(jobResultsDir, { recursive: true });
      const ws = XLSX.utils.json_to_sheet(results);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Matched_Results');
      if (type === 'csv') {
        fs.writeFileSync(targetPath, XLSX.utils.sheet_to_csv(ws), 'utf-8');
      } else {
        XLSX.writeFile(wb, targetPath);
      }
    }
  }

  // Protection against path traversal
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(DATA_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Requested export artifact does not exist or job is still running' });
  }

  const fileStat = fs.statSync(resolved);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.setHeader('Content-Length', fileStat.size);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(resolved);
};

app.get('/api/v1/jobs/:job_id/download', handleDownloadRoute);
app.get('/api/v1/jobs/:job_id/download.xlsx', handleDownloadRoute);
app.get('/api/v1/jobs/:job_id/match_results.xlsx', handleDownloadRoute);

// 18. POST /api/v1/demo/seed (Instant test datasets loader!)
app.post('/api/v1/demo/seed', (_req: Request, res: Response) => {
  try {
    const datasetA = [
      { id: 'CRM_101', company_name: 'Salesforce Inc', domain: 'salesforce.com', address: '415 Mission St, San Francisco, CA', email: 'sales@salesforce.com', phone: '18006676389', pincode: '94105' },
      { id: 'CRM_102', company_name: 'Microsoft Corporation', domain: 'https://microsoft.com', address: 'One Microsoft Way, Redmond, WA', email: 'bizdev@microsoft.com', phone: '4258828080', pincode: '98052' },
      { id: 'CRM_103', company_name: 'Apple Computrs Inc', domain: 'apple.com', address: '1 Apple Park Way, Cupertino', email: 'enterprise@apple.com', phone: '4089961010', pincode: '95014' },
      { id: 'CRM_104', company_name: 'Amazon Web Services, LLC', domain: 'aws.amazon.com', address: '410 Terry Ave N, Seattle, WA', email: 'support@aws.amazon.com', phone: '2062661000', pincode: '98109' },
      { id: 'CRM_105', company_name: 'Oracle Systems Corp', domain: 'oracle.com', address: '2300 Oracle Way, Austin, TX', email: 'info@oracle.com', phone: '7378561000', pincode: '78741' },
      { id: 'CRM_106', company_name: 'Alphabet Google LLC', domain: 'google.com', address: '1600 Amphitheatre Pkwy, Mountain View, CA', email: 'cloud@google.com', phone: '6502530000', pincode: '94043' },
      { id: 'CRM_107', company_name: 'Stripe Payments UK', domain: 'stripe.com', address: '354 Oyster Point Blvd, South San Francisco', email: 'merchants@stripe.com', phone: '8889638955', pincode: '94080' },
      { id: 'CRM_108', company_name: 'Snowflake Data Inc', domain: 'snowflake.com', address: '106 East Babcock St, Bozeman, MT', email: 'contact@snowflake.com', phone: '8447669355', pincode: '59715' },
      { id: 'CRM_109', company_name: 'Databricks Analytics', domain: 'databricks.com', address: '160 Spear St 13th Fl, San Francisco, CA', email: 'leads@databricks.com', phone: '8773282274', pincode: '94105' },
      { id: 'CRM_110', company_name: 'HubSpot Marketing Inc', domain: 'hubspot.com', address: '25 First St, Cambridge, MA', email: 'sales@hubspot.com', phone: '8884827768', pincode: '02141' },
      { id: 'CRM_111', company_name: 'Twilio Cloud Telecom', domain: 'twilio.com', address: '101 Spear St, San Francisco, CA', email: 'api@twilio.com', phone: '8448144627', pincode: '94105' },
      { id: 'CRM_112', company_name: 'Workday HR Solutions', domain: 'workday.com', address: '6110 Stoneridge Mall Rd, Pleasanton, CA', email: 'info@workday.com', phone: '8779675329', pincode: '94588' },
      { id: 'CRM_113', company_name: 'Atlassian Software Pty', domain: 'atlassian.com', address: '341 George St, Sydney', email: 'sales@atlassian.com', phone: '4157011110', pincode: '2000' },
      { id: 'CRM_114', company_name: 'DocuSign Signatures Inc', domain: 'docusign.com', address: '221 Main St Suite 1550, San Francisco', email: 'agreements@docusign.com', phone: '8777202040', pincode: '94105' },
      { id: 'CRM_115', company_name: 'Splunk Observability Co', domain: 'splunk.com', address: '270 Brannan St, San Francisco, CA', email: 'logs@splunk.com', phone: '8664387758', pincode: '94107' },
      { id: 'CRM_116', company_name: 'Cloudflare Edge Tech', domain: 'cloudflare.com', address: '101 Townsend St, San Francisco, CA', email: 'cdn@cloudflare.com', phone: '8889935273', pincode: '94107' },
      { id: 'CRM_117', company_name: 'ServiceNow ITSM Inc', domain: 'servicenow.com', address: '2225 Lawson Ln, Santa Clara, CA', email: 'enterprise@servicenow.com', phone: '4085018800', pincode: '95054' },
      { id: 'CRM_118', company_name: 'Zoom Video Comm', domain: 'zoom.us', address: '55 Almaden Blvd, San Jose, CA', email: 'meetings@zoom.us', phone: '8887999666', pincode: '95113' },
      { id: 'CRM_119', company_name: 'Zendesk Support Desk', domain: 'zendesk.com', address: '989 Market St, San Francisco, CA', email: 'support@zendesk.com', phone: '8886704887', pincode: '94103' },
      { id: 'CRM_120', company_name: 'MongoDB NoSQL Corp', domain: 'mongodb.com', address: '1633 Broadway 38th Fl, New York, NY', email: 'database@mongodb.com', phone: '6467274092', pincode: '10019' },
      { id: 'CRM_121', company_name: 'Unmatched Local Hardware Store', domain: 'localhardware-denver.com', address: '782 Pine St, Denver, CO', email: 'jim@localhardware-denver.com', phone: '3035550188', pincode: '80202' }
    ];

    const datasetB = [
      { vendor_code: 'ERP_901', vendor_name: 'Salesforce.com, LLC', official_url: 'https://www.salesforce.com', corporate_street: '415 Mission Street Fl 3', contact_email: 'billing@salesforce.com', tel_number: '+1 (800) 667-6389', zip_code: '94105' },
      { vendor_code: 'ERP_902', vendor_name: 'Microsoft Corp.', official_url: 'www.microsoft.com', corporate_street: '1 Microsoft Way, Building 92', contact_email: 'invoicing@microsoft.com', tel_number: '425-882-8080', zip_code: '98052' },
      { vendor_code: 'ERP_903', vendor_name: 'Apple Inc.', official_url: 'https://apple.com', corporate_street: 'One Apple Park Way', contact_email: 'accounts@apple.com', tel_number: '(408) 996-1010', zip_code: '95014' },
      { vendor_code: 'ERP_904', vendor_name: 'Amazon Web Services Inc', official_url: 'aws.amazon.com', corporate_street: '410 Terry Avenue North', contact_email: 'aws-receivables@amazon.com', tel_number: '206-266-1000', zip_code: '98109' },
      { vendor_code: 'ERP_905', vendor_name: 'Oracle America Inc', official_url: 'http://www.oracle.com', corporate_street: '2300 Oracle Way', contact_email: 'ar@oracle.com', tel_number: '737-856-1000', zip_code: '78741' },
      { vendor_code: 'ERP_906', vendor_name: 'Google LLC', official_url: 'https://google.com', corporate_street: '1600 Amphitheatre Parkway', contact_email: 'collections@google.com', tel_number: '+1-650-253-0000', zip_code: '94043' },
      { vendor_code: 'ERP_907', vendor_name: 'Stripe Inc.', official_url: 'stripe.com', corporate_street: '354 Oyster Point Boulevard', contact_email: 'stripe-billing@stripe.com', tel_number: '888-963-8955', zip_code: '94080' },
      { vendor_code: 'ERP_908', vendor_name: 'Snowflake Inc', official_url: 'snowflake.com', corporate_street: 'Suite 200, 106 E Babcock St', contact_email: 'finance@snowflake.com', tel_number: '844-766-9355', zip_code: '59715' },
      { vendor_code: 'ERP_909', vendor_name: 'Databricks, Inc.', official_url: 'databricks.com', corporate_street: '160 Spear St, 13th Floor', contact_email: 'accounting@databricks.com', tel_number: '877-328-2274', zip_code: '94105' },
      { vendor_code: 'ERP_910', vendor_name: 'HubSpot, Inc.', official_url: 'hubspot.com', corporate_street: '25 First Street, 2nd Floor', contact_email: 'billing@hubspot.com', tel_number: '888-482-7768', zip_code: '02141' },
      { vendor_code: 'ERP_911', vendor_name: 'Twilio Inc.', official_url: 'www.twilio.com', corporate_street: '101 Spear St, 1st Fl', contact_email: 'payables@twilio.com', tel_number: '844-814-4627', zip_code: '94105' },
      { vendor_code: 'ERP_912', vendor_name: 'Workday, Inc.', official_url: 'https://www.workday.com', corporate_street: '6110 Stoneridge Mall Road', contact_email: 'remit@workday.com', tel_number: '877-967-5329', zip_code: '94588' },
      { vendor_code: 'ERP_913', vendor_name: 'Atlassian US Inc', official_url: 'atlassian.com', corporate_street: '341 George Street', contact_email: 'payments@atlassian.com', tel_number: '415-701-1110', zip_code: '2000' },
      { vendor_code: 'ERP_914', vendor_name: 'DocuSign, Inc.', official_url: 'docusign.com', corporate_street: '221 Main Street, Ste 1550', contact_email: 'finance@docusign.com', tel_number: '877-720-2040', zip_code: '94105' },
      { vendor_code: 'ERP_915', vendor_name: 'Splunk Inc.', official_url: 'splunk.com', corporate_street: '270 Brannan Street', contact_email: 'ar@splunk.com', tel_number: '866-438-7758', zip_code: '94107' },
      { vendor_code: 'ERP_916', vendor_name: 'Cloudflare, Inc.', official_url: 'cloudflare.com', corporate_street: '101 Townsend St', contact_email: 'billing@cloudflare.com', tel_number: '888-993-5273', zip_code: '94107' },
      { vendor_code: 'ERP_917', vendor_name: 'ServiceNow, Inc.', official_url: 'servicenow.com', corporate_street: '2225 Lawson Lane', contact_email: 'accounts@servicenow.com', tel_number: '408-501-8800', zip_code: '95054' },
      { vendor_code: 'ERP_918', vendor_name: 'Zoom Video Communications Inc', official_url: 'https://zoom.us', corporate_street: '55 Almaden Boulevard, 6th Fl', contact_email: 'remittance@zoom.us', tel_number: '888-799-9666', zip_code: '95113' },
      { vendor_code: 'ERP_919', vendor_name: 'Zendesk, Inc.', official_url: 'zendesk.com', corporate_street: '989 Market Street', contact_email: 'payables@zendesk.com', tel_number: '888-670-4887', zip_code: '94103' },
      { vendor_code: 'ERP_920', vendor_name: 'MongoDB Inc', official_url: 'https://www.mongodb.com', corporate_street: '1633 Broadway, 38th Floor', contact_email: 'invoicing@mongodb.com', tel_number: '646-727-4092', zip_code: '10019' },
      { vendor_code: 'ERP_921', vendor_name: 'Acme Vintage Antiques LLC', official_url: 'acme-antiques-boston.com', corporate_street: '44 Newbury St', contact_email: 'sarah@acme-antiques-boston.com', tel_number: '617-555-0144', zip_code: '02116' }
    ];

    // Write File A
    const fileAId = `f_demo_a_${crypto.randomBytes(4).toString('hex')}`;
    const fileAPath = path.join(UPLOADS_DIR, `${fileAId}_crm_accounts_export.xlsx`);
    const wbA = XLSX.utils.book_new();
    const wsA = XLSX.utils.json_to_sheet(datasetA);
    XLSX.utils.book_append_sheet(wbA, wsA, 'CRM_Accounts');
    XLSX.writeFile(wbA, fileAPath);

    const fileAStat = fs.statSync(fileAPath);
    const fileARecord: FileRecord = {
      id: fileAId,
      filename: path.basename(fileAPath),
      original_name: 'crm_accounts_export.xlsx',
      file_size: fileAStat.size,
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      row_count: datasetA.length,
      columns: Object.keys(datasetA[0]),
      preview_rows: datasetA.slice(0, 5),
      storage_path: fileAPath,
      created_at: new Date().toISOString(),
    };
    db.files.set(fileAId, fileARecord);

    // Write File B
    const fileBId = `f_demo_b_${crypto.randomBytes(4).toString('hex')}`;
    const fileBPath = path.join(UPLOADS_DIR, `${fileBId}_erp_master_vendors.xlsx`);
    const wbB = XLSX.utils.book_new();
    const wsB = XLSX.utils.json_to_sheet(datasetB);
    XLSX.utils.book_append_sheet(wbB, wsB, 'ERP_Vendors');
    XLSX.writeFile(wbB, fileBPath);

    const fileBStat = fs.statSync(fileBPath);
    const fileBRecord: FileRecord = {
      id: fileBId,
      filename: path.basename(fileBPath),
      original_name: 'erp_master_vendors.xlsx',
      file_size: fileBStat.size,
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      row_count: datasetB.length,
      columns: Object.keys(datasetB[0]),
      preview_rows: datasetB.slice(0, 5),
      storage_path: fileBPath,
      created_at: new Date().toISOString(),
    };
    db.files.set(fileBId, fileBRecord);
    db.save();

    res.json({
      success: true,
      message: 'Demo datasets created successfully',
      file_a: fileARecord,
      file_b: fileBRecord,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to generate demo datasets' });
  }
});

// Guard: API routes must never return HTML
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// Vite Middleware for SPA Frontend
async function startServer() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MatchEngine SaaS running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
