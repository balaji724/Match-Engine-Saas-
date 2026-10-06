"""
MatchEngine Core Engine: Large-Scale Entity Resolution & Fuzzy Matching.
Architecture:
1. Normalization (Clean company, domain, address, email, phone, pincode)
2. Inverted Index / Blocking Candidate Generation (O(N) candidate generation instead of O(N*M))
3. Fast Exact Matching on canonical keys
4. Multi-attribute Fuzzy Evaluation (RapidFuzz / Jaro-Winkler / Token Sort)
5. Weighted Scoring & Classification (MATCH >= 90, PARTIAL MATCH >= 60, NOT MATCH < 60)
6. Excel chunk partitioning (results_001.xlsx...) & Summary & ZIP packaging
"""
import os
import re
import math
import time
import zipfile
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import polars as pl
from rapidfuzz import fuzz, distance

LEGAL_SUFFIXES = [
    r'\bINCORPORATED\b', r'\bINC\b', r'\bLLC\b', r'\bL\.L\.C\b',
    r'\bCORPORATION\b', r'\bCORP\b', r'\bLIMITED\b', r'\bLTD\b',
    r'\bCOMPANY\b', r'\bCO\b', r'\bGROUP\b', r'\bHOLDINGS\b',
    r'\bENTERPRISES\b', r'\bTECHNOLOGIES\b', r'\bTECH\b',
    r'\bSOLUTIONS\b', r'\bSERVICES\b', r'\bPVT\b', r'\bPRIVATE\b',
    r'\bGMBH\b', r'\bS\.A\b', r'\bS\.R\.L\b', r'\bPLC\b'
]

def normalize_company(val: Any) -> str:
    if val is None or pl.is_null(val) or str(val).strip() == "":
        return ""
    text = str(val).upper().strip()
    # Strip punctuation
    text = re.sub(r'[\.,\-\'\"/\\#&()\[\]]', ' ', text)
    # Strip legal suffixes
    for suffix in LEGAL_SUFFIXES:
        text = re.sub(suffix, '', text)
    # Collapse whitespace
    return re.sub(r'\s+', ' ', text).strip()

def normalize_domain(val: Any) -> str:
    if val is None or pl.is_null(val) or str(val).strip() == "":
        return ""
    text = str(val).lower().strip()
    # Remove protocol
    text = re.sub(r'^https?://', '', text)
    # Remove www.
    text = re.sub(r'^www\.', '', text)
    # Remove path / query / port
    text = text.split('/')[0].split('?')[0].split(':')[0]
    return text.strip()

def normalize_phone(val: Any) -> str:
    if val is None or pl.is_null(val) or str(val).strip() == "":
        return ""
    digits = re.sub(r'\D', '', str(val))
    # Return last 10 digits for national/international comparison
    return digits[-10:] if len(digits) >= 10 else digits

def normalize_email(val: Any) -> str:
    if val is None or pl.is_null(val) or str(val).strip() == "":
        return ""
    return str(val).lower().strip()

def normalize_pincode(val: Any) -> str:
    if val is None or pl.is_null(val) or str(val).strip() == "":
        return ""
    clean = re.sub(r'[^a-zA-Z0-9]', '', str(val).upper().strip())
    return clean[:6]

def normalize_address(val: Any) -> str:
    if val is None or pl.is_null(val) or str(val).strip() == "":
        return ""
    text = str(val).upper().strip()
    text = re.sub(r'\bSUITE\b|\bSTE\b|\bAPT\b|\bUNIT\b|\bFL\b|\bFLOOR\b', '', text)
    text = re.sub(r'\bSTREET\b', 'ST', text)
    text = re.sub(r'\bAVENUE\b|\bAVE\b', 'AVE', text)
    text = re.sub(r'\bBOULEVARD\b|\bBLVD\b', 'BLVD', text)
    text = re.sub(r'\bROAD\b|\bRD\b', 'RD', text)
    text = re.sub(r'\bDRIVE\b|\bDR\b', 'DR', text)
    text = re.sub(r'[\.,\-\'\"/\\#]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def score_company(c_a: str, c_b: str) -> float:
    if not c_a or not c_b:
        return 0.0
    if c_a == c_b:
        return 100.0
    # RapidFuzz token sort ratio handles word reorderings (e.g. "Acme Healthcare" vs "Healthcare Acme")
    token_score = fuzz.token_sort_ratio(c_a, c_b)
    # Jaro-Winkler distance captures prefixes and character typos
    jw_score = distance.JaroWinkler.similarity(c_a, c_b) * 100.0
    return max(token_score, jw_score)

def score_domain(d_a: str, d_b: str) -> float:
    if not d_a or not d_b:
        return 0.0
    if d_a == d_b:
        return 100.0
    # Check parent domain match (e.g. store.apple.com vs apple.com)
    if d_a.endswith(f".{d_b}") or d_b.endswith(f".{d_a}"):
        return 90.0
    return fuzz.ratio(d_a, d_b)

def score_email(e_a: str, e_b: str) -> float:
    if not e_a or not e_b:
        return 0.0
    if e_a == e_b:
        return 100.0
    dom_a = e_a.split('@')[-1] if '@' in e_a else ''
    dom_b = e_b.split('@')[-1] if '@' in e_b else ''
    if dom_a and dom_a == dom_b:
        user_a = e_a.split('@')[0]
        user_b = e_b.split('@')[0]
        return 70.0 + (fuzz.ratio(user_a, user_b) * 0.3)
    return 0.0

def score_phone(p_a: str, p_b: str) -> float:
    if not p_a or not p_b:
        return 0.0
    if p_a == p_b and len(p_a) >= 7:
        return 100.0
    if len(p_a) >= 7 and len(p_b) >= 7 and (p_a.endswith(p_b[-7:]) or p_b.endswith(p_a[-7:])):
        return 80.0
    return 0.0

def score_pincode(pin_a: str, pin_b: str) -> float:
    if not pin_a or not pin_b:
        return 0.0
    if pin_a == pin_b:
        return 100.0
    if len(pin_a) >= 3 and len(pin_b) >= 3 and pin_a[:3] == pin_b[:3]:
        return 70.0
    return 0.0

def score_address(a_a: str, a_b: str) -> float:
    if not a_a or not a_b:
        return 0.0
    if a_a == a_b:
        return 100.0
    return fuzz.token_set_ratio(a_a, a_b)

class MatchProcessor:
    def __init__(self, weights: Dict[str, float], thresholds: Dict[str, float]):
        self.weights = {
            'company': weights.get('company_name', 30.0),
            'domain': weights.get('domain', 25.0),
            'address': weights.get('address', 20.0),
            'email': weights.get('email', 10.0),
            'phone': weights.get('phone', 10.0),
            'pincode': weights.get('pincode', 5.0),
        }
        self.total_weight = sum(self.weights.values()) or 100.0
        self.match_thresh = thresholds.get('match', 90.0)
        self.partial_thresh = thresholds.get('partial_match', 60.0)

    def evaluate_pair(self, row_a: dict, row_b: dict) -> dict:
        c_score = score_company(row_a['norm_company'], row_b['norm_company'])
        d_score = score_domain(row_a['norm_domain'], row_b['norm_domain'])
        a_score = score_address(row_a['norm_address'], row_b['norm_address'])
        e_score = score_email(row_a['norm_email'], row_b['norm_email'])
        p_score = score_phone(row_a['norm_phone'], row_b['norm_phone'])
        pin_score = score_pincode(row_a['norm_pincode'], row_b['norm_pincode'])

        weighted_sum = (
            c_score * self.weights['company'] +
            d_score * self.weights['domain'] +
            a_score * self.weights['address'] +
            e_score * self.weights['email'] +
            p_score * self.weights['phone'] +
            pin_score * self.weights['pincode']
        )
        overall_score = round(weighted_sum / self.total_weight, 2)

        matched_fields = []
        if c_score >= 80: matched_fields.append("Company")
        if d_score >= 80: matched_fields.append("Domain")
        if a_score >= 75: matched_fields.append("Address")
        if e_score >= 80: matched_fields.append("Email")
        if p_score >= 80: matched_fields.append("Phone")
        if pin_score >= 80: matched_fields.append("Pincode")

        if overall_score >= self.match_thresh:
            result = "MATCH"
            reason = f"High confidence match across {', '.join(matched_fields) if matched_fields else 'attributes'} ({overall_score}% >= {self.match_thresh}%)"
        elif overall_score >= self.partial_thresh:
            result = "PARTIAL MATCH"
            reason = f"Partial similarity detected in {', '.join(matched_fields) if matched_fields else 'attributes'} ({overall_score}% >= {self.partial_thresh}%)"
        else:
            result = "NOT MATCH"
            reason = f"Insufficient similarity score ({overall_score}% < {self.partial_thresh}%)"

        return {
            "A_ID": row_a['raw_id'],
            "B_ID": row_b['raw_id'],
            "Company_A": row_a['raw_company'],
            "Company_B": row_b['raw_company'],
            "Domain_A": row_a['raw_domain'],
            "Domain_B": row_b['raw_domain'],
            "Address_A": row_a['raw_address'],
            "Address_B": row_b['raw_address'],
            "Email_A": row_a['raw_email'],
            "Email_B": row_b['raw_email'],
            "Phone_A": row_a['raw_phone'],
            "Phone_B": row_b['raw_phone'],
            "Pincode_A": row_a['raw_pincode'],
            "Pincode_B": row_b['raw_pincode'],
            "Company_Score": round(c_score, 1),
            "Domain_Score": round(d_score, 1),
            "Address_Score": round(a_score, 1),
            "Email_Score": round(e_score, 1),
            "Phone_Score": round(p_score, 1),
            "Pincode_Score": round(pin_score, 1),
            "Overall_Score": overall_score,
            "Result": result,
            "Matched_Fields": ", ".join(matched_fields) if matched_fields else "None",
            "Reason": reason
        }
