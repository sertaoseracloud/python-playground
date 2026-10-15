"""Delta Lake do DivergePython: tabelas com versões sobre o pyspark daqui (python/delta).

A API segue o delta-spark (from delta.tables import DeltaTable); o log de transações fica em
<tabela>/_delta_log, como no Delta real. Os arquivos de dados usam o parquet simplificado do
DivergePython (só este site lê)."""


def configure_spark_with_delta_pip(spark_session_builder, extra_packages=None):
    """No Delta real, baixa os jars; aqui o Delta já vem junto, então só devolve o builder."""
    return spark_session_builder
