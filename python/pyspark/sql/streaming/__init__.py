"""Structured Streaming do DivergePython: micro-lotes num relógio virtual."""
from .consulta import DataStreamWriter, StreamingQuery, StreamingQueryManager, StreamingQueryProgress
from .fonte import DataStreamReader

__all__ = ['DataStreamReader', 'DataStreamWriter', 'StreamingQuery', 'StreamingQueryManager', 'StreamingQueryProgress']
