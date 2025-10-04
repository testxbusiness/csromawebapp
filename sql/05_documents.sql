-- Documents and Templates Management Schema
-- This SQL creates tables for managing documents and templates for CSRoma

-- Document Templates Table
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'medical_certificate_request',
    'enrollment_form', 
    'attendance_certificate',
    'payment_receipt',
    'team_convocation'
  )),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'team')),
  
  -- Template content
  content_html TEXT NOT NULL,
  styles_css TEXT,
  
  -- Template settings
  has_logo BOOLEAN DEFAULT false,
  logo_position VARCHAR(20) DEFAULT 'top-left' CHECK (logo_position IN ('top-left', 'top-center', 'top-right')),
  has_date BOOLEAN DEFAULT true,
  date_format VARCHAR(20) DEFAULT 'dd/mm/yyyy',
  has_signature_area BOOLEAN DEFAULT true,
  footer_text TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  
  -- Document metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'archived')),
  
  -- Content
  generated_content_html TEXT,
  file_url TEXT, -- Supabase Storage URL for generated PDF
  file_name VARCHAR(255),
  
  -- Recipients
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  
  -- Generation data
  generation_date TIMESTAMP WITH TIME ZONE,
  variables JSONB DEFAULT '{}', -- Dynamic variables used in generation
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Constraints
  CONSTRAINT target_check CHECK (
    (target_user_id IS NOT NULL AND target_team_id IS NULL) OR
    (target_user_id IS NULL AND target_team_id IS NOT NULL)
  )
);

-- Document Recipients (for team documents)
CREATE TABLE IF NOT EXISTS document_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'read', 'acknowledged')),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(document_id, user_id)
);

-- Update timestamps triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_templates_updated_at 
    BEFORE UPDATE ON document_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_recipients ENABLE ROW LEVEL SECURITY;

-- Document Templates Policies
CREATE POLICY "Admin can manage all document templates" ON document_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Coaches can view active templates" ON document_templates
    FOR SELECT USING (
        is_active = true AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'admin')
        )
    );

-- Documents Policies
CREATE POLICY "Admin can manage all documents" ON documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Coaches can manage documents for their teams" ON documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN team_members tm ON p.id = tm.user_id
            WHERE p.id = auth.uid() 
                AND p.role = 'coach'
                AND tm.team_id = documents.target_team_id
        )
    );

CREATE POLICY "Users can view their own documents" ON documents
    FOR SELECT USING (
        target_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM document_recipients dr
            WHERE dr.document_id = documents.id 
                AND dr.user_id = auth.uid()
        )
    );

-- Document Recipients Policies
CREATE POLICY "Admin can manage all document recipients" ON document_recipients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Coaches can manage recipients for their team documents" ON document_recipients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN team_members tm ON d.target_team_id = tm.team_id
            JOIN profiles p ON tm.user_id = p.id
            WHERE d.id = document_recipients.document_id
                AND p.id = auth.uid() 
                AND p.role = 'coach'
        )
    );

CREATE POLICY "Users can view their own recipient status" ON document_recipients
    FOR SELECT USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_document_templates_type ON document_templates(type);
CREATE INDEX idx_document_templates_active ON document_templates(is_active);
CREATE INDEX idx_documents_template ON documents(template_id);
CREATE INDEX idx_documents_target_user ON documents(target_user_id);
CREATE INDEX idx_documents_target_team ON documents(target_team_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_document_recipients_document ON document_recipients(document_id);
CREATE INDEX idx_document_recipients_user ON document_recipients(user_id);
CREATE INDEX idx_document_recipients_status ON document_recipients(status);

-- Insert default templates
INSERT INTO document_templates (name, description, type, target_type, content_html, has_logo, has_date, has_signature_area, footer_text) VALUES 
(
    'Richiesta Certificato Medico',
    'Template per richiesta certificato medico sportivo',
    'medical_certificate_request',
    'user',
    '<div class="document">
        <h1>Richiesta Certificato Medico Sportivo</h1>
        <p>Egregio {{user_title}} {{user_full_name}},</p>
        <p>Le ricordiamo che il suo certificato medico sportivo risulta in scadenza il <strong>{{medical_certificate_expiry}}</strong>.</p>
        <p>La preghiamo di provvedere al rinnovo presso il suo medico di fiducia e di consegnare il nuovo certificato presso la segreteria dell''associazione.</p>
        <p>Cordiali saluti,</p>
        <p><strong>CSRoma</strong></p>
    </div>',
    true,
    true,
    false,
    'CS Roma - Associazione Sportiva | Email: info@csroma.it'
),
(
    'Modulo Iscrizione',
    'Template per modulo di iscrizione',
    'enrollment_form',
    'user',
    '<div class="document">
        <h1>Modulo di Iscrizione</h1>
        <p><strong>Dati dell''atleta:</strong></p>
        <p>Nome: {{user_first_name}}</p>
        <p>Cognome: {{user_last_name}}</p>
        <p>Data di nascita: {{user_birth_date}}</p>
        <p>Codice fiscale: {{user_tax_code}}</p>
        <p><strong>Squadra:</strong> {{team_name}}</p>
        <p><strong>Attività:</strong> {{activity_name}}</p>
        <p><strong>Stagione:</strong> {{season_name}}</p>
        <div class="signature-area">
            <p>Data: _______________</p>
            <p>Firma dell''atleta: _______________</p>
            <p>Firma del genitore (se minorenne): _______________</p>
        </div>
    </div>',
    true,
    true,
    true,
    'CS Roma - Associazione Sportiva | Email: info@csroma.it'
),
(
    'Convocazione Squadra',
    'Template per convocazioni di squadra',
    'team_convocation',
    'team',
    '<div class="document">
        <h1>Convocazione</h1>
        <p><strong>Squadra:</strong> {{team_name}} ({{team_code}})</p>
        <p><strong>Evento:</strong> {{event_title}}</p>
        <p><strong>Data e ora:</strong> {{event_date}} alle {{event_time}}</p>
        <p><strong>Luogo:</strong> {{event_location}}</p>
        <p><strong>Descrizione:</strong></p>
        <p>{{event_description}}</p>
        <p><strong>Note per gli atleti:</strong></p>
        <ul>
            <li>Presentarsi puntuali all''orario indicato</li>
            <li>Portare l''attrezzatura completa</li>
            <li>In caso di impedimento, comunicare tempestivamente</li>
        </ul>
        <p>L''allenatore,<br>{{coach_name}}</p>
    </div>',
    true,
    true,
    false,
    'CS Roma - Associazione Sportiva | Email: info@csroma.it'
);