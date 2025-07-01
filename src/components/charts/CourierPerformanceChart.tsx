
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { courier: 'Leopard', success: 94.2, failed: 5.8 },
  { courier: 'PostEx', success: 91.5, failed: 8.5 },
  { courier: 'TCS', success: 89.3, failed: 10.7 },
  { courier: 'BlueEx', success: 87.1, failed: 12.9 },
];

export const CourierPerformanceChart = () => {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="courier" stroke="#666" />
          <YAxis stroke="#666" />
          <Tooltip />
          <Bar dataKey="success" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
