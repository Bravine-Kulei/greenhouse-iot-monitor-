import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend } from
'recharts';
import { Activity } from 'lucide-react';
interface DataPoint {
  time: string;
  tempA: number;
  tempB: number;
  humA: number;
  humB: number;
}
interface TrendChartProps {
  data: DataPoint[];
}
export function TrendChart({ data }: TrendChartProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100">
      <div className="flex items-center gap-2 mb-6">
        <Activity size={18} className="text-green-600" />
        <h3 className="text-lg font-semibold text-green-900">Sensor Trends</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature Chart */}
        <div>
          <p className="text-sm font-medium text-green-700/70 mb-3">
            Temperature (°C)
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis
                  dataKey="time"
                  tick={{
                    fontSize: 11,
                    fill: '#6b7280'
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke: '#d1fae5'
                  }} />
                
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{
                    fontSize: 11,
                    fill: '#6b7280'
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke: '#d1fae5'
                  }}
                  width={35} />
                
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #d1fae5',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }} />
                
                <Line
                  type="monotone"
                  dataKey="tempA"
                  name="Zone A"
                  stroke="#2D6A4F"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#2D6A4F'
                  }} />
                
                <Line
                  type="monotone"
                  dataKey="tempB"
                  name="Zone B"
                  stroke="#95D5B2"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#95D5B2'
                  }} />
                
                <Legend
                  iconType="line"
                  wrapperStyle={{
                    fontSize: '12px',
                    paddingTop: '8px'
                  }} />
                
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Humidity Chart */}
        <div>
          <p className="text-sm font-medium text-green-700/70 mb-3">
            Humidity (%)
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis
                  dataKey="time"
                  tick={{
                    fontSize: 11,
                    fill: '#6b7280'
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke: '#d1fae5'
                  }} />
                
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{
                    fontSize: 11,
                    fill: '#6b7280'
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke: '#d1fae5'
                  }}
                  width={35} />
                
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #d1fae5',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }} />
                
                <Line
                  type="monotone"
                  dataKey="humA"
                  name="Zone A"
                  stroke="#1B4332"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#1B4332'
                  }} />
                
                <Line
                  type="monotone"
                  dataKey="humB"
                  name="Zone B"
                  stroke="#52B788"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#52B788'
                  }} />
                
                <Legend
                  iconType="line"
                  wrapperStyle={{
                    fontSize: '12px',
                    paddingTop: '8px'
                  }} />
                
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>);

}