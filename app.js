// Constants & Initial Data
    const DEFAULT_SLOTS = ['08.00–10.00', '11.00–13.00', '14.00–16.00', '17.00–19.00'];
    const LEGACY_SLOTS = ['08.00–10.00', '10.00–12.00', '13.00–15.00', '15.00–17.00'];
    let SLOTS = DEFAULT_SLOTS.slice();
    
    let ROOMS = [
      { id: 'r1', name: 'Ruang Kelas 301', cap: 40, fac: 'Proyektor, AC, papan tulis', slots: DEFAULT_SLOTS.slice() },
      { id: 'r2', name: 'Lab Komputer 1', cap: 30, fac: '30 PC, AC, proyektor', slots: DEFAULT_SLOTS.slice() },
      { id: 'r3', name: 'Ruang Diskusi B', cap: 12, fac: 'Meja bundar, TV layar lebar', slots: DEFAULT_SLOTS.slice() },
      { id: 'r4', name: 'Aula Utama', cap: 200, fac: 'Panggung, sound system', slots: DEFAULT_SLOTS.slice() },
      { id: 'r5', name: 'Lab Jaringan', cap: 24, fac: 'Rak server, switch, AC', slots: DEFAULT_SLOTS.slice() }
    ];

    const USERS = [
      { u: '2024001', p: 'mhs123', role: 'mhs', name: 'Raka Pratama' },
      { u: 'admin', p: 'admin123', role: 'admin', name: 'Admin Akademik' }
    ];

    const LBL = {
      pending: 'Menunggu',
      approved: 'Disetujui',
      rejected: 'Ditolak'
    };

    // Helper Functions
    const $ = s => document.querySelector(s);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const JAKARTA_TZ = 'Asia/Jakarta';
    const jakartaParts = () => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: JAKARTA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    };
    const today = () => {
      const p = jakartaParts();
      return `${p.year}-${p.month}-${p.day}`;
    };
    const isPastSlot = (dateValue, slotValue) => {
      if (!dateValue || !slotValue) return false;
      if (dateValue < today()) return true;
      if (dateValue > today()) return false;
      const now = jakartaParts();
      const start = slotValue.split('–')[0];
      const startMinutes = toMinutes(start);
      const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
      return startMinutes <= currentMinutes;
    };
    const fmt = d => new Date(d + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const formatSubmittedAt = value => {
      if (!value) return 'Waktu pengajuan tidak tersedia (data lama).';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'Waktu pengajuan tidak tersedia.';
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: JAKARTA_TZ,
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(date) + ' WIB';
    };
    const room = id => ROOMS.find(r => r.id === id) || { name: 'Ruangan dihapus', cap: 0, fac: '-', slots: [] };
    const roomSlots = id => (room(id).slots || DEFAULT_SLOTS).slice().sort((a,b) => toMinutes(a.split('–')[0]) - toMinutes(b.split('–')[0]));
    const toMinutes = t => { const [h,m] = t.replace('.', ':').split(':').map(Number); return h * 60 + m; };
    const bookingSlot = b => b.slotTime || (typeof b.slot === 'string' ? b.slot : (LEGACY_SLOTS[b.slot] || 'Jadwal lama'));
    function hasOneHourBreak(slots) {
      const ranges = slots.map(label => { const [a,z] = label.split('–'); return [toMinutes(a), toMinutes(z), label]; }).sort((a,b) => a[0]-b[0]);
      for (let i=0; i<ranges.length; i++) {
        if (ranges[i][0] >= ranges[i][1]) return false;
        if (i && ranges[i][0] - ranges[i-1][1] < 60) return false;
      }
      return true;
    }

    // LocalStorage Operations
    function load() {
      try {
        const d = JSON.parse(localStorage.getItem('pinjamruang-v1'));
        if (Array.isArray(d)) return d;
      } catch (e) {}
      return null;
    }

    function save() {
      try {
        localStorage.setItem('pinjamruang-v1', JSON.stringify(S.b));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ rooms: ROOMS }));
      } catch (e) {}
    }
    function saveSettings() {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ rooms: ROOMS })); }
      catch (e) { alert('Penyimpanan browser penuh atau tidak tersedia.'); }
    }

    const seed = () => [
      { id: 1, nim: '2024017', name: 'Dina Safitri', room: 'r2', date: today(), slot: 1, slotTime: '11.00–13.00', purpose: 'Latihan praktikum Basis Data bersama kelompok.', status: 'approved', note: '' },
      { id: 2, nim: '2024033', name: 'Bima Nugraha', room: 'r3', date: today(), slot: 2, slotTime: '14.00–16.00', purpose: 'Rapat persiapan lomba karya tulis ilmiah tingkat nasional.', status: 'pending', note: '' }
    ];

    // Application State
    const SETTINGS_KEY = 'pinjamruang-settings-v1';
    function loadSettings() {
      try {
        const data = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (data && Array.isArray(data.rooms)) return data;
      } catch (e) {}
      return null;
    }
    const savedSettings = loadSettings();
    if (savedSettings) { ROOMS = savedSettings.rooms.map(r => ({ ...r, slots: Array.isArray(r.slots) ? r.slots : DEFAULT_SLOTS.slice() })); }
    let editingRoomId = null;

    const S = {
      user: null,
      registerMode: false,
      b: load() || seed(),
      tab: 'rooms',
      room: null,
      date: today(),
      slot: null,
      purpose: '',
      unavail: false,
      sel: null,
      historySel: null,
      toast: '',
      err: ''
    };

    save();
    saveSettings();

    window.addEventListener('storage', () => {
      const d = load();
      if (d) {
        S.b = d;
        render();
      }
    });

    // State Helper Calculations
    const taken = (r, d, s) => S.b.some(b => b.room === r && b.date === d && bookingSlot(b) === s && b.status !== 'rejected');
    const mine = () => S.b.filter(b => b.nim === S.user.u).sort((a, b) => b.id - a.id);
    const pend = () => S.b.filter(b => b.status === 'pending');

    // Actions
    function say(t) {
      S.toast = t;
      render();
      setTimeout(() => {
        S.toast = '';
        render();
      }, 2600);
    }

    function login(e) {
      e.preventDefault();
      const u = $('#u').value.trim();
      const p = $('#p').value;
      const f = USERS.find(x => x.u === u && x.p === p);
      
      if (!f) {
        S.err = 'Login gagal. Periksa kembali NIM/username dan kata sandi.';
        render();
        return;
      }
      
      S.err = '';
      S.user = f;
      S.tab = f.role === 'admin' ? 'queue' : 'rooms';
      S.registerMode = false;
      S.sel = null;
      render();
    }

    function register(e) {
      e.preventDefault();
      const nim = $('#regNim').value.trim();
      const name = $('#regName').value.trim();
      const pass = $('#regPass').value;
      if (USERS.some(x => x.u === nim)) {
        S.err = 'NIM/username sudah terdaftar.';
        render();
        return;
      }
      const account = { u: nim, p: pass, role: 'mhs', name };
      USERS.push(account);
      S.user = account;
      S.err = '';
      S.tab = 'rooms';
      render();
      say('Registrasi berhasil. Selamat datang!');
    }

    function showRegister() {
      S.err = '';
      S.registerMode = true;
      render();
    }

    function showLogin() {
      S.err = '';
      S.registerMode = false;
      render();
    }

    function logout() {
      S.user = null;
      S.room = null;
      S.slot = null;
      S.unavail = false;
      S.purpose = '';
      render();
    }

    function pickRoom(id) {
      S.room = id;
      S.slot = null;
      S.unavail = false;
      render();
    }

    function pickDate(v) {
      S.date = v || today();
      S.slot = null;
      S.unavail = false;
      render();
    }

    function pickSlot(i) {
      if (isPastSlot(S.date, i)) {
        S.slot = i;
        S.unavail = true;
        render();
        return;
      }
      S.slot = i;
      S.unavail = taken(S.room, S.date, i);
      render();
    }

    function kirim(e) {
      e.preventDefault();
      const purpose = S.purpose.trim();
      if (!purpose) return;

      if (isPastSlot(S.date, S.slot)) {
        S.unavail = true;
        render();
        say('Tidak bisa mengajukan jadwal yang waktu mulainya sudah lewat. Pilih jam setelah waktu sekarang.');
        return;
      }
      
      if (taken(S.room, S.date, S.slot)) {
        S.unavail = true;
        render();
        return;
      }
      
      const submittedAt = new Date().toISOString();
      S.b.push({
        id: Date.now(),
        submittedAt,
        nim: S.user.u,
        name: S.user.name,
        room: S.room,
        date: S.date,
        slot: S.slot,
        slotTime: S.slot,
        purpose,
        extraFac: ($('#extraFac') ? $('#extraFac').value.trim() : ''),
        extraReason: ($('#extraReason') ? $('#extraReason').value.trim() : ''),
        participants: Number($('#participantCount') ? $('#participantCount').value : 1),
        status: 'pending',
        note: ''
      });
      
      save();
      S.room = null;
      S.slot = null;
      S.purpose = '';
      S.unavail = false;
      S.tab = 'status';
      say('Pengajuan terkirim. Admin sudah mendapat notifikasi.');
    }

    function decide(id, st) {
      const b = S.b.find(x => x.id === id);
      if (!b) return;
      
      const n = $('#nt');
      b.status = st;
      b.note = n ? n.value.trim() : '';
      save();
      S.sel = null;
      say(st === 'approved' ? 'Peminjaman disetujui.' : 'Peminjaman ditolak.');
    }

    function saveRoom(e) {
      e.preventDefault();
      const name = $('#roomName').value.trim();
      const cap = Number($('#roomCap').value);
      const facilities = $('#roomFacilities').value.trim();
      const schedule = editingRoomId ? room(editingRoomId).slots.slice() : DEFAULT_SLOTS.slice();
      if (!name || !facilities || cap < 1) return;
      if (!schedule.length || !hasOneHourBreak(schedule)) { say('Jadwal harus memiliki jeda minimal 1 jam setelah setiap sesi.'); return; }
      if (editingRoomId) {
        const r = room(editingRoomId);
        Object.assign(r, { name, cap, fac: facilities, slots: schedule });
      } else {
        ROOMS.push({ id: 'r' + Date.now(), name, cap, fac: facilities, slots: schedule });
      }
      editingRoomId = null;
      saveSettings();
      render();
      say('Data ruangan berhasil disimpan.');
    }

    function editRoom(id) {
      editingRoomId = id;
      render();
    }

    function cancelEditRoom() {
      editingRoomId = null;
      render();
    }

    function deleteRoom(id) {
      const used = S.b.some(b => b.room === id && b.status !== 'rejected');
      if (used) { say('Ruangan tidak dapat dihapus karena masih memiliki data peminjaman aktif/riwayat.'); return; }
      if (!confirm('Hapus ruangan ini?')) return;
      ROOMS = ROOMS.filter(r => r.id !== id);
      saveSettings();
      render();
      say('Ruangan berhasil dihapus.');
    }

    function addRoomSlot(roomId) {
      const start = $('#roomSlotStart').value;
      const end = $('#roomSlotEnd').value;
      if (!start || !end) { say('Isi jam mulai dan jam selesai terlebih dahulu.'); return; }
      const label = start.replace(':','.') + '–' + end.replace(':','.');
      const r = room(roomId);
      const proposed = [...r.slots, label];
      if (toMinutes(start) >= toMinutes(end)) { say('Jam selesai harus setelah jam mulai.'); return; }
      if (r.slots.includes(label)) { say('Rentang waktu tersebut sudah ada.'); return; }
      if (!hasOneHourBreak(proposed)) { say('Jadwal bertabrakan atau jeda antar-sesi kurang dari 1 jam.'); return; }
      r.slots = proposed;
      saveSettings();
      render();
      say('Jam tersedia berhasil ditambahkan ke ruangan.');
    }

    function removeRoomSlot(roomId, label) {
      const used = S.b.some(b => b.room === roomId && bookingSlot(b) === label && b.status !== 'rejected');
      if (used) { say('Jam tidak dapat dihapus karena sudah digunakan dalam pengajuan.'); return; }
      const r = room(roomId);
      r.slots = r.slots.filter(s => s !== label);
      saveSettings();
      render();
      say('Jam tersedia berhasil dihapus.');
    }

    function checkNew() {
      const d = load();
      if (d) S.b = d;
      say(pend().length ? pend().length + ' permohonan menunggu keputusan.' : 'Belum ada permohonan baru.');
    }

    function tab(t) {
      S.tab = t;
      S.sel = null;
      render();
    }

    // Views / Components
    function head() {
      const a = S.user.role === 'admin';
      return `
        <header class="top">
          <div class="logo"><i>P</i>PinjamRuang</div>
          <div class="sp"></div>
          <div class="live-clock" aria-live="off">
            <span class="clock-label">Waktu sekarang</span>
            <b id="liveClock">--:--:--</b>
            <small id="liveDate"></small>
          </div>
          <div class="who">
            <b>${esc(S.user.name)}</b>
            ${a ? 'Panel admin' : 'Mahasiswa · ' + esc(S.user.u)}
          </div>
          <button class="btn" onclick="logout()">Keluar</button>
        </header>
      `;
    }

    function loginView() {
      if (S.registerMode) {
        return `
          <main class="login">
            <section class="hero">
              <div class="logo" style="margin-bottom:22px"><i>P</i>PinjamRuang</div>
              <h1>Buat akun mahasiswa.</h1>
              <p class="sub">Daftar menggunakan NIM dan nama agar bisa mengajukan peminjaman ruangan kampus.</p>
            </section>
            <form class="panel" onsubmit="register(event)">
              <h2>Register Mahasiswa</h2>
              <label for="regNim">NIM</label><input id="regNim" required autocomplete="username">
              <label for="regName">Nama lengkap</label><input id="regName" required>
              <label for="regPass">Kata sandi</label><input id="regPass" type="password" minlength="4" required autocomplete="new-password">
              ${S.err ? `<div class="note bad" role="alert">${esc(S.err)}</div>` : ''}
              <div class="row"><button class="btn p" style="width:100%">Daftar</button></div>
              <p class="demo">Sudah punya akun? <button type="button" class="btn" onclick="showLogin()">Login</button></p>
            </form>
          </main>`;
      }
      return `
        <main class="login">
          <section class="hero">
            <div class="logo" style="margin-bottom:22px"><i>P</i>PinjamRuang</div>
            <h1>Pinjam ruang kampus lebih cepat dengan web.</h1>
            <p class="sub">Pilih ruangan, tentukan sesi, kirim pengajuan. Statusnya bisa kamu pantau langsung.</p>
          </section>
          <form class="panel" onsubmit="login(event)">
            <h2>Login</h2>
            <label for="u">NIM atau username</label><input id="u" autocomplete="username" required>
            <label for="p">Kata sandi</label><input id="p" type="password" autocomplete="current-password" required>
            ${S.err ? `<div class="note bad" role="alert">${S.err}</div>` : ''}
            <div class="row"><button class="btn p" style="width:100%">Masuk</button></div>
            <p class="demo">Belum punya akun? <button type="button" class="btn" onclick="showRegister()">Register</button><br><br>
              Akun admin demo: <code>admin</code> / <code>admin123</code></p>
          </form>
        </main>`;
    }

    function studentView() {
      const m = mine();
      let h = `
        <div class="wrap">
          <h1>Halo, ${esc(S.user.name.split(' ')[0])}</h1>
          <p class="sub">Ruangan mana yang kamu butuhkan hari ini?</p>
          
          <div class="tabs" role="tablist">
            <button class="tab" role="tab" aria-selected="${S.tab === 'rooms'}" onclick="tab('rooms')">Ruangan tersedia</button>
            <button class="tab" role="tab" aria-selected="${S.tab === 'status'}" onclick="tab('status')">
              Status pengajuan<span class="badge">${m.length}</span>
            </button>
          </div>
      `;

      if (S.tab === 'rooms') {
        h += `
          <div class="grid">
            <div>
              <h2>Pilih ruangan</h2>
              <div class="rooms">
                ${ROOMS.map(r => `
                  <button class="room" aria-pressed="${S.room === r.id}" onclick="pickRoom('${r.id}')">
                    <span>
                      <b>${r.name}</b>
                      <small>${r.fac}</small>
                    </span>
                    <span class="cap">${r.cap}<small>kursi</small></span>
                  </button>
                `).join('')}
              </div>
            </div>
            
            <div class="panel">
              <h2>Jadwal dan pengajuan</h2>
        `;

        if (!S.room) {
          h += `<div class="empty">Pilih ruangan di sebelah kiri untuk melihat sesi yang kosong.</div>`;
        } else {
          h += `
            <p style="margin:0;font-weight:700">${room(S.room).name}</p>
            <p class="hint">Fasilitas tersedia:</p>
            <div class="facility-list">${room(S.room).fac.split(',').map(x => `<span class="facility-chip">${esc(x.trim())}</span>`).join('')}</div>
            <label for="dt">Tanggal</label>
            <input id="dt" type="date" min="${today()}" value="${S.date}" onchange="pickDate(this.value)">
            
            <label>Sesi waktu</label>
            <div class="slots">
              ${roomSlots(S.room).map((s, i) => {
                const t = taken(S.room, S.date, s);
                const past = isPastSlot(S.date, s);
                const unavailable = t || past;
                return `
                  <button class="slot${unavailable ? ' x' : ''}" aria-pressed="${S.slot === s}" ${unavailable ? 'disabled' : ''} onclick="pickSlot('${s}')">
                    ${s}<small>${past ? 'Waktu sudah lewat' : t ? 'Sudah terisi' : 'Kosong'}</small>
                  </button>
                `;
              }).join('')}
            </div>
          `;

          if (S.slot !== null && S.unavail) {
            h += `<div class="note bad" role="alert">Jadwal ini sudah lewat atau sudah terisi. Pilih jam lain yang masih tersedia.</div>`;
          }

          if (S.slot !== null && !S.unavail) {
            h += `
              <form onsubmit="kirim(event)">
                <div class="note good">Tersedia: ${fmt(S.date)}, ${S.slot}</div>
                <label for="extraFac">Fasilitas tambahan yang ingin digunakan (opsional)</label>
                <input id="extraFac" placeholder="Contoh: kabel HDMI, mikrofon, papan tambahan">
                <label for="extraReason">Keterangan fasilitas tambahan</label>
                <textarea id="extraReason" placeholder="Jelaskan fasilitas tambahan digunakan untuk apa"></textarea>
                <label for="participantCount">Jumlah peserta</label>
                <input id="participantCount" type="number" min="1" max="${room(S.room).cap}" required placeholder="Maksimal ${room(S.room).cap} orang">
                <label for="pp">Tujuan peminjaman</label>
                <textarea id="pp" required placeholder="Contoh: Kerja kelompok mata kuliah Rekayasa Perangkat Lunak" oninput="S.purpose=this.value">${esc(S.purpose)}</textarea>
                <div class="row">
                  <button class="btn p">Kirim pengajuan</button>
                </div>
              </form>
            `;
          }
        }
        h += `</div></div>`;
      } else {
        h += m.length 
          ? `<div class="list">
              ${m.map(b => `
                <div class="item">
                  <span>
                    <b>${room(b.room).name}</b>
                    <small>${fmt(b.date)} · ${bookingSlot(b)}</small>
                    <small class="submission-time">Diajukan pada: ${formatSubmittedAt(b.submittedAt)}</small>
                    <small>${esc(b.purpose)}</small>
                    ${b.participants ? `<small>Jumlah peserta: ${b.participants} orang</small>` : ''}
                    ${b.extraFac ? `<small>Fasilitas tambahan: ${esc(b.extraFac)}${b.extraReason ? ' — ' + esc(b.extraReason) : ''}</small>` : ''}
                    ${b.note ? `<small>Catatan admin: ${esc(b.note)}</small>` : ''}
                  </span>
                  <span class="st ${b.status}">${b.status === 'approved' ? 'Peminjaman disetujui' : b.status === 'rejected' ? 'Peminjaman ditolak' : 'Menunggu admin'}</span>
                </div>
              `).join('')}
            </div>`
          : `<div class="empty">Kamu belum pernah mengajukan peminjaman. Pilih ruangan di tab Ruangan tersedia.</div>`;
      }
      return h + '</div>';
    }

    function adminView() {
      if (S.tab === 'manageRooms') return `<div class="wrap"><h1>Kelola ruangan</h1><p class="sub">Tambah, ubah, atau hapus ruangan beserta fasilitasnya.</p><div class="tabs"><button class="tab" onclick="tab('queue')">Permohonan</button><button class="tab" aria-selected="true" onclick="tab('manageRooms')">Kelola ruangan</button></div>${roomManagementView()}</div>`;

      const p = pend();
      const done = S.b.filter(b => b.status !== 'pending').sort((a, b) => b.id - a.id);
      const cnt = s => S.b.filter(b => b.status === s).length;
      let h = `<div class="wrap">
        <h1>Dasbor admin</h1><p class="sub">Tinjau permohonan yang masuk dan putuskan satu per satu.</p>
        <div class="tabs" role="tablist">
          <button class="tab" aria-selected="true" onclick="tab('queue')">Permohonan</button>
          <button class="tab" onclick="tab('manageRooms')">Kelola ruangan</button>
          
        </div>
        <div class="stats">
          <div class="stat"><b>${cnt('pending')}</b><span>Menunggu</span></div>
          <div class="stat"><b>${cnt('approved')}</b><span>Disetujui</span></div>
          <div class="stat"><b>${cnt('rejected')}</b><span>Ditolak</span></div>
        </div>
        <div class="grid"><div><h2>Antrean permohonan</h2>`;
      h += p.length ? `<div class="list">${p.map(b => `
        <button class="item" aria-pressed="${S.sel === b.id}" onclick="S.sel=${b.id};S.historySel=null;render()"><span><b>${esc(b.name)}</b><small>${room(b.room).name} · ${bookingSlot(b)}</small><small>${fmt(b.date)}</small></span><span class="st pending">Menunggu</span></button>
      `).join('')}</div>` : `<div class="empty">Tidak ada permohonan baru.<div class="row" style="justify-content:center"><button class="btn" onclick="checkNew()">Cek berkala</button></div></div>`;
      if (p.length) h += `<div class="row"><button class="btn" onclick="checkNew()">Cek permohonan baru</button></div>`;
      if (done.length) h += `<h2 style="margin-top:28px">Riwayat keputusan</h2><div class="list">${done.slice(0,6).map(b => `<button type="button" class="item history-item" aria-pressed="${S.historySel === b.id}" onclick="S.historySel=${b.id};S.sel=null;render()"><span><b>${esc(b.name)}</b><small>${room(b.room).name} · ${bookingSlot(b)}</small></span><span class="st ${b.status}">${LBL[b.status]}</span></button>`).join('')}</div>`;
      h += `</div><div class="panel"><h2>${S.historySel ? 'Detail riwayat peminjaman' : 'Detail permohonan'}</h2>`;
      const historyBooking = S.b.find(x => x.id === S.historySel && x.status !== 'pending');
      const b = S.b.find(x => x.id === S.sel && x.status === 'pending');
      if (historyBooking) {
        h += `<div class="history-detail">
          <p class="sub" style="margin:0 0 12px">Informasi peminjaman yang dipilih dari riwayat keputusan.</p>
          <label>Yang ingin meminjam</label>
          <div><b>${esc(historyBooking.name || 'Nama tidak tersedia')}</b> (${esc(historyBooking.nim || 'NIM tidak tersedia')})</div>
          <label>Ruangan dan jadwal</label>
          <div>${esc(room(historyBooking.room).name)}<br>${fmt(historyBooking.date)}, ${bookingSlot(historyBooking)}</div>
          <label>Waktu pengajuan dikirim</label>
          <div>${formatSubmittedAt(historyBooking.submittedAt)}</div>
          <label>Fasilitas tambahan yang ingin digunakan</label>
          <div>${historyBooking.extraFac ? esc(historyBooking.extraFac) : 'Tidak ada fasilitas tambahan yang diminta.'}</div>
          ${historyBooking.extraReason ? `<label>Keterangan penggunaan fasilitas tambahan</label><div>${esc(historyBooking.extraReason)}</div>` : ''}
          <label>Alasan / tujuan peminjaman</label>
          <div>${historyBooking.purpose ? esc(historyBooking.purpose) : 'Tidak ada alasan yang dicatat.'}</div>
          <label>Jumlah peserta</label>
          <div>${historyBooking.participants ? esc(historyBooking.participants) + ' orang' : 'Tidak dicantumkan pada pengajuan lama.'}</div>
          <label>Status keputusan</label>
          <div><span class="st ${historyBooking.status}">${LBL[historyBooking.status]}</span></div>
          ${historyBooking.note ? `<label>Catatan admin</label><div>${esc(historyBooking.note)}</div>` : ''}
        </div>`;
      } else if (!b) h += `<div class="empty">Pilih permohonan dari antrean atau salah satu riwayat keputusan untuk melihat detail peminjaman.</div>`;
      else {
        const bentrok = S.b.some(x => x.id !== b.id && x.room === b.room && x.date === b.date && bookingSlot(x) === bookingSlot(b) && x.status === 'approved');
        const ok1 = !bentrok, ok2 = b.date >= today(), ok3 = b.purpose.length >= 10;
        h += `<p style="margin:0"><b>${esc(b.name)}</b> (${esc(b.nim)})</p><p class="sub" style="margin:4px 0 0">${room(b.room).name}<br>${fmt(b.date)}, ${bookingSlot(b)}</p>
          <label>Waktu pengajuan dikirim</label><div>${formatSubmittedAt(b.submittedAt)}</div>
          <label>Tujuan</label><div>${esc(b.purpose)}</div><label>Jumlah peserta</label><div>${b.participants || '-'} orang</div>
          <label>Fasilitas tambahan yang diminta</label><div>${b.extraFac ? esc(b.extraFac) : 'Tidak ada'}${b.extraReason ? '<br>' + esc(b.extraReason) : ''}</div>
          <ul class="chk"><li class="${ok1 ? '' : 'f'}">${ok1 ? 'Jadwal tidak bentrok' : 'Jadwal bentrok dengan peminjaman lain'}</li><li class="${ok2 ? '' : 'f'}">${ok2 ? 'Tanggal sesuai kebijakan' : 'Tanggal sudah lewat'}</li><li class="${ok3 ? '' : 'f'}">${ok3 ? 'Data lengkap' : 'Tujuan terlalu singkat'}</li></ul>
          <label for="nt">Catatan untuk mahasiswa (opsional)</label><input id="nt"><div class="row"><button class="btn ok" onclick="decide(${b.id},'approved')">Setujui</button><button class="btn no" onclick="decide(${b.id},'rejected')">Tolak</button></div>`;
      }
      return h + `</div></div></div>`;
    }

    function roomManagementView() {
      const current = editingRoomId ? room(editingRoomId) : null;
      return `<div class="grid">
        <section>
          <h2>Daftar ruangan dan fasilitas</h2>
          ${ROOMS.map(r => `<div class="admin-room"><div><b>${esc(r.name)}</b><p>Kapasitas ${r.cap} orang · ${esc(r.fac)}</p><p>Jam tersedia: ${roomSlots(r.id).map(esc).join(', ')}</p></div>
            <div class="row"><button class="btn" onclick="editRoom('${r.id}')">Edit</button><button class="btn no" onclick="deleteRoom('${r.id}')">Hapus</button></div></div>`).join('')}
        </section>
        <div class="panel">
          <form onsubmit="saveRoom(event)">
            <h2>${current ? 'Edit ruangan' : 'Tambah ruangan'}</h2>
            <label for="roomName">Nama ruangan</label><input id="roomName" required value="${current ? esc(current.name) : ''}">
            <label for="roomCap">Kapasitas peserta</label><input id="roomCap" type="number" min="1" required value="${current ? current.cap : ''}">
            <label for="roomFacilities">Fasilitas (pisahkan dengan koma)</label><textarea id="roomFacilities" required placeholder="AC, proyektor, papan tulis">${current ? esc(current.fac) : ''}</textarea>
            <div class="row"><button class="btn p">${current ? 'Simpan perubahan' : 'Tambah ruangan'}</button>${current ? '<button type="button" class="btn" onclick="cancelEditRoom()">Batal</button>' : ''}</div>
          </form>
          ${current ? `<div class="schedule-editor"><h2 style="margin-top:22px">Jam tersedia untuk ${esc(current.name)}</h2>
            <p class="hint">Setiap sesi harus diikuti jeda minimal 1 jam sebelum sesi berikutnya. Contoh: 08.00–10.00, lalu sesi berikutnya paling cepat 11.00.</p>
            ${roomSlots(current.id).map(label => `<div class="slot-admin"><b>${esc(label)}</b><button type="button" class="btn no" onclick="removeRoomSlot('${current.id}','${label}')">Hapus</button></div>`).join('')}
            <div class="form-grid" style="margin-top:14px"><div><label for="roomSlotStart">Jam mulai</label><input id="roomSlotStart" type="time" required></div><div><label for="roomSlotEnd">Jam selesai</label><input id="roomSlotEnd" type="time" required></div></div>
            <div class="row"><button type="button" class="btn p" onclick="addRoomSlot('${current.id}')">Tambah jam</button></div>
          </div>` : `<div class="note good">Pilih tombol Edit pada ruangan untuk mengatur jam ketersediaannya.</div>`}
        </div>
      </div>`;
    }

    // Main Render Loop
    function render() {
      const ae = document.activeElement;
      const id = ae && ae.id;
      const v = ae && ae.value;

      $('#app').innerHTML = !S.user 
        ? loginView() 
        : head() + (S.user.role === 'admin' ? adminView() : studentView()) + (S.toast ? `<div class="toast" role="status">${S.toast}</div>` : '');

      if (!S.user && S.toast === '') return;

      // Restore focus & value for typing inputs
      if (id && $('#' + id) && ['nt', 'pp'].includes(id)) {
        $('#' + id).value = v;
        $('#' + id).focus();
      }
    }

    function updateLiveClock() {
      const now = new Date();
      const clock = document.getElementById('liveClock');
      const date = document.getElementById('liveDate');
      if (clock) clock.textContent = now.toLocaleTimeString('id-ID', {
        timeZone: JAKARTA_TZ,
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      if (date) date.textContent = now.toLocaleDateString('id-ID', {
        timeZone: JAKARTA_TZ,
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
      });
    }

    // Initialize
    render();
    updateLiveClock();
    setInterval(updateLiveClock, 1000);
