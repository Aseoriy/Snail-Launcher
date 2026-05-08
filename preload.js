const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snail', {
  // Accounts
  loginMicrosoft: () => ipcRenderer.invoke('login-microsoft'),
  addOfflineAccount: (name) => ipcRenderer.invoke('add-offline-account', name),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  refreshAccount: (id) => ipcRenderer.invoke('refresh-account', id),
  removeAccount: (id) => ipcRenderer.invoke('remove-account', id),

  // Versions
  getVersions: (opts) => ipcRenderer.invoke('get-versions', opts),

  // Instances
  getInstances: () => ipcRenderer.invoke('get-instances'),
  createInstance: (opts) => ipcRenderer.invoke('create-instance', opts),
  deleteInstance: (id) => ipcRenderer.invoke('delete-instance', id),
  updateInstance: (id, u) => ipcRenderer.invoke('update-instance', id, u),

  // Mod Loaders
  getFabricLoaders: (v) => ipcRenderer.invoke('get-fabric-loaders', v),
  installFabric: (opts) => ipcRenderer.invoke('install-fabric', opts),
  getForgeVersions: (v) => ipcRenderer.invoke('get-forge-versions', v),

  // Mods
  searchMods: (opts) => ipcRenderer.invoke('search-mods', opts),
  getModVersions: (opts) => ipcRenderer.invoke('get-mod-versions', opts),
  installMod: (opts) => ipcRenderer.invoke('install-mod', opts),
  removeMod: (opts) => ipcRenderer.invoke('remove-mod', opts),
  getInstalledMods: (id) => ipcRenderer.invoke('get-installed-mods', id),
  installContent: (opts) => ipcRenderer.invoke('install-content', opts),

  // Modules
  getModules: (id) => ipcRenderer.invoke('get-modules', id),
  toggleModule: (opts) => ipcRenderer.invoke('toggle-module', opts),

  // Skins
  uploadSkin: () => ipcRenderer.invoke('upload-skin'),
  getSkins: () => ipcRenderer.invoke('get-skins'),

  // Launch
  launchGame: (id) => ipcRenderer.invoke('launch-game', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  // Java & Misc
  detectJava: () => ipcRenderer.invoke('detect-java'),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  getInstancePath: (id) => ipcRenderer.invoke('get-instance-path', id),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Events
  onLaunchProgress: (cb) => ipcRenderer.on('launch-progress', (_, d) => cb(d)),
  onInstallProgress: (cb) => ipcRenderer.on('install-progress', (_, d) => cb(d)),
  onGameConsole: (cb) => ipcRenderer.on('game-console', (_, d) => cb(d)),
  onGameClosed: (cb) => ipcRenderer.on('game-closed', (_, c) => cb(c)),
});