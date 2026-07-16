"""
engine.py — Comparison Engine Gateway
===================================
Routes comparison orchestration requests directly to the newly implemented
Enterprise Comparison Engine V2 (ComparisonEngineV2).
"""

from compare_engine.v2.engine import ComparisonEngineV2

class ComparisonEngine:
    @staticmethod
    def compare_documents(path_orig: str, path_rev: str) -> dict:
        """
        Delegates document comparison to ComparisonEngineV2.
        """
        return ComparisonEngineV2.compare_documents(path_orig, path_rev)
