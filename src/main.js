const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const db=require('./database');
function window(){const w=new BrowserWindow({width:1500,height:960,minWidth:1080,minHeight:700,backgroundColor:'#f4f6f9',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});w.loadFile(path.join(__dirname,'index.html'));}
app.whenReady().then(()=>{db.initDatabase();
ipcMain.handle('data:list',(_e,t)=>db.list(t));ipcMain.handle('data:save',(_e,p)=>db.save(p.table,p.item));ipcMain.handle('data:remove',(_e,p)=>db.remove(p.table,p.id));
ipcMain.handle('orders:list',()=>db.listOrders());ipcMain.handle('orders:create',(_e,o)=>db.createOrder(o));ipcMain.handle('orders:status',(_e,p)=>db.updateOrderStatus(p));
ipcMain.handle('reports:summary',()=>({today:db.reports(),days:db.reportRows(),cash:db.cashSummary()}));
ipcMain.handle('backup:save',async()=>{const {filePath,canceled}=await dialog.showSaveDialog({defaultPath:'oudi-food-backup.json',filters:[{name:'نسخة OUDI FOOD',extensions:['json']}]});if(canceled)return {canceled:true};await fs.writeFile(filePath,JSON.stringify(db.exportData(),null,2),'utf8');return {canceled:false,filePath};});
ipcMain.handle('backup:restore',async()=>{const {filePaths,canceled}=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'نسخة OUDI FOOD',extensions:['json']}]});if(canceled||!filePaths[0])return {canceled:true};const data=JSON.parse(await fs.readFile(filePaths[0],'utf8'));if(data.version!==1)throw Error('ملف النسخة غير معروف');db.restoreData(data);return {canceled:false,message:'تمت استعادة النسخة الاحتياطية بنجاح.'};});
window();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)window();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
