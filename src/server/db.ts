import fs from 'fs';
import path from 'path';

export interface FileRecord {
  id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  row_count: number;
  columns: string[];
  preview_rows: any[];
  storage_path: string;
  created_at: string;
}

export interface MatchingJobRecord {
  id: string;
  name: string;
  file_a_id: string;
  file_b_id: string;
  status: 'PENDING' | 'MAPPING' | 'CONFIGURED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  current_stage: string;
  total_rows: number;
  processed_rows: number;
  matches_count: number;
  partial_matches_count: number;
  not_matches_count: number;
  elapsed_ms: number;
  rows_per_second: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface MatchingConfigRecord {
  id: string;
  job_id: string;
  mapping: {
    company_name?: { a?: string; b?: string };
    domain?: { a?: string; b?: string };
    address?: { a?: string; b?: string };
    email?: { a?: string; b?: string };
    phone?: { a?: string; b?: string };
    pincode?: { a?: string; b?: string };
  };
  weights: {
    company_name: number; // default 30
    domain: number;       // default 25
    address: number;      // default 20
    email: number;        // default 10
    phone: number;        // default 10
    pincode: number;      // default 5
  };
  thresholds: {
    match: number;         // default 90
    partial_match: number; // default 60
  };
  updated_at: string;
}

export interface ResultFileRecord {
  id: string;
  job_id: string;
  filename: string;
  file_type: 'EXCEL_CHUNK' | 'ZIP_ARCHIVE' | 'SUMMARY_EXCEL';
  file_size: number;
  record_count: number;
  download_path: string;
  created_at: string;
}

// In-Memory storage backed with JSON persistence in data/
const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'matchengine_db.json');

class Store {
  files: Map<string, FileRecord> = new Map();
  matching_jobs: Map<string, MatchingJobRecord> = new Map();
  matching_configs: Map<string, MatchingConfigRecord> = new Map();
  result_files: Map<string, ResultFileRecord> = new Map();
  // Results in-memory / cache
  job_results: Map<string, any[]> = new Map();

  constructor() {
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.files) Object.entries(data.files).forEach(([k, v]) => this.files.set(k, v as FileRecord));
        if (data.matching_jobs) Object.entries(data.matching_jobs).forEach(([k, v]) => this.matching_jobs.set(k, v as MatchingJobRecord));
        if (data.matching_configs) Object.entries(data.matching_configs).forEach(([k, v]) => this.matching_configs.set(k, v as MatchingConfigRecord));
        if (data.result_files) Object.entries(data.result_files).forEach(([k, v]) => this.result_files.set(k, v as ResultFileRecord));
      }
    } catch (e) {
      console.error('Error loading DB file:', e);
    }
  }

  save() {
    try {
      const data = {
        files: Object.fromEntries(this.files),
        matching_jobs: Object.fromEntries(this.matching_jobs),
        matching_configs: Object.fromEntries(this.matching_configs),
        result_files: Object.fromEntries(this.result_files),
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Error saving DB file:', e);
    }
  }
}

export const db = new Store();
