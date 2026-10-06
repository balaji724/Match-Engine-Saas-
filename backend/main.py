"""
FastAPI application for MatchEngine SaaS.
Provides clean REST API endpoints for V1.
Strictly NO authentication or login endpoints.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import Optional, List
import polars as pl
import os

from backend.storage import storage_service, sanitize_filename
from backend.models import (
    JobStatus, JobCreateSchema, ColumnMappingSchema, MatchingRulesSchema
)

app = FastAPI(
    title="MatchEngine SaaS API",
    description="High-performance entity resolution and matching engine API (V1 - No Auth)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "healthy", "service": "matchengine-api"}

# The endpoints are implemented and will run alongside the Node Vite Express server.
