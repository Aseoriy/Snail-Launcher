// ═══ Snail Launcher — Renderer ═══

let state = { loggedIn: false, username: null, uuid: null, instances: [], selectedInstance: null, settings: {}, isLaunching: false };
let currentDetailInstance = null;

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-btn[data-screen]').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.screen)));
  await loadSettings();
  await loadAccounts();
  await loadInstances();
  refreshJava();
  window.snail.onLaunchProgress(onLaunchProgress);
  window.snail.onInstallProgress(onInstallProgress);
  window.snail.onGameConsole(onGameConsole);
  window.snail.onGameClosed(onGameClosed);
});

// ═══ Nav ═══
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`); if (el) el.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-screen="${name}"]`); if (btn) btn.classList.add('active');
  if (name === 'instances') loadInstances();
  if (name === 'mods') { populateSelect('mod-instance-select'); searchMods(); }
  if (name === 'modules') { populateModuleSelect(); }
  if (name === 'accounts') loadAccounts();
  if (name === 'skins') loadSkins();
}

// ═══ Toast / Modal ═══
function toast(msg, type = 'info') { const el = document.getElementById('toast'); el.textContent = msg; el.className = `toast toast-${type} show`; setTimeout(() => el.classList.remove('show'), 3500); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function confirmDialog(title, msg, fn) { document.getElementById('confirm-title').textContent = title; document.getElementById('confirm-msg').textContent = msg; document.getElementById('confirm-btn').onclick = () => { closeModal('modal-confirm'); fn(); }; openModal('modal-confirm'); }

// ═══ Accounts ═══
async function loadAccounts() {
  const accounts = await window.snail.getAccounts();
  const list = document.getElementById('accounts-list');
  const empty = document.getElementById('accounts-empty');
  document.getElementById('stat-accounts').textContent = accounts.length;
  if (!accounts.length) { list.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  list.innerHTML = accounts.map(a => {
    const isMs = a.type === 'microsoft';
    const badge = a.isActive ? '<span style="color:var(--primary);font-size:0.72rem;margin-left:6px">● Active</span>' : '';
    const typeBadge = isMs ? '<span class="tag tag-release" style="margin-left:6px">Microsoft</span>' : '<span class="tag tag-offline" style="margin-left:6px">Offline</span>';
    const avatarSrc = isMs ? `https://mc-heads.net/avatar/${a.username}/48` : '';
    const avatarContent = avatarSrc ? `<img src="${avatarSrc}" onerror="this.parentElement.textContent='${a.username[0]}'" alt="">` : a.username[0].toUpperCase();
    return `<div class="card account-row ${a.isActive ? 'is-active' : ''}">
      <div class="avatar-lg">${avatarContent}</div>
      <div class="acct-info"><div class="name">${esc(a.username)}${badge}${typeBadge}</div><div class="uuid">${a.uuid}</div></div>
      <div class="acct-actions">${!a.isActive ? `<button class="btn btn-sm" onclick="switchAccount('${a.id}')">Use</button>` : ''}<button class="btn btn-sm btn-danger" onclick="removeAccount('${a.id}','${esc(a.username)}')">Remove</button></div>
    </div>`;
  }).join('');
  const active = accounts.find(a => a.isActive);
  if (active) setLoggedInUI(active.username, active.uuid, active.type);
}

async function doLogin() {
  const btn = document.getElementById('sidebar-login'); if (btn) btn.textContent = '⏳ Authenticating...';
  const res = await window.snail.loginMicrosoft();
  if (res.success) { toast(`Welcome, ${res.profile.name}!`, 'success'); await loadAccounts(); }
  else { toast(res.error || 'Login failed', 'error'); if (btn) btn.textContent = '🔑 Login with Microsoft'; }
}

function openOfflineModal() { document.getElementById('offline-name').value = ''; openModal('modal-offline'); }
async function submitOfflineAccount() {
  const name = document.getElementById('offline-name').value.trim();
  const res = await window.snail.addOfflineAccount(name);
  if (res.success) { closeModal('modal-offline'); toast(`Offline account "${name}" added!`, 'success'); await loadAccounts(); }
  else toast(res.error, 'error');
}

function setLoggedInUI(username, uuid, type) {
  state.loggedIn = true; state.username = username; state.uuid = uuid;
  document.getElementById('sidebar-login').style.display = 'none';
  const card = document.getElementById('sidebar-account'); card.style.display = 'flex';
  document.getElementById('sidebar-name').textContent = username;
  const isMs = type === 'microsoft';
  document.getElementById('sidebar-avatar').innerHTML = isMs ? `<img src="https://mc-heads.net/avatar/${username}/38" onerror="this.parentElement.textContent='${username[0]}'" alt="">` : username[0].toUpperCase();
  document.getElementById('home-username').textContent = username;
  if (isMs) document.getElementById('skin-preview').src = `https://mc-heads.net/body/${username}`;
  const pb = document.getElementById('play-btn');
  if (state.selectedInstance) { pb.disabled = false; pb.textContent = 'Play Now'; }
}

async function switchAccount(id) {
  const res = await window.snail.refreshAccount(id);
  if (res.success) { toast('Switched account', 'success'); await loadAccounts(); }
  else toast(res.error, 'error');
}

function removeAccount(id, name) {
  confirmDialog('Remove Account', `Remove "${name}"?`, async () => {
    await window.snail.removeAccount(id); toast('Removed', 'info'); await loadAccounts();
    const accts = await window.snail.getAccounts();
    if (!accts.find(a => a.isActive)) { state.loggedIn = false; document.getElementById('sidebar-login').style.display = 'flex'; document.getElementById('sidebar-account').style.display = 'none'; document.getElementById('play-btn').disabled = true; document.getElementById('play-btn').textContent = 'Login to Play'; }
  });
}

// ═══ Instances ═══
async function loadInstances() {
  state.instances = await window.snail.getInstances();
  const list = document.getElementById('instances-list');
  const empty = document.getElementById('instances-empty');
  document.getElementById('stat-instances').textContent = state.instances.length;
  let totalMods = 0;
  for (const i of state.instances) totalMods += (await window.snail.getInstalledMods(i.id)).length;
  document.getElementById('stat-mods').textContent = totalMods;
  if (!state.instances.length) { list.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  list.innerHTML = state.instances.map(i => {
    const lt = i.modLoader === 'fabric' ? '<span class="tag tag-fabric">Fabric</span>' : i.modLoader === 'forge' ? '<span class="tag tag-forge">Forge</span>' : '<span class="tag tag-vanilla">Vanilla</span>';
    const sel = state.selectedInstance?.id === i.id ? ' selected' : '';
    return `<div class="card instance-card${sel}" onclick="selectInstance('${i.id}')" ondblclick="selectAndPlay('${i.id}')">
      <div class="ic-header"><div class="ic-icon">⛏️</div><div><div class="ic-title">${esc(i.name)}</div><div class="ic-version">${i.mcVersion}${i.loaderVersion ? ' • ' + i.modLoader + ' ' + i.loaderVersion : ''}</div></div></div>
      <div class="ic-tags">${lt}${i.lastPlayed ? `<span class="tag" style="background:rgba(255,255,255,0.05);color:var(--text-muted)">${timeAgo(i.lastPlayed)}</span>` : ''}</div>
      <div class="ic-btns">
        <button class="btn btn-sm" onclick="event.stopPropagation();openInstanceDetail('${i.id}')">⚙️ Manage</button>
        <button class="btn btn-sm" onclick="event.stopPropagation();openInstanceFolder('${i.id}')">📁</button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteInstance('${i.id}','${esc(i.name)}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function selectInstance(id) {
  const inst = state.instances.find(i => i.id === id); if (!inst) return;
  state.selectedInstance = inst;
  document.querySelectorAll('.instance-card').forEach(c => c.classList.remove('selected'));
  event?.target?.closest?.('.instance-card')?.classList.add('selected');
  document.getElementById('action-instance').textContent = `${inst.name} (${inst.mcVersion})`;
  if (state.loggedIn) { document.getElementById('play-btn').disabled = false; document.getElementById('play-btn').textContent = 'Play Now'; }
}

function selectAndPlay(id) { selectInstance(id); if (state.loggedIn) playGame(); }
async function openInstanceFolder(id) { window.snail.openFolder(await window.snail.getInstancePath(id)); }

function deleteInstance(id, name) {
  confirmDialog('Delete Instance', `Delete "${name}" and all files?`, async () => {
    await window.snail.deleteInstance(id);
    if (state.selectedInstance?.id === id) { state.selectedInstance = null; document.getElementById('action-instance').textContent = 'None'; document.getElementById('play-btn').disabled = true; }
    toast('Deleted', 'info'); loadInstances();
  });
}

// Instance Detail Modal
function openInstanceDetail(id) {
  const inst = state.instances.find(i => i.id === id); if (!inst) return;
  currentDetailInstance = id;
  document.getElementById('inst-detail-name').textContent = inst.name;
  document.getElementById('inst-detail-sub').textContent = `${inst.mcVersion} • ${inst.modLoader}${inst.loaderVersion ? ' ' + inst.loaderVersion : ''}`;
  document.getElementById('inst-ram').value = inst.ram || 4;
  const lt = inst.modLoader === 'fabric' ? 'tag-fabric' : inst.modLoader === 'forge' ? 'tag-forge' : 'tag-vanilla';
  document.getElementById('inst-detail-tags').innerHTML = `<span class="tag ${lt}">${inst.modLoader}</span><span class="tag tag-release">${inst.mcVersion}</span>`;
  openModal('modal-instance');
}

async function saveInstanceDetail() {
  if (!currentDetailInstance) return;
  const ram = parseInt(document.getElementById('inst-ram').value) || 4;
  await window.snail.updateInstance(currentDetailInstance, { ram });
  toast('Instance updated', 'success'); closeModal('modal-instance'); loadInstances();
}

function openInstanceModsTab() {
  closeModal('modal-instance');
  const sel = document.getElementById('mod-instance-select');
  sel.value = currentDetailInstance;
  showScreen('mods');
  loadInstalledMods();
  document.querySelectorAll('#screen-mods .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#screen-mods .tab')[1]?.classList.add('active');
  document.getElementById('mod-results').style.display = 'none';
  document.getElementById('mod-installed').style.display = 'block';
}

function deleteInstanceFromDetail() {
  const inst = state.instances.find(i => i.id === currentDetailInstance);
  closeModal('modal-instance');
  if (inst) deleteInstance(inst.id, inst.name);
}

// Create Instance
async function openCreateInstance() {
  const sel = document.getElementById('ci-version'); sel.innerHTML = '<option>Loading...</option>';
  openModal('modal-create');
  const data = await window.snail.getVersions({ type: state.settings.showSnapshots ? 'all' : 'release' });
  sel.innerHTML = data.versions.map(v => `<option value="${v.id}">${v.id}${v.type !== 'release' ? ' (' + v.type + ')' : ''}</option>`).join('');
  document.getElementById('ci-name').value = '';
  document.getElementById('ci-loader').value = 'vanilla';
  document.getElementById('ci-loader-version-wrap').style.display = 'none';
}

async function onLoaderChange() {
  const loader = document.getElementById('ci-loader').value;
  const wrap = document.getElementById('ci-loader-version-wrap');
  if (loader === 'vanilla') { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const sel = document.getElementById('ci-loader-version'); sel.innerHTML = '<option>Loading...</option>';
  if (loader === 'fabric') {
    const loaders = await window.snail.getFabricLoaders(document.getElementById('ci-version').value);
    sel.innerHTML = loaders.length ? loaders.map(l => `<option value="${l.version}">${l.version}${l.stable ? ' (stable)' : ''}</option>`).join('') : '<option value="">No versions available</option>';
  }
}

async function submitCreateInstance() {
  const name = document.getElementById('ci-name').value.trim() || 'My Instance';
  const mcVersion = document.getElementById('ci-version').value;
  const modLoader = document.getElementById('ci-loader').value;
  const loaderVersion = modLoader !== 'vanilla' ? document.getElementById('ci-loader-version').value : null;
  const btn = document.getElementById('ci-submit'); btn.textContent = 'Creating...'; btn.disabled = true;
  const res = await window.snail.createInstance({ name, mcVersion, modLoader, loaderVersion });
  if (!res.success) { toast(res.error, 'error'); btn.textContent = 'Create'; btn.disabled = false; return; }
  if (modLoader === 'fabric' && loaderVersion) {
    toast('Installing Fabric...', 'info');
    const fr = await window.snail.installFabric({ instanceId: res.instance.id, mcVersion, loaderVersion });
    if (fr.success) toast('Fabric installed!', 'success'); else toast('Fabric: ' + fr.error, 'error');
  }
  closeModal('modal-create'); btn.textContent = 'Create'; btn.disabled = false;
  toast(`"${name}" created!`, 'success'); await loadInstances(); selectInstance(res.instance.id);
}

// ═══ Mods ═══
function populateSelect(id) {
  const sel = document.getElementById(id); const cur = sel.value;
  sel.innerHTML = '<option value="">Select Instance</option>' + state.instances.map(i => `<option value="${i.id}" ${i.id === cur ? 'selected' : ''}>${esc(i.name)} (${i.mcVersion})</option>`).join('');
}

function setModTab(el, tab) {
  document.querySelectorAll('#screen-mods .tab').forEach(t => t.classList.remove('active')); el.classList.add('active');
  document.getElementById('mod-results').style.display = tab === 'search' ? 'block' : 'none';
  document.getElementById('mod-installed').style.display = tab === 'installed' ? 'block' : 'none';
  if (tab === 'installed') loadInstalledMods();
}

async function searchMods() {
  const query = document.getElementById('mod-search').value;
  const instId = document.getElementById('mod-instance-select').value;
  const inst = state.instances.find(i => i.id === instId);
  const el = document.getElementById('mod-results'); el.innerHTML = '<div class="spinner"></div>';
  const data = await window.snail.searchMods({ query, mcVersion: inst?.mcVersion || '', loader: inst?.modLoader !== 'vanilla' ? inst?.modLoader : '', limit: 20 });
  if (!data.hits?.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No mods found</h3></div>'; return; }
  el.innerHTML = data.hits.map(m => `<div class="card mod-card" style="margin-bottom:10px">
    <div class="mod-icon">${m.icon_url ? `<img src="${m.icon_url}" alt="" onerror="this.style.display='none'">` : '🧩'}</div>
    <div class="mod-info"><div class="mod-name">${esc(m.title)}</div><div class="mod-author">by ${esc(m.author)}</div><div class="mod-desc">${esc(m.description)}</div><div class="mod-stats"><span>⬇ ${fmtNum(m.downloads)}</span><span>❤ ${fmtNum(m.follows)}</span></div></div>
    <button class="btn btn-sm btn-primary" onclick="installModFromSearch('${m.project_id}')" ${!instId ? 'disabled title="Select instance"' : ''}>Install</button>
  </div>`).join('');
}

async function installModFromSearch(pid) {
  const instId = document.getElementById('mod-instance-select').value;
  if (!instId) { toast('Select an instance first', 'error'); return; }
  toast('Downloading...', 'info');
  const r = await window.snail.installMod({ instanceId: instId, projectId: pid });
  if (r.success) toast('Mod installed!', 'success'); else toast(r.error, 'error');
}

async function loadInstalledMods() {
  const instId = document.getElementById('mod-instance-select').value;
  const el = document.getElementById('mod-installed');
  if (!instId) { el.innerHTML = '<p style="color:var(--text-dim);padding:20px">Select an instance.</p>'; return; }
  const mods = await window.snail.getInstalledMods(instId);
  if (!mods.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>No mods</h3></div>'; return; }
  el.innerHTML = mods.map(m => `<div class="card mod-card" style="margin-bottom:10px">
    <div class="mod-icon">📦</div><div class="mod-info"><div class="mod-name">${esc(m.filename)}</div><div class="mod-author">${(m.size/1024).toFixed(0)} KB</div></div>
    <button class="btn btn-sm btn-danger" onclick="removeMod('${instId}','${esc(m.filename)}')">Remove</button>
  </div>`).join('');
}

async function removeMod(instId, fn) { await window.snail.removeMod({ instanceId: instId, filename: fn }); toast('Removed', 'info'); loadInstalledMods(); }

// ═══ Modules ═══
function populateModuleSelect() {
  const sel = document.getElementById('module-instance-select'); const cur = sel.value;
  sel.innerHTML = '<option value="">Select Instance</option>' + state.instances.filter(i => i.modLoader !== 'vanilla').map(i => `<option value="${i.id}" ${i.id === cur ? 'selected' : ''}>${esc(i.name)} (${i.mcVersion})</option>`).join('');
  if (!cur) document.getElementById('modules-empty').style.display = 'flex';
}

async function loadModules() {
  const instId = document.getElementById('module-instance-select').value;
  const list = document.getElementById('modules-list'); const empty = document.getElementById('modules-empty');
  if (!instId) { list.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  const modules = await window.snail.getModules(instId);
  const cats = {};
  modules.forEach(m => { if (!cats[m.category]) cats[m.category] = []; cats[m.category].push(m); });
  list.innerHTML = Object.entries(cats).map(([cat, mods]) => `<div class="card settings-group" style="margin-bottom:16px">
    <div class="settings-group-title">${cat}</div>
    ${mods.map(m => `<div class="module-card"><div class="mod-icon-lg">${m.icon}</div><div class="mod-body"><h4>${m.name}</h4><p>${m.desc}</p></div>
      <label class="toggle"><input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleModule('${instId}','${m.id}',this.checked,this)"><span class="slider"></span></label>
    </div>`).join('')}
  </div>`).join('');
}

async function toggleModule(instId, modId, enable, cb) {
  cb.disabled = true; toast(enable ? 'Installing...' : 'Removing...', 'info');
  const r = await window.snail.toggleModule({ instanceId: instId, moduleId: modId, enable });
  cb.disabled = false;
  if (r.success) toast(enable ? 'Enabled!' : 'Disabled', 'success'); else { cb.checked = !enable; toast(r.error, 'error'); }
}

// ═══ Skins ═══
async function uploadSkin() {
  const r = await window.snail.uploadSkin();
  if (r.success) { toast('Skin saved!', 'success'); loadSkins(); }
}

async function loadSkins() {
  const skins = await window.snail.getSkins();
  const list = document.getElementById('skin-list');
  list.innerHTML = skins.length ? skins.map(s => `<div style="width:48px;height:48px;border-radius:8px;border:1px solid var(--glass-border);overflow:hidden;cursor:pointer;image-rendering:pixelated" onclick="selectSkin('${s.replace(/\\/g, '/')}')"><img src="file:///${s.replace(/\\/g, '/')}" style="width:100%;height:100%;object-fit:cover" alt=""></div>`).join('') : '<p style="color:var(--text-muted);font-size:0.8rem">No saved skins</p>';
}

function selectSkin(path) {
  document.getElementById('skin-preview').src = 'file:///' + path;
  toast('Skin selected', 'info');
}

// ═══ Launch ═══
async function playGame() {
  if (!state.selectedInstance || !state.loggedIn || state.isLaunching) return;
  state.isLaunching = true;
  const pb = document.getElementById('play-btn'); pb.textContent = 'Launching...'; pb.classList.add('launching'); pb.disabled = true;
  showProgress('Preparing...', 0);
  const r = await window.snail.launchGame(state.selectedInstance.id);
  if (!r.success) { toast(r.error, 'error'); pb.textContent = 'Play Now'; pb.classList.remove('launching'); pb.disabled = false; state.isLaunching = false; hideProgress(); }
}

function quickLaunch() {
  if (state.selectedInstance && state.loggedIn) playGame();
  else if (!state.loggedIn) toast('Login first!', 'error');
  else { toast('Select an instance', 'error'); showScreen('instances'); }
}

// ═══ Progress ═══
function showProgress(t, p) { document.getElementById('progress-wrap').classList.add('active'); document.getElementById('progress-text').textContent = t; document.getElementById('progress-pct').textContent = p + '%'; document.getElementById('progress-fill').style.width = p + '%'; }
function hideProgress() { document.getElementById('progress-wrap').classList.remove('active'); }
function onLaunchProgress(d) { showProgress(`Downloading ${d.type}... (${d.task}/${d.total})`, d.pct || 0); }
function onInstallProgress(d) { showProgress(d.stage, d.pct || 0); }

// ═══ Console ═══
function onGameConsole(t) { const el = document.getElementById('console-output'); el.textContent += t + '\n'; el.scrollTop = el.scrollHeight; }
function onGameClosed(code) {
  state.isLaunching = false;
  const pb = document.getElementById('play-btn'); pb.textContent = 'Play Now'; pb.classList.remove('launching'); pb.disabled = false;
  hideProgress(); onGameConsole(`\n[Snail] Game exited (code ${code})`); toast('Game closed', 'info'); loadInstances();
}
function clearConsole() { document.getElementById('console-output').textContent = ''; }

// ═══ Settings ═══
async function loadSettings() {
  state.settings = await window.snail.getSettings();
  document.getElementById('set-ram').value = state.settings.ram || 4;
  document.getElementById('set-ram-val').textContent = (state.settings.ram || 4) + 'GB';
  document.getElementById('set-snapshots').checked = !!state.settings.showSnapshots;
  document.getElementById('set-close-launch').checked = !!state.settings.closeOnLaunch;
  if (state.settings.theme) setTheme(state.settings.theme, false);
}

async function saveSettings() {
  const theme = document.body.getAttribute('data-theme') || 'mocha';
  state.settings = { ram: parseInt(document.getElementById('set-ram').value), showSnapshots: document.getElementById('set-snapshots').checked, closeOnLaunch: document.getElementById('set-close-launch').checked, javaPath: document.getElementById('set-java').value, theme };
  const r = await window.snail.saveSettings(state.settings);
  if (r.success) toast('Settings saved!', 'success'); else toast('Save failed', 'error');
}

function setTheme(theme, save = true) {
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === theme));
  if (save) { state.settings.theme = theme; }
}

async function refreshJava() {
  const paths = await window.snail.detectJava();
  const sel = document.getElementById('set-java'); const cur = sel.value;
  sel.innerHTML = '<option value="">Auto-detect</option>' + paths.map(p => `<option value="${p}">${p}</option>`).join('');
  if (cur) sel.value = cur;
}

// ═══ Helpers ═══
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function fmtNum(n) { if (!n) return '0'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); }
function timeAgo(d) { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 1) return 'just now'; if (m < 60) return m+'m ago'; const h = Math.floor(m/60); if (h < 24) return h+'h ago'; return Math.floor(h/24)+'d ago'; }

// ─── Auto-restore ───
(async () => {
  const accts = await window.snail.getAccounts();
  const active = accts.find(a => a.isActive);
  if (active) { const r = await window.snail.refreshAccount(active.id); if (r.success) setLoggedInUI(r.profile.name, r.profile.id, active.type); }
})();
