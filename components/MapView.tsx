import React, { useEffect, useRef, useState } from 'react';
import { VisitRecord } from '../types';

interface MapViewProps {
  visits: VisitRecord[];
  onSelectVisit: (visit: VisitRecord) => void;
  apiKey: string;
}

const MapView: React.FC<MapViewProps> = ({ visits, onSelectVisit, apiKey }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setMapError(true);
      return;
    }

    if ((window as any).google && (window as any).google.maps) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);

    return () => {
    };
  }, [apiKey]);

  useEffect(() => {
    if (scriptLoaded && mapRef.current && !mapError && (window as any).google) {
      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 34.0522, lng: -118.2437 }, // 默认中心
        zoom: 4,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;

      visits.forEach((visit) => {
        if (visit.latitude && visit.longitude) {
          hasMarkers = true;
          const marker = new google.maps.Marker({
            position: { lat: visit.latitude, lng: visit.longitude },
            map,
            title: visit.clientName,
            animation: google.maps.Animation.DROP,
          });

          // Format date to Chinese format YYYY年MM月DD日
          let dateStr = '';
          if (visit.visitDate) {
             const cleanDate = visit.visitDate.split('T')[0];
             const parts = cleanDate.split('-');
             if (parts.length === 3) {
                 dateStr = `${parts[0]}年${parts[1]}月${parts[2]}日`;
             } else {
                 dateStr = cleanDate;
             }
          }

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="color: black; padding: 5px;">
                <h3 style="font-weight:bold; margin-bottom: 4px;">${visit.clientName}</h3>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #555;">${dateStr}</p>
                <button id="btn-${visit.id}" style="color: #4f46e5; text-decoration: none; border: 1px solid #4f46e5; background: white; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">查看详情</button>
              </div>
            `,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            setTimeout(() => {
              const btn = document.getElementById(`btn-${visit.id}`);
              if (btn) {
                btn.onclick = () => onSelectVisit(visit);
              }
            }, 100);
          });

          bounds.extend(marker.getPosition());
        }
      });

      if (hasMarkers) {
        map.fitBounds(bounds);
      }
    }
  }, [scriptLoaded, visits, onSelectVisit, mapError]);

  if (mapError || !apiKey) {
    return (
      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-1.447-.894L15 7m0 13V7m0 0L9 4" /></svg>
          <h3 className="text-xl font-bold text-slate-800 mb-2">无法加载地图</h3>
          <p className="text-slate-600 mb-4">
            {!apiKey ? "请在设置中配置 Google Maps API Key 以显示地图。" : "Google Maps 加载失败。"}
          </p>
          <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded text-left">
            <strong>列表模式预览:</strong>
            <ul className="list-disc ml-4 mt-2 space-y-1">
              {visits.map(v => (
                <li key={v.id} className="cursor-pointer hover:text-blue-600" onClick={() => onSelectVisit(v)}>
                  {v.clientName} ({v.region})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full min-h-[500px]" />;
};

export default MapView;