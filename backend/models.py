"""
SQLAlchemy and Pydantic models for MatchEngine.
Strictly V1 compliant: No users table.
Tables:
1. files
2. matching_jobs
3. matching_configs
4. result_files
"""
import enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Enum as SQLEnum, JSON, BigInteger, Text
)
from sqlalchemy.orm import relationship
from backend.database import Base

class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    MAPPING = "MAPPING"
    CONFIGURED = "CONFIGURED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class DBFile(Base):
    __tablename__ = "files"

    id = Column(String(64), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(128), nullable=False)
    row_count = Column(Integer, default=0)
    columns = Column(JSON, default=list)
    storage_path = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBMatchingJob(Base):
    __tablename__ = "matching_jobs"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    file_a_id = Column(String(64), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    file_b_id = Column(String(64), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING, nullable=False, index=True)
    progress = Column(Float, default=0.0)
    current_stage = Column(String(128), default="Initialized")
    total_rows = Column(Integer, default=0)
    processed_rows = Column(Integer, default=0)
    matches_count = Column(Integer, default=0)
    partial_matches_count = Column(Integer, default=0)
    not_matches_count = Column(Integer, default=0)
    elapsed_ms = Column(Integer, default=0)
    rows_per_second = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    config = relationship("DBMatchingConfig", back_populates="job", uselist=False, cascade="all, delete-orphan")
    result_files = relationship("DBResultFile", back_populates="job", cascade="all, delete-orphan")

class DBMatchingConfig(Base):
    __tablename__ = "matching_configs"

    id = Column(String(64), primary_key=True, index=True)
    job_id = Column(String(64), ForeignKey("matching_jobs.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Column mapping File A -> File B
    mapping_company_name_a = Column(String(128), nullable=True)
    mapping_company_name_b = Column(String(128), nullable=True)
    mapping_domain_a = Column(String(128), nullable=True)
    mapping_domain_b = Column(String(128), nullable=True)
    mapping_address_a = Column(String(128), nullable=True)
    mapping_address_b = Column(String(128), nullable=True)
    mapping_email_a = Column(String(128), nullable=True)
    mapping_email_b = Column(String(128), nullable=True)
    mapping_phone_a = Column(String(128), nullable=True)
    mapping_phone_b = Column(String(128), nullable=True)
    mapping_pincode_a = Column(String(128), nullable=True)
    mapping_pincode_b = Column(String(128), nullable=True)

    # Weights (Default sum = 100)
    weight_company = Column(Float, default=30.0)
    weight_domain = Column(Float, default=25.0)
    weight_address = Column(Float, default=20.0)
    weight_email = Column(Float, default=10.0)
    weight_phone = Column(Float, default=10.0)
    weight_pincode = Column(Float, default=5.0)

    # Thresholds
    threshold_match = Column(Float, default=90.0)
    threshold_partial_match = Column(Float, default=60.0)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("DBMatchingJob", back_populates="config")

class DBResultFile(Base):
    __tablename__ = "result_files"

    id = Column(String(64), primary_key=True, index=True)
    job_id = Column(String(64), ForeignKey("matching_jobs.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(64), nullable=False) # 'EXCEL_CHUNK', 'ZIP_ARCHIVE', 'SUMMARY_EXCEL'
    file_size = Column(BigInteger, default=0)
    record_count = Column(Integer, default=0)
    storage_path = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("DBMatchingJob", back_populates="result_files")

# --- Pydantic Schemas ---
class ColumnMappingSchema(BaseModel):
    company_name: Optional[Dict[str, Optional[str]]] = None # {'a': '...', 'b': '...'}
    domain: Optional[Dict[str, Optional[str]]] = None
    address: Optional[Dict[str, Optional[str]]] = None
    email: Optional[Dict[str, Optional[str]]] = None
    phone: Optional[Dict[str, Optional[str]]] = None
    pincode: Optional[Dict[str, Optional[str]]] = None

class MatchingWeightsSchema(BaseModel):
    company_name: float = 30.0
    domain: float = 25.0
    address: float = 20.0
    email: float = 10.0
    phone: float = 10.0
    pincode: float = 5.0

class MatchingThresholdsSchema(BaseModel):
    match: float = 90.0
    partial_match: float = 60.0

class MatchingRulesSchema(BaseModel):
    weights: MatchingWeightsSchema = Field(default_factory=MatchingWeightsSchema)
    thresholds: MatchingThresholdsSchema = Field(default_factory=MatchingThresholdsSchema)

class JobCreateSchema(BaseModel):
    name: Optional[str] = "Entity Matching Job"
    file_a_id: str
    file_b_id: str

class JobProgressSchema(BaseModel):
    job_id: str
    status: JobStatus
    progress: float
    current_stage: str
    total_rows: int
    processed_rows: int
    matches_count: int
    partial_matches_count: int
    not_matches_count: int
    elapsed_ms: int
    rows_per_second: float
    error_message: Optional[str] = None
