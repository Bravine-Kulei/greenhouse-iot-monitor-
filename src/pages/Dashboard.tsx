import React, { useEffect, useState, useRef } from 'react';
import { Header } from '../components/Header';
import { SensorCard } from '../components/SensorCard';
import { TrendChart } from '../components/TrendChart';
import { AlertsPanel } from '../components/AlertsPanel';
import { RefreshCw } from 'lucide-react';

interface SensorData {
  temp: number;
  hum: number;
}

interface DataPoint {
  time: string;
  tempA: number;
  tempB: number;
  humA: number;
  humB: number;
}

const MAX_HISTORY = 20;

export function Dashboard() {
  const [zoneA, setZoneA] = useState<SensorData>({
    temp: 24.2,
    hum: 58.5
  });
  const [zoneB, setZoneB] = useState<SensorData>({
    temp: 25.1,
    hum: 62.0
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [history, setHistory] = useState<DataPoint[]>([]);

  const zoneARef = useRef(zoneA);
  const zoneBRef = useRef(zoneB);
  zoneARef.current = zoneA;
  zoneBRef.current = zoneB;

  // Helper to generate realistic fluctuations
  const fluctuate = (
  current: number,
  maxChange: number,
  min: number,
  max: number) =>
  {
    const change = Math.random() * maxChange * 2 - maxChange;
    let newValue = current + change;
    if (newValue < min) newValue = min;
    if (newValue > max) newValue = max;
    return newValue;
  };

  // Initialize history with some seed data
  useEffect(() => {
    const now = new Date();
    const seed: DataPoint[] = [];
    let tA = 24.2,tB = 25.1,hA = 58.5,hB = 62.0;
    for (let i = MAX_HISTORY - 1; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 4000);
      tA = fluctuate(tA, 0.3, 15, 35);
      tB = fluctuate(tB, 0.4, 15, 35);
      hA = fluctuate(hA, 1.5, 30, 90);
      hB = fluctuate(hB, 1.2, 30, 90);
      seed.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tempA: parseFloat(tA.toFixed(1)),
        tempB: parseFloat(tB.toFixed(1)),
        humA: parseFloat(hA.toFixed(1)),
        humB: parseFloat(hB.toFixed(1))
      });
    }
    setZoneA({ temp: tA, hum: hA });
    setZoneB({ temp: tB, hum: hB });
    setHistory(seed);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsUpdating(true);

      const newA = {
        temp: fluctuate(zoneARef.current.temp, 0.3, 15, 35),
        hum: fluctuate(zoneARef.current.hum, 1.5, 30, 90)
      };
      const newB = {
        temp: fluctuate(zoneBRef.current.temp, 0.4, 15, 35),
        hum: fluctuate(zoneBRef.current.hum, 1.2, 30, 90)
      };

      setZoneA(newA);
      setZoneB(newB);

      const now = new Date();
      setLastUpdated(now);

      setHistory((prev) => {
        const point: DataPoint = {
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          tempA: parseFloat(newA.temp.toFixed(1)),
          tempB: parseFloat(newB.temp.toFixed(1)),
          humA: parseFloat(newA.hum.toFixed(1)),
          humB: parseFloat(newB.hum.toFixed(1))
        };
        const updated = [...prev, point];
        return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
      });

      setTimeout(() => setIsUpdating(false), 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-green-50/50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-green-950">Live Overview</h2>
            <p className="text-green-700/70 mt-1">
              Monitoring 2 active sensor zones
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-green-600/80 bg-green-100/50 px-3 py-1.5 rounded-full">
            <RefreshCw
              size={14}
              className={isUpdating ? 'animate-spin text-green-600' : ''} />
            
            <span>
              Updated{' '}
              {lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SensorCard
            zoneName="Zone A - North Corner"
            temperature={zoneA.temp}
            humidity={zoneA.hum} />
          
          <SensorCard
            zoneName="Zone B - South Corner"
            temperature={zoneB.temp}
            humidity={zoneB.hum} />
          
        </div>

        <div className="mt-6">
          <TrendChart data={history} />
        </div>

        <div className="mt-6">
          <AlertsPanel zoneA={zoneA} zoneB={zoneB} />
        </div>

        <div className="mt-6 bg-white/60 rounded-xl p-5 border border-green-100/50">
          <h3 className="text-sm font-semibold text-green-900 mb-2">
            System Info
          </h3>
          <ul className="text-sm text-green-700/80 space-y-1 list-disc list-inside">
            <li>Optimal temperature: 18°C – 28°C</li>
            <li>Optimal humidity: 40% – 70%</li>
            <li>ESP8266 + DHT11 sensors polling every 4 seconds</li>
          </ul>
        </div>
      </main>
    </div>);

}