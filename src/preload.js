const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('oudi', {
  products: () => ipcRenderer.invoke('products:list'),
  orders: () => ipcRenderer.invoke('orders:list'),
  createOrder: (order) => ipcRenderer.invoke('orders:create', order),
  updateStatus: (payload) => ipcRenderer.invoke('orders:update-status', payload)
});