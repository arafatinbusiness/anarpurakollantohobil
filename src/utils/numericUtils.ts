/**
 * Utility functions for handling Bangla and English numeric input
 */

/**
 * Converts Bangla numerals to English numerals
 * @param banglaNumber String containing Bangla numerals (০-৯)
 * @returns String with English numerals (0-9)
 */
export const banglaToEnglish = (banglaNumber: string): string => {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = '';
  for (let i = 0; i < banglaNumber.length; i++) {
    const char = banglaNumber[i];
    const index = banglaDigits.indexOf(char);
    if (index !== -1) {
      result += englishDigits[index];
    } else {
      result += char;
    }
  }
  return result;
};

/**
 * Converts English numerals to Bangla numerals
 * @param englishNumber String containing English numerals (0-9)
 * @returns String with Bangla numerals (০-৯)
 */
export const englishToBangla = (englishNumber: string): string => {
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  
  let result = '';
  for (let i = 0; i < englishNumber.length; i++) {
    const char = englishNumber[i];
    const index = englishDigits.indexOf(char);
    if (index !== -1) {
      result += banglaDigits[index];
    } else {
      result += char;
    }
  }
  return result;
};

/**
 * Normalizes numeric input by converting Bangla to English and removing non-numeric characters
 * @param input String input that may contain Bangla or English numerals
 * @returns Clean numeric string ready for parsing
 */
export const normalizeNumericInput = (input: string): string => {
  // First convert Bangla numerals to English
  const englishInput = banglaToEnglish(input);
  
  // Remove everything except digits and decimal point
  const cleanInput = englishInput.replace(/[^\d.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleanInput.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleanInput;
};

/**
 * Parses a numeric string that may contain Bangla or English numerals
 * @param input String input that may contain Bangla or English numerals
 * @returns Parsed float number or NaN if invalid
 */
export const parseNumericInput = (input: string): number => {
  const normalized = normalizeNumericInput(input);
  return parseFloat(normalized);
};

/**
 * Formats a number as Bangla currency string
 * @param amount Number to format
 * @returns Formatted string with Bangla numerals and currency symbol
 */
export const formatBanglaCurrency = (amount: number): string => {
  if (isNaN(amount)) return '০';
  
  const formatted = new Intl.NumberFormat('bn-BD').format(amount);
  return `${formatted} টাকা`;
};

/**
 * Formats a number as English currency string
 * @param amount Number to format
 * @returns Formatted string with English numerals and currency symbol
 */
export const formatEnglishCurrency = (amount: number): string => {
  if (isNaN(amount)) return '0';
  
  const formatted = new Intl.NumberFormat('en-US').format(amount);
  return `৳${formatted}`;
};