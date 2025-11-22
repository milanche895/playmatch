import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useLocation, useNavigate } from 'react-router-dom';

type Field = { _id: string; name: string; sport: string; lat: number; lng: number };

export default function CreateMatch() {
  const [fields, setFields] = useState<Field[]>([]);
  const [sport, setSport] = useState<string>('football');
  const [fieldId, setFieldId] = useState<string>('');
  const [dateTime, setDateTime] = useState<string>('');
  const [playersNeeded, setPlayersNeeded] = useState<number>(10);
  const navigate = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    api.get('/api/fields').then((res) => setFields(res.data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const preselect = params.get('fieldId');
    if (preselect) setFieldId(preselect);
  }, [search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post('/api/matches', { sport, fieldId, dateTime, playersNeeded });
    navigate(`/matches/${res.data._id}`);
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Create a Match</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm mb-1">Sport</label>
          <select className="w-full border rounded p-2" value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="tennis">Tennis</option>
            <option value="volleyball">Volleyball</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Field</label>
          <select className="w-full border rounded p-2" value={fieldId} onChange={(e) => setFieldId(e.target.value)} required>
            <option value="">Select field</option>
            {fields.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name} — {f.sport}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Date & Time</label>
          <input type="datetime-local" className="w-full border rounded p-2" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Players Needed</label>
          <input type="number" min={1} className="w-full border rounded p-2" value={playersNeeded} onChange={(e) => setPlayersNeeded(Number(e.target.value))} required />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Create</button>
      </form>
    </div>
  );
}


