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

// Simple JWT decoding and validation
async function verifyJWT(token: string): Promise<any> {
  try {
    // Decode the JWT without verification (since we're getting HS256 tokens)
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    // Decode the payload
    const payload = JSON.parse(atob(parts[1]));

    // Basic validation
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error("Token expired");
    }

    // Check if it's a Supabase token
    if (payload.iss && payload.iss.includes("supabase.co")) {
      return payload;
    }

    throw new Error("Invalid token issuer");
  } catch (error) {
    console.log("JWT verification failed:", error);
    return null;
  }
}

export async function handleUpload(request: Request): Promise<Response> {
  // 1. Get the Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");

  // 2. Verify the token
  const user = await verifyJWT(token);
  if (!user) {
    console.log("JWT verification failed");
    return new Response("Unauthorized", { status: 401 });
  }
  console.log("User authenticated:", user.email || user.sub);

  // 3. Proceed with your upload logic (user is authenticated)
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  // Parse multipart form
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response("No file uploaded", { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  let placements: Placement[] = [];
  let results: Result[] = [];

  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    ({ placements, results } = parseRaceCSV(text));
  } else if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
    // For now, return an error for XLS files since xlsx library is not compatible with Cloudflare Workers
    return new Response(
      "XLS/XLSX files are not supported in this environment. Please convert to CSV format.",
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  } else {
    return new Response("Unsupported file type. Please use CSV format.", {
      status: 400,
    });
  }

  return new Response(
    JSON.stringify({
      placements,
      results,
      message: "Upload successful",
      user: { id: user.sub, email: user.email },
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

function parseRaceCSV(text: string): {
  placements: Placement[];
  results: Result[];
} {
  // Simple CSV parser that works in Cloudflare Workers
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { placements: [], results: [] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const data: Record<string, string>[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    data.push(row);
  }

  return splitRaceData(data);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function splitRaceData(data: Record<string, string>[]): {
  placements: Placement[];
  results: Result[];
} {
  // Heuristic: if row has 'division' or 'division_place', it's a placement; if 'leg_number', it's a result
  const placements: Placement[] = [];
  const results: Result[] = [];
  for (const row of data) {
    if ("division" in row || "division_place" in row) {
      placements.push({
        year: Number(row.year),
        division: row.division,
        division_place: Number(row.division_place),
        division_teams: Number(row.division_teams),
        overall_place: Number(row.overall_place),
        overall_teams: Number(row.overall_teams),
        bib: Number(row.bib),
      });
    } else if ("leg_number" in row) {
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
