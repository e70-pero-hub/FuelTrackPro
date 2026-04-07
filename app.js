/**
 * FuelTrack Mobile - Core Application Logic
 */class DataManager {
    constructor() {
        this.apiUrl = '/api';
        this.currentUser = null;
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.apiUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (result.success) {
                this.currentUser = result.user;
                localStorage.setItem('ft_user', JSON.stringify(result.user));
                localStorage.setItem('ft_last_activity', Date.now());
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, message: 'Greška pri povezivanju sa serverom' };
        }
    }

    async getAllData() {
        // Init
    }

    restoreSession() {
        const userStr = localStorage.getItem('ft_user');
        const lastActStr = localStorage.getItem('ft_last_activity');
        if (userStr && lastActStr) {
            const lastAct = parseInt(lastActStr, 10);
            const now = Date.now();
            if (now - lastAct < 5 * 60 * 1000) {
                this.currentUser = JSON.parse(userStr);
                localStorage.setItem('ft_last_activity', now);
                return true;
            } else {
                this.logout();
            }
        }
        return false;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('ft_user');
        localStorage.removeItem('ft_last_activity');
    }

    async getData(key) {
        try {
            let url = `${this.apiUrl}/${key}`;
            if (this.currentUser && this.currentUser.role !== 'admin' && key !== 'users') {
                url += `?user_id=${this.currentUser.id}&_t=${Date.now()}`;
            } else {
                url += `?_t=${Date.now()}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Mreža nije dostupna');
            const data = await response.json();
            return data.map(item => this.mapFromDB(item, key));
        } catch (err) {
            console.error('Greška pri čitanju podataka:', err);
            return [];
        }
    }

    async getReports(filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.month_year) params.append('month_year', filters.month_year);
            if (filters.plate) params.append('plate', filters.plate);
            if (filters.username) params.append('username', filters.username);

            const url = `${this.apiUrl}/reports?${params.toString()}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Greška u dohvatanju izveštaja');
            return await response.json();
        } catch (err) {
            console.error('Greška pri dohvatanju izveštaja:', err);
            return { logs: [], summary: {} };
        }
    }

    mapFromDB(item, key) {
        if (key === 'vehicles') {
            return {
                id: item.id,
                brand: item.brand,
                model: item.model,
                plate: item.plate,
                regExp: item.reg_exp,
                service: item.service,
                tires: item.tires,
                userId: item.user_id
            };
        }
        if (key === 'fuel_logs') {
            return {
                id: item.id,
                vehicleId: item.vehicle_id,
                km: item.km,
                liters: item.liters,
                price: item.price,
                date: item.date,
                qrData: item.receipt_qr_data,
                image: item.receipt_image_path
            };
        }
        return item; // users
    }

    async addItem(key, item, file = null) {
        try {
            let response;
            if (key === 'fuel_logs' && file) {
                const formData = new FormData();
                formData.append('vehicle_id', item.vehicleId);
                formData.append('km', item.km);
                formData.append('liters', item.liters);
                formData.append('price', item.price);
                formData.append('date', item.date);
                if (item.qrData) formData.append('receipt_qr_data', item.qrData);
                formData.append('receipt_image', file);

                response = await fetch(`${this.apiUrl}/${key}`, {
                    method: 'POST',
                    body: formData
                });
            } else {
                const dbItem = this.mapToDB(item, key);
                response = await fetch(`${this.apiUrl}/${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dbItem)
                });
            }
            const data = await response.json();
            if (!response.ok) return { error: data.error };
            return data;
        } catch (err) {
            console.error('Greška pri čuvanju:', err);
            alert('Greška pri čuvanju u bazu podataka!');
            return { error: err.message };
        }
    }

    mapToDB(item, key) {
        if (key === 'vehicles') {
            return {
                brand: item.brand,
                model: item.model,
                plate: item.plate,
                reg_exp: item.regExp,
                service: item.service,
                tires: item.tires,
                user_id: item.userId || null
            };
        }
        if (key === 'fuel_logs') {
            return {
                vehicle_id: item.vehicleId,
                km: item.km,
                liters: item.liters,
                price: item.price,
                date: item.date,
                receipt_qr_data: item.qrData || null
            };
        }
        if (key === 'users') {
            const obj = { full_name: item.full_name, role: item.role, username: item.username };
            if (item.password) obj.password = item.password;
            return obj;
        }
        return item;
    }

    async updateItem(key, id, item) {
        try {
            const dbItem = this.mapToDB(item, key);
            const response = await fetch(`${this.apiUrl}/${key}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbItem)
            });
            const data = await response.json();
            if (!response.ok) return { error: data.error };
            return data;
        } catch (err) {
            console.error('Greška pri ažuriranju:', err);
            alert('Greška pri ažuriranju u bazi podataka!');
            return { error: err.message };
        }
    }

    async deleteItem(key, id) {
        if (!confirm('Da li ste sigurni da želite da obrišete?')) return false;
        try {
            const response = await fetch(`${this.apiUrl}/${key}/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Brisanje nije uspelo');
            return true;
        } catch (err) {
            console.error('Greška pri brisanju:', err);
            alert('Greška pri brisanju iz baze podataka!');
            return false;
        }
    }
}

class UIManager {
    constructor(dataManager) {
        this.dm = dataManager;
        this.currentRole = 'admin';
        this.contentArea = document.getElementById('content-area');
        this.sectionTitle = document.getElementById('section-title');
        this.modal = document.getElementById('modal-container');
        this.html5QrcodeScanner = null;

        this.initLogin();
        this.initEventListeners();
        this.checkSession();
        this.setupActivityTracker();
    }

    checkSession() {
        if (this.dm.restoreSession()) {
            this.currentRole = this.dm.currentUser.role;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            const initial = this.dm.currentUser.full_name.split(' ').map(n => n[0]).join('').substring(0, 2);
            const avatarBtn = document.getElementById('user-avatar');
            if (avatarBtn) avatarBtn.textContent = initial;
            this.updateRoleUI();
        }
    }

    setupActivityTracker() {
        const updateActivity = () => {
            if (this.dm.currentUser) {
                localStorage.setItem('ft_last_activity', Date.now());
            }
        };
        ['click', 'touchstart', 'keypress', 'scroll'].forEach(evt => {
            document.addEventListener(evt, updateActivity, { passive: true });
        });

        // Proverava svake minute da li je isteklo
        setInterval(() => {
            if (this.dm.currentUser) {
                const lastAct = parseInt(localStorage.getItem('ft_last_activity') || '0', 10);
                if (Date.now() - lastAct > 5 * 60 * 1000) {
                    this.dm.logout();
                    alert("Sesija je istekla zbog neaktivnosti od 5 minuta.");
                    location.reload();
                }
            }
        }, 60000);
    }

    initLogin() {
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');

        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;

            const result = await this.dm.login(user, pass);
            if (result.success) {
                this.currentRole = this.dm.currentUser.role;
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('main-app').style.display = 'flex';

                const initial = this.dm.currentUser.full_name.split(' ').map(n => n[0]).join('').substring(0, 2);
                const avatarBtn = document.getElementById('user-avatar');
                if (avatarBtn) avatarBtn.textContent = initial;

                this.updateRoleUI();
            } else {
                loginError.textContent = result.message;
                loginError.classList.add('show');
            }
        };
    }

    initEventListeners() {
        document.querySelector('.nav-links').addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (li) {
                const section = li.dataset.section;
                this.setActiveNav(li);
                this.renderSection(section);
            }
        });

        document.getElementById('add-fuel-btn').addEventListener('click', () => {
            this.showFuelForm();
        });

        document.querySelector('.close-modal').addEventListener('click', () => {
            this.modal.classList.add('hidden');
            if (this.html5QrcodeScanner) {
                this.html5QrcodeScanner.clear();
                document.getElementById('qr-reader').style.display = 'none';
            }
        });

        document.getElementById('role-toggle').addEventListener('click', () => {
            if (confirm('Da li ste sigurni da želite da se odjavite?')) {
                this.dm.logout();
                location.reload();
            }
        });
    }

    updateRoleUI() {
        const navUsers = document.getElementById('nav-users');
        const navReports = document.getElementById('nav-reports');
        const addFuelBtn = document.getElementById('add-fuel-btn');

        if (this.currentRole === 'admin') {
            if (navUsers) navUsers.classList.remove('hidden');
            if (navReports) navReports.classList.remove('hidden');
            addFuelBtn.classList.remove('hidden');
            this.renderSection('dashboard');
            this.setActiveNav(document.querySelector('[data-section="dashboard"]'));
        } else {
            if (navUsers) navUsers.classList.add('hidden');
            if (navReports) navReports.classList.add('hidden');
            addFuelBtn.classList.remove('hidden');
            this.renderSection('fuel');
            this.setActiveNav(document.querySelector('[data-section="fuel"]'));
        }
    }

    setActiveNav(element) {
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        if (element) element.classList.add('active');
    }

    async renderSection(section) {
        this.contentArea.innerHTML = '<div class="loading-shimmer" style="padding:2rem;text-align:center;">Učitavam...</div>';

        switch (section) {
            case 'dashboard':
                await this.renderDashboard();
                break;
            case 'vehicles':
                await this.renderVehicles();
                break;
            case 'employees':
                await this.renderUsers();
                break;
            case 'reports':
                await this.renderReports();
                break;
            case 'fuel':
                await this.renderFuelLogs();
                break;
        }
    }

    async renderDashboard() {
        this.sectionTitle.textContent = 'Početna (Nadzorna Tabla)';
        const [vehicles, logs] = await Promise.all([
            this.dm.getData('vehicles'),
            this.dm.getData('fuel_logs')
        ]);

        let summaryHtml = `
            <div class="summary-cards">
                <div class="summary-card">
                    <h3>Ukupno Vozila</h3>
                    <div class="value">${vehicles.length}</div>
                </div>
                <div class="summary-card">
                    <h3>Broj Točenja</h3>
                    <div class="value">${logs.length}</div>
                </div>
            </div>
            
            <h3 style="margin-bottom:1rem; font-size:1.1rem;">Nedavna Točenja</h3>
        `;

        if (logs.length === 0) {
            summaryHtml += `<p style="color:var(--text-dim); text-align:center;">Nema podataka.</p>`;
        } else {
            summaryHtml += logs.slice(0, 5).map(log => {
                const vehicle = vehicles.find(v => v.id === log.vehicleId);
                const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate})` : `Vozilo ID: ${log.vehicleId}`;
                return `
                    <div class="data-card">
                        <div class="card-header">
                            <span class="card-title">${vehicleName}</span>
                            <span style="font-size: 0.8rem; color:var(--text-dim);">${new Date(log.date).toLocaleDateString()}</span>
                        </div>
                        <div class="card-body">
                            <div>Kilometraža: <strong>${log.km} km</strong></div>
                            <div>Količina: <strong style="color:var(--accent)">${log.liters} L</strong></div>
                            <div style="grid-column: span 2;">Cena: <strong>${(log.price * log.liters).toFixed(2)} RSD</strong></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        this.contentArea.innerHTML = summaryHtml;
    }

    async renderVehicles() {
        this.sectionTitle.textContent = 'Vozila';
        const [vehicles, users] = await Promise.all([
            this.dm.getData('vehicles'),
            this.dm.getData('users')
        ]);

        let html = ``;
        if (this.currentRole === 'admin') {
            html += `<button class="btn btn-primary" onclick="window.ui.showVehicleForm()" style="margin-bottom: 1rem;"><i class="fas fa-plus"></i> Dodaj Vozilo</button>`;
        }

        if (vehicles.length === 0) {
            html += `<p style="color:var(--text-dim); text-align:center;">Nema vozila.</p>`;
        } else {
            html += vehicles.map(v => {
                const u = users.find(usr => usr.id === v.userId);
                const userName = u ? u.full_name : 'Nije dodeljeno';

                const getStatus = (dateString) => {
                    const date = new Date(dateString);
                    const daysLeft = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
                    if (daysLeft < 0) return { text: 'Isteklo', badge: 'background: var(--danger);' };
                    if (daysLeft <= 30) return { text: 'Uskoro (<30d)', badge: 'background: var(--warning);' };
                    return { text: 'OK', badge: 'background: var(--accent);' };
                };
                const regStatus = getStatus(v.regExp);

                return `
                    <div class="data-card">
                        <div class="card-header">
                            <span class="card-title">${v.brand} ${v.model} (${v.plate})</span>
                            <span class="card-badge" style="color:#fff; ${regStatus.badge}">${regStatus.text}</span>
                        </div>
                        <div class="card-body">
                            <div>Zadužen: <strong>${userName}</strong></div>
                            <div>Reg: <strong>${new Date(v.regExp).toLocaleDateString()}</strong></div>
                            <div>Servis: <strong>${new Date(v.service).toLocaleDateString()}</strong></div>
                            <div>Gume: <strong>${new Date(v.tires).toLocaleDateString()}</strong></div>
                        </div>
                        ${this.currentRole === 'admin' ? `
                        <div class="card-actions">
                            <button class="btn btn-secondary" onclick="window.ui.showVehicleForm(${v.id})" style="padding: 0.5rem;"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger" onclick="window.ui.deleteVehicle(${v.id})" style="padding: 0.5rem;"><i class="fas fa-trash"></i></button>
                        </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }

        this.contentArea.innerHTML = html;
    }

    async renderUsers() {
        this.sectionTitle.textContent = 'Korisnici Sistem';
        const users = await this.dm.getData('users');

        let html = `<button class="btn btn-primary" onclick="window.ui.showUserForm()" style="margin-bottom: 1rem;"><i class="fas fa-plus"></i> Novi Korisnik</button>`;

        if (users.length === 0) {
            html += `<p style="color:var(--text-dim); text-align:center;">Nema korisnika.</p>`;
        } else {
            html += users.map(u => {
                const roleBadge = u.role === 'admin' ? '<span style="color:var(--warning)"><i class="fas fa-star"></i> Admin</span>' : 'Korisnik';
                return `
                    <div class="data-card">
                        <div class="card-header">
                            <span class="card-title">${u.full_name}</span>
                            <span style="font-size:0.8rem;">${roleBadge}</span>
                        </div>
                        <div class="card-body">
                            <div>Username: <strong>${u.username}</strong></div>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-secondary" onclick="window.ui.showUserForm(${u.id})" style="padding: 0.5rem;"><i class="fas fa-edit"></i></button>
                            ${u.id !== this.dm.currentUser.id ? `<button class="btn btn-danger" onclick="window.ui.deleteUser(${u.id})" style="padding: 0.5rem;"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
        this.contentArea.innerHTML = html;
    }

    async renderFuelLogs() {
        this.sectionTitle.textContent = 'Istorija Točenja';
        const [logs, vehicles] = await Promise.all([
            this.dm.getData('fuel_logs'),
            this.dm.getData('vehicles')
        ]);

        let html = ``;
        if (logs.length === 0) {
            html += `<p style="color:var(--text-dim); text-align:center;">Nema točenja u bazi.</p>`;
        } else {
            html += logs.map(log => {
                const v = vehicles.find(veh => veh.id === log.vehicleId);
                const vehicleName = v ? `${v.brand} ${v.model}` : `Vozilo ID: ${log.vehicleId}`;
                const hasQr = log.qrData ? `<span style="color:var(--primary); font-size:0.8rem;"><i class="fas fa-qrcode"></i> Skenirano</span>` : '';
                const hasImg = log.image ? `<br><a href="${log.image}" target="_blank" style="color:var(--accent);font-size:0.8rem;"><i class="fas fa-image"></i> Pogledaj račun</a>` : '';

                return `
                    <div class="data-card">
                        <div class="card-header">
                            <span class="card-title">${vehicleName} <span style="font-size:0.8rem;color:var(--text-dim)">(${v ? v.plate : ''})</span></span>
                            <span style="font-size: 0.8rem; color:var(--text-dim);">${new Date(log.date).toLocaleDateString()}</span>
                        </div>
                        <div class="card-body">
                            <div>Kilometraža: <strong>${log.km.toLocaleString()} km</strong></div>
                            <div>Cena: <strong>${log.price} RSD</strong></div>
                            <div style="grid-column: span 2;">
                                Količina i iznos: <strong style="color:var(--accent)">${log.liters} L (${(log.liters * log.price).toLocaleString()} RSD)</strong>
                            </div>
                            <div style="grid-column: span 2;">
                                ${hasQr} ${hasImg}
                            </div>
                        </div>
                        ${this.currentRole === 'admin' ? `
                        <div class="card-actions">
                            <button class="btn btn-danger" onclick="window.ui.deleteFuel(${log.id})" style="padding: 0.5rem;"><i class="fas fa-trash"></i></button>
                        </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
        this.contentArea.innerHTML = html;
    }

    async renderReports(filters = {}, activeTab = 'fuel') {
        this.sectionTitle.textContent = 'Menadžerski Izveštaji';

        // Tabs
        let tabsHtml = `
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <button class="btn ${activeTab === 'fuel' ? 'btn-primary' : 'btn-secondary'}" style="flex:1;" onclick="window.ui.renderReports({}, 'fuel')">Gorivo i Potrošnja</button>
                <button class="btn ${activeTab === 'warnings' ? 'btn-primary' : 'btn-secondary'}" style="flex:1;" onclick="window.ui.renderReports({}, 'warnings')">Isteci i Upozorenja</button>
            </div>
        `;

        if (activeTab === 'fuel') {
            const [vehicles, users, data] = await Promise.all([
                this.dm.getData('vehicles'),
                this.dm.getData('users'),
                this.dm.getReports(filters)
            ]);

            let filterHtml = `
                <div class="data-card" style="margin-bottom: 1rem;">
                    <div class="card-body" style="grid-template-columns: 1fr; gap: 0.5rem;">
                        <input type="month" id="filter-month" value="${filters.month_year || ''}" placeholder="Mesec" title="Odaberi mesec i godinu" style="padding: 0.5rem; background: var(--surface-light); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px;">
                        
                        <input type="text" id="filter-plate" list="plates-list" value="${filters.plate || ''}" placeholder="Pretraga po tablicama..." style="padding: 0.5rem; background: var(--surface-light); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px;">
                        <datalist id="plates-list">
                            ${vehicles.map(v => `<option value="${v.plate}">${v.brand} ${v.model}</option>`).join('')}
                        </datalist>

                        <input type="text" id="filter-user" list="users-list" value="${filters.username || ''}" placeholder="Pretraga po vozaču..." style="padding: 0.5rem; background: var(--surface-light); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px;">
                        <datalist id="users-list">
                            ${users.map(u => `<option value="${u.username}">${u.full_name}</option>`).join('')}
                        </datalist>

                        <button class="btn btn-primary" onclick="window.ui.applyReportFilters()" style="margin-top: 0.5rem;"><i class="fas fa-search"></i> Primeni filtere</button>
                    </div>
                </div>
            `;

            let summaryHtml = `
                <div class="summary-cards" style="margin-bottom: 1rem;">
                    <div class="summary-card">
                        <h3>Ukupno Litara</h3>
                        <div class="value">${data.summary.total_liters || '0.00'} L</div>
                    </div>
                    <div class="summary-card">
                        <h3>Dato za Gorivo</h3>
                        <div class="value">${data.summary.total_price || '0.00'} RSD</div>
                    </div>
                    ${data.summary.avg_consumption ? `
                    <div class="summary-card" style="grid-column: span 2;">
                        <h3>Prosečna Potrošnja</h3>
                        <div class="value" style="color:var(--accent)">${data.summary.avg_consumption} L/100km</div>
                    </div>` : ''}
                </div>
            `;

            let listHtml = '';
            if (data.logs.length === 0) {
                listHtml = `<p style="color:var(--text-dim); text-align:center;">Nema rezultata za date filtere.</p>`;
            } else {
                // Grupisemo logove po tablici
                let grouped = {};
                data.logs.forEach(log => {
                    if (!grouped[log.plate]) grouped[log.plate] = [];
                    grouped[log.plate].push(log);
                });

                listHtml = Object.keys(grouped).map((plate, index) => {
                    let vLogs = grouped[plate];
                    let firstLog = vLogs[0];
                    let vTCount = vLogs.length;
                    let vTLiters = vLogs.reduce((acc, l) => acc + parseFloat(l.liters), 0);
                    let vTPrice = vLogs.reduce((acc, l) => acc + parseFloat(l.price * l.liters), 0);
                    let vAvg = firstLog.vehicle_avg;

                    let detailedLogsHtml = vLogs.map(log => `
                        <div class="data-card" style="margin-top:0.5rem; background: var(--bg-main); border: 1px solid var(--border-color); box-shadow: none;">
                            <div class="card-header" style="border-bottom: 1px dashed var(--border-color); padding-bottom:0.5rem; display: flex; justify-content: space-between;">
                                <span style="font-size: 0.8rem; color:var(--text-dim);"><i class="far fa-calendar-alt"></i> ${new Date(log.fuel_date).toLocaleDateString()}</span>
                                <span style="font-size: 0.8rem;">Cena/L: <strong>${log.price}</strong> RSD</span>
                            </div>
                            <div class="card-body" style="padding-top:0.5rem;">
                                <div>Kilometraža: <strong>${log.km.toLocaleString()} km</strong></div>
                                <div>Količina: <strong style="color:var(--accent)">${log.liters} L</strong></div>
                                <div style="grid-column: span 2;">Uplaćeno: <strong>${(log.liters * log.price).toLocaleString()} RSD</strong></div>
                            </div>
                        </div>
                    `).join('');

                    return `
                        <div class="data-card" style="margin-bottom: 1rem; border: 2px solid var(--primary);">
                            <div class="card-header" style="cursor: pointer; background: var(--surface-light); border-radius: 8px; margin: -10px; padding: 10px; margin-bottom: 0px;" onclick="document.getElementById('tree-${index}').classList.toggle('hidden')">
                                <span class="card-title">🚗 ${firstLog.brand} ${firstLog.model} <span style="color:var(--text-dim); font-size:0.8rem;">(${plate})</span></span>
                                <span style="font-size: 0.8rem; color: var(--accent); background: var(--bg-main); padding: 5px 10px; border-radius: 12px;"><i class="fas fa-chevron-down"></i> Detalji (${vTCount})</span>
                            </div>
                            <div class="card-body" style="margin-top: 15px;">
                                <div style="grid-column: span 2;">Zadužen Vozač: <strong>${firstLog.full_name}</strong></div>
                                <div>Ukupno stalo: <strong>${vTLiters.toFixed(2)} L</strong></div>
                                <div>Odliv novca: <strong>${vTPrice.toLocaleString()} RSD</strong></div>
                                ${vAvg ? `<div style="grid-column: span 2;">Prosek u ovom bloku (Računajući KM): <strong style="color:var(--accent)">${vAvg} L/100km</strong></div>` : ''}
                            </div>
                            <div id="tree-${index}" class="hidden" style="padding-top: 1rem; border-top: 1px solid var(--border-color); margin-top: 1rem;">
                                <h4 style="margin-bottom: 0.5rem; color: var(--text-dim); font-size: 0.85rem;">Istorija Točenja za navedeni period:</h4>
                                ${detailedLogsHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            }
            this.contentArea.innerHTML = tabsHtml + filterHtml + summaryHtml + listHtml;
        } else {
            // Tab za Upozorenja
            const [vehicles, users] = await Promise.all([
                this.dm.getData('vehicles'),
                this.dm.getData('users')
            ]);

            const getDaysLeft = (dString) => Math.ceil((new Date(dString) - new Date()) / (1000 * 60 * 60 * 24));

            let warnings = [];
            vehicles.forEach(v => {
                const userName = users.find(u => u.id === v.userId)?.full_name || 'Nedodeljeno';
                const events = [
                    { type: 'Registracija', days: getDaysLeft(v.regExp), date: v.regExp },
                    { type: 'Servis', days: getDaysLeft(v.service), date: v.service },
                    { type: 'Promena Guma', days: getDaysLeft(v.tires), date: v.tires }
                ];

                events.forEach(ev => {
                    if (ev.days <= 30) {
                        warnings.push({
                            vehicle: `${v.brand} ${v.model} (${v.plate})`,
                            user: userName,
                            type: ev.type,
                            days: ev.days,
                            date: ev.date
                        });
                    }
                });
            });

            // Sortiranje po hitnosti
            warnings.sort((a, b) => a.days - b.days);

            let listHtml = '';
            if (warnings.length === 0) {
                listHtml = `<div class="data-card" style="text-align:center; padding: 2rem;"><p style="color:var(--success);">✅ Sva vozila su ažurna. Nema skorijih isteka registracija i servisa!</p></div>`;
            } else {
                listHtml = warnings.map(w => {
                    let badge = '';
                    if (w.days < 0) badge = `<span class="card-badge" style="background:var(--danger);color:#fff">Isteklo (${Math.abs(w.days)} dana)</span>`;
                    else if (w.days <= 15) badge = `<span class="card-badge" style="background:var(--danger);color:#fff">Kritično (${w.days} dana)</span>`;
                    else badge = `<span class="card-badge" style="background:var(--warning);color:#fff">Uskoro (${w.days} dana)</span>`;

                    return `
                        <div class="data-card" style="border-left: 4px solid ${w.days <= 15 ? 'var(--danger)' : 'var(--warning)'}; margin-bottom: 0.5rem;">
                            <div class="card-header">
                                <span class="card-title">${w.vehicle}</span>
                                ${badge}
                            </div>
                            <div class="card-body">
                                <div>Vozač: <strong>${w.user}</strong></div>
                                <div>Upozorenje: <strong><i class="fas fa-exclamation-triangle" style="color: ${w.days <= 15 ? 'var(--danger)' : 'var(--warning)'};"></i> ${w.type}</strong></div>
                                <div style="grid-column: span 2;">Datum isteka: <strong>${new Date(w.date).toLocaleDateString()}</strong></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            this.contentArea.innerHTML = tabsHtml + listHtml;
        }
    }

    applyReportFilters() {
        const filters = {
            month_year: document.getElementById('filter-month').value,
            plate: document.getElementById('filter-plate').value,
            username: document.getElementById('filter-user').value
        };
        this.renderReports(filters, 'fuel');
    }

    async deleteVehicle(id) { await this.dm.deleteItem('vehicles', id) && await this.renderSection('vehicles'); }
    async deleteUser(id) { await this.dm.deleteItem('users', id) && await this.renderSection('employees'); }
    async deleteFuel(id) { await this.dm.deleteItem('fuel_logs', id) && await this.renderSection('fuel'); }

    async showVehicleForm(id = null) {
        let vEdit = null;
        const users = await this.dm.getData('users');

        if (id) {
            const all = await this.dm.getData('vehicles');
            vEdit = all.find(v => v.id === id);
        }
        const modalBody = document.getElementById('modal-body');
        document.getElementById('modal-title').textContent = vEdit ? 'Izmeni Vozilo' : 'Dodaj Novo Vozilo';
        document.getElementById('scan-qr-btn').classList.add('hidden');

        const fmtDate = (dString) => dString ? new Date(dString).toISOString().split('T')[0] : '';
        modalBody.innerHTML = `
            <form id="vehicle-form">
                <div class="form-group"><label>Marka</label><input type="text" id="v-brand" required value="${vEdit ? vEdit.brand : ''}"></div>
                <div class="form-group"><label>Model</label><input type="text" id="v-model" required value="${vEdit ? vEdit.model : ''}"></div>
                <div class="form-group"><label>Tablice</label><input type="text" id="v-plate" required value="${vEdit ? vEdit.plate : ''}"></div>
                <div class="form-group"><label>Registracija ističe</label><input type="date" id="v-regExp" required value="${fmtDate(vEdit ? vEdit.regExp : '')}"></div>
                <div class="form-group"><label>Sledeći Servis</label><input type="date" id="v-service" required value="${fmtDate(vEdit ? vEdit.service : '')}"></div>
                <div class="form-group"><label>Zamena Guma</label><input type="date" id="v-tires" required value="${fmtDate(vEdit ? vEdit.tires : '')}"></div>
                <div class="form-group"><label>Dodeli Korisniku</label>
                    <select id="v-user">
                        <option value="">Nije dodeljeno</option>
                        ${users.map(u => `<option value="${u.id}" ${vEdit && vEdit.userId === u.id ? 'selected' : ''}>${u.full_name}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Sačuvaj</button>
            </form>
        `;

        this.modal.classList.remove('hidden');

        document.getElementById('vehicle-form').onsubmit = async (e) => {
            e.preventDefault();
            const vehicle = {
                brand: document.getElementById('v-brand').value,
                model: document.getElementById('v-model').value,
                plate: document.getElementById('v-plate').value,
                regExp: document.getElementById('v-regExp').value,
                service: document.getElementById('v-service').value,
                tires: document.getElementById('v-tires').value,
                userId: document.getElementById('v-user').value || null
            };

            if (vEdit) await this.dm.updateItem('vehicles', vEdit.id, vehicle);
            else await this.dm.addItem('vehicles', vehicle);

            this.modal.classList.add('hidden');
            await this.renderSection('vehicles');
        };
    }

    async showUserForm(id = null) {
        let uEdit = null;
        if (id) {
            const all = await this.dm.getData('users');
            uEdit = all.find(u => u.id === id);
        }
        const modalBody = document.getElementById('modal-body');
        document.getElementById('modal-title').textContent = uEdit ? 'Izmeni Korisnika' : 'Dodaj Novog Korisnika';
        document.getElementById('scan-qr-btn').classList.add('hidden');

        modalBody.innerHTML = `
            <form id="user-form">
                <div class="form-group"><label>Puno Ime i Prezime</label><input type="text" id="u-fullname" required value="${uEdit ? uEdit.full_name : ''}"></div>
                <div class="form-group"><label>Korisničko Ime (Login)</label><input type="text" id="u-username" required value="${uEdit ? uEdit.username : ''}"></div>
                <div class="form-group"><label>${uEdit ? 'Nova Lozinka (ostavi prazno)' : 'Lozinka'}</label><input type="password" id="u-password" ${uEdit ? '' : 'required'}></div>
                <div class="form-group"><label>Rola</label>
                    <select id="u-role">
                        <option value="user" ${uEdit && uEdit.role === 'user' ? 'selected' : ''}>Korisnik (Vozač)</option>
                        <option value="admin" ${uEdit && uEdit.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Sačuvaj</button>
            </form>
        `;

        this.modal.classList.remove('hidden');

        document.getElementById('user-form').onsubmit = async (e) => {
            e.preventDefault();
            const user = {
                full_name: document.getElementById('u-fullname').value,
                username: document.getElementById('u-username').value,
                role: document.getElementById('u-role').value,
                password: document.getElementById('u-password').value || undefined
            };

            if (uEdit) await this.dm.updateItem('users', uEdit.id, user);
            else {
                const res = await this.dm.addItem('users', user);
                if (res.error) { alert(res.error); return; }
            }

            this.modal.classList.add('hidden');
            await this.renderSection('employees');
        };
    }

    async showFuelForm() {
        const vehicles = await this.dm.getData('vehicles');
        const modalBody = document.getElementById('modal-body');
        document.getElementById('modal-title').textContent = 'Novo Točenje Goriva';

        // QR Btn setup
        const scanBtn = document.getElementById('scan-qr-btn');
        scanBtn.classList.remove('hidden');

        modalBody.innerHTML = `
            <form id="fuel-form">
                <input type="hidden" id="f-qrdata" value="">
                <div class="form-group">
                    <label>Izaberi Vozilo</label>
                    <select id="f-vehicle" required>
                        ${vehicles.map(v => `<option value="${v.id}">${v.brand} ${v.plate}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Kilometraža vozila</label>
                    <input type="number" id="f-km" required>
                </div>
                <div style="display:flex; gap:10px;">
                    <div class="form-group" style="flex:1;">
                        <label>Litri (l)</label>
                        <input type="number" step="0.01" id="f-liters" required>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Cena po L</label>
                        <input type="number" step="0.1" id="f-price" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Datum</label>
                    <input type="date" id="f-date" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label>Slika računa (Opciono)</label>
                    <input type="file" id="f-image" accept="image/*" capture="environment" style="background:transparent; border:none; padding:0;">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:1rem;">Sačuvaj Unos</button>
            </form>
        `;

        this.modal.classList.remove('hidden');

        // QR Skener Listener
        scanBtn.onclick = () => {
            const qrReader = document.getElementById('qr-reader');
            qrReader.style.display = 'block';
            this.html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
            this.html5QrcodeScanner.render((decodedText, decodedResult) => {
                document.getElementById('f-qrdata').value = decodedText;
                alert('QR kod uspešno skeniran!');
                this.html5QrcodeScanner.clear();
                qrReader.style.display = 'none';

                // Pokusaj parsiranja PFR kodova sa srpskih racuna ako postoji logika (mock ovde)
                // Npr. "cena:185, litara:45..." (Ako bi imali poseban URL parser, ovde bismo popunili f-price i f-liters)

            }, (errorMessage) => {
                // ignorisemo dok ne uslika
            });
        };

        document.getElementById('fuel-form').onsubmit = async (e) => {
            e.preventDefault();
            const log = {
                vehicleId: document.getElementById('f-vehicle').value,
                km: parseInt(document.getElementById('f-km').value),
                liters: parseFloat(document.getElementById('f-liters').value),
                price: parseFloat(document.getElementById('f-price').value),
                date: document.getElementById('f-date').value,
                qrData: document.getElementById('f-qrdata').value
            };
            const imageFile = document.getElementById('f-image').files[0];

            await this.dm.addItem('fuel_logs', log, imageFile);

            if (this.html5QrcodeScanner) this.html5QrcodeScanner.clear();
            this.modal.classList.add('hidden');
            document.getElementById('qr-reader').style.display = 'none';
            await this.renderSection('fuel');
        };
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const dm = new DataManager();
    window.ui = new UIManager(dm);
});
