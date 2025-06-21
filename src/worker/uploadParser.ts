import { parse as parseCSV } from 'papaparse';

export type Placement = {
  year: number;
  division: string;
  division_place: number;
  division_teams: number;
  overall_place: number;
  overall_teams: number;
  bib: number;
};

export type Result = {
  year: number;
  leg_number: number;
  leg_version: number;
  runner: string;
  lap_time: string; // ISO 8601 duration or HH:MM:SS string
};

export async function handleUpload(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response('Expected multipart/form-data', { status: 400 });
  }

  // Parse multipart form
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return new Response('No file uploaded', { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  let placements: Placement[] = [];
  let results: Result[] = [];

  if (fileName.endsWith('.csv')) {
    const text = await file.text();
    ({ placements, results } = parseRaceCSV(text));
  } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
    // For now, return an error for XLS files since xlsx library is not compatible with Cloudflare Workers
    return new Response('XLS/XLSX files are not supported in this environment. Please convert to CSV format.', { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    return new Response('Unsupported file type. Please use CSV format.', { status: 400 });
  }

  return new Response(JSON.stringify({ placements, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseRaceCSV(text: string): { placements: Placement[]; results: Result[] } {
  // Use PapaParse to parse CSV
  const { data } = parseCSV(text, { header: true, skipEmptyLines: true });
  return splitRaceData(data as Record<string, string>[]);
}

function splitRaceData(data: Record<string, string>[]): { placements: Placement[]; results: Result[] } {
  // Heuristic: if row has 'division' or 'division_place', it's a placement; if 'leg_number', it's a result
  const placements: Placement[] = [];
  const results: Result[] = [];
  for (const row of data) {
    if ('division' in row || 'division_place' in row) {
      placements.push({
        year: Number(row.year),
        division: row.division,
        division_place: Number(row.division_place),
        division_teams: Number(row.division_teams),
        overall_place: Number(row.overall_place),
        overall_teams: Number(row.overall_teams),
        bib: Number(row.bib),
      });
    } else if ('leg_number' in row) {
      results.push({
        year: Number(row.year),
        leg_number: Number(row.leg_number),
        leg_version: Number(row.leg_version),
        runner: row.runner,
        lap_time: row.lap_time,
      });
    }
  }
  return { placements, results };
} 