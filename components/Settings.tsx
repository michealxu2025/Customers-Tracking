import React from 'react';
import { AppSettings } from '../types';

// Google Apps Script 代码
const GAS_SCRIPT_CODE = `
// -----------------------------------------------------
// ⚠️ 部署说明 (Deployment Instructions):
// 1. 将此代码粘贴到 Google Apps Script 编辑器 (Code.gs)
// 2. 点击 "部署" (Deploy) > "新建部署" (New deployment)
// 3. 选择类型: "Web 应用" (Web app)
// 4. 描述: V5 - Final with Delete & Lock
// 5. 以我身份运行 (Execute as): Me (我)
// 6. 谁可以访问 (Who has access): Anyone (任何人) -> 必选！
// 7. 点击 "部署", 复制生成的 "Web App URL"
// -----------------------------------------------------

// ✅ 配置: 您的 Google Sheet ID
// 请确保此 ID 与您实际使用的表格 ID 一致
const SPREADSHEET_ID = "1N_xfjmI2sv2wFmlDoQ6I4SMEnH493vkmgjSTWd1uxdI";

// ✅ 表头定义:
// 1:地区, 2:google定位, 3:客户名, 4:拜访日期, 5:拜访记录
// 6-10: 拜访照片1-5
// 11:ID, 12:Lat, 13:Lng, 14:AI_Analysis

function doGet(e) {
  const lock = LockService.getScriptLock();
  // 读操作通常不需要锁，但为了保持一致性可保留，或者为了性能可去掉
  // 这里我们只处理 action路由
  
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("Service is active. Please use the App.");
  }

  const action = e.parameter.action;
  
  if (action === 'read') {
    return readVisits();
  }

  return createJSONOutput({status: 'error', message: 'Unknown action'});
}

function doPost(e) {
  // 🔒 获取脚本锁，防止并发写入导致数据错乱 (等待最多 10秒)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
  } catch (e) {
    return createJSONOutput({status: 'error', message: 'Server is busy, please try again.'});
  }

  try {
    if (!e || !e.postData) {
      return createJSONOutput({status: 'error', message: 'Invalid POST'});
    }

    const ss = getSpreadsheet();
    if (!ss) return createJSONOutput({status: 'error', message: 'Spreadsheet not found'});

    const sheetName = "Visits";
    let sheet = ss.getSheetByName(sheetName);
    
    // 初始化 Sheet
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        "地区", "google定位", "客户名", "拜访日期", "拜访记录", 
        "拜访照片1", "拜访照片2", "拜访照片3", "拜访照片4", "拜访照片5",
        "ID", "Lat", "Lng", "AI_Analysis"
      ]);
    }

    const jsonString = e.postData.contents;
    const payload = JSON.parse(jsonString);
    
    // ===========================
    // 🗑️ 删除逻辑 (DELETE)
    // ===========================
    if (payload.action === 'delete') {
      const idToDelete = payload.id;
      if (!idToDelete) return createJSONOutput({status: 'error', message: 'Missing ID'});
      
      const data = sheet.getDataRange().getValues();
      // 遍历查找 ID (K列, 索引10)
      for (let i = 1; i < data.length; i++) {
        // 强制转为 String 比较，防止数字/字符串类型不匹配
        if (String(data[i][10]) === String(idToDelete)) {
          // deleteRow 使用 1-based index
          sheet.deleteRow(i + 1);
          return createJSONOutput({status: 'success', message: 'Deleted'});
        }
      }
      return createJSONOutput({status: 'error', message: 'ID not found'});
    }

    // ===========================
    // 📝 写入逻辑 (WRITE)
    // ===========================
    const item = payload.data; 
    if (!item) return createJSONOutput({status: 'error', message: 'No data'});

    // 处理照片 (固定5列)
    const photoCols = ["", "", "", "", ""];
    if (item.photos && Array.isArray(item.photos)) {
      for (let i = 0; i < Math.min(item.photos.length, 5); i++) {
        photoCols[i] = item.photos[i];
      }
    }

    // 格式化日期
    const cleanDate = item.visitDate ? String(item.visitDate).split('T')[0] : '';

    const rowData = [
      item.region,
      item.locationLink,
      item.clientName,
      cleanDate,
      item.visitNotes,
      photoCols[0], photoCols[1], photoCols[2], photoCols[3], photoCols[4],
      item.id,
      item.latitude,
      item.longitude,
      item.aiAnalysis
    ];

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    // 查找是否存在现有 ID
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][10]) === String(item.id)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      // 更新
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // 新增
      sheet.appendRow(rowData);
    }
    
    return createJSONOutput({status: 'success'});
    
  } catch (error) {
    return createJSONOutput({status: 'error', message: error.toString()});
  } finally {
    // 🔓 释放锁
    lock.releaseLock();
  }
}

function readVisits() {
  const ss = getSpreadsheet();
  if (!ss) return createJSONOutput({status: 'success', data: []});

  const sheet = ss.getSheetByName("Visits");
  if (!sheet) return createJSONOutput({status: 'success', data: []});

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return createJSONOutput({status: 'success', data: []});

  const rows = data.slice(1);
  // 按日期倒序排列 (最新的在前)，辅助前端排序
  // rows.sort((a, b) => new Date(b[3]) - new Date(a[3])); 
  // (可选：通常前端处理排序更好，这里保持原始顺序或按插入顺序)

  const visits = rows.map(row => {
    const photos = [];
    for (let i = 5; i <= 9; i++) {
      if (row[i] && String(row[i]).trim() !== "") photos.push(row[i]);
    }

    return {
      region: row[0],
      locationLink: row[1],
      clientName: row[2],
      visitDate: formatDate(row[3]),
      visitNotes: row[4],
      photos: photos,
      id: row[10] ? String(row[10]) : '', 
      latitude: Number(row[11]) || 0,
      longitude: Number(row[12]) || 0,
      aiAnalysis: row[13] || ''
    };
  });

  return createJSONOutput({status: 'success', data: visits});
}

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.length > 10) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      console.log("Error opening by ID, falling back to Active.");
      return SpreadsheetApp.getActiveSpreadsheet();
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function createJSONOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
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
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">系统设置</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">&times;</button>
        </div>
        
        <div className="p-6 space-y-8">
          
          {/* Section 1: Data Source */}
          <section>
            <h3 className="text-lg font-semibold text-indigo-700 mb-3">1. 数据后端 (Google Sheets)</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                 <label className="block text-sm font-medium text-slate-700">GAS Web App URL (发布链接)</label>
                 <input
                    type="text"
                    name="gasWebAppUrl"
                    value={localSettings.gasWebAppUrl}
                    onChange={handleChange}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                 />
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-2">Google Apps Script 后端代码 (Code.gs)</h4>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-2">
                  <p className="text-xs text-yellow-800">
                    <strong>⚠️ 需要更新:</strong> 代码已更新以支持“删除功能”和“并发安全锁”。请复制下方新代码并在 Google Apps Script 编辑器中重新部署 (选择 "New deployment")。
                  </p>
                </div>
                <pre className="bg-slate-800 text-slate-100 p-3 rounded text-xs overflow-x-auto h-64 font-mono leading-relaxed selection:bg-indigo-500 selection:text-white">
                  {GAS_SCRIPT_CODE}
                </pre>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(GAS_SCRIPT_CODE);
                    alert("代码已复制到剪贴板");
                  }}
                  className="mt-2 text-xs bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-100 flex items-center"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  复制代码
                </button>
              </div>
            </div>
          </section>

          {/* Section 2: Integrations */}
          <section>
            <h3 className="text-lg font-semibold text-indigo-700 mb-3">2. API 集成</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">ImgBB API Key (用于图片存储)</label>
                <input
                  type="password"
                  name="imgbbApiKey"
                  value={localSettings.imgbbApiKey}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <a href="https://api.imgbb.com/" target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">在此获取 Key</a>
              </div>
            </div>
          </section>

        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end">
           <button onClick={onClose} className="mr-3 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">取消</button>
           <button 
             onClick={() => { onSave(localSettings); onClose(); }}
             className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
           >
             保存设置
           </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;