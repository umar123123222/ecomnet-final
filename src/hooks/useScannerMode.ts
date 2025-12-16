import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

export interface ScanResult {
  entry: string;
  type: 'order_number' | 'tracking_id' | 'unknown';
  status: 'success' | 'error';
  message: string;
  timestamp: Date;
  orderId?: string;
  courier?: string;
}

export interface ScannerStats {
  success: number;
  errors: number;
}

export interface PerformanceMetrics {
  avgProcessingTime: number;
  totalScans: number;
  scansPerMinute: number;
  queueLength: number;
  currentlyProcessing: number;
}

interface UseScannerModeOptions {
  storageKey: string; // e.g., 'dispatch_entry_type' or 'returns_entry_type'
  maxConcurrent?: number;
}

export function useScannerMode(options: UseScannerModeOptions) {
  const { storageKey, maxConcurrent = 5 } = options;

  // Scanner Mode States
  const [scannerModeActive, setScannerModeActive] = useState(false);
  const [scannerStats, setScannerStats] = useState<ScannerStats>({ success: 0, errors: 0 });
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [scanHistoryForExport, setScanHistoryForExport] = useState<any[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number>(Date.now());

  // Focus Management States
  const [hasFocus, setHasFocus] = useState(true);
  const [focusLostTime, setFocusLostTime] = useState<number | null>(null);
  const [scanBuffer, setScanBuffer] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Entry Type State with localStorage persistence
  const [entryType, setEntryType] = useState<'tracking_id' | 'order_number'>(() => {
    const saved = localStorage.getItem(storageKey);
    return (saved === 'order_number' ? 'order_number' : 'tracking_id') as 'tracking_id' | 'order_number';
  });

  // Performance Metrics
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    avgProcessingTime: 0,
    totalScans: 0,
    scansPerMinute: 0,
    queueLength: 0,
    currentlyProcessing: 0
  });
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [activeProcessing, setActiveProcessing] = useState<Set<string>>(new Set());
  const processingRef = useRef<Set<string>>(new Set());
  
  // Track currently processing count
  const currentlyProcessingCount = activeProcessing.size;

  // Scroll to top functionality
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Audio for feedback
  const successSound = useMemo(() => new Audio('/sounds/success.mp3'), []);
  const errorSound = useMemo(() => new Audio('/sounds/error.mp3'), []);

  // Preload audio on mount
  useEffect(() => {
    successSound.load();
    errorSound.load();
  }, [successSound, errorSound]);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Persist entry type to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, entryType);
  }, [entryType, storageKey]);

  // Play sounds
  const playSuccessSound = useCallback(() => {
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  }, [successSound]);

  const playErrorSound = useCallback(() => {
    errorSound.currentTime = 0;
    errorSound.play().catch(() => {});
  }, [errorSound]);

  // Add scan result
  const addScanResult = useCallback((result: ScanResult) => {
    setRecentScans(prev => [result, ...prev].slice(0, 50));
    setScanHistoryForExport(prev => [...prev, result]);
    setLastScanTime(Date.now());
    
    if (result.status === 'success') {
      setScannerStats(prev => ({ ...prev, success: prev.success + 1 }));
      playSuccessSound();
    } else {
      setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
      playErrorSound();
    }
  }, [playSuccessSound, playErrorSound]);

  // Reset scanner stats
  const resetScannerStats = useCallback(() => {
    setScannerStats({ success: 0, errors: 0 });
    setRecentScans([]);
    setScanHistoryForExport([]);
  }, []);

  // Focus scanner input
  const focusScannerInput = useCallback(() => {
    scannerInputRef.current?.focus();
  }, []);

  // Update performance metrics
  const updatePerformanceMetrics = useCallback((processingTime: number) => {
    setPerformanceMetrics(prev => {
      const newTotal = prev.totalScans + 1;
      const newAvg = ((prev.avgProcessingTime * prev.totalScans) + processingTime) / newTotal;
      return {
        ...prev,
        avgProcessingTime: Math.round(newAvg),
        totalScans: newTotal
      };
    });
  }, []);

  // Export scan history
  const exportScanHistory = useCallback(() => {
    if (scanHistoryForExport.length === 0) return null;
    
    const csvContent = [
      ['Entry', 'Type', 'Status', 'Message', 'Timestamp', 'Order ID'].join(','),
      ...scanHistoryForExport.map(scan => [
        scan.entry,
        scan.type,
        scan.status,
        `"${scan.message}"`,
        scan.timestamp.toISOString(),
        scan.orderId || ''
      ].join(','))
    ].join('\n');
    
    return csvContent;
  }, [scanHistoryForExport]);

  return {
    // Scanner mode
    scannerModeActive,
    setScannerModeActive,
    scannerStats,
    setScannerStats,
    recentScans,
    setRecentScans,
    scanHistoryForExport,
    setScanHistoryForExport,
    lastScanTime,
    setLastScanTime,
    
    // Focus management
    hasFocus,
    setHasFocus,
    focusLostTime,
    setFocusLostTime,
    scanBuffer,
    setScanBuffer,
    scannerInputRef,
    
    // Entry type
    entryType,
    setEntryType,
    
    // Performance
    performanceMetrics,
    setPerformanceMetrics,
    processingQueue,
    setProcessingQueue,
    activeProcessing,
    setActiveProcessing,
    processingRef,
    maxConcurrent,
    currentlyProcessingCount,
    
    // Scroll
    showScrollTop,
    scrollToTop,
    
    // Audio
    successSound,
    errorSound,
    playSuccessSound,
    playErrorSound,
    
    // Actions
    addScanResult,
    resetScannerStats,
    focusScannerInput,
    updatePerformanceMetrics,
    exportScanHistory
  };
}
