import React from 'react';

const VersionDisplay = () => {
  const version = import.meta.env.VITE_APP_VERSION || '2.0.0';
  const buildTime = import.meta.env.VITE_BUILD_TIME || new Date().toISOString();
  
  return (
    <div className="text-xs text-muted-foreground px-4 py-2">
      v{version} • {new Date(buildTime).toLocaleDateString()} {new Date(buildTime).toLocaleTimeString('en-US', { hour12: true })}
    </div>
  );
};

export default VersionDisplay;
