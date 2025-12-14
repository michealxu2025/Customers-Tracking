export interface VisitRecord {
  id: string;
  region: string;
  clientName: string;
  visitDate: string;
  visitNotes: string;
  locationLink: string;
  latitude?: number;
  longitude?: number;
  photos: string[]; // Array of ImgBB URLs
  aiAnalysis?: string; // Optional AI summary
}

export interface AppSettings {
  gasWebAppUrl: string;
  imgbbApiKey: string;
}

export type ViewMode = 'list' | 'form' | 'settings';

export interface ImgBBResponse {
  data: {
    url: string;
    display_url: string;
  };
  success: boolean;
}