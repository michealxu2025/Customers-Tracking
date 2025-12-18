import React, { useState } from 'react';
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
  // 获取当前本地日期 (YYYY-MM-DD)
  const getCurrentDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr || dateStr.trim() === '') return getCurrentDateString();
    return dateStr.split('T')[0];
  };

  const [formData, setFormData] = useState<VisitRecord>(() => {
     if (initialData) {
       return {
         ...initialData,
         visitDate: formatDateOnly(initialData.visitDate)
       };
     }
     return {
      id: Date.now().toString(),
      region: '',
      clientName: '',
      visitDate: getCurrentDateString(),
      visitNotes: '',
      locationLink: '',
      photos: [],
      latitude: undefined,
      longitude: undefined,
      aiAnalysis: ''
    };
  });
  
  const isEditing = initialData && existingVisits.some(v => v.id === initialData.id);
  const isNewClient = !isEditing && !initialData?.clientName;

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const uniqueClients = Array.from(new Set(existingVisits.map(v => v.clientName).filter(Boolean))).sort();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'clientName') {
        const matchedVisit = existingVisits.find(v => v.clientName === value);
        if (matchedVisit) {
          newData.region = matchedVisit.region;
          newData.locationLink = matchedVisit.locationLink;
          newData.latitude = matchedVisit.latitude;
          newData.longitude = matchedVisit.longitude;
        }
      }
      return newData;
    });
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("浏览器不支持地理定位。");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const link = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        setFormData(prev => ({ ...prev, latitude, longitude, locationLink: link }));
      },
      (err) => setError("定位失败: " + err.message)
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    setError(null);
    const files = Array.from(e.target.files) as File[];
    const remainingSlots = 10 - formData.photos.length;
    const filesToUpload = files.slice(0, remainingSlots);

    try {
      const newUrls: string[] = [];
      for (const file of filesToUpload) {
        if (imgbbKey) {
          const url = await uploadImageToImgBB(file, imgbbKey);
          newUrls.push(url);
        } else {
          const blobUrl = URL.createObjectURL(file);
          newUrls.push(blobUrl);
          if (!error) setError("⚠️ 未配置 ImgBB Key，照片仅限临时预览。");
        }
      }
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newUrls] }));
    } catch (err: any) {
      setError("上传失败: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto my-6 border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{isNewClient ? '新建客户档案' : (isEditing ? '编辑拜访记录' : '新建拜访记录')}</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-100">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">客户名称</label>
            <input required type="text" name="clientName" list="client-suggestions" value={formData.clientName} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none" placeholder="输入或选择客户" autoComplete="off" />
            <datalist id="client-suggestions">{uniqueClients.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">地区</label>
            <input required type="text" name="region" value={formData.region} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none" placeholder="例如：上海中心" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Google 地图标点</label>
          <div className="flex space-x-2">
            <input type="text" name="locationLink" value={formData.locationLink} onChange={handleInputChange} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="定位链接" />
            <button type="button" onClick={handleGetLocation} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center text-xs whitespace-nowrap">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>获取定位
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">拜访日期</label>
          <input required type="date" name="visitDate" value={formData.visitDate} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">详情备注</label>
          <textarea name="visitNotes" rows={4} value={formData.visitNotes} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="记录本次拜访的核心要点..." />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">拜访照片 ({formData.photos.length}/10)</label>
            <span className="text-[10px] text-slate-400">点击预览大图</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {formData.photos.map((url, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden shadow-sm border border-slate-200 group">
                <img src={url} alt="Visit" className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform" onClick={() => setPreviewImage(url)} />
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-md">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            {formData.photos.length < 10 && (
              <label className={`w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all ${uploading ? 'opacity-50' : ''}`}>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={uploading} multiple />
                {uploading ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
              </label>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-50 transition-colors">取消</button>
          <button type="submit" className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 active:scale-95 transition-all">保存记录</button>
        </div>
      </form>

      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm transition-all" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <img src={previewImage} alt="Original" className="max-w-full max-h-full object-contain rounded-md shadow-2xl scale-in" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default VisitForm;