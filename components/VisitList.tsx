import React, { useState, useMemo } from 'react';
import { VisitRecord } from '../types';

interface VisitListProps {
  visits: VisitRecord[];
  onSelectVisit: (visit: VisitRecord) => void;
  onCreateVisitForClient: (clientName: string) => void;
  onCreateNewClient: () => void;
  onDeleteVisit: (visitId: string, e: React.MouseEvent) => void;
}

const VisitList: React.FC<VisitListProps> = ({ visits, onSelectVisit, onCreateVisitForClient, onCreateNewClient, onDeleteVisit }) => {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'region' | 'time'>('region');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });

  const getTimestamp = (dateStr?: string) => {
    if (!dateStr) return 0;
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 0 : t;
  };

  const formatToChineseDate = (dateStr?: string) => {
    if (!dateStr) return '无日期';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    return parts.length === 3 ? `${parts[0]}年${parts[1]}月${parts[2]}日` : cleanDate;
  };

  const checkVisitedThisWeek = (clientName: string) => {
    if (!clientName) return false;
    const now = new Date();
    const day = (now.getDay() || 7) - 1;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - day);
    return visits.some(v => v.clientName === clientName && getTimestamp(v.visitDate) >= monday.getTime());
  };

  const renderStatusTag = (clientName: string) => {
    const isVisited = checkVisitedThisWeek(clientName);
    return (
      <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold border ${isVisited ? 'bg-green-50 text-green-600 border-green-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
        {isVisited ? '本周已拜访' : '本周待拜访'}
      </span>
    );
  };

  const regionGroupedData = useMemo(() => {
    if (groupBy !== 'region') return {};
    const groups: Record<string, Record<string, VisitRecord[]>> = {};
    visits.forEach(v => {
      const region = v.region?.trim() || '未分类地区';
      const client = v.clientName?.trim() || '未知客户';
      if (!groups[region]) groups[region] = {};
      if (!groups[region][client]) groups[region][client] = [];
      groups[region][client].push(v);
    });
    return groups;
  }, [visits, groupBy]);

  const timeRangeData = useMemo(() => {
    if (groupBy !== 'time') return null;
    const allClients = Array.from(new Set(visits.map(v => v.clientName).filter(Boolean)));
    const startTs = new Date(startDate).setHours(0,0,0,0);
    const endTs = new Date(endDate).setHours(23,59,59,999);
    
    const visitsInRange = visits.filter(v => {
      const ts = getTimestamp(v.visitDate);
      return ts >= startTs && ts <= endTs;
    });

    const visitedNames = new Set(visitsInRange.map(v => v.clientName));
    const visitedList = Array.from(visitedNames).map(name => {
      const matches = visitsInRange.filter(v => v.clientName === name).sort((a,b) => getTimestamp(b.visitDate) - getTimestamp(a.visitDate));
      return { clientName: name, visits: matches, latestVisit: matches[0] };
    }).sort((a,b) => getTimestamp(b.latestVisit.visitDate) - getTimestamp(a.latestVisit.visitDate));

    const unvisitedList = allClients.filter(n => !visitedNames.has(n)).sort((a,b) => a.localeCompare(b, 'zh-CN'));
    return { visitedList, unvisitedList };
  }, [visits, groupBy, startDate, endDate]);

  const renderTimeView = () => {
    if (!timeRangeData) return null;
    const { visitedList, unvisitedList } = timeRangeData;
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-green-50 px-4 py-2 border-b border-slate-200 font-bold text-green-700 text-sm">阶段已拜访 ({visitedList.length})</div>
          <div className="divide-y divide-slate-100">
            {visitedList.length === 0 ? <div className="p-8 text-center text-slate-400 text-xs tracking-widest uppercase">暂无记录</div> : 
              visitedList.map(item => (
                <div key={item.clientName} onClick={() => setSelectedClient(item.clientName)} className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center group">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center">{item.clientName}{renderStatusTag(item.clientName)}</h4>
                    <p className="text-[11px] text-slate-500 mt-1">期间最后拜访: <span className="text-indigo-600 font-medium">{formatToChineseDate(item.latestVisit.visitDate)}</span></p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              ))
            }
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-rose-50 px-4 py-2 border-b border-slate-200 font-bold text-rose-700 text-sm">阶段未拜访 ({unvisitedList.length})</div>
          <div className="divide-y divide-slate-100">
            {unvisitedList.length === 0 ? <div className="p-8 text-center text-slate-400 text-xs tracking-widest uppercase">全员已拜访</div> : 
              unvisitedList.map(name => (
                <div key={name} onClick={() => setSelectedClient(name)} className="px-4 py-3 hover:bg-rose-50/30 cursor-pointer flex justify-between items-center group">
                  <h4 className="font-bold text-slate-600 text-sm">{name}</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-rose-500 font-bold border border-rose-100 px-1.5 py-0.5 rounded">待跟进</span>
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    );
  };

  if (selectedClient) {
    const clientVisits = visits.filter(v => v.clientName === selectedClient).sort((a,b) => getTimestamp(b.visitDate) - getTimestamp(a.visitDate));
    return (
      <div className="space-y-4">
        <div className="sticky top-0 bg-slate-50/90 backdrop-blur z-10 pb-3 border-b border-slate-200 -mx-4 px-4 pt-2 mb-4 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => setSelectedClient(null)} className="p-2 -ml-2 text-slate-500 hover:text-indigo-600 rounded-full transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <h2 className="text-xl font-bold text-slate-800 ml-1">{selectedClient}{renderStatusTag(selectedClient)}</h2>
          </div>
          <button onClick={() => onCreateVisitForClient(selectedClient)} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-all flex items-center"><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>新建拜访</button>
        </div>
        {clientVisits.map(v => (
          <div key={v.id} onClick={() => onSelectVisit(v)} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer flex justify-between items-start group">
            <div className="flex-1 min-w-0 pr-4">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-tighter">{formatToChineseDate(v.visitDate)}</span>
              <p className="text-sm text-slate-600 mt-2 line-clamp-3 leading-relaxed">{v.visitNotes || '暂无文字详情'}</p>
            </div>
            {v.photos.length > 0 && (
              <div className="relative flex-shrink-0 group/img">
                <img src={v.photos[0]} alt="Tmb" className="w-16 h-16 rounded-lg object-cover border border-slate-200 group-hover:opacity-90 transition-all" onClick={(e) => { e.stopPropagation(); setPreviewImage(v.photos[0]); }} />
                {v.photos.length > 1 && <div className="absolute -bottom-1 -right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-md font-black shadow-lg">+{v.photos.length - 1}</div>}
              </div>
            )}
            <div className="ml-3 self-center flex items-center">
              <button onClick={(e) => onDeleteVisit(v.id, e)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all opacity-0 group-hover:opacity-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              <svg className="w-5 h-5 text-slate-300 ml-1 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">客户库</h2>
          <button onClick={onCreateNewClient} className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"><svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3" /></svg>新增客户</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button onClick={() => setGroupBy('region')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${groupBy === 'region' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>按区域分</button>
            <button onClick={() => setGroupBy('time')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${groupBy === 'time' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>按时段查</button>
          </div>
          {groupBy === 'time' && (
             <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:ring-0 p-1 w-24" />
                <span className="text-slate-300 text-xs">→</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:ring-0 p-1 w-24" />
             </div>
          )}
        </div>
      </div>
      {groupBy === 'region' ? (
        Object.keys(regionGroupedData).sort().map(region => (
          <div key={region} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 font-black text-slate-700 uppercase tracking-widest text-xs flex justify-between">
              <span>{region}</span>
              <span className="text-slate-400 font-medium">{Object.keys(regionGroupedData[region]).length} 位客户</span>
            </div>
            <div className="divide-y divide-slate-100">
              {Object.keys(regionGroupedData[region]).sort().map(name => (
                <div key={name} onClick={() => setSelectedClient(name)} className="px-5 py-4 hover:bg-indigo-50/50 cursor-pointer flex justify-between items-center group transition-colors">
                  <div>
                    <h4 className="font-bold text-slate-800 text-base flex items-center">{name}{renderStatusTag(name)}</h4>
                    <span className="text-[11px] text-slate-400 font-medium">累计完成拜访: {regionGroupedData[region][name].length} 次</span>
                  </div>
                  <svg className="w-5 h-5 text-slate-200 group-hover:text-indigo-400 transition-all transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : renderTimeView()}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Full" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default VisitList;