import * as xlsxModule from 'xlsx';
const XLSX = (xlsxModule as any).default || xlsxModule;

/**
 * Downloads job results safely as a real binary Excel (.xlsx), CSV, or ZIP file.
 * Automatically prevents HTML fallbacks and uses client-side SheetJS if server fails.
 */
export async function downloadJobResults(
  jobId: string,
  type: 'excel' | 'summary' | 'csv' | 'zip' = 'excel',
  fallbackJobName?: string
): Promise<void> {
  const baseName = (fallbackJobName || `match_results_${jobId}`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const ext = type === 'csv' ? 'csv' : type === 'zip' ? 'zip' : 'xlsx';
  const filename = `${baseName}.${ext}`;

  try {
    const response = await fetch(`/api/v1/jobs/${jobId}/download?type=${type}`, {
      headers: {
        'Accept':
          type === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
      },
    });

    const contentType = response.headers.get('content-type') || '';

    // If server returned error or HTML (e.g. Vite SPA fallback)
    if (!response.ok || contentType.includes('text/html')) {
      console.warn(`Server download returned status ${response.status} with content-type "${contentType}", using client-side export`);
      await clientSideExport(jobId, type, baseName);
      return;
    }

    const blob = await response.blob();
    const mime =
      type === 'csv'
        ? 'text/csv;charset=utf-8;'
        : type === 'zip'
        ? 'application/zip'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const safeBlob = new Blob([blob], { type: mime });
    const url = window.URL.createObjectURL(safeBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 1500);
  } catch (err) {
    console.warn('Network download failed, executing client-side Excel generation fallback:', err);
    await clientSideExport(jobId, type, baseName);
  }
}

async function clientSideExport(
  jobId: string,
  type: 'excel' | 'summary' | 'csv' | 'zip',
  baseName: string
) {
  try {
    const res = await fetch(`/api/v1/jobs/${jobId}/results?page=1&limit=50000`);
    if (!res.ok) throw new Error('Could not fetch results from server');
    const data = await res.json();
    const rows = data.items || [];
    if (!rows.length) {
      alert('No results available to download.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matched_Results');

    if (type === 'csv') {
      XLSX.writeFile(wb, `${baseName}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `${baseName}.xlsx`, { bookType: 'xlsx' });
    }
  } catch (e: any) {
    alert('Failed to generate Excel file: ' + (e.message || 'Please retry'));
  }
}
