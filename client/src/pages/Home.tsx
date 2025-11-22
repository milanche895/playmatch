import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Link } from 'react-router-dom';

// Fix default icon paths for Leaflet in Vite
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

type Field = { _id: string; name: string; sport: string; lat: number; lng: number };

export default function Home() {
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    api.get('/api/fields').then((res) => setFields(res.data));
  }, []);

  const position: [number, number] = [40.7128, -74.006];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="h-[70vh] w-full rounded overflow-hidden border">
        <MapContainer center={position} zoom={12} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {fields.map((f) => (
            <Marker key={f._id} position={[f.lat, f.lng]}>
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-sm text-gray-600">{f.sport}</div>
                  <Link to={`/create?fieldId=${f._id}`} className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white rounded">
                    Create Match Here
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}


