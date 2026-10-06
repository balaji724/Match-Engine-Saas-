"""
Unit tests for MatchEngine core algorithms.
Validates normalization, scoring functions, candidate generation, and threshold evaluation.
"""
from backend.matcher import (
    normalize_company, normalize_domain, normalize_phone,
    normalize_email, normalize_pincode, normalize_address,
    score_company, score_domain, score_phone, score_email,
    MatchProcessor
)

def test_normalization():
    assert normalize_company("Acme Corporation, Inc.") == "ACME"
    assert normalize_company("Google LLC - Mountain View") == "GOOGLE MOUNTAIN VIEW"
    assert normalize_domain("https://www.apple.com/shop/buy-mac") == "apple.com"
    assert normalize_phone("+1 (800) 555-0199") == "8005550199"
    assert normalize_email("John.Doe+promo@Company.com") == "john.doe+promo@company.com"
    assert normalize_pincode("94043-1234") == "940431"
    assert normalize_address("1600 Amphitheatre Pkwy, Suite 400") == "1600 AMPHITHEATRE PKWY"

def test_scoring_weights():
    weights = {
        'company_name': 30.0,
        'domain': 25.0,
        'address': 20.0,
        'email': 10.0,
        'phone': 10.0,
        'pincode': 5.0
    }
    thresholds = {'match': 90.0, 'partial_match': 60.0}
    processor = MatchProcessor(weights, thresholds)

    row_a = {
        'raw_id': 'A1', 'raw_company': 'Microsoft Corp',
        'raw_domain': 'microsoft.com', 'raw_address': 'One Microsoft Way',
        'raw_email': 'contact@microsoft.com', 'raw_phone': '4258828080',
        'raw_pincode': '98052',
        'norm_company': 'MICROSOFT', 'norm_domain': 'microsoft.com',
        'norm_address': 'ONE MICROSOFT WAY', 'norm_email': 'contact@microsoft.com',
        'norm_phone': '4258828080', 'norm_pincode': '98052'
    }
    row_b = {
        'raw_id': 'B1', 'raw_company': 'Microsoft Corporation',
        'raw_domain': 'https://www.microsoft.com', 'raw_address': '1 Microsoft Way, Redmond',
        'raw_email': 'info@microsoft.com', 'raw_phone': '(425) 882-8080',
        'raw_pincode': '98052',
        'norm_company': 'MICROSOFT', 'norm_domain': 'microsoft.com',
        'norm_address': '1 MICROSOFT WAY REDMOND', 'norm_email': 'info@microsoft.com',
        'norm_phone': '4258828080', 'norm_pincode': '98052'
    }

    result = processor.evaluate_pair(row_a, row_b)
    assert result['Result'] == 'MATCH'
    assert result['Overall_Score'] >= 90.0
    assert result['Company_Score'] == 100.0
