const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('oudi',{
 list:(table)=>ipcRenderer.invoke('data:list',table),save:(table,item)=>ipcRenderer.invoke('data:save',{table,item}),remove:(table,id)=>ipcRenderer.invoke('data:remove',{table,id}),
 orders:()=>ipcRenderer.invoke('orders:list'),createOrder:(order)=>ipcRenderer.invoke('orders:create',order),updateStatus:(payload)=>ipcRenderer.invoke('orders:status',payload),reports:()=>ipcRenderer.invoke('reports:summary'),
 backup:()=>ipcRenderer.invoke('backup:save'),restore:()=>ipcRenderer.invoke('backup:restore')
});
