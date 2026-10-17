'use client';

import { useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Spinner } from '@/components/ui/spinner';

type Point = { lat: number; lng: number };
function PointPicker({ value, onPick }: { value: Point | null; onPick: (point: Point) => void }) {
  useMapEvents({ click(event) { onPick({ lat: event.latlng.lat, lng: event.latlng.lng }); } });
  return value ? <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: .9 }} /> : null;
}

export default function AddressPicker({ onClose, onSelect, initialPoint }: { onClose: () => void; onSelect: (address: string, point: Point) => void; initialPoint: Point | null }) {
  const [point, setPoint] = useState<Point | null>(initialPoint);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (!point) { setError('Отметьте место на карте'); return; }
    setLoading(true); setError('');
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2'); url.searchParams.set('lat', String(point.lat)); url.searchParams.set('lon', String(point.lng)); url.searchParams.set('zoom', '18'); url.searchParams.set('addressdetails', '1');
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Сервис адресов временно недоступен');
      const data = await response.json() as { display_name?: string };
      const resolved = data.display_name?.trim();
      if (!resolved) throw new Error('Не удалось определить адрес для точки');
      onSelect(resolved, point); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось получить адрес'); }
    finally { setLoading(false); }
  }
  return <div className="address-picker-backdrop" onClick={onClose}>
    <section className="address-picker" role="dialog" aria-modal="true" aria-label="Выбор адреса на карте" onClick={(e) => e.stopPropagation()}>
      <header><h2>Выберите точку доставки</h2><button type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
      <p>Нажмите на карту, чтобы отметить адрес.</p>
      <MapContainer center={point ? [point.lat, point.lng] : [55.751244, 37.618423]} zoom={point ? 16 : 11} scrollWheelZoom className="address-picker-map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <PointPicker value={point} onPick={setPoint} />
      </MapContainer>
      {error && <p role="alert" className="address-picker-error">{error}</p>}
      <footer><span>{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'Точка не выбрана'}</span><button type="button" disabled={loading || !point} onClick={confirm}>{loading ? <><Spinner /> Определяем адрес…</> : 'Подставить адрес'}</button></footer>
      <small>Адрес определяется сервисом OpenStreetMap Nominatim. Карта: © OpenStreetMap contributors. Результат можно поправить вручную.</small>
    </section>
  </div>;
}
