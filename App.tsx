import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ViewMode, VisitRecord, AppSettings } from './types';
import VisitList from './components/VisitList';
import VisitForm from './components/VisitForm';
import Settings from './components/Settings';
import { getVisits, saveVisit, deleteVisit } from './services/dataService';

// ⚠️ 默认配置 (已根据需求硬编码)
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbzztRE3a1eC-XCombzh6y-4oXNFANC2iqO4nsQZDJ9Zs2l8p1n3Xk4BxGb_uxFnnHCp/exec";
const DEFAULT_IMGBB_KEY = "005410c0aa046abd33de8e6bc93f6376";

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('list');
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // New state for connection errors to avoid annoying alerts
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // App Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('visit_track_settings');
    let parsed: any = {};
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing settings", e);
      }
    }
    
    // 逻辑：
    // 1. 如果本地缓存(localStorage)有值，优先使用（允许用户临时覆盖）
    // 2. 否则使用默认硬编码值
    return {
      gasWebAppUrl: parsed.gasWebAppUrl || DEFAULT_GAS_URL,
      imgbbApiKey: parsed.imgbbApiKey || DEFAULT_IMGBB_KEY
    };
  });

  useEffect(() => {
    // Save settings whenever they change
    localStorage.setItem('visit_track_settings', JSON.stringify(settings));
    
    // Always attempt to fetch data if URL is present
    if (settings.gasWebAppUrl) {
       fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.gasWebAppUrl]);

  const fetchData = async () => {
    if (!settings.gasWebAppUrl) return;
    setLoading(true);
    setConnectionError(null);
    try {
      const data = await getVisits(settings);
      setVisits(data);
    } catch (error: any) {
      console.error("Failed to load data", error);
      
      let errorMsg = error.message;
      if (errorMsg.includes("Rate exceeded") || errorMsg.includes("429")) {
        errorMsg = "Google API 配额超限 (Rate exceeded)。这通常是因为使用了默认的共享 URL。请在设置中配置您自己部署的 Google Apps Script URL。";
      }
      
      // Use state instead of alert
      setConnectionError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVisit = async (visit: VisitRecord) => {
    setLoading(true);
    setConnectionError(null);
    try {
      await saveVisit(visit, settings);
      await fetchData(); // Refresh data after save
      setView('list');
      setSelectedVisit(null);
    } catch (error: any) {
      let errorMsg = error.message;
      if (errorMsg.includes("Rate exceeded")) {
         errorMsg = "API 调用配额超限。请检查您的 Google Apps Script 部署或稍后再试。";
      }
      alert(`保存记录失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteVisit = async (visitId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop click from opening the visit details
    if (!window.confirm("确定要删除这条拜访记录吗？此操作无法撤销。")) return;

    setLoading(true);
    setConnectionError(null);
    try {
      await deleteVisit(visitId, settings);
      await fetchData(); // Refresh data after delete
      // If we deleted the currently selected visit (edge case), return to list
      if (selectedVisit && selectedVisit.id === visitId) {
        setView('list');
        setSelectedVisit(null);
      }
    } catch (error: any) {
      alert(`删除失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVisit = (visit: VisitRecord) => {
    setSelectedVisit(visit);
    setView('form');
  };

  // Helper to get today's date string YYYY-MM-DD
  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 新增：为特定客户创建新拜访，自动填充信息
  const handleCreateVisitForClient = (clientName: string) => {
    // 查找该客户最近的一条记录以获取默认信息
    const clientHistory = visits.filter(v => v.clientName === clientName);
    // 按日期倒序查找最近的有信息的记录
    const lastRecord = clientHistory.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];

    const todayStr = getTodayString();

    const newVisit: VisitRecord = {
      id: Date.now().toString(),
      clientName: clientName,
      // 自动填充地区、定位链接、坐标
      region: lastRecord?.region || '',
      locationLink: lastRecord?.locationLink || '',
      latitude: lastRecord?.latitude,
      longitude: lastRecord?.longitude,
      visitDate: todayStr, // 默认自动填写当前日期
      visitNotes: '',
      photos: [],
      aiAnalysis: ''
    };

    setSelectedVisit(newVisit);
    setView('form');
  };

  // 新增：创建全新客户 (空白表单)
  const handleCreateNewClient = () => {
    const todayStr = getTodayString();

    const newVisit: VisitRecord = {
      id: Date.now().toString(),
      clientName: '',
      region: '',
      locationLink: '',
      latitude: undefined,
      longitude: undefined,
      visitDate: todayStr, // 默认自动填写当前日期 (虽然界面上可能隐藏)
      visitNotes: '',
      photos: [],
      aiAnalysis: ''
    };

    setSelectedVisit(newVisit);
    setView('form');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
      
      {/* Navbar */}
      <nav className="bg-indigo-700 text-white shadow-md z-10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <svg className="h-8 w-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="font-bold text-xl tracking-tight">VisitTrack</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-md hover:bg-indigo-600 text-indigo-200 hover:text-white transition-colors"
                title="系统设置"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* View Container */}
        <div className="w-full h-full relative">
          
          {loading && (
             <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
             </div>
          )}

          {/* Connection Error Banner */}
          {connectionError && (
             <div className="bg-red-50 border-b border-red-200 p-4 sticky top-0 z-40">
               <div className="max-w-7xl mx-auto flex items-start space-x-3">
                 <svg className="h-5 w-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 <div className="flex-1">
                   <h3 className="text-sm font-medium text-red-800">数据同步错误</h3>
                   <div className="mt-1 text-sm text-red-700 whitespace-pre-line">{connectionError}</div>
                   <div className="mt-2">
                     <button 
                       onClick={() => setShowSettings(true)}
                       className="text-xs font-medium text-red-600 hover:text-red-500 underline"
                     >
                       打开设置检查 URL 配置
                     </button>
                     <button 
                        onClick={() => fetchData()}
                        className="ml-4 text-xs font-medium text-red-600 hover:text-red-500 underline"
                     >
                       重试
                     </button>
                   </div>
                 </div>
                 <button onClick={() => setConnectionError(null)} className="text-red-400 hover:text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
               </div>
             </div>
          )}
          
          {!settings.gasWebAppUrl && !connectionError && (
            <div className="bg-indigo-50 border-b border-indigo-100 p-4 sticky top-0 z-40">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-indigo-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm text-indigo-700">欢迎使用! 请先配置 Google Apps Script URL 以启用云端同步功能。</span>
                </div>
                <button 
                   onClick={() => setShowSettings(true)}
                   className="text-sm font-medium text-indigo-600 hover:text-indigo-500 underline"
                >
                  去配置
                </button>
              </div>
            </div>
          )}

          {view === 'list' && (
             <div className="w-full h-full overflow-y-auto bg-slate-50 p-4">
               <div className="max-w-3xl mx-auto">
                 <VisitList 
                   visits={visits} 
                   onSelectVisit={handleSelectVisit}
                   onCreateVisitForClient={handleCreateVisitForClient}
                   onCreateNewClient={handleCreateNewClient}
                   onDeleteVisit={handleDeleteVisit}
                 />
               </div>
             </div>
          )}

          {view === 'form' && (
             <div className="w-full h-full overflow-y-auto bg-slate-100 p-4 absolute top-0 left-0 z-30">
               <VisitForm 
                 initialData={selectedVisit}
                 existingVisits={visits}
                 onSave={handleSaveVisit}
                 onCancel={() => setView('list')}
                 imgbbKey={settings.imgbbApiKey}
               />
             </div>
          )}
        </div>
      </div>

      {showSettings && (
        <Settings 
          settings={settings} 
          onSave={(s) => { setSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)} 
        />
      )}

    </div>
  );
};

export default App;