export interface UploadedFile {
  id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  row_count: number;
  columns: string[];
  preview_rows: any[];
  created_at: string;
}

export type JobStatus =
  | 'PENDING'
  | 'MAPPING'
  | 'CONFIGURED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface MatchingJob {
  id: string;
  name: string;
  file_a_id: string;
  file_b_id: string;
  status: JobStatus;
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
  config?: MatchingConfig;
  file_a?: UploadedFile;
  file_b?: UploadedFile;
}

export interface ColumnMappingField {
  a?: string;
  b?: string;
}

export interface ColumnMapping {
  company_name?: ColumnMappingField;
  domain?: ColumnMappingField;
  address?: ColumnMappingField;
  email?: ColumnMappingField;
  phone?: ColumnMappingField;
  pincode?: ColumnMappingField;
}

export interface MatchingWeights {
  company_name: number;
  domain: number;
  address: number;
  email: number;
  phone: number;
  pincode: number;
}

export interface MatchingThresholds {
  match: number;
  partial_match: number;
}

export interface MatchingConfig {
  id: string;
  job_id: string;
  mapping: ColumnMapping;
  weights: MatchingWeights;
  thresholds: MatchingThresholds;
  updated_at: string;
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

export interface JobProgressResponse {
  job_id: string;
  status: JobStatus;
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
}
