import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface HandheldScannerContextType {
  isConnected: boolean;
  deviceName: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  onScan: (callback: (data: string) => void) => () => void;
}

const HandheldScannerContext = createContext<HandheldScannerContextType | undefined>(undefined);

export const HandheldScannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [scanCallbacks, setScanCallbacks] = useState<((data: string) => void)[]>([]);
  const [buffer, setBuffer] = useState('');

  // Listen for keyboard input (HID mode)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isConnected) return;

      if (e.key === 'Enter') {
        // Scanner sends Enter after data
        if (buffer.trim()) {
          scanCallbacks.forEach(cb => cb(buffer.trim()));
          setBuffer('');
        }
      } else if (e.key.length === 1) {
        // Accumulate barcode data
        setBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [isConnected, buffer, scanCallbacks]);

  // Load connection state from localStorage
  useEffect(() => {
    const savedDevice = localStorage.getItem('handheld_scanner_device');
    if (savedDevice) {
      setDeviceName(savedDevice);
      setIsConnected(true);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      // For HID keyboard mode, we just need to mark as connected
      // No actual Bluetooth API needed for keyboard emulation
      const deviceName = 'Handheld Scanner (HID Mode)';
      setDeviceName(deviceName);
      setIsConnected(true);
      localStorage.setItem('handheld_scanner_device', deviceName);
    } catch (error) {
      console.error('Failed to connect scanner:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setDeviceName(null);
    localStorage.removeItem('handheld_scanner_device');
    setBuffer('');
  }, []);

  const onScan = useCallback((callback: (data: string) => void) => {
    setScanCallbacks(prev => [...prev, callback]);
    
    // Return cleanup function
    return () => {
      setScanCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  return (
    <HandheldScannerContext.Provider value={{ isConnected, deviceName, connect, disconnect, onScan }}>
      {children}
    </HandheldScannerContext.Provider>
  );
};

export const useHandheldScanner = () => {
  const context = useContext(HandheldScannerContext);
  if (!context) {
    throw new Error('useHandheldScanner must be used within HandheldScannerProvider');
  }
  return context;
};
