import { GoogleGenAI } from "@google/genai";

export const analyzeVisitNotes = async (
  notes: string, 
  clientName: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "环境配置中缺少 Gemini API Key。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      你是一名专业的销售助手。请分析以下关于客户 "${clientName}" 的拜访记录。
      
      记录内容: "${notes}"
      
      请提供简短的分析（50字以内），包含：
      1. 情感判断 (积极/中性/消极)
      2. 关键洞察
      3. 下一步行动建议
      
      请使用中文回答，纯文本格式。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "无法生成分析结果。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI 分析失败，请重试。";
  }
};