-- EXTENDED STORES TABLE FOR FULL ONBOARDING

-- 1. Alter 'stores' to add structured data columns
-- We use JSONB for flexible nested data (Address, Contacts, Consents, Extra Docs)

ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS legal_name TEXT, -- Corporate Name or User Full Name
ADD COLUMN IF NOT EXISTS doc_type TEXT CHECK (doc_type IN ('PF', 'PJ')),
ADD COLUMN IF NOT EXISTS document TEXT, -- CPF or CNPJ
ADD COLUMN IF NOT EXISTS fantasy_name TEXT, -- Nome Fantasia (useful for PJ)
ADD COLUMN IF NOT EXISTS establishment_type TEXT, -- Matriz, Filial, Depósito, Outros
ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}'::jsonb, 
-- Structure: { street, number, complement, neighborhood, zip_code, city, state, ibge_code }
ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '{}'::jsonb,
-- Structure: { 
--   secondary_emails: [], 
--   website: '', 
--   social_media: '', 
--   responsible_name: '', 
--   responsible_phone: '', 
--   extra_contact: { name: '', phone: '' },
--   whatsapp_business: '', -- The OptmaSMSGate number
--   whatsapp_contact: ''
-- }
ADD COLUMN IF NOT EXISTS consents JSONB DEFAULT '{}'::jsonb;
-- Structure: { 
--   channels: { sms: bool, whatsapp: bool, email: bool, phone: bool, mail: bool },
--   terms_accepted: bool,
--   legal_responsibility_accepted: bool,
--   illicit_goods_accepted: bool,
--   integrations_accepted: bool,
--   lgpd_accepted: bool
-- }

-- 2. Add comments for clarity
COMMENT ON COLUMN stores.legal_name IS 'Razão Social or Full Name';
COMMENT ON COLUMN stores.document IS 'CPF or CNPJ Value';
COMMENT ON COLUMN stores.address IS 'Structured address data with IBGE';
COMMENT ON COLUMN stores.contacts IS 'All contact points including secondary emails and phones';
