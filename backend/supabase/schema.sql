-- Wilhelm's default Supabase vector store.
-- Uses OpenAI text-embedding-3-small (1536 dimensions).

create extension if not exists vector with schema extensions;

create table if not exists public.documents (
  id text primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists documents_embedding_cosine_idx
  on public.documents using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists documents_metadata_gin_idx
  on public.documents using gin (metadata);

alter table public.documents enable row level security;
revoke all on public.documents from anon, authenticated;
grant select, insert, update, delete on public.documents to service_role;

drop function if exists public.match_documents(extensions.vector, int, text);

create or replace function public.match_documents(
  query_embedding extensions.vector(1536),
  match_count int default 5,
  filter_domain text default null,
  filter_application_number text default null
)
returns table (
  id text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where (filter_domain is null
     or d.metadata ->> 'domain' = filter_domain)
    and (filter_application_number is null
      or d.metadata ->> 'application_number' = filter_application_number)
  order by d.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;

revoke all on function public.match_documents(extensions.vector, int, text, text) from public, anon, authenticated;
grant execute on function public.match_documents(extensions.vector, int, text, text) to service_role;

create or replace function public.cleanup_patent_document_chunks(
  p_source_id text,
  p_keep_chunk_count int
)
returns void
language sql
security invoker
set search_path = public, extensions
as $$
  delete from public.documents d
  where d.metadata ->> 'domain' = 'patents'
    and d.metadata ->> 'source_id' = p_source_id
    and coalesce((d.metadata ->> 'chunkIndex')::int, 0) >= greatest(p_keep_chunk_count, 0);
$$;

revoke all on function public.cleanup_patent_document_chunks(text, int) from public, anon, authenticated;
grant execute on function public.cleanup_patent_document_chunks(text, int) to service_role;
