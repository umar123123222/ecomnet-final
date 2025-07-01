
import React from 'react';
import { Package, Search, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: 'package' | 'search' | 'alert';
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'package',
  title,
  description,
  action,
  className = ''
}) => {
  const iconMap = {
    package: Package,
    search: Search,
    alert: AlertCircle
  };

  const Icon = iconMap[icon];

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="rounded-full bg-slate-100 p-4 mb-4">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      {description && (
        <p className="text-slate-600 text-center max-w-md mb-6">{description}</p>
      )}
      {action && action}
    </div>
  );
};

export default EmptyState;
