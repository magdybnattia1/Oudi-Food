const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const db = require('./database');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f3f5f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => {
  db.initDatabase();
  ipcMain.handle('products:list', () => db.listProducts());
  ipcMain.handle('orders:list', () => db.listOrders());
  ipcMain.handle('orders:create', (_event, order) => db.createOrder(order));
  ipcMain.handle('orders:update-status', (_event, payload) => db.updateOrderStatus(payload));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });