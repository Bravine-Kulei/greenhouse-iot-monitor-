import React from 'react';
import { AlertTriangle, CheckCircle2, Leaf } from 'lucide-react';
interface AlertsPanelProps {
  zoneA: {
    temp: number;
    hum: number;
  };
  zoneB: {
    temp: number;
    hum: number;
  };
}
interface Alert {
  zone: string;
  metric: string;
  value: string;
  message: string;
}
export function AlertsPanel({ zoneA, zoneB }: AlertsPanelProps) {
  const alerts: Alert[] = [];
  // Check Zone A
  if (zoneA.temp < 18)
  alerts.push({
    zone: 'Zone A',
    metric: 'Temperature',
    value: `${zoneA.temp.toFixed(1)}°C`,
    message: 'Below optimal range (18°C)'
  });
  if (zoneA.temp > 28)
  alerts.push({
    zone: 'Zone A',
    metric: 'Temperature',
    value: `${zoneA.temp.toFixed(1)}°C`,
    message: 'Above optimal range (28°C)'
  });
  if (zoneA.hum < 40)
  alerts.push({
    zone: 'Zone A',
    metric: 'Humidity',
    value: `${zoneA.hum.toFixed(1)}%`,
    message: 'Below optimal range (40%)'
  });
  if (zoneA.hum > 70)
  alerts.push({
    zone: 'Zone A',
    metric: 'Humidity',
    value: `${zoneA.hum.toFixed(1)}%`,
    message: 'Above optimal range (70%)'
  });
  // Check Zone B
  if (zoneB.temp < 18)
  alerts.push({
    zone: 'Zone B',
    metric: 'Temperature',
    value: `${zoneB.temp.toFixed(1)}°C`,
    message: 'Below optimal range (18°C)'
  });
  if (zoneB.temp > 28)
  alerts.push({
    zone: 'Zone B',
    metric: 'Temperature',
    value: `${zoneB.temp.toFixed(1)}°C`,
    message: 'Above optimal range (28°C)'
  });
  if (zoneB.hum < 40)
  alerts.push({
    zone: 'Zone B',
    metric: 'Humidity',
    value: `${zoneB.hum.toFixed(1)}%`,
    message: 'Below optimal range (40%)'
  });
  if (zoneB.hum > 70)
  alerts.push({
    zone: 'Zone B',
    metric: 'Humidity',
    value: `${zoneB.hum.toFixed(1)}%`,
    message: 'Above optimal range (70%)'
  });
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100">
      <div className="flex items-center gap-2 mb-4">
        {alerts.length > 0 ?
        <AlertTriangle size={18} className="text-amber-500" /> :

        <Leaf size={18} className="text-green-600" />
        }
        <h3 className="text-lg font-semibold text-green-900">
          {alerts.length > 0 ?
          `${alerts.length} Active Alert${alerts.length > 1 ? 's' : ''}` :
          'All Systems Normal'}
        </h3>
      </div>

      {alerts.length === 0 ?
      <div className="flex items-center gap-3 p-4 bg-green-50/50 rounded-xl border border-green-100/50">
          <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          <p className="text-sm text-green-700">
            All sensor readings are within the optimal greenhouse range. Your
            plants are happy!
          </p>
        </div> :

      <div className="space-y-2">
          {alerts.map((alert, i) =>
        <div
          key={i}
          className="flex items-start gap-3 p-3 bg-amber-50/70 rounded-xl border border-amber-100">
          
              <AlertTriangle
            size={16}
            className="text-amber-500 mt-0.5 shrink-0" />
          
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {alert.zone} · {alert.metric}: {alert.value}
                </p>
                <p className="text-xs text-amber-600/80 mt-0.5">
                  {alert.message}
                </p>
              </div>
            </div>
        )}
        </div>
      }
    </div>);

}