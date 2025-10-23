import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParseError {
  row: number;
  field?: string;
  message: string;
  value?: any;
}

export interface ParseResult {
  data: any[];
  errors: ParseError[];
  meta: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

export const detectFileType = (file: File): 'csv' | 'excel' | 'unknown' => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv') return 'csv';
  if (extension === 'xlsx' || extension === 'xls') return 'excel';
  
  return 'unknown';
};

export const parseCSV = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        const errors: ParseError[] = [];
        
        // Check for parsing errors
        if (results.errors.length > 0) {
          results.errors.forEach((error) => {
            errors.push({
              row: error.row || 0,
              message: error.message,
            });
          });
        }

        const validData = results.data.filter((row: any) => {
          // Filter out completely empty rows
          return Object.values(row).some(value => value !== null && value !== undefined && value !== '');
        });

        resolve({
          data: validData,
          errors,
          meta: {
            totalRows: results.data.length,
            validRows: validData.length,
            invalidRows: results.data.length - validData.length,
          },
        });
      },
      error: (error) => {
        resolve({
          data: [],
          errors: [{ row: 0, message: `CSV parsing failed: ${error.message}` }],
          meta: { totalRows: 0, validRows: 0, invalidRows: 0 },
        });
      },
    });
  });
};

export const parseExcel = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: '',
        });

        // Transform headers to lowercase with underscores
        const transformedData = jsonData.map((row: any) => {
          const transformedRow: any = {};
          Object.keys(row).forEach(key => {
            const transformedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
            transformedRow[transformedKey] = row[key];
          });
          return transformedRow;
        });

        const validData = transformedData.filter((row: any) => {
          return Object.values(row).some(value => value !== null && value !== undefined && value !== '');
        });

        resolve({
          data: validData,
          errors: [],
          meta: {
            totalRows: transformedData.length,
            validRows: validData.length,
            invalidRows: transformedData.length - validData.length,
          },
        });
      } catch (error) {
        resolve({
          data: [],
          errors: [{ row: 0, message: `Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          meta: { totalRows: 0, validRows: 0, invalidRows: 0 },
        });
      }
    };

    reader.onerror = () => {
      resolve({
        data: [],
        errors: [{ row: 0, message: 'Failed to read file' }],
        meta: { totalRows: 0, validRows: 0, invalidRows: 0 },
      });
    };

    reader.readAsBinaryString(file);
  });
};

export const parseFile = async (file: File): Promise<ParseResult> => {
  const fileType = detectFileType(file);
  
  if (fileType === 'csv') {
    return parseCSV(file);
  } else if (fileType === 'excel') {
    return parseExcel(file);
  } else {
    return {
      data: [],
      errors: [{ row: 0, message: 'Unsupported file type. Please upload a CSV or Excel file.' }],
      meta: { totalRows: 0, validRows: 0, invalidRows: 0 },
    };
  }
};
