import React, { useState, useEffect } from 'react';
import { VisitRecord } from '../types';
import { uploadImageToImgBB } from '../services/dataService';

interface VisitFormProps {
  initialData?: VisitRecord | null;
  existingVisits: VisitRecord[];
  onSave: (visit: VisitRecord) => void;
  onCancel: () => void;
  imgbbKey: string;
}

const VisitForm: React.FC<VisitFormProps> = ({ initialData, existingVisits, onSave, onCancel, imgbbKey }) => {
  // 获取当前本地日期字符串 (YYYY-MM-DD)，用于设置默认值
  const getCurrentDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 确保日期仅保留 YYYY-MM-DD
  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr || dateStr.trim() === '') return getCurrentDateString();
    // 兼容可能带有时间戳的旧数据 (e.g. "2023-10-01T12:00:00")
    return dateStr.split('T')[0];
  };

  const [formData, setFormData] = useState<VisitRecord>(() => {
     if (initialData) {
       return {
         ...initialData,
         // 强制检查：如果日期字段为空，则自动填写今天
         visitDate: formatDateOnly(initialData.visitDate)
       };
     }
     return {
      id: Date.now().toString(),
      region: '',
      clientName: '',
      visitDate: getCurrentDateString(), // 默认为今天
      visitNotes: '',
      locationLink: '',
      photos: [],
      latitude: undefined,
      longitude: undefined,
      aiAnalysis: ''
    };
  });
  
  // 判断是编辑模式还是新建模式（预填充数据的 ID 不会存在于 existingVisits 中）
  // 另外判断是否是"新建客户" (即名字是空的)
  const isEditing = initialData && existingVisits.some(v => v.id === initialData.id);
  const isNewClient = !isEditing && !initialData?.clientName;

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Extract unique client names for auto-complete suggestions
  const uniqueClients = Array.from(new Set(existingVisits.map(v => v.clientName).filter(Boolean))).sort();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      // 自动填充逻辑：当客户名匹配历史记录时，自动填充地区和定位信息
      if (name === 'clientName') {
        // 查找该客户最近的一次拜访记录（假设列表顺序未必有序，但通常我们可以找到任意一个匹配项）
        // 为了更精准，我们倒序查找（如果 existingVisits 是按时间倒序的最好，这里简单查找第一个匹配项）
        const matchedVisit = existingVisits.find(v => v.clientName === value);
        
        if (matchedVisit) {
          newData.region = matchedVisit.region;
          newData.locationLink = matchedVisit.locationLink;
          // 如果历史记录有坐标，也同步更新，以便地图定位准确
          newData.latitude = matchedVisit.latitude;
          newData.longitude = matchedVisit.longitude;
        }
      }
      
      return newData;
    });
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("当前浏览器不支持地理定位。");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const link = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude,
          locationLink: link
        }));
      },
      (err) => {
        setError("无法获取位置: " + err.message);
      }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    setError(null);
    const files = Array.from(e.target.files) as File[];
    
    // Limit to remaining slots (max 5)
    const remainingSlots = 5 - formData.photos.length;
    const filesToUpload = files.slice(0, remainingSlots);

    try {
      const newUrls: string[] = [];
      for (const file of filesToUpload) {
        if (imgbbKey) {
          const url = await uploadImageToImgBB(file, imgbbKey);
          newUrls.push(url);
        } else {
          // If no key, we use a local blob for display, but warn the user
          const blobUrl = URL.createObjectURL(file);
          newUrls.push(blobUrl); 
          if (!error) {
             setError("⚠️ 警告: 未配置 ImgBB API Key。照片仅能在本机显示，无法保存到 Google Sheets。");
          }
        }
      }
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newUrls] }));
    } catch (err: any) {
      setError("图片上传失败: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const getFormTitle = () => {
    if (isNewClient) return '新建客户档案';
    if (isEditing) return '编辑拜访记录';
    return '新建拜访记录';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto my-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{getFormTitle()}</h2>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">客户名</label>
            <input
              required
              type="text"
              name="clientName"
              list="client-suggestions"
              value={formData.clientName}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="客户名称 (输入已有客户可自动填充信息)"
              autoComplete="off"
            />
            <datalist id="client-suggestions">
              {uniqueClients.map(client => (
                <option key={client} value={client} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地区 / 地址</label>
            <input
              required
              type="text"
              name="region"
              value={formData.region}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="例如：华北区 或 具体地址"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Google 定位</label>
          <div className="flex space-x-2">
            <input
              type="text"
              name="locationLink"
              value={formData.locationLink}
              onChange={handleInputChange}
              placeholder="输入 Google 地图链接或点击右侧获取"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            
            {formData.locationLink && (
              <a 
                href={formData.locationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg border border-slate-300 hover:bg-slate-200 flex items-center justify-center transition-colors"
                title="打开链接"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            )}

            <button
              type="button"
              onClick={handleGetLocation}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 flex items-center transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              获取坐标
            </button>
          </div>
        </div>

        {/* 仅在非新建客户模式下显示日期 */}
        {!isNewClient && (
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">拜访日期 (年月日)</label>
             <input
                required
                type="date"
                name="visitDate"
                value={formData.visitDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
          </div>
        )}

        {/* 仅在非新建客户模式下显示记录 */}
        {!isNewClient && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">拜访记录</label>
            <div className="relative">
              <textarea
                name="visitNotes"
                rows={4}
                value={formData.visitNotes}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="记录会议详情、客户反馈等..."
              />
            </div>
          </div>
        )}

        {/* 仅在非新建客户模式下显示照片 */}
        {!isNewClient && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">拜访照片 (最多5张)</label>
            <div className="flex flex-wrap gap-4 mb-2">
              {formData.photos.map((url, idx) => (
                <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm border border-slate-200 group">
                  <img 
                    src={url} 
                    alt="Visit" 
                    className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                    onClick={() => setPreviewImage(url)}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {formData.photos.length < 5 && (
                <label className={`w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={uploading} multiple />
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      <span className="text-xs text-slate-500">添加照片</span>
                    </>
                  )}
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500">点击照片可查看原图。照片将上传至 ImgBB 并存储链接。</p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-lg text-slate-600 font-medium hover:bg-slate-100"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md transition-colors"
          >
            {isNewClient ? '创建客户档案' : '保存记录'}
          </button>
        </div>
      </form>

      {/* Full Screen Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[110]"
            onClick={() => setPreviewImage(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img 
            src={previewImage} 
            alt="Original" 
            className="max-w-full max-h-full object-contain rounded-md shadow-2xl"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
};

export default VisitForm;