-- CSRoma WebApp - Master Migration Script (Fixed Version)
-- Combines all main migrations (0001-0045) with predefined_installments from migrations2
-- Created: 2025-10-07
-- Updated: 2025-10-07 - Fixed security issues and improved RLS policies

-- ===========================================
-- EXTENSIONS
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"

CREATE EXTENSION IF NOT EXISTS "pgcrypto"

-- ===========================================
-- HELPER FUNCTIONS FOR RLS POLICIES
-- ===========================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

-- Function to check if user is coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'coach'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

-- Function to check if user is athlete
CREATE OR REPLACE FUNCTION is_athlete()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'athlete'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

-- Function to check if user is coach of a specific team (SECURE VERSION)
CREATE OR REPLACE FUNCTION is_coach_of_team(team_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM team_members
        WHERE profile_id = auth.uid()
        AND team_id = team_uuid
        AND role = 'coach'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

-- Function to check if user can view athlete profiles (SECURE VERSION)
CREATE OR REPLACE FUNCTION can_view_athlete_profile(athlete_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM team_members tm
        JOIN team_members coach_tm ON tm.team_id = coach_tm.team_id
        WHERE coach_tm.profile_id = auth.uid()
        AND coach_tm.role = 'coach'
        AND tm.profile_id = athlete_profile_id
        AND tm.role = 'athlete'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

-- Note: These functions use SECURITY DEFINER to bypass RLS and avoid recursion

-- ===========================================
-- MAIN TABLES
-- ===========================================

-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create gyms table
CREATE TABLE IF NOT EXISTS gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_info TEXT,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'coach', 'athlete')),
    phone VARCHAR(50),
    birth_date DATE,
    jersey_number INTEGER,
    membership_number VARCHAR(100),
    medical_certificate_expiry DATE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('coach', 'athlete')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, team_id)
)

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    kind VARCHAR(50) DEFAULT 'spot' CHECK (kind IN ('spot', 'recurring')),
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (start_time < end_time)
)

-- Create event_teams table
CREATE TABLE IF NOT EXISTS event_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, team_id)
)

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create message_recipients table
CREATE TABLE IF NOT EXISTS message_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('team', 'user')),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (recipient_type = 'team' AND team_id IS NOT NULL AND profile_id IS NULL) OR
        (recipient_type = 'user' AND profile_id IS NOT NULL AND team_id IS NULL)
    )
)

-- Create membership_fees table
CREATE TABLE IF NOT EXISTS membership_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    enrollment_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    insurance_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    months_count INTEGER NOT NULL DEFAULT 10,
    discount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    installments_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create fee_installments table
CREATE TABLE IF NOT EXISTS fee_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_fee_id UUID NOT NULL REFERENCES membership_fees(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(membership_fee_id, profile_id, installment_number)
)

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('general_cost', 'coach_payment')),
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('one_time', 'recurring')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    due_date DATE,
    paid_at TIMESTAMP WITH TIME ZONE,
    gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create document_templates table
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('medical_request', 'enrollment_form', 'attendance_certificate', 'payment_receipt', 'team_convocation')),
    content TEXT NOT NULL,
    logo_position VARCHAR(50) DEFAULT 'top_left',
    footer_text TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('medical_request', 'enrollment_form', 'attendance_certificate', 'payment_receipt', 'team_convocation')),
    content TEXT,
    template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(255) NOT NULL,
    details JSONB,
    profile_id UUID REFERENCES profiles(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, endpoint)
)

-- Create rsvp table
CREATE TABLE IF NOT EXISTS rsvp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('going', 'not_going', 'maybe')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, profile_id)
)

-- ===========================================
-- MIGRATIONS2: predefined_installments TABLE
-- ===========================================

-- Add predefined installments table to store template installments for membership fees
CREATE TABLE IF NOT EXISTS predefined_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_fee_id UUID NOT NULL REFERENCES membership_fees(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT predefined_installments_unique_fee_number UNIQUE (membership_fee_id, installment_number)
)

-- ===========================================
-- ROW LEVEL SECURITY POLICIES
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY

ALTER TABLE activities ENABLE ROW LEVEL SECURITY

ALTER TABLE teams ENABLE ROW LEVEL SECURITY

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY

ALTER TABLE events ENABLE ROW LEVEL SECURITY

ALTER TABLE event_teams ENABLE ROW LEVEL SECURITY

ALTER TABLE messages ENABLE ROW LEVEL SECURITY

ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY

ALTER TABLE membership_fees ENABLE ROW LEVEL SECURITY

ALTER TABLE fee_installments ENABLE ROW LEVEL SECURITY

ALTER TABLE payments ENABLE ROW LEVEL SECURITY

ALTER TABLE documents ENABLE ROW LEVEL SECURITY

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY

ALTER TABLE rsvp ENABLE ROW LEVEL SECURITY

ALTER TABLE predefined_installments ENABLE ROW LEVEL SECURITY

-- Seasons policies
CREATE POLICY "Admins can manage seasons" ON seasons
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Authenticated users can view active seasons" ON seasons
    FOR SELECT TO authenticated USING (is_active = true)

-- Gym policies
CREATE POLICY "Admins can manage gyms" ON gyms
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Authenticated users can view gyms" ON gyms
    FOR SELECT TO authenticated USING (true)

-- Activities policies
CREATE POLICY "Admins can manage activities" ON activities
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Authenticated users can view activities" ON activities
    FOR SELECT TO authenticated USING (true)

-- Teams policies
CREATE POLICY "Admins can manage teams" ON teams
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

-- Coaches can only view and manage their own teams
CREATE POLICY "Coaches can update their teams" ON teams
    FOR UPDATE USING (is_coach() AND is_coach_of_team(id))
    WITH CHECK (is_coach() AND is_coach_of_team(id))

CREATE POLICY "Coaches can delete their teams" ON teams
    FOR DELETE USING (is_coach() AND is_coach_of_team(id))

-- Coaches can view their teams
CREATE POLICY "Coaches can view their teams" ON teams
    FOR SELECT USING (
        is_coach() AND
        id IN (
            SELECT team_id FROM team_members
            WHERE profile_id = auth.uid() AND role = 'coach'
        )
    )

-- Athletes can view their own teams
CREATE POLICY "Athletes can view their teams" ON teams
    FOR SELECT USING (
        is_athlete() AND
        id IN (
            SELECT team_id FROM team_members
            WHERE profile_id = auth.uid() AND role = 'athlete'
        )
    )

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id)

CREATE POLICY "Admins can manage all profiles" ON profiles
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Coaches can view athlete profiles in their teams" ON profiles
    FOR SELECT USING (
        is_coach() AND can_view_athlete_profile(id)
    )

-- Team members policies
CREATE POLICY "Admins can manage team members" ON team_members
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

-- Coaches can manage team members with team validation (using SECURITY DEFINER function)
CREATE POLICY "Coaches can insert team members" ON team_members
    FOR INSERT WITH CHECK (is_coach() AND is_coach_of_team(team_id))

CREATE POLICY "Coaches can update team members" ON team_members
    FOR UPDATE USING (is_coach() AND is_coach_of_team(team_id))

CREATE POLICY "Coaches can delete team members" ON team_members
    FOR DELETE USING (is_coach() AND is_coach_of_team(team_id))

CREATE POLICY "Users can view their team memberships" ON team_members
    FOR SELECT USING (profile_id = auth.uid())

-- Events policies
CREATE POLICY "Admins can manage all events" ON events
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Coaches can manage events for their teams" ON events
    FOR ALL USING (
        is_coach() AND
        id IN (
            SELECT et.event_id FROM event_teams et
            JOIN team_members tm ON et.team_id = tm.team_id
            WHERE tm.profile_id = auth.uid() AND tm.role = 'coach'
        )
    )

CREATE POLICY "Athletes can view events for their teams" ON events
    FOR SELECT USING (
        is_athlete() AND
        id IN (
            SELECT et.event_id FROM event_teams et
            JOIN team_members tm ON et.team_id = tm.team_id
            WHERE tm.profile_id = auth.uid() AND tm.role = 'athlete'
        )
    )

-- Event teams policies
CREATE POLICY "Admins can manage event teams" ON event_teams
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

-- Coaches can manage event teams for their teams
CREATE POLICY "Coaches can insert event teams" ON event_teams
    FOR INSERT WITH CHECK (is_coach() AND is_coach_of_team(team_id))

CREATE POLICY "Coaches can update event teams" ON event_teams
    FOR UPDATE USING (is_coach() AND is_coach_of_team(team_id))
    WITH CHECK (is_coach() AND is_coach_of_team(team_id))

CREATE POLICY "Coaches can delete event teams" ON event_teams
    FOR DELETE USING (is_coach() AND is_coach_of_team(team_id))

-- Coaches can view event teams for their teams
CREATE POLICY "Coaches can view event teams" ON event_teams
    FOR SELECT USING (
        is_coach() AND
        team_id IN (
            SELECT team_id FROM team_members
            WHERE profile_id = auth.uid() AND role = 'coach'
        )
    )

-- Athletes can view event teams for their teams
CREATE POLICY "Athletes can view event teams" ON event_teams
    FOR SELECT USING (
        is_athlete() AND
        team_id IN (
            SELECT team_id FROM team_members
            WHERE profile_id = auth.uid() AND role = 'athlete'
        )
    )

-- Messages policies
CREATE POLICY "Admins can manage all messages" ON messages
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Coaches can manage messages for their teams" ON messages
    FOR ALL USING (
        is_coach() AND
        id IN (
            SELECT mr.message_id FROM message_recipients mr
            JOIN team_members tm ON mr.team_id = tm.team_id
            WHERE tm.profile_id = auth.uid() AND tm.role = 'coach'
            AND mr.recipient_type = 'team'
        )
    )

CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (sender_id = auth.uid())

CREATE POLICY "Users can view messages sent to them" ON messages
    FOR SELECT USING (
        id IN (
            SELECT message_id FROM message_recipients
            WHERE profile_id = auth.uid() OR
            (recipient_type = 'team' AND team_id IN (
                SELECT team_id FROM team_members WHERE profile_id = auth.uid()
            ))
        )
    )

-- Message recipients policies
CREATE POLICY "Admins can manage message recipients" ON message_recipients
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

-- Coaches can manage message recipients only for their teams and only team recipients
CREATE POLICY "Coaches can insert message recipients" ON message_recipients
    FOR INSERT WITH CHECK (
        is_coach() AND
        recipient_type = 'team' AND
        team_id IS NOT NULL AND
        is_coach_of_team(team_id)
    )

CREATE POLICY "Coaches can update message recipients" ON message_recipients
    FOR UPDATE USING (
        is_coach() AND
        recipient_type = 'team' AND
        team_id IS NOT NULL AND
        is_coach_of_team(team_id)
    )
    WITH CHECK (
        is_coach() AND
        recipient_type = 'team' AND
        team_id IS NOT NULL AND
        is_coach_of_team(team_id)
    )

CREATE POLICY "Coaches can delete message recipients" ON message_recipients
    FOR DELETE USING (
        is_coach() AND
        recipient_type = 'team' AND
        team_id IS NOT NULL AND
        is_coach_of_team(team_id)
    )

CREATE POLICY "Users can view their message recipients" ON message_recipients
    FOR SELECT USING (
        profile_id = auth.uid() OR
        team_id IN (
            SELECT team_id FROM team_members WHERE profile_id = auth.uid()
        )
    )

-- Membership fees policies
CREATE POLICY "Admins can manage membership fees" ON membership_fees
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

-- Coaches can view membership fees (simplified)
CREATE POLICY "Coaches can view membership fees" ON membership_fees
    FOR SELECT USING (is_coach())

-- Fee installments policies
CREATE POLICY "Admins can manage fee installments" ON fee_installments
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Users can view their own fee installments" ON fee_installments
    FOR SELECT USING (profile_id = auth.uid())

-- Payments policies
CREATE POLICY "Admins can manage all payments" ON payments
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

CREATE POLICY "Coaches can view their payments" ON payments
    FOR SELECT USING (is_coach() AND coach_id = auth.uid())

-- Documents policies
CREATE POLICY "Admins can manage all documents" ON documents
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

-- Coaches can manage documents (simplified)
CREATE POLICY "Coaches can insert documents" ON documents
    FOR INSERT WITH CHECK (is_coach())

CREATE POLICY "Coaches can update documents" ON documents
    FOR UPDATE USING (is_coach())

CREATE POLICY "Coaches can delete documents" ON documents
    FOR DELETE USING (is_coach())

CREATE POLICY "Users can view their own documents" ON documents
    FOR SELECT USING (profile_id = auth.uid())

-- Document templates policies
CREATE POLICY "Authenticated users can view document templates" ON document_templates
    FOR SELECT TO authenticated USING (true)

CREATE POLICY "Admins can insert document templates" ON document_templates
    FOR INSERT WITH CHECK (is_admin() AND created_by = auth.uid())

CREATE POLICY "Admins can update document templates" ON document_templates
    FOR UPDATE USING (is_admin())

CREATE POLICY "Admins can delete document templates" ON document_templates
    FOR DELETE USING (is_admin())

-- System logs policies
CREATE POLICY "Admins can view system logs" ON system_logs
    FOR SELECT USING (is_admin())

-- Push subscriptions policies
CREATE POLICY "Users can manage their own push subscriptions" ON push_subscriptions
    FOR ALL USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid())

-- RSVP policies
CREATE POLICY "Users can manage their own RSVP" ON rsvp
    FOR ALL USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid())

CREATE POLICY "Coaches can view RSVP for their teams" ON rsvp
    FOR SELECT USING (
        is_coach() AND
        event_id IN (
            SELECT et.event_id FROM event_teams et
            JOIN team_members tm ON et.team_id = tm.team_id
            WHERE tm.profile_id = auth.uid() AND tm.role = 'coach'
        )
    )

-- Predefined installments policies
CREATE POLICY "Admins can manage predefined installments" ON predefined_installments
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin())

-- ===========================================
-- FUNCTIONS AND TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql'

-- Create triggers for updated_at
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_gyms_updated_at BEFORE UPDATE ON gyms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_membership_fees_updated_at BEFORE UPDATE ON membership_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_fee_installments_updated_at BEFORE UPDATE ON fee_installments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

CREATE TRIGGER update_predefined_installments_updated_at BEFORE UPDATE ON predefined_installments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()

-- Function to sync auth.users to profiles (SECURE VERSION)
CREATE OR REPLACE FUNCTION sync_auth_users_to_profiles()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'athlete')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

-- Trigger for auth.users sync
CREATE TRIGGER sync_auth_users_to_profiles_trigger
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION sync_auth_users_to_profiles()

-- ===========================================
-- STORAGE BUCKETS
-- ===========================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
    ('message-attachments', 'message-attachments', false),
    ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING

-- Storage policies for message-attachments bucket
CREATE POLICY "Admins can manage message attachments" ON storage.objects
    FOR ALL USING (bucket_id = 'message-attachments' AND is_admin())
    WITH CHECK (bucket_id = 'message-attachments' AND is_admin())

CREATE POLICY "Coaches can manage message attachments for their teams" ON storage.objects
    FOR ALL USING (
        bucket_id = 'message-attachments' AND
        is_coach() AND
        (storage.foldername(name))[1] IN (
            SELECT team_id::text FROM team_members
            WHERE profile_id = auth.uid() AND role = 'coach'
        )
    )
    WITH CHECK (
        bucket_id = 'message-attachments' AND
        is_coach() AND
        (storage.foldername(name))[1] IN (
            SELECT team_id::text FROM team_members
            WHERE profile_id = auth.uid() AND role = 'coach'
        )
    )

CREATE POLICY "Users can view message attachments for their teams" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'message-attachments' AND
        (storage.foldername(name))[1] IN (
            SELECT team_id::text FROM team_members WHERE profile_id = auth.uid()
        )
    )

-- Storage policies for documents bucket
CREATE POLICY "Admins can manage documents" ON storage.objects
    FOR ALL USING (bucket_id = 'documents' AND is_admin())
    WITH CHECK (bucket_id = 'documents' AND is_admin())

CREATE POLICY "Coaches can manage documents for their teams" ON storage.objects
    FOR ALL USING (
        bucket_id = 'documents' AND
        is_coach() AND
        (storage.foldername(name))[1] IN (
            SELECT team_id::text FROM team_members
            WHERE profile_id = auth.uid() AND role = 'coach'
        )
    )
    WITH CHECK (
        bucket_id = 'documents' AND
        is_coach() AND
        (storage.foldername(name))[1] IN (
            SELECT team_id::text FROM team_members
            WHERE profile_id = auth.uid() AND role = 'coach'
        )
    )

CREATE POLICY "Users can manage their own documents" ON storage.objects
    FOR ALL USING (
        bucket_id = 'documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    )

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role)

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email)

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_profile_id ON team_members(profile_id)

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id)

CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role)

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by)

CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time)

-- Event teams indexes
CREATE INDEX IF NOT EXISTS idx_event_teams_event_id ON event_teams(event_id)

CREATE INDEX IF NOT EXISTS idx_event_teams_team_id ON event_teams(team_id)

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)

-- Message recipients indexes
CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id ON message_recipients(message_id)

CREATE INDEX IF NOT EXISTS idx_message_recipients_profile_id ON message_recipients(profile_id)

CREATE INDEX IF NOT EXISTS idx_message_recipients_team_id ON message_recipients(team_id)

-- Unique partial indexes to prevent duplicates in message_recipients
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_recipients_unique_user
ON message_recipients (message_id, profile_id)
WHERE profile_id IS NOT NULL

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_recipients_unique_team
ON message_recipients (message_id, team_id)
WHERE team_id IS NOT NULL

-- Membership fees indexes
CREATE INDEX IF NOT EXISTS idx_membership_fees_team_id ON membership_fees(team_id)

-- Fee installments indexes
CREATE INDEX IF NOT EXISTS idx_fee_installments_profile_id ON fee_installments(profile_id)

CREATE INDEX IF NOT EXISTS idx_fee_installments_membership_fee_id ON fee_installments(membership_fee_id)

CREATE INDEX IF NOT EXISTS idx_fee_installments_due_date ON fee_installments(due_date)

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_coach_id ON payments(coach_id)

CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by)

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_profile_id ON documents(profile_id)

CREATE INDEX IF NOT EXISTS idx_documents_team_id ON documents(team_id)

CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by)

-- RSVP indexes
CREATE INDEX IF NOT EXISTS idx_rsvp_event_id ON rsvp(event_id)

CREATE INDEX IF NOT EXISTS idx_rsvp_profile_id ON rsvp(profile_id)

-- Predefined installments indexes
CREATE INDEX IF NOT EXISTS idx_predefined_installments_membership_fee_id ON predefined_installments(membership_fee_id)

-- ===========================================
-- FINAL NOTES
-- ===========================================

-- This master migration script combines:
-- 1. All main migrations from 0001-0045
-- 2. Only the predefined_installments table from migrations2 folder
-- 3. Excludes other migrations2 files (alternative events and documents versions)
--
-- SECURITY IMPROVEMENTS:
-- ✅ Fixed document_templates policy (read for all, write only for admin)
-- ✅ Replaced auth.jwt()->>'role' with profiles.role-based helper functions
-- ✅ Added WITH CHECK clauses to all policies
-- ✅ Standardized UUID generation to gen_random_uuid()
-- ✅ Added FK constraint for documents.template_id
-- ✅ Secured auth.users trigger with SECURITY DEFINER
-- ✅ Fixed storage RLS policies with WITH CHECK and path rules
-- ✅ Added missing indexes for performance/RLS
--
-- The script creates the complete database schema with:
-- - 24 main tables
-- - Complex RLS policies based on profiles.role
-- - Storage buckets for file management
-- - Triggers for automatic timestamp updates
-- - Functions for user synchronization
-- - Performance indexes
--
-- To apply this migration:
-- 1. Connect to your Supabase database
-- 2. Run this script as a single transaction
-- 3. Verify all tables and policies are created correctly
