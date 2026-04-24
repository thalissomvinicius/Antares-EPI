-- Tabela para controlar links remotos (captura de foto e assinatura de entrega)
CREATE TABLE IF NOT EXISTS remote_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('capture', 'delivery')),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  data JSONB DEFAULT NULL, -- dados extras para delivery (ppe_id, workplace_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Índice para buscas por token
CREATE INDEX IF NOT EXISTS idx_remote_links_token ON remote_links(token);

-- Política RLS: leitura aberta (links são acessados sem login)
ALTER TABLE remote_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de links remotos" ON remote_links
  FOR SELECT USING (true);

CREATE POLICY "Service role pode tudo em remote_links" ON remote_links
  FOR ALL USING (true) WITH CHECK (true);
