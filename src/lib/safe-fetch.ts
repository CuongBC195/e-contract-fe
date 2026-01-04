/**
 * Safe fetch helper that handles JSON parsing errors
 */
export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 100));
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      console.error('JSON parse error:', error, 'Response text:', text.substring(0, 100));
      return null;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

