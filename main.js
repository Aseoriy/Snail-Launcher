const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client, Authenticator } = require('minecraft-launcher-core');
const msmc = require('msmc');
const crypto = require('crypto');

// �"��"��"� Paths �"��"��"�
const GAME_DIR = path.join(app.getPath('userData'), '.minecraft-snail');
const INSTANCES_DIR = path.join(GAME_DIR, 'instances');
const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'snail_accounts.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'snail_settings.json');
const SNAIL_MOD_JAR = path.join(__dirname, 'snail-mod.jar');

// �"��"��"� State �"��"��"�
const launcher = new Client();
let mainWindow;
let activeAuth = null;
let activeAccountId = null;

// �"��"��"� Built-in Modules �"��"��"�
const BUILT_IN_MODULES = [
  { id: 'sodium', name: 'Sodium', desc: 'Massive FPS boost via modern rendering', category: 'Performance', icon: '⚡', slug: 'sodium' },
  { id: 'lithium', name: 'Lithium', desc: 'General-purpose optimization', category: 'Performance', icon: '�"�', slug: 'lithium' },
  { id: 'iris', name: 'Iris Shaders', desc: 'OptiFine-compatible shader support', category: 'Visual', icon: '🌈', slug: 'iris' },
  { id: 'lambdynamiclights', name: 'Dynamic Lights', desc: 'Held items illuminate surroundings', category: 'Visual', icon: '�"�', slug: 'lambdynamiclights' },
  { id: 'modmenu', name: 'Mod Menu', desc: 'In-game mod configuration screen', category: 'HUD', icon: '�"�', slug: 'modmenu' },
  { id: 'appleskin', name: 'AppleSkin', desc: 'Food & saturation HUD overlay', category: 'HUD', icon: '🍎', slug: 'appleskin' },
  { id: 'betterf3', name: 'BetterF3', desc: 'Customizable debug screen', category: 'HUD', icon: '�"�', slug: 'betterf3' },
  { id: 'zoomify', name: 'Zoomify', desc: 'OptiFine-like smooth zoom', category: 'Utility', icon: '�"�', slug: 'zoomify' },
  { id: 'xaeros-minimap', name: 'Minimap', desc: 'Full minimap overlay', category: 'HUD', icon: '🗺️', slug: 'xaeros-minimap' },
  { id: 'inventoryprofilesnext', name: 'Inv Sorting', desc: 'Sort inventory in one click', category: 'Utility', icon: '�"�', slug: 'inventory-profiles-next' },
];

// �"��"��"� Helpers �"��"��"�
function ensureDir(d) { if (d) fs.mkdirSync(d, { recursive: true }); }
function readJSON(fp, fb = null) {
  try { if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch (e) { console.error('readJSON:', e.message); }
  return fb;
}
function writeJSON(fp, data) { ensureDir(path.dirname(fp)); fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8'); }
function encrypt(s) { return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s).toString('base64') : Buffer.from(s).toString('base64'); }
function decrypt(s) { try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(s, 'base64')) : Buffer.from(s, 'base64').toString('utf-8'); } catch { return null; } }

async function downloadFile(url, dest) {
  ensureDir(path.dirname(dest));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/** Auto-install the best snail-mod JAR for this instance's MC version */
function installSnailMod(instanceId) {
  try {
    const config = getInst(instanceId);
    if (!config || config.modLoader !== 'fabric') return;

    // Find the best matching JAR from snail-mod-jars/
    const jarsDir = path.join(__dirname, 'snail-mod-jars');
    let jarPath = SNAIL_MOD_JAR; // fallback to generic
    if (fs.existsSync(jarsDir)) {
      // Available builds: snail-mod-1.20.1.jar, snail-mod-1.20.4.jar, snail-mod-1.21.1.jar, etc.
      const available = fs.readdirSync(jarsDir).filter(f => f.startsWith('snail-mod-') && f.endsWith('.jar'))
        .map(f => ({ file: f, ver: f.replace('snail-mod-', '').replace('.jar', '') }));
      // Find exact match first, then closest lower version
      const mcVer = config.mcVersion;
      const exact = available.find(a => a.ver === mcVer);
      if (exact) {
        jarPath = path.join(jarsDir, exact.file);
      } else {
        // Find closest compatible version (same major.minor)
        const [mcMaj, mcMin] = mcVer.split('.').map(Number);
        const compatible = available.filter(a => {
          const [aMaj, aMin] = a.ver.split('.').map(Number);
          return aMaj === mcMaj && aMin === mcMin;
        }).sort((a, b) => b.ver.localeCompare(a.ver, undefined, { numeric: true }));
        if (compatible.length) jarPath = path.join(jarsDir, compatible[0].file);
        else if (available.length) {
          // Fall back to closest available
          available.sort((a, b) => {
            const da = Math.abs(parseFloat(a.ver.replace(/^1\./, '')) - parseFloat(mcVer.replace(/^1\./, '')));
            const db = Math.abs(parseFloat(b.ver.replace(/^1\./, '')) - parseFloat(mcVer.replace(/^1\./, '')));
            return da - db;
          });
          jarPath = path.join(jarsDir, available[0].file);
        }
      }
    }

    if (!fs.existsSync(jarPath)) { console.warn('[SnailMod] No JAR found'); return; }
    const modsDir = path.join(INSTANCES_DIR, instanceId, '.minecraft', 'mods');
    ensureDir(modsDir);
    const dest = path.join(modsDir, 'snail-mod.jar');
    fs.copyFileSync(jarPath, dest);
    console.log(`[SnailMod] Installed ${path.basename(jarPath)} to ${modsDir}`);
  } catch (e) { console.warn('[SnailMod] Install failed:', e.message); }
}

// �"��"��"� Window �"��"��"�
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 780, minWidth: 1000, minHeight: 680,
    frame: true, show: false, backgroundColor: '#11111b',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => { ensureDir(GAME_DIR); ensureDir(INSTANCES_DIR); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ══════════════════════════════════════════
//  ACCOUNTS (Microsoft + Offline)
// ══════════════════════════════════════════
function getAccounts() { return readJSON(ACCOUNTS_FILE, []); }
function saveAccounts(l) { writeJSON(ACCOUNTS_FILE, l); }

ipcMain.handle('login-microsoft', async () => {
  try {
    const auth = new msmc.Auth();
    const xbox = await auth.launch('electron');
    const mc = await xbox.getMinecraft();
    if (!mc.profile) return { success: false, error: 'No Minecraft profile found.' };
    const mclcAuth = mc.mclc();
    activeAuth = mclcAuth;
    const accounts = getAccounts();
    accounts.forEach(a => a.isActive = false);
    const tokenStr = JSON.stringify(mclcAuth);
    const idx = accounts.findIndex(a => a.uuid === mc.profile.id);
    const acct = { id: mc.profile.id, uuid: mc.profile.id, username: mc.profile.name, type: 'microsoft', encryptedToken: encrypt(tokenStr), isActive: true, lastLogin: new Date().toISOString() };
    if (idx >= 0) accounts[idx] = acct; else accounts.push(acct);
    saveAccounts(accounts);
    activeAccountId = acct.id;
    return { success: true, profile: mc.profile };
  } catch (err) { console.error('Auth:', err); return { success: false, error: err.message }; }
});

ipcMain.handle('add-offline-account', (_, username) => {
  if (!username || username.length < 3) return { success: false, error: 'Username must be at least 3 characters' };
  const id = 'offline-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const offlineAuth = Authenticator.getAuth(username);
  activeAuth = offlineAuth;
  const accounts = getAccounts();
  accounts.forEach(a => a.isActive = false);
  const acct = { id, uuid: id, username, type: 'offline', encryptedToken: encrypt(JSON.stringify(offlineAuth)), isActive: true, lastLogin: new Date().toISOString() };
  accounts.push(acct);
  saveAccounts(accounts);
  activeAccountId = id;
  return { success: true, profile: { name: username, id } };
});

ipcMain.handle('get-accounts', () => getAccounts().map(a => ({ id: a.id, uuid: a.uuid, username: a.username, type: a.type || 'microsoft', isActive: a.isActive, lastLogin: a.lastLogin })));

ipcMain.handle('refresh-account', async (_, accountId) => {
  try {
    const accounts = getAccounts();
    const acct = accounts.find(a => a.id === accountId);
    if (!acct) return { success: false, error: 'Account not found' };
    const tokenStr = decrypt(acct.encryptedToken);
    if (!tokenStr) return { success: false, error: 'Token decrypt failed' };
    activeAuth = JSON.parse(tokenStr);
    activeAccountId = acct.id;
    accounts.forEach(a => a.isActive = a.id === accountId);
    saveAccounts(accounts);
    return { success: true, profile: { name: acct.username, id: acct.uuid } };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('remove-account', (_, accountId) => {
  saveAccounts(getAccounts().filter(a => a.id !== accountId));
  if (activeAccountId === accountId) { activeAuth = null; activeAccountId = null; }
  return { success: true };
});

// ══════════════════════════════════════════
//  VERSIONS
// ══════════════════════════════════════════
let verCache = null, verCacheT = 0;
ipcMain.handle('get-versions', async (_, opts = {}) => {
  try {
    if (!verCache || Date.now() - verCacheT > 300000) {
      const r = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
      verCache = await r.json(); verCacheT = Date.now();
    }
    let v = verCache.versions;
    if (opts.type && opts.type !== 'all') v = v.filter(x => x.type === opts.type);
    if (opts.search) v = v.filter(x => x.id.includes(opts.search));
    return { versions: v.slice(0, 150), latest: verCache.latest };
  } catch (e) { return { versions: [], latest: {} }; }
});

// ══════════════════════════════════════════
//  INSTANCES
// ══════════════════════════════════════════
function getInst(id) { return readJSON(path.join(INSTANCES_DIR, id, 'instance.json')); }
function saveInst(id, c) { writeJSON(path.join(INSTANCES_DIR, id, 'instance.json'), c); }

ipcMain.handle('get-instances', () => {
  try {
    if (!fs.existsSync(INSTANCES_DIR)) return [];
    return fs.readdirSync(INSTANCES_DIR)
      .filter(d => fs.existsSync(path.join(INSTANCES_DIR, d, 'instance.json')))
      .map(d => getInst(d)).filter(Boolean)
      .sort((a, b) => new Date(b.lastPlayed || 0) - new Date(a.lastPlayed || 0));
  } catch { return []; }
});

ipcMain.handle('create-instance', (_, { name, mcVersion, modLoader, loaderVersion }) => {
  try {
    const id = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}-${Date.now().toString(36)}`;
    const gd = path.join(INSTANCES_DIR, id, '.minecraft');
    ensureDir(path.join(gd, 'mods'));
    ensureDir(path.join(gd, 'resourcepacks'));
    ensureDir(path.join(gd, 'shaderpacks'));
    ensureDir(path.join(gd, 'config'));
    const config = { id, name, mcVersion, modLoader: modLoader || 'vanilla', loaderVersion: loaderVersion || null, ram: 4, javaPath: null, modules: {}, created: new Date().toISOString(), lastPlayed: null };
    saveInst(id, config);
    return { success: true, instance: config };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('delete-instance', (_, id) => {
  try { const d = path.join(INSTANCES_DIR, id); if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('update-instance', (_, id, updates) => {
  const c = getInst(id); if (!c) return { success: false, error: 'Not found' };
  Object.assign(c, updates); saveInst(id, c); return { success: true, instance: c };
});

// ══════════════════════════════════════════
//  FABRIC INSTALLATION (FIXED)
// ══════════════════════════════════════════
ipcMain.handle('get-fabric-loaders', async (_, mcVer) => {
  try {
    const r = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVer}`);
    if (!r.ok) return [];
    return (await r.json()).slice(0, 15).map(d => ({ version: d.loader.version, stable: d.loader.stable }));
  } catch { return []; }
});

ipcMain.handle('install-fabric', async (_, { instanceId, mcVersion, loaderVersion }) => {
  try {
    const send = (stage, pct) => mainWindow.webContents.send('install-progress', { stage, pct });
    send('Fetching Fabric profile...', 5);

    // 1. Get the profile JSON
    const profileRes = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
    if (!profileRes.ok) throw new Error(`Fabric profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json();
    const versionId = profile.id; // e.g. "fabric-loader-0.16.14-1.20.4"

    // 2. Save version JSON
    const versionDir = path.join(GAME_DIR, 'versions', versionId);
    ensureDir(versionDir);
    fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(profile, null, 2));
    send('Profile saved, downloading libraries...', 15);

    // 3. Download all Fabric libraries
    const libs = profile.libraries || [];
    for (let i = 0; i < libs.length; i++) {
      const lib = libs[i];
      if (!lib.name) continue;

      // Parse Maven coordinates: group:artifact:version
      const parts = lib.name.split(':');
      if (parts.length < 3) continue;
      const [group, artifact, version] = parts;
      const groupPath = group.replace(/\./g, '/');
      const jarName = `${artifact}-${version}.jar`;
      const libRelPath = `${groupPath}/${artifact}/${version}/${jarName}`;
      const dest = path.join(GAME_DIR, 'libraries', libRelPath);

      if (!fs.existsSync(dest)) {
        // Try the lib's url field first, fall back to Maven Central
        const baseUrl = lib.url || 'https://maven.fabricmc.net/';
        const fullUrl = baseUrl.replace(/\/$/, '') + '/' + libRelPath;
        try {
          await downloadFile(fullUrl, dest);
        } catch (e) {
          // Fallback to Maven Central
          try { await downloadFile(`https://repo1.maven.org/maven2/${libRelPath}`, dest); }
          catch (e2) { console.warn(`Skipped lib ${lib.name}: ${e2.message}`); }
        }
      }
      send(`Libraries (${i + 1}/${libs.length})...`, 15 + Math.round((i / libs.length) * 75));
    }

    // 4. Also ensure vanilla version JSON exists (MCLC needs it for inheritsFrom)
    const vanillaDir = path.join(GAME_DIR, 'versions', mcVersion);
    const vanillaJsonPath = path.join(vanillaDir, `${mcVersion}.json`);
    if (!fs.existsSync(vanillaJsonPath)) {
      send('Fetching vanilla version data...', 92);
      // Get version manifest to find the vanilla version URL
      const manifestRes = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
      const manifest = await manifestRes.json();
      const verEntry = manifest.versions.find(v => v.id === mcVersion);
      if (verEntry) {
        const verJsonRes = await fetch(verEntry.url);
        const verJson = await verJsonRes.json();
        ensureDir(vanillaDir);
        fs.writeFileSync(vanillaJsonPath, JSON.stringify(verJson, null, 2));
      }
    }

    // 5. Update instance
    const config = getInst(instanceId);
    if (config) { config.modLoader = 'fabric'; config.loaderVersion = loaderVersion; saveInst(instanceId, config); }

    send('Fabric installed successfully!', 100);
    return { success: true, versionId };
  } catch (err) { console.error('Fabric install:', err); return { success: false, error: err.message }; }
});

ipcMain.handle('get-forge-versions', async (_, mcVer) => {
  try {
    const r = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    if (!r.ok) return [];
    const promos = (await r.json()).promos || {};
    const versions = [];
    for (const [k, v] of Object.entries(promos)) {
      if (k.startsWith(mcVer + '-')) versions.push({ version: v, type: k.includes('latest') ? 'latest' : 'recommended' });
    }
    return versions;
  } catch { return []; }
});

// ══════════════════════════════════════════
//  MODS (MODRINTH)
// ══════════════════════════════════════════
const MR = 'https://api.modrinth.com/v2';
const MR_H = { 'User-Agent': 'SnailLauncher/2.0.0' };
async function mrFetch(ep) { const r = await fetch(`${MR}${ep}`, { headers: MR_H }); if (!r.ok) throw new Error(`Modrinth ${r.status}`); return r.json(); }

ipcMain.handle('search-mods', async (_, { query, mcVersion, loader, limit = 20, offset = 0 }) => {
  try {
    const facets = []; 
    if (mcVersion) facets.push(`["versions:${mcVersion}"]`);
    if (loader && loader !== 'vanilla') facets.push(`["categories:${loader}"]`);
    const contentType = opts.contentType || 'mod';
    facets.push('["project_type:' + contentType + '"]');
    const p = new URLSearchParams({ query: query || '', limit: String(limit), offset: String(offset), facets: `[${facets.join(',')}]` });
    return await mrFetch(`/search?${p}`);
  } catch { return { hits: [], total_hits: 0 }; }
});

ipcMain.handle('install-content', async (_, { instanceId, projectId, contentType }) => {
  try {
    const config = getInst(instanceId);
    if (!config) return { success: false, error: 'Instance not found' };
    const vs = await mrFetch(`/project/${projectId}/version?game_versions=${JSON.stringify([config.mcVersion])}`);
    if (!vs.length) return { success: false, error: 'No compatible version' };
    const file = vs[0].files?.find(f => f.primary) || vs[0].files?.[0];
    if (!file) return { success: false, error: 'No file' };
    const folderMap = { mod: 'mods', shader: 'shaderpacks', resourcepack: 'resourcepacks', datapack: 'datapacks' };
    const folder = folderMap[contentType] || 'mods';
    const destDir = path.join(INSTANCES_DIR, instanceId, '.minecraft', folder);
    ensureDir(destDir);
    await downloadFile(file.url, path.join(destDir, file.filename));
    return { success: true, filename: file.filename, folder };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('get-mod-versions', async (_, { projectId, mcVersion, loader }) => {
  try {
    const p = new URLSearchParams();
    if (mcVersion) p.set('game_versions', JSON.stringify([mcVersion]));
    if (loader && loader !== 'vanilla') p.set('loaders', JSON.stringify([loader]));
    return await mrFetch(`/project/${projectId}/version?${p}`);
  } catch { return []; }
});

ipcMain.handle('install-mod', async (_, { instanceId, projectId, versionData }) => {
  try {
    const config = getInst(instanceId);
    if (!config) return { success: false, error: 'Instance not found' };
    let fd = versionData;
    if (!fd) {
      const vs = await mrFetch(`/project/${projectId}/version?game_versions=${JSON.stringify([config.mcVersion])}&loaders=${JSON.stringify([config.modLoader])}`);
      if (!vs.length) return { success: false, error: 'No compatible version' };
      fd = vs[0];
    }
    const file = fd.files?.find(f => f.primary) || fd.files?.[0];
    if (!file) return { success: false, error: 'No file' };
    const modsDir = path.join(INSTANCES_DIR, instanceId, '.minecraft', 'mods');
    ensureDir(modsDir);
    await downloadFile(file.url, path.join(modsDir, file.filename));
    return { success: true, filename: file.filename };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('remove-mod', (_, { instanceId, filename }) => {
  try { const p = path.join(INSTANCES_DIR, instanceId, '.minecraft', 'mods', filename); if (fs.existsSync(p)) fs.unlinkSync(p); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('get-installed-mods', (_, instanceId) => {
  try {
    const d = path.join(INSTANCES_DIR, instanceId, '.minecraft', 'mods');
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter(f => f.endsWith('.jar')).map(f => ({ filename: f, size: fs.statSync(path.join(d, f)).size }));
  } catch { return []; }
});

// ══════════════════════════════════════════
//  MODULES (Modrinth-based toggles)
// ══════════════════════════════════════════
ipcMain.handle('get-modules', (_, instanceId) => {
  const c = instanceId ? getInst(instanceId) : null;
  const em = c?.modules || {};
  return BUILT_IN_MODULES.map(m => ({ ...m, enabled: !!em[m.id] }));
});

ipcMain.handle('toggle-module', async (_, { instanceId, moduleId, enable }) => {
  try {
    const config = getInst(instanceId);
    if (!config) return { success: false, error: 'Instance not found' };
    if (config.modLoader === 'vanilla') return { success: false, error: 'Install a mod loader first (Fabric)' };
    const mod = BUILT_IN_MODULES.find(m => m.id === moduleId);
    if (!mod) return { success: false, error: 'Module not found' };
    const modsDir = path.join(INSTANCES_DIR, instanceId, '.minecraft', 'mods');
    ensureDir(modsDir);
    if (enable) {
      const vs = await mrFetch(`/project/${mod.slug}/version?game_versions=${JSON.stringify([config.mcVersion])}&loaders=${JSON.stringify([config.modLoader])}`);
      if (!vs.length) return { success: false, error: `No version for MC ${config.mcVersion}` };
      const file = vs[0].files?.find(f => f.primary) || vs[0].files?.[0];
      if (!file) return { success: false, error: 'No file' };
      await downloadFile(file.url, path.join(modsDir, file.filename));
      if (!config.modules) config.modules = {};
      config.modules[moduleId] = { filename: file.filename, version: vs[0].version_number };
    } else {
      const md = config.modules?.[moduleId];
      if (md?.filename) { const p = path.join(modsDir, md.filename); if (fs.existsSync(p)) fs.unlinkSync(p); }
      if (config.modules) delete config.modules[moduleId];
    }
    saveInst(instanceId, config);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ══════════════════════════════════════════
//  SKIN MANAGEMENT
// ══════════════════════════════════════════
ipcMain.handle('upload-skin', async (_, instanceId) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Skin File',
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return { success: false, error: 'Cancelled' };
  const src = result.filePaths[0];
  const skinsDir = path.join(app.getPath('userData'), 'skins');
  ensureDir(skinsDir);
  const dest = path.join(skinsDir, `skin-${Date.now()}.png`);
  fs.copyFileSync(src, dest);
  return { success: true, path: dest };
});

ipcMain.handle('get-skins', () => {
  const dir = path.join(app.getPath('userData'), 'skins');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => path.join(dir, f));
});

// ══════════════════════════════════════════
//  LAUNCH (FIXED)
// ══════════════════════════════════════════
ipcMain.handle('launch-game', async (_, instanceId) => {
  if (!activeAuth) return { success: false, error: 'Login first!' };
  const config = getInst(instanceId);
  if (!config) return { success: false, error: 'Instance not found' };
  const settings = readJSON(SETTINGS_FILE, {});
  const ram = config.ram || settings.ram || 4;
  const gameDir = path.join(INSTANCES_DIR, instanceId, '.minecraft');
  ensureDir(gameDir);

  // Auto-install Snail Mod for Fabric instances
  installSnailMod(instanceId);

  let versionId = config.mcVersion;
  let customId = undefined;
  if (config.modLoader === 'fabric' && config.loaderVersion) {
    customId = `fabric-loader-${config.loaderVersion}-${config.mcVersion}`;
  }

  const opts = {
    clientPackage: null,
    authorization: activeAuth,
    root: GAME_DIR,
    version: { number: config.mcVersion, type: 'release', custom: customId },
    memory: { max: `${ram}G`, min: '1G' },
    overrides: { gameDirectory: gameDir },
    javaPath: config.javaPath || settings.javaPath || undefined
  };

  launcher.removeAllListeners();
  launcher.on('progress', (e) => {
    mainWindow.webContents.send('launch-progress', { type: e.type, task: e.task, total: e.total, pct: e.total > 0 ? Math.round((e.task / e.total) * 100) : 0 });
  });
  launcher.on('download-status', (e) => {
    mainWindow.webContents.send('launch-progress', { type: 'download', task: e.current, total: e.total, pct: e.total > 0 ? Math.round((e.current / e.total) * 100) : 0 });
  });
  launcher.on('data', (d) => mainWindow.webContents.send('game-console', d.toString()));
  launcher.on('close', (code) => {
    mainWindow.webContents.send('game-closed', code);
    const c = getInst(instanceId);
    if (c) { c.lastPlayed = new Date().toISOString(); saveInst(instanceId, c); }
  });

  try {
    mainWindow.webContents.send('launch-progress', { type: 'init', task: 0, total: 1, pct: 0 });
    await launcher.launch(opts);
    return { success: true };
  } catch (e) { console.error('Launch:', e); return { success: false, error: e.message }; }
});

// ══════════════════════════════════════════
//  SETTINGS & JAVA & MISC
// ══════════════════════════════════════════
ipcMain.handle('get-settings', () => readJSON(SETTINGS_FILE, { ram: 4, theme: 'mocha', showSnapshots: false, closeOnLaunch: false, javaPath: '' }));
ipcMain.handle('save-settings', (_, s) => { try { writeJSON(SETTINGS_FILE, s); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });

ipcMain.handle('detect-java', () => {
  const found = [];
  if (process.env.JAVA_HOME) { const p = path.join(process.env.JAVA_HOME, 'bin', 'java.exe'); if (fs.existsSync(p)) found.push(p); }
  for (const base of ['C:\\Program Files\\Java', 'C:\\Program Files (x86)\\Java', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\Zulu']) {
    try { if (!fs.existsSync(base)) continue; for (const e of fs.readdirSync(base)) { const p = path.join(base, e, 'bin', 'java.exe'); if (fs.existsSync(p) && !found.includes(p)) found.push(p); } } catch {}
  }
  return found;
});

ipcMain.handle('open-folder', (_, p) => { if (fs.existsSync(p)) shell.openPath(p); });
ipcMain.handle('get-instance-path', (_, id) => path.join(INSTANCES_DIR, id, '.minecraft'));
ipcMain.handle('get-app-version', () => app.getVersion() || '2.0.0');