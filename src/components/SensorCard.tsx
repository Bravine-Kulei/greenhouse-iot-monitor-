import React from 'react';
import {
  Thermometer,
  Droplets,
  AlertTriangle,
  CheckCircle2 } from
'lucide-react';
interface SensorCardProps {
  zoneName: string;
  temperature: number;
  humidity: number;
}
export function SensorCard({
  zoneName,
  temperature,
  humidity
}: SensorCardProps) {
  // Simple logic for status:
  // Temp ideal: 18-28°C, Humidity ideal: 40-70%
  const isTempWarning = temperature < 18 || temperature > 28;
  const isHumWarning = humidity < 40 || humidity > 70;
  const hasWarning = isTempWarning || isHumWarning;
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-lg font-semibold text-green-900">{zoneName}</h2>
        {hasWarning ?
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
            <AlertTriangle size={14} />
            <span>Warning</span>
          </div> :

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
            <CheckCircle2 size={14} />
            <span>Normal</span>
          </div>
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Temperature Metric */}
        <div
          className={`p-4 rounded-xl border ${isTempWarning ? 'bg-amber-50 border-amber-100' : 'bg-green-50/50 border-green-50'}`}>
          
          <div className="flex items-center gap-2 text-green-700/70 mb-2">
            <Thermometer
              size={18}
              className={isTempWarning ? 'text-amber-500' : 'text-green-500'} />
            
            <span className="text-sm font-medium">Temperature</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-3xl font-bold tracking-tight ${isTempWarning ? 'text-amber-700' : 'text-green-900'}`}>
              
              {temperature.toFixed(1)}
            </span>
            <span
              className={`text-lg font-medium ${isTempWarning ? 'text-amber-600/70' : 'text-green-700/50'}`}>
              
              °C
            </span>
          </div>
        </div>

        {/* Humidity Metric */}
        <div
          className={`p-4 rounded-xl border ${isHumWarning ? 'bg-amber-50 border-amber-100' : 'bg-green-50/50 border-green-50'}`}>
          
          <div className="flex items-center gap-2 text-green-700/70 mb-2">
            <Droplets
              size={18}
              className={isHumWarning ? 'text-amber-500' : 'text-blue-400'} />
            
            <span className="text-sm font-medium">Humidity</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-3xl font-bold tracking-tight ${isHumWarning ? 'text-amber-700' : 'text-green-900'}`}>
              
              {humidity.toFixed(1)}
            </span>
            <span
              className={`text-lg font-medium ${isHumWarning ? 'text-amber-600/70' : 'text-green-700/50'}`}>
              
              %
            </span>
          </div>
        </div>
      </div>
    </div>);

}