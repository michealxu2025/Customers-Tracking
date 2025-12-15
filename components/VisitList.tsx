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
  
  // Date Range State (Defaults: First day of current month to Today)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });

  // Helper for safe timestamp
  const getTimestamp = (dateStr?: string) => {
    if (!dateStr) return 0;
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Helper for Chinese Date Formatting
  const formatToChineseDate = (dateStr?: string) => {
    if (!dateStr) return '无日期';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parts[0]}年${parts[1]}月${parts[2]}日`;
    }
    return cleanDate;
  };

  // --- New Logic: Weekly Status Check ---
  // Returns true if the client has a visit record >= this week's Monday
  const checkVisitedThisWeek = (clientName: string) => {
    if (!clientName) return false;
    
    const now = new Date();
    const day = now.getDay() || 7; // Get current day number, make Sunday = 7
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    // Rewind to Monday
    monday.setDate(now.getDate() - (day - 1));
    const mondayTs = monday.getTime();

    // Find if any visit for this client happened on or after Monday
    return visits.some(v => 
      v.clientName === clientName && 
      getTimestamp(v.visitDate) >= mondayTs
    );
  };

  const renderStatusTag = (clientName: string) => {
    const isVisited = checkVisitedThisWeek(clientName);
    if (isVisited) {
      return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
          本周已拜访
        </span>
      );
    } else {
      return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-100 whitespace-nowrap">
          本周未拜访
        </span>
      );
    }
  };

  // --- Logic 1: Group by Region (Existing) ---
  const regionGroupedData = useMemo(() => {
    if (groupBy !== 'region') return {};
    const groups: Record<string, Record<string, VisitRecord[]>> = {};
    
    visits.forEach(visit => {
      const region = visit.region && visit.region.trim() ? visit.region : '未分类地区';
      const client = visit.clientName && visit.clientName.trim() ? visit.clientName : '未命名客户';
      
      if (!groups[region]) groups[region] = {};
      if (!groups[region][client]) groups[region][client] = [];
      groups[region][client].push(visit);
    });
    return groups;
  }, [visits, groupBy]);

  // --- Logic 2: Group by Time Range (Existing) ---
  const timeRangeData = useMemo(() => {
    if (groupBy !== 'time') return null;

    const allClients: string[] = Array.from(new Set(visits.map(v => v.clientName).filter(n => n && n.trim() !== '')));
    
    const startTs = new Date(startDate).setHours(0,0,0,0);
    const endTs = new Date(endDate).setHours(23,59,59,999);

    const visitsInRange = visits.filter(v => {
      const vTs = new Date(v.visitDate).getTime();
      return vTs >= startTs && vTs <= endTs;
    });

    const visitedClientNames = new Set(visitsInRange.map(v => v.clientName));

    const visitedList = Array.from(visitedClientNames).map(clientName => {
      const clientVisits = visitsInRange.filter(v => v.clientName === clientName);
      clientVisits.sort((a, b) => getTimestamp(b.visitDate) - getTimestamp(a.visitDate));
      return {
        clientName,
        visits: clientVisits,
        latestVisit: clientVisits[0]
      };
    }).sort((a, b) => getTimestamp(b.latestVisit.visitDate) - getTimestamp(a.latestVisit.visitDate));

    const unvisitedList = allClients
      .filter(client => !visitedClientNames.has(client))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));

    return { visitedList, unvisitedList };
  }, [visits, groupBy, startDate, endDate]);

  // --- View: Client Details (Drill Down) ---
  if (selectedClient) {
    const clientVisits = visits
      .filter(v => v.clientName === selectedClient)
      .sort((a, b) => getTimestamp(b.visitDate) - getTimestamp(a.visitDate));

    const locationLink = clientVisits.find(v => v.locationLink && v.locationLink.trim() !== '')?.locationLink;

    return (
      <div className="space-y-4">
        <div className="sticky top-0 bg-slate-50 z-10 pb-2 border-b border-slate-200 shadow-sm -mx-4 px-4 pt-2 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setSelectedClient(null)}
                className="p-2 -ml-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200 rounded-full transition-colors"
                aria-label="返回列表"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  {selectedClient}
                  {renderStatusTag(selectedClient)}
                </h2>
                <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                  <span>共 {clientVisits.length} 条记录</span>
                  {locationLink && (
                    <>
                      <span>•</span>
                      <a 
                        href={locationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-indigo-600 hover:underline"
                      >
                        <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        导航
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => onCreateVisitForClient(selectedClient)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              新建拜访
            </button>
          </div>
        </div>

        {clientVisits.map((visit) => (
          <div 
            key={visit.id} 
            onClick={() => onSelectVisit(visit)}
            className="bg-white rounded-lg p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer flex justify-between items-start"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-indigo-900">{formatToChineseDate(visit.visitDate)}</span>
              </div>
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{visit.visitNotes}</p>
            </div>
            
            {visit.photos.length > 0 && (
              <div className="ml-3 flex-shrink-0 hidden xs:block">
                 <img src={visit.photos[0]} alt="Thumbnail" className="w-16 h-16 rounded-md object-cover border border-slate-200" />
              </div>
            )}
             <div className="ml-2 flex items-center space-x-1 self-center">
              <button 
                onClick={(e) => onDeleteVisit(visit.id, e)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10"
                title="删除记录"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <div className="p-2 text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- View: Main List (Region or Time Mode) ---

  const renderRegionView = () => {
    const sortedRegions = Object.keys(regionGroupedData).sort((a, b) => {
      if (a === '未分类地区') return 1;
      if (b === '未分类地区') return -1;
      return a.localeCompare(b, 'zh-CN');
    });

    if (sortedRegions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
           <p>暂无数据</p>
        </div>
      );
    }

    return sortedRegions.map(region => {
      const clients = regionGroupedData[region];
      const sortedClientNames = Object.keys(clients).sort((a, b) => {
         const visitsA = clients[a];
         const visitsB = clients[b];
         const maxDateA = Math.max(...visitsA.map(v => getTimestamp(v.visitDate)));
         const maxDateB = Math.max(...visitsB.map(v => getTimestamp(v.visitDate)));
         return maxDateB - maxDateA;
      });

      return (
        <div key={region} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center">
              <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {region}
            </h3>
            <span className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-full">{Object.keys(clients).length} 客户</span>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedClientNames.map(clientName => {
              const clientVisits = clients[clientName];
              const latestVisit = clientVisits.sort((a,b) => getTimestamp(b.visitDate) - getTimestamp(a.visitDate))[0];
              
              return (
                <div 
                  key={clientName} 
                  onClick={() => setSelectedClient(clientName)}
                  className="px-4 py-4 hover:bg-indigo-50 cursor-pointer transition-colors flex justify-between items-center group active:bg-indigo-100"
                >
                  <div>
                    <h4 className="font-semibold text-slate-800 text-lg group-hover:text-indigo-700 flex items-center flex-wrap gap-1">
                      {clientName}
                      {renderStatusTag(clientName)}
                    </h4>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">最近: {formatToChineseDate(latestVisit.visitDate)}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">共 {clientVisits.length} 次拜访</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const renderTimeView = () => {
    if (!timeRangeData) return null;
    const { visitedList, unvisitedList } = timeRangeData;

    return (
      <div className="space-y-6">
        
        {/* 已拜访列表 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex justify-between items-center">
             <h3 className="font-bold text-green-800 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                该时段已拜访 ({visitedList.length})
             </h3>
          </div>
          <div className="divide-y divide-slate-100">
             {visitedList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">此时间段内无拜访记录</div>
             ) : (
                visitedList.map(item => (
                  <div 
                    key={item.clientName} 
                    onClick={() => setSelectedClient(item.clientName)}
                    className="px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors flex justify-between items-center group"
                  >
                     <div>
                        <h4 className="font-medium text-slate-800 group-hover:text-green-700 flex items-center">
                          {item.clientName}
                          {renderStatusTag(item.clientName)}
                        </h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                           最新: <span className="font-medium text-slate-600">{formatToChineseDate(item.latestVisit.visitDate)}</span>
                           <span className="mx-1">•</span>
                           共 {item.visits.length} 次
                        </div>
                     </div>
                     <svg className="w-4 h-4 text-slate-300 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                ))
             )}
          </div>
        </div>

        {/* 未拜访列表 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
             <h3 className="font-bold text-red-800 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                该时段未拜访 ({unvisitedList.length})
             </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {unvisitedList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">所有现有客户均已拜访</div>
             ) : (
                unvisitedList.map(clientName => (
                  <div 
                    key={clientName} 
                    onClick={() => onCreateVisitForClient(clientName)} // 点击未拜访客户直接去创建记录
                    className="px-4 py-3 hover:bg-red-50 cursor-pointer transition-colors flex justify-between items-center group"
                  >
                     <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-400 mr-3"></div>
                        <h4 className="font-medium text-slate-600 group-hover:text-red-700 flex items-center">
                          {clientName}
                          {renderStatusTag(clientName)}
                        </h4>
                     </div>
                     <div className="flex items-center text-xs text-slate-400 group-hover:text-red-500">
                        <span>点击新建</span>
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     </div>
                  </div>
                ))
             )}
          </div>
        </div>

      </div>
    );
  };

  // --- Main Render ---
  return (
    <div className="space-y-6 pb-10">
      {/* Overview Header with Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">客户列表</h2>
          </div>
          <button
            onClick={onCreateNewClient}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            新建客户
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Group Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto self-start flex-shrink-0">
            <button
              onClick={() => setGroupBy('region')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all text-center ${
                groupBy === 'region' 
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              按地区
            </button>
            <button
              onClick={() => setGroupBy('time')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all text-center ${
                groupBy === 'time' 
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              按时间段
            </button>
          </div>

          {/* Date Picker (Only visible when Time mode) */}
          {groupBy === 'time' && (
             <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full sm:w-auto">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-700 focus:ring-0 p-1 w-28"
                />
                <span className="text-slate-400 text-xs">至</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-700 focus:ring-0 p-1 w-28"
                />
             </div>
          )}
        </div>
      </div>

      {groupBy === 'region' ? renderRegionView() : renderTimeView()}
    </div>
  );
};

export default VisitList;