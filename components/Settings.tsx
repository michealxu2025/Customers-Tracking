import React from 'react';
import { AppSettings } from '../types';

// =====================================================
// 最终版 Google Apps Script 代码 (V8 - 10张照片 & 增强稳定性)
// =====================================================
const GAS_SCRIPT_CODE = `
// -----------------------------------------------------
// ⚠️ 部署说明 (Deployment Instructions):
// 1. 将此代码粘贴到 Google Apps Script 编辑器 (Code.gs)
// 2. 修改 SPREADSHEET_ID 为您的表格 ID (或留空使用当前绑定表)
// 3. 点击 "部署" (Deploy) > "新建部署" (New deployment)
// 4. 选择类型: "Web 应用" (Web app)
// 5. 以我身份运行 (Execute as): Me (我)
// 6. 谁可以访问 (Who has access): Anyone (任何人) -> 必选！
// -----------------------------------------------------

const SPREADSHEET_ID = ""; // 填入 ID 或保持为空以使用脚本绑定的表格

/**
 * 处理 GET 请求 (读取数据)
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action;
  
  if (!action) {
     return ContentService.createTextOutput("VisitTrack API V8 is running. Action required.");
  }

  if (action === 'read') return readVisits();
  return createJSONOutput({status: 'error', message: 'Unknown action'});
}

/**
 * 处理 POST 请求 (保存/更新/删除数据)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); 
  } catch (e) {
    return createJSONOutput({status: 'error', message: 'Server busy'});
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJSONOutput({status: 'error', message: 'No data received'});
    }

    const sheet = getOrCreateSheet();
    const payload = JSON.parse(e.postData.contents);
    
    // --- 删除逻辑 ---
    if (payload.action === 'delete') {
      const idToDelete = payload.id;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        // ID 位于索引 15 (P列)
        if (String(data[i][15]) === String(idToDelete)) {
          sheet.deleteRow(i + 1);
          return createJSONOutput({status: 'success'});
        }
      }
      return createJSONOutput({status: 'error', message: 'Record not found'});
    }

    // --- 写入/更新逻辑 ---
    const item = payload.data; 
    if (!item) return createJSONOutput({status: 'error', message: 'Missing data'});

    // 填充 10 列照片 (F-O列)
    const photoCols = Array(10).fill("");
    if (item.photos && Array.isArray(item.photos)) {
      for (let i = 0; i < Math.min(item.photos.length, 10); i++) {
        photoCols[i] = item.photos[i] || "";
      }
    }

    const cleanDate = item.visitDate ? String(item.visitDate).split('T')[0] : '';
    
    // 构建 19 列数据行
    // 0:地区, 1:定位, 2:客户名, 3:日期, 4:记录, 5-14:照片1-10, 15:ID, 16:Lat, 17:Lng, 18:AI
    const rowData = [
      item.region || "",
      item.locationLink || "",
      item.clientName || "",
      cleanDate,
      item.visitNotes || "",
      ...photoCols,
      item.id || "",
      item.latitude || "",
      item.longitude || "",
      item.aiAnalysis || ""
    ];

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][15]) === String(item.id)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return createJSONOutput({status: 'success'});
  } catch (error) {
    return createJSONOutput({status: 'error', message: error.toString()});
  } finally {
    lock.releaseLock();
  }
}

/**
 * 读取所有拜访记录
 */
function readVisits() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Visits");
  if (!sheet) return createJSONOutput({status: 'success', data: []});

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return createJSONOutput({status: 'success', data: []});

  const rows = data.slice(1);
  const visits = rows.map(row => {
    const photos = [];
    // 提取 10 列照片 (索引 5-14)
    for (let i = 5; i <= 14; i++) {
      if (row[i] && String(row[i]).trim() !== "") photos.push(row[i]);
    }
    return {
      region: row[0] || "",
      locationLink: row[1] || "",
      clientName: row[2] || "",
      visitDate: formatDate(row[3]),
      visitNotes: row[4] || "",
      photos: photos,
      id: row[15] ? String(row[15]) : '', 
      latitude: row[16] ? parseFloat(row[16]) : 0,
      longitude: row[17] ? parseFloat(row[17]) : 0,
      aiAnalysis: row[18] || ''
    };
  });
  return createJSONOutput({status: 'success', data: visits});
}

/**
 * 获取或初始化工作表
 */
function getOrCreateSheet() {
  const ss = getSpreadsheet();
  const name = "Visits";
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = [
      "地区", "Google定位", "客户名", "拜访日期", "拜访记录", 
      "照片1", "照片2", "照片3", "照片4", "照片5", "照片6", "照片7", "照片8", "照片9", "照片10",
      "ID", "Lat", "Lng", "AI_Analysis"
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSpreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function createJSONOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(date).split('T')[0];
}
`;

interface SettingsProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = React.useState(settings);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setLocalSettings({ ...localSettings, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">系统设置</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          <section>
            <h3 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              1. 数据后端 (Google Sheets)
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">GAS Web App URL (部署生成的 /exec 链接)</label>
                 <input 
                    type="text" 
                    name="gasWebAppUrl" 
                    value={localSettings.gasWebAppUrl} 
                    onChange={handleChange} 
                    className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all sm:text-sm" 
                    placeholder="https://script.google.com/macros/s/.../exec" 
                 />
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">最新版后端代码 (V8)</h4>
                  <div className="flex space-x-2">
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">同步 10 张照片</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">字段自动对齐</span>
                  </div>
                </div>
                <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-4 text-xs text-amber-800">
                  <strong>⚠️ 升级必读:</strong> 请删除 Google 脚本编辑器中的所有旧代码，粘贴下方新代码。重新部署时选择“新版本”，并确保权限为“Anyone”。
                </div>
                <div className="relative group">
                  <pre className="bg-slate-900 text-indigo-100 p-4 rounded-xl text-[11px] h-72 overflow-y-auto font-mono leading-relaxed border border-slate-700 shadow-2xl">
                    {GAS_SCRIPT_CODE}
                  </pre>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(GAS_SCRIPT_CODE); alert("代码已复制！请前往 GAS 脚本编辑器粘贴并发布。"); }} 
                    className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    复制代码
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              2. 图片上传 (ImgBB)
            </h3>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
              <input 
                type="password" 
                name="imgbbApiKey" 
                value={localSettings.imgbbApiKey} 
                onChange={handleChange} 
                className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 sm:text-sm transition-all" 
                placeholder="在此处输入您的 ImgBB API 密钥"
              />
              <div className="mt-3 flex items-start space-x-2 p-2 bg-blue-50 rounded-lg text-blue-700 text-[11px]">
                 <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <span>照片将永久托管在 ImgBB。如果未配置此 Key，照片将无法在多台设备间同步显示。</span>
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-xl">
           <button onClick={onClose} className="mr-3 px-6 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-white transition-all">取消</button>
           <button 
             onClick={() => { onSave(localSettings); onClose(); }} 
             className="px-8 py-2 bg-indigo-600 rounded-lg text-sm font-bold text-white shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
           >
             保存并启用
           </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;