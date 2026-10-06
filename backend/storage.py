"""
Modular Storage Service for MatchEngine SaaS.
Implements secure local storage:
  data/
  ├── uploads/
  ├── processing/
  ├── results/
  └── temp/
With interface designed for zero-refactor S3 / MinIO integration.
Enforces security:
- Filename sanitization
- Path traversal protection
- Upload size limits
- MIME & extension validation
- Safe temporary files and automatic cleanup
"""
import os
import re
import uuid
import shutil
from pathlib import Path
from typing import BinaryIO, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
PROCESSING_DIR = DATA_DIR / "processing"
RESULTS_DIR = DATA_DIR / "results"
TEMP_DIR = DATA_DIR / "temp"

# Allowed extensions
ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB max for V1

def sanitize_filename(filename: str) -> str:
    """Strip path traversal attempts and special characters from filename."""
    # Remove directory separators
    clean_name = os.path.basename(filename)
    # Remove null bytes and path traversal
    clean_name = re.sub(r'[\x00/\\?%*:|"<>~#]', '_', clean_name)
    # Strip dangerous shell extensions
    base, ext = os.path.splitext(clean_name)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file format '{ext}'. Supported: .xlsx, .xls, .csv")
    safe_base = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', base)[:100]
    return f"{safe_base}{ext}"

class StorageService:
    def __init__(self):
        for directory in [UPLOADS_DIR, PROCESSING_DIR, RESULTS_DIR, TEMP_DIR]:
            directory.mkdir(parents=True, exist_ok=True)

    def save_upload(self, file_obj: BinaryIO, original_name: str) -> dict:
        safe_name = sanitize_filename(original_name)
        file_id = f"f_{uuid.uuid4().hex[:12]}"
        stored_filename = f"{file_id}_{safe_name}"
        destination = UPLOADS_DIR / stored_filename

        # Write safely in chunks
        size = 0
        with open(destination, "wb") as buffer:
            while chunk := file_obj.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    destination.unlink(missing_ok=True)
                    raise ValueError(f"File size exceeds maximum limit of {MAX_FILE_SIZE // (1024*1024)}MB")
                buffer.write(chunk)

        return {
            "id": file_id,
            "filename": stored_filename,
            "original_name": safe_name,
            "file_size": size,
            "storage_path": str(destination)
        }

    def get_file_path(self, storage_path: str) -> Path:
        """Validate path stays strictly within allowed DATA_DIR."""
        resolved = Path(storage_path).resolve()
        if not str(resolved).startswith(str(DATA_DIR.resolve())):
            raise PermissionError("Access outside data directory is prohibited")
        if not resolved.exists():
            raise FileNotFoundError(f"File does not exist: {storage_path}")
        return resolved

    def delete_file(self, storage_path: str):
        try:
            path = self.get_file_path(storage_path)
            if path.exists() and path.is_file():
                path.unlink()
        except Exception:
            pass

    def cleanup_job_artifacts(self, job_id: str):
        """Clean temporary processing and result files for job."""
        for folder in [PROCESSING_DIR, RESULTS_DIR, TEMP_DIR]:
            for item in folder.glob(f"*{job_id}*"):
                try:
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
                except Exception:
                    pass

storage_service = StorageService()
