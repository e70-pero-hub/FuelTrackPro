-- Kreiranje tabela za AppFvl-v2 (Mobile)

-- 1. Korisnici (Zaposleni + Administratori spojeni)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' -- 'admin' ili 'user'
);

-- 2. Vozila
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    reg_exp DATE NOT NULL,
    service DATE NOT NULL,
    tires DATE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Točenja goriva
CREATE TABLE IF NOT EXISTS fuel_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    km INTEGER NOT NULL,
    liters DECIMAL(10, 2) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    receipt_qr_data TEXT,
    receipt_image_path VARCHAR(255)
);

-- Početni podaci (Opciono)
INSERT INTO users (username, password, full_name, role) VALUES 
('admin', 'admin123', 'Glavni Administrator', 'admin'),
('operater', 'gas123', 'Pera Operater', 'user')
ON CONFLICT (username) DO NOTHING;

INSERT INTO vehicles (brand, model, plate, reg_exp, service, tires, user_id) 
VALUES ('Volkswagen', 'Golf 8', 'BG-1234-AB', '2026-05-15', '2026-10-01', '2026-11-20', 1);

-- 4. View za Izveštavanje
CREATE OR REPLACE VIEW admin_reports_view AS
SELECT 
    fl.id AS log_id,
    fl.km,
    fl.liters,
    fl.price,
    fl.date AS fuel_date,
    fl.receipt_qr_data,
    TO_CHAR(fl.date, 'YYYY-MM') AS month_year,
    v.id AS vehicle_id,
    v.plate,
    v.brand,
    v.model,
    u.id AS user_id,
    u.username,
    u.full_name
FROM fuel_logs fl
JOIN vehicles v ON fl.vehicle_id = v.id
JOIN users u ON v.user_id = u.id;
