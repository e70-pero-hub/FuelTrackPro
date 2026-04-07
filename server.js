const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Za serviranje frontenda
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Slike

// Kreiranje foldera za slike ako ne postoji
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Konfiguracija Multer za slike računa
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// PostgreSQL konekcija
const pool = new Pool({
    // Ako aplikacija vidi ENV varijablu (na cloud-u), koristi je, a ako ne (na lokalu), koristi stare lokalne podešavanja.
    connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_DX1xcwbGvI5O@ep-winter-forest-albxjxx1-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    ,
});



/*new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'appfvl2', // nova baza
    password: process.env.DB_PASSWORD || 'admin',
    port: process.env.DB_PORT || 5432,
});*/

// TEST RUTE
app.get('/api/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- API RUTE ZA VOZILA ---
app.get('/api/vehicles', async (req, res) => {
    const { user_id } = req.query;
    try {
        let result;
        if (user_id) {
            result = await pool.query(
                'SELECT * FROM vehicles WHERE user_id = $1 ORDER BY id ASC',
                [user_id]
            );
        } else {
            result = await pool.query('SELECT * FROM vehicles ORDER BY id ASC');
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vehicles', async (req, res) => {
    const { brand, model, plate, reg_exp, service, tires, user_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO vehicles (brand, model, plate, reg_exp, service, tires, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [brand, model, plate, reg_exp, service, tires, user_id || null]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/vehicles/:id', async (req, res) => {
    const { id } = req.params;
    const { brand, model, plate, reg_exp, service, tires, user_id } = req.body;
    try {
        const result = await pool.query(
            'UPDATE vehicles SET brand = $1, model = $2, plate = $3, reg_exp = $4, service = $5, tires = $6, user_id = $7 WHERE id = $8 RETURNING *',
            [brand, model, plate, reg_exp, service, tires, user_id || null, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/vehicles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM vehicles WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- API RUTE ZA KORISNIKE (Koji su sada i zaposleni) ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, full_name, role FROM users ORDER BY full_name ASC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, full_name, role } = req.body;
    try {
        const userResult = await pool.query(
            `INSERT INTO users (username, password, full_name, role)
             VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role`,
            [username, password, full_name, role || 'user']
        );
        res.json(userResult.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Korisničko ime je već zauzeto.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, full_name, role } = req.body;
    try {
        let result;
        if (password) {
            result = await pool.query(
                'UPDATE users SET username = $1, password = $2, full_name = $3, role = $4 WHERE id = $5 RETURNING id, username, full_name, role',
                [username, password, full_name, role, id]
            );
        } else {
            result = await pool.query(
                'UPDATE users SET username = $1, full_name = $2, role = $3 WHERE id = $4 RETURNING id, username, full_name, role',
                [username, full_name, role, id]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Promena sopstvene lozinke
app.put('/api/users/:id/password', async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    try {
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- API RUTE ZA TOČENJA (FUEL LOGS) ---
app.get('/api/fuel_logs', async (req, res) => {
    const { user_id } = req.query;
    try {
        let result;
        if (user_id) {
            result = await pool.query(
                `SELECT fl.* FROM fuel_logs fl
                 INNER JOIN vehicles v ON fl.vehicle_id = v.id
                 WHERE v.user_id = $1
                 ORDER BY fl.date DESC`,
                [user_id]
            );
        } else {
            result = await pool.query('SELECT * FROM fuel_logs ORDER BY date DESC');
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dodavanje upload modifikatora
app.post('/api/fuel_logs', upload.single('receipt_image'), async (req, res) => {
    const { vehicle_id, km, liters, price, date, receipt_qr_data } = req.body;
    const receipt_image_path = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const result = await pool.query(
            'INSERT INTO fuel_logs (vehicle_id, km, liters, price, date, receipt_qr_data, receipt_image_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [vehicle_id, km, liters, price, date, receipt_qr_data || null, receipt_image_path]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/fuel_logs/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM fuel_logs WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API RUTE ZA IZVEŠTAJE ---
app.get('/api/reports', async (req, res) => {
    const { month_year, plate, username } = req.query;
    try {
        let query = 'SELECT * FROM admin_reports_view WHERE 1=1';
        let values = [];
        let index = 1;

        if (month_year) {
            query += ` AND month_year = $${index++}`;
            values.push(month_year);
        }
        if (plate) {
            query += ` AND plate ILIKE $${index++}`;
            values.push(`%${plate}%`);
        }
        if (username) {
            query += ` AND username ILIKE $${index++}`;
            values.push(`%${username}%`);
        }

        query += ' ORDER BY fuel_date DESC';

        const result = await pool.query(query, values);

        let total_liters = 0;
        let total_price = 0;
        let avg_consumption = null;

        if (result.rows.length > 0) {
            let vehicleStats = {};

            result.rows.forEach(r => {
                total_liters += parseFloat(r.liters);
                total_price += parseFloat(r.price);

                if (!vehicleStats[r.plate]) {
                    vehicleStats[r.plate] = { min_km: r.km, max_km: r.km, total_liters: 0 };
                }
                if (r.km < vehicleStats[r.plate].min_km) vehicleStats[r.plate].min_km = r.km;
                if (r.km > vehicleStats[r.plate].max_km) vehicleStats[r.plate].max_km = r.km;
                vehicleStats[r.plate].total_liters += parseFloat(r.liters);
            });

            // Računanje proseka za pojedinačna vozila
            Object.keys(vehicleStats).forEach(p => {
                let stats = vehicleStats[p];
                let distance = stats.max_km - stats.min_km;
                if (distance > 0) {
                    stats.avg = (stats.total_liters / distance) * 100;
                } else {
                    stats.avg = null;
                }
            });

            // Ubacivanje statistike nazad u redove za prikaz na karticama
            result.rows = result.rows.map(r => {
                r.vehicle_avg = vehicleStats[r.plate].avg ? vehicleStats[r.plate].avg.toFixed(2) : null;
                return r;
            });

            // Ako je detektovano prisustvo *samo jednog* vozila, prikaži i globalno
            if (Object.keys(vehicleStats).length === 1) {
                let p = Object.keys(vehicleStats)[0];
                avg_consumption = vehicleStats[p].avg;
            }
        }

        res.json({
            logs: result.rows,
            summary: {
                total_liters: total_liters.toFixed(2),
                total_price: total_price.toFixed(2),
                avg_consumption: avg_consumption ? avg_consumption.toFixed(2) : null
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, username, full_name, role FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );

        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Pogrešno korisničko ime ili lozinka' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Greška na serveru' });
    }
});

app.listen(port, () => {
    console.log(`Server radi na http://localhost:${port}`);
});
