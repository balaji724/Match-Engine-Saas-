# MatchEngine SaaS

High-performance Enterprise Entity Resolution and Fuzzy Matching Platform (V1).

## 🚀 Key Features

- **Direct Open Dashboard**: Zero login, registration, JWT, or auth barriers. Opens immediately to the main dashboard.
- **Large Dataset Architecture (5,000,000+ Records)**:
  - Avoids $O(N \times M)$ nested loop comparisons ($25 \times 10^{12}$ comparisons).
  - Uses inverted index blocking (canonical domain hashes, phone digits, first-token tri-grams, zip prefixes) to generate high-probability candidate sets in $O(N)$.
  - Multi-attribute fuzzy scoring (Jaro-Winkler, Token Sort Ratio, Levenshtein, Domain hierarchy).
  - Weighted composite scoring with customizable thresholds (`MATCH >= 90`, `PARTIAL MATCH >= 60`, `NOT MATCH < 60`).
- **File Ingestion**: Supports `.xlsx`, `.xls`, and `.csv`.
- **Intelligent Column Mapping**: Map Company Name, Website/Domain, Address, Email, Phone, and Pincode between File A and File B.
- **Excel & ZIP Partitioning**:
  - Automatically splits large datasets into `results_001.xlsx`, `results_002.xlsx`...
  - Creates downloadable `match_results.zip` containing all chunked workbooks plus `summary.xlsx`.
- **Non-blocking Background Processing**:
  - Immediate job ID generation with polling via `GET /api/v1/jobs/{job_id}/progress`.
  - Real-time row processing rate, elapsed time, and match categorization.

## 📁 Directory Structure

```
matchengine/
├── frontend/
├── backend/
│   ├── main.py        # FastAPI REST endpoints
│   ├── matcher.py     # Entity resolution & fuzzy matching algorithms
│   ├── storage.py     # Modular file storage (local & S3/MinIO compatible)
│   ├── tasks.py       # Celery background workers
│   ├── models.py      # SQLAlchemy & Pydantic models (files, jobs, configs, results)
│   └── database.py    # PostgreSQL connection
├── data/
│   ├── uploads/       # Secure file uploads
│   ├── processing/    # Temp candidate blocks & Parquet chunks
│   ├── results/       # Exported Excel partitions & ZIP archives
│   └── temp/          # Scratch space
├── tests/
│   └── test_matcher.py# Algorithm unit tests
├── docker/
├── docker-compose.yml # PostgreSQL, Redis, FastAPI, Celery, Web
├── .env.example
└── README.md
```

## 🔌 API Endpoints (V1 - No Auth)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/files/upload` | Upload File A or File B (.xlsx, .xls, .csv) |
| `GET` | `/api/v1/files/{file_id}` | Retrieve file metadata & column preview |
| `DELETE` | `/api/v1/files/{file_id}` | Remove uploaded file |
| `POST` | `/api/v1/jobs` | Create a new matching job |
| `GET` | `/api/v1/jobs` | List recent jobs with counts |
| `GET` | `/api/v1/jobs/{job_id}` | Get job details |
| `POST` | `/api/v1/jobs/{job_id}/mapping` | Save column mapping (File A -> File B) |
| `GET` | `/api/v1/jobs/{job_id}/mapping` | Fetch column mapping |
| `POST` | `/api/v1/jobs/{job_id}/rules` | Configure weights and thresholds |
| `GET` | `/api/v1/jobs/{job_id}/rules` | Fetch rules configuration |
| `POST` | `/api/v1/jobs/{job_id}/start` | Start matching engine in background |
| `POST` | `/api/v1/jobs/{job_id}/cancel` | Cancel active processing job |
| `DELETE`| `/api/v1/jobs/{job_id}` | Delete job and result files |
| `GET` | `/api/v1/jobs/{job_id}/progress` | Real-time progress & statistics |
| `GET` | `/api/v1/jobs/{job_id}/summary` | Execution summary & configuration |
| `GET` | `/api/v1/jobs/{job_id}/results` | Paginated comparison table |
| `GET` | `/api/v1/jobs/{job_id}/download`| Download `match_results.zip` or individual Excel file |
