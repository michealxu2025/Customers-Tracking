import { VisitRecord, AppSettings, ImgBBResponse } from '../types';

export const getVisits = async (settings: AppSettings): Promise<VisitRecord[]> => {
  // Live Mode: Fetch from Google Apps Script
  let url = settings.gasWebAppUrl?.trim();
  if (!url) throw new Error("未配置 Google Apps Script URL。请在设置中添加。");
  
  // Validation: Common mistake check
  if (url.includes('script.google.com') && (url.includes('/edit') || url.includes('/dev'))) {
    throw new Error("配置的 URL 似乎是脚本编辑器地址 (包含 /edit 或 /dev)。请重新部署为 Web 应用，并使用生成的 /exec 结尾的 URL。");
  }

  // Ensure URL ends with /exec if it's a standard GAS URL (warning only, as proxies exist)
  if (url.includes('script.google.com') && !url.endsWith('/exec')) {
     console.warn("Warning: GAS URL should typically end in /exec");
  }

  // Safe URL construction handling existing query parameters
  const separator = url.includes('?') ? '&' : '?';
  const fetchUrl = `${url}${separator}action=read`;

  try {
    // IMPORTANT for GAS CORS:
    // 1. credentials: 'omit' is required if the script is deployed as "Anyone".
    // 2. Do NOT set custom headers for GET requests to avoid preflight.
    const response = await fetch(fetchUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
    }

    // Handle potential HTML error pages from Google (e.g., 404, 401, or script errors)
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      // If parsing fails, it's likely an HTML error page from Google
      if (text.includes("Google Drive") || text.includes("Google Docs")) {
         throw new Error(`服务器返回了 HTML 而不是 JSON。这通常意味着 URL 错误或权限不足 (未设置为 'Anyone')。`);
      }
      throw new Error(`服务器返回了无效数据。响应片段: ${text.substring(0, 50)}...`);
    }

    if (result.status === 'success') {
      return result.data;
    } else {
      throw new Error(result.message || '获取数据失败');
    }
  } catch (error: any) {
    console.error("GAS Fetch Error", error);
    // Clean up the error message for the UI
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error("连接失败 (Failed to fetch)。请检查:\n1. 部署权限是否为 'Anyone' (所有人)\n2. URL 是否正确 (结尾为 /exec)\n3. 网络连接是否正常");
    }
    throw error;
  }
};

export const saveVisit = async (visit: VisitRecord, settings: AppSettings): Promise<void> => {
  // Live Mode: Post to Google Apps Script
  let url = settings.gasWebAppUrl?.trim();
  if (!url) throw new Error("未配置 Google Apps Script URL。");

  if (url.includes('/edit')) {
    throw new Error("URL 包含 /edit，无法用于写入数据。请使用 /exec URL。");
  }

  const payload = JSON.stringify({ action: 'write', data: visit });
  
  // IMPORTANT:
  // We explicitly set Content-Type to text/plain. 
  // This prevents the browser from sending a CORS Preflight (OPTIONS) request, 
  // which Google Apps Script does not support and causes "Failed to fetch".
  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: payload,
    });
    
    if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status}`);
    }

    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error(`保存失败: 服务器返回无效数据。可能部署权限不是 'Anyone'。`);
    }
    
    if (result.status !== 'success') {
      throw new Error(result.message || '保存到 Google Sheets 失败');
    }
  } catch (error: any) {
    console.error("GAS Save Error", error);
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error("保存失败: 无法连接服务器。请确保 GAS 部署为 'Anyone' 且 URL 正确。");
    }
    throw error;
  }
};

export const deleteVisit = async (visitId: string, settings: AppSettings): Promise<void> => {
  let url = settings.gasWebAppUrl?.trim();
  if (!url) throw new Error("未配置 Google Apps Script URL。");

  const payload = JSON.stringify({ action: 'delete', id: visitId });

  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: payload,
    });
    
    if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status}`);
    }

    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error(`删除失败: 服务器返回无效数据。`);
    }
    
    if (result.status !== 'success') {
      throw new Error(result.message || '删除失败');
    }
  } catch (error: any) {
    console.error("GAS Delete Error", error);
    throw new Error("删除请求发送失败: " + error.message);
  }
};

export const uploadImageToImgBB = async (file: File, apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("缺少 ImgBB API Key");

  const formData = new FormData();
  formData.append('image', file);
  
  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`ImgBB 上传失败: ${response.status}`);
    }

    const result: ImgBBResponse = await response.json();
    if (result.success) {
      return result.data.url;
    } else {
      throw new Error('图片上传失败: ' + (result as any).error?.message || '未知错误');
    }
  } catch (error: any) {
     throw new Error("图片上传网络错误: " + error.message);
  }
};