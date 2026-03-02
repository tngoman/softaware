/**
 * Format date string to DD/MM/YYYY format
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format date and time to DD/MM/YYYY HH:MM format
 */
export const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export const formatDateForInput = (dateString?: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${year}-${month}-${day}`;
};

/**
 * Format number as currency (South African Rand)
 */
export const formatCurrency = (amount?: number | string): string => {
  const num = Number(amount);
  if (!num || isNaN(num)) return 'R0.00';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(num);
};

/**
 * Parse notes string into key-value pairs
 * Format: "Key: Value\nAnother Key: Another Value"
 */
export const parseNotes = (notes?: string): Record<string, string> => {
  if (!notes) return {};
  
  const noteList: Record<string, string> = {};
  const lines = notes.split('\n');
  
  lines.forEach(line => {
    if (line.includes(':')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim(); // In case value contains ':'
        if (key && value) {
          noteList[key] = value;
        }
      }
    }
  });
  
  return noteList;
};
