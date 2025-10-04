-- Tabella eventi
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location VARCHAR(255),
  gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  event_type VARCHAR(50) DEFAULT 'one_time' CHECK (event_type IN ('one_time', 'recurring')),
  
  -- Recurring event fields
  recurrence_rule JSONB, -- Stores recurrence pattern
  recurrence_end_date TIMESTAMPTZ,
  parent_event_id UUID REFERENCES events(id) ON DELETE CASCADE, -- For recurring instances
  
  -- Metadata
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella squadre associate agli eventi
CREATE TABLE IF NOT EXISTS event_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, team_id)
);

-- RLS Policies per events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Admin può tutto
CREATE POLICY "Admin full access on events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allenatori vedono eventi delle loro squadre
CREATE POLICY "Coaches can view their team events" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    ) AND (
      id IN (
        SELECT et.event_id 
        FROM event_teams et
        JOIN teams t ON et.team_id = t.id
        WHERE t.coach_id = auth.uid()
      )
    )
  );

-- Allenatori possono creare/modificare eventi per le loro squadre
CREATE POLICY "Coaches can manage their team events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    ) AND (
      created_by = auth.uid() OR
      id IN (
        SELECT et.event_id 
        FROM event_teams et
        JOIN teams t ON et.team_id = t.id
        WHERE t.coach_id = auth.uid()
      )
    )
  );

-- Atleti vedono solo eventi delle loro squadre
CREATE POLICY "Athletes can view their team events" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'athlete'
    ) AND (
      id IN (
        SELECT et.event_id 
        FROM event_teams et
        JOIN team_members tm ON et.team_id = tm.team_id
        WHERE tm.profile_id = auth.uid()
      )
    )
  );

-- RLS Policies per event_teams
ALTER TABLE event_teams ENABLE ROW LEVEL SECURITY;

-- Admin può tutto
CREATE POLICY "Admin full access on event_teams" ON event_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allenatori possono gestire le associazioni delle loro squadre
CREATE POLICY "Coaches can manage their team event associations" ON event_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    ) AND (
      team_id IN (
        SELECT id FROM teams WHERE coach_id = auth.uid()
      )
    )
  );

-- Atleti possono vedere le associazioni delle loro squadre
CREATE POLICY "Athletes can view their team event associations" ON event_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'athlete'
    ) AND (
      team_id IN (
        SELECT tm.team_id 
        FROM team_members tm 
        WHERE tm.profile_id = auth.uid()
      )
    )
  );

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_activity_id ON events(activity_id);
CREATE INDEX IF NOT EXISTS idx_events_gym_id ON events(gym_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_event_teams_event_id ON event_teams(event_id);
CREATE INDEX IF NOT EXISTS idx_event_teams_team_id ON event_teams(team_id);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at 
  BEFORE UPDATE ON events 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();