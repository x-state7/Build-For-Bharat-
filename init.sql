-- Create database and user
CREATE DATABASE mgnrega_db;
CREATE USER mgnrega_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE mgnrega_db TO mgnrega_user;

-- Connect to the database
\c mgnrega_db;

-- Create main data table
CREATE TABLE IF NOT EXISTS mgnrega_data (
  id SERIAL PRIMARY KEY,
  fin_year VARCHAR(20) NOT NULL,
  month VARCHAR(20),
  state_code VARCHAR(10),
  state_name VARCHAR(100) NOT NULL,
  district_code VARCHAR(10),
  district_name VARCHAR(100) NOT NULL,
  approved_labour_budget NUMERIC(15,2) DEFAULT 0,
  avg_wage_rate NUMERIC(10,2) DEFAULT 0,
  avg_days_employment NUMERIC(10,2) DEFAULT 0,
  diff_abled_persons_worked NUMERIC(10,0) DEFAULT 0,
  material_and_skilled_wages NUMERIC(15,2) DEFAULT 0,
  completed_works NUMERIC(10,0) DEFAULT 0,
  gps_with_nil_exp NUMERIC(10,0) DEFAULT 0,
  ongoing_works NUMERIC(10,0) DEFAULT 0,
  central_liability_persondays NUMERIC(15,2) DEFAULT 0,
  sc_persondays NUMERIC(15,2) DEFAULT 0,
  sc_workers_active NUMERIC(10,0) DEFAULT 0,
  st_persondays NUMERIC(15,2) DEFAULT 0,
  st_workers_active NUMERIC(10,0) DEFAULT 0,
  total_admin_expenditure NUMERIC(15,2) DEFAULT 0,
  total_expenditure NUMERIC(15,2) DEFAULT 0,
  total_households_worked NUMERIC(10,0) DEFAULT 0,
  total_individuals_worked NUMERIC(10,0) DEFAULT 0,
  active_job_cards NUMERIC(10,0) DEFAULT 0,
  active_workers NUMERIC(10,0) DEFAULT 0,
  hh_completed_100_days NUMERIC(10,0) DEFAULT 0,
  job_cards_issued NUMERIC(10,0) DEFAULT 0,
  total_workers NUMERIC(10,0) DEFAULT 0,
  works_takenup NUMERIC(10,0) DEFAULT 0,
  wages NUMERIC(15,2) DEFAULT 0,
  women_persondays NUMERIC(15,2) DEFAULT 0,
  percent_category_b_works NUMERIC(5,2) DEFAULT 0,
  percent_agri_allied_works NUMERIC(5,2) DEFAULT 0,
  percent_nrm_expenditure NUMERIC(5,2) DEFAULT 0,
  percent_payments_15_days NUMERIC(5,2) DEFAULT 0,
  remarks TEXT,
  data_payload JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_state_district_year ON mgnrega_data(state_name, district_name, fin_year);
CREATE INDEX idx_fin_year ON mgnrega_data(fin_year);
CREATE INDEX idx_district_name ON mgnrega_data(district_name);
CREATE INDEX idx_updated_at ON mgnrega_data(updated_at DESC);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX idx_unique_record ON mgnrega_data(state_name, district_name, fin_year, month);

-- Grant permissions to user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mgnrega_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mgnrega_user;