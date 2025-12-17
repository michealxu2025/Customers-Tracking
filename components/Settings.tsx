import React from 'react';
import { AppSettings } from '../types';

// Google Apps Script 代码
const GAS_SCRIPT_CODE = `
// -----------------------------------------------------
// ⚠️ 部署说明 (Deployment Instructions):
// 1. 将此代码粘贴到 Google Apps Script 编辑器 (Code.gs)
// 2. 点击 "部署" (Deploy) > "新建部署" (New deployment)
// 3. 选择类型: "Web 应用" (Web app)
// 4. 以我身份运行 (Execute as): Me (我)
// 5. 谁可以访问 (Who has access): Anyone (任何人) -> 必选！
// -----------------------------------------------------

// ✅ 配置: 您的 Google Sheet ID
const SPREADSHEET_ID = "1N_xfjmI2sv2wFmlDoQ6I4SMEnH493vkmgjSTWd1uxdI";

// ✅ 表头定义 (V6 - 10 Photos):
// 0:地区, 1:google定位, 2:客户名, 3:拜访日期, 4:拜访记录
// 5-14: 拜访照片1-10
// 15:ID, 16:Lat, 17:Lng, 18:AI_Analysis

function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("Service is active.");
  }
  const action = e.parameter.action;
  if (action === 'read') return readVisits();
  return createJSONOutput({status: 'error', message: 'Unknown action'});
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
  } catch (e) {
    return createJSONOutput({status: 'error', message: 'Server is busy'});
  }

  try {
    const ss = getSpreadsheet();
    const sheetName = "Visits";
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        "地区", "google定位", "客户名", "拜访日期", "拜访记录", 
        "照片1", "照片2", "照片3", "照片4", "照片5", "照片6", "照片7", "照片8", "照片9", "照片10",
        "ID", "Lat", "Lng", "AI_Analysis"
      ]);
    }

    const payload = JSON.parse(e.postData.contents);
    
    // DELETE
    if (payload.action === 'delete') {
      const idToDelete = payload.id;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][15]) === String(idToDelete)) {
          sheet.deleteRow(i + 1);
          return createJSONOutput({status: 'success'});
        }
      }
      return createJSONOutput({status: 'error', message: 'ID not found'});
    }

    // WRITE
    const item = payload.data; 
    const photoCols = Array(10).fill("");
    if (item.photos && Array.isArray(item.photos)) {
      for (let i = 0; i < Math.min(item.photos.length, 10); i++) {
        photoCols[i] = item.photos[i];
      }
    }

    const cleanDate = item.visitDate ? String(item.visitDate).split('T')[0] : '';
    const rowData = [
      item.region, item.locationLink, item.clientName, cleanDate, item.visitNotes,
      ...photoCols,
      item.id, item.latitude, item.longitude, item.aiAnalysis
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

function readVisits() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Visits");
  if (!sheet) return createJSONOutput({status: 'success', data: []});

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return createJSONOutput({status: 'success', data: []});

  const rows = data.slice(1);
  const visits = rows.map(row => {
    const photos = [];
    for (let i = 5; i <= 14; i++) {
      if (row[i] && String(row[i]).trim() !== "") photos.push(row[i]);
    }
    return {
      region: row[0],
      locationLink: row[1],
      clientName: row[2],
      visitDate: formatDate(row[3]),
      visitNotes: row[4],
      photos: photos,
      id: row[15] ? String(row[15]) : '', 
      latitude: Number(row[16]) || 0,
      longitude: Number(row[17]) || 0,
      aiAnalysis: row[18] || ''
    };
  });
  return createJSONOutput({status: 'success', data: visits});
}

function getSpreadsheet() {
  try { return SpreadsheetApp.openById(SPREADSHEET_ID); } 
  catch (e) { return SpreadsheetApp.getActiveSpreadsheet(); }
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
                <div className="bg-blue-50 border-l-4 border-blue-400 p-2 mb-2">
                  <p className="text-xs text-blue-800">
                    <strong>ℹ️ 信息:</strong> 已升级至 10 张照片支持。请复制下方代码覆盖旧脚本并<strong>重新部署</strong>。
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
                <label className="block text-sm font-medium text-slate-700">ImgBB API Key</label>
                <input
                  type="password"
                  name="imgbbApiKey"
                  value={localSettings.imgbbApiKey}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
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