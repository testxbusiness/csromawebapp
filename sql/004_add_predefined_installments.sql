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
);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_predefined_installments_updated_at
    BEFORE UPDATE ON predefined_installments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE predefined_installments ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can access predefined installments
CREATE POLICY "Admins can manage predefined installments" ON predefined_installments
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');