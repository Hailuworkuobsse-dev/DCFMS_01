import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const PALETTE = [
  '#1b4332', // forest-800
  '#2d6a4f', // forest-700
  '#b45309', // harvest-700
  '#d97706', // harvest-600
  '#78350f', // earth-900
  '#92400e', // earth-800
  '#44403c', // stone-700
  '#0369a1', // sky-700
];

export interface SimpleBarChartProps {
  data: Array<Record<string, any>>;
  dataKey: string;
  nameKey: string;
  color?: string;
  height?: number;
  unit?: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  dataKey,
  nameKey,
  color = '#1b4332',
  height = 240,
  unit,
}) => {
  return (
    <div style={{ width: '100%', height }} className="font-mono text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey={nameKey}
            tick={{ fill: '#78716c', fontSize: 11 }}
            axisLine={{ stroke: '#d6d3d1' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#78716c', fontSize: 11 }}
            axisLine={{ stroke: '#d6d3d1' }}
            tickLine={false}
            unit={unit}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #d6d3d1',
              borderRadius: '0px',
              boxShadow: 'none',
              fontSize: '12px',
            }}
          />
          <Bar dataKey={dataKey} fill={color} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface SimpleAreaChartProps {
  data: Array<Record<string, any>>;
  dataKey: string;
  nameKey: string;
  color?: string;
  height?: number;
}

export const SimpleAreaChart: React.FC<SimpleAreaChartProps> = ({
  data,
  dataKey,
  nameKey,
  color = '#2d6a4f',
  height = 240,
}) => {
  return (
    <div style={{ width: '100%', height }} className="font-mono text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey={nameKey}
            tick={{ fill: '#78716c', fontSize: 11 }}
            axisLine={{ stroke: '#d6d3d1' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#78716c', fontSize: 11 }}
            axisLine={{ stroke: '#d6d3d1' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #d6d3d1',
              borderRadius: '0px',
              boxShadow: 'none',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface SimplePieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({
  data,
  height = 240,
}) => {
  return (
    <div style={{ width: '100%', height }} className="font-mono text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #d6d3d1',
              borderRadius: '0px',
              boxShadow: 'none',
              fontSize: '12px',
            }}
          />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={75}
            innerRadius={40}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
