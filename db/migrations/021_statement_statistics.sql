-- Expose the statistics already collected by Neon's preloaded module.
-- Local servers need pg_stat_statements in shared_preload_libraries (and a
-- restart) before these views can be queried. No application query depends on it.
-- Production rollout is separate from the importer change and needs approval.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
