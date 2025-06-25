import React, { useState } from "react";
import { supabase } from "../lib/supabase";

const defaultPlacement = {
  year: "",
  division: "",
  division_place: "",
  division_teams: "",
  overall_place: "",
  overall_teams: "",
  bib: "",
};
const defaultResult = {
  year: "",
  leg_number: "",
  leg_version: "",
  runner: "",
  lap_time: "",
};

const UploadView: React.FC = () => {
  const [placement, setPlacement] = useState({ ...defaultPlacement });
  const [results, setResults] = useState(Array(7).fill(null).map(() => ({ ...defaultResult })));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    placements: any[];
    results: any[];
  } | null>(null);

  // Placement field change
  const handlePlacementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlacement({ ...placement, [e.target.name]: e.target.value });
  };

  // Results field change
  const handleResultChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const newResults = results.slice();
    newResults[idx] = { ...newResults[idx], [e.target.name]: e.target.value };
    setResults(newResults);
  };

  // Populate form fields from parsedData
  React.useEffect(() => {
    if (parsedData) {
      if (parsedData.placements && parsedData.placements.length > 0) {
        setPlacement({ ...defaultPlacement, ...parsedData.placements[0] });
      }
      if (parsedData.results && parsedData.results.length > 0) {
        // Fill up to 7, pad with defaults if less
        const filled = parsedData.results.slice(0, 7).map(r => ({ ...defaultResult, ...r }));
        while (filled.length < 7) filled.push({ ...defaultResult });
        setResults(filled);
      }
    }
  }, [parsedData]);

  // Helper function to get runner ID by name
  const getRunnerIdByName = async (runnerName: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('runners')
      .select('id')
      .eq('name', runnerName)
      .single();
    
    if (error) {
      console.error(`Error finding runner "${runnerName}":`, error);
      return null;
    }
    
    return data?.id || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    
    // Validate placement
    for (const key of Object.keys(defaultPlacement)) {
      if (!placement[key as keyof typeof defaultPlacement]) {
        setError("All placement fields are required.");
        setLoading(false);
        return;
      }
    }
    
    // Validate results
    for (let i = 0; i < 7; ++i) {
      for (const key of Object.keys(defaultResult)) {
        if (!results[i][key as keyof typeof defaultResult]) {
          setError(`All fields required for result row ${i + 1}.`);
          setLoading(false);
          return;
        }
      }
    }
    
    try {
      // Upsert placement
      const { error: placementError } = await supabase.from("placements").upsert([
        {
          year: Number(placement.year),
          division: placement.division,
          division_place: Number(placement.division_place),
          division_teams: Number(placement.division_teams),
          overall_place: Number(placement.overall_place),
          overall_teams: Number(placement.overall_teams),
          bib: Number(placement.bib),
        },
      ]);
      
      if (placementError) {
        setError(placementError.message);
        setLoading(false);
        return;
      }
      
      // Process results - look up runner IDs and prepare for insertion
      const resultsToInsert = [];
      
      for (const result of results) {
        if (result.runner.trim()) {
          const runnerId = await getRunnerIdByName(result.runner);
          
          if (!runnerId) {
            setError(`Runner "${result.runner}" not found in the database. Please ensure the runner name matches exactly.`);
            setLoading(false);
            return;
          }
          
          resultsToInsert.push({
            year: Number(result.year),
            leg_number: Number(result.leg_number),
            leg_version: Number(result.leg_version),
            user_id: runnerId, // Use the runner ID instead of runner name
            lap_time: result.lap_time,
          });
        }
      }
      
      if (resultsToInsert.length === 0) {
        setError("No valid results to insert.");
        setLoading(false);
        return;
      }
      
      // Upsert results
      const { error: resultsError } = await supabase.from("results").upsert(resultsToInsert);
      
      if (resultsError) {
        setError(resultsError.message);
      } else {
        setMessage("Race data uploaded successfully!");
      }
    } catch (error) {
      setError(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setFileError('You must be logged in!');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (response.ok) {
        const responseData = await response.json();
        setParsedData({
          placements: responseData.placements || [],
          results: responseData.results || []
        });
        setFileError(null);
      } else {
        const errorText = await response.text();
        setFileError(`Upload failed: ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      setFileError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFileLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-md animate-fade-in">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">Upload Official Race Data</h1>
      {/* File Upload Section */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
        <input
          type="file"
          accept=".csv"
          onChange={e => {
            setFile(e.target.files?.[0] || null);
            setParsedData(null);
            setFileError(null);
          }}
          className="block w-full border border-gray-300 rounded-md shadow-sm p-2 mb-2"
        />
        <button
          className="btn-primary w-full mb-2"
          disabled={!file || fileLoading}
          onClick={async e => {
            e.preventDefault();
            if (!file) return;
            setFileLoading(true);
            setFileError(null);
            setParsedData(null);
            await uploadFile(file);
          }}
        >
          {fileLoading ? 'Uploading...' : 'Upload File'}
        </button>
        {fileError && <div className="text-red-600 text-sm">{fileError}</div>}
        {parsedData && (
          <div className="mt-4 text-xs max-h-48 overflow-auto bg-gray-50 p-2 rounded">
            <div className="font-bold mb-1">Placements:</div>
            <pre className="mb-2">{JSON.stringify(parsedData.placements, null, 2)}</pre>
            <div className="font-bold mb-1">Results:</div>
            <pre>{JSON.stringify(parsedData.results, null, 2)}</pre>
          </div>
        )}
      </div>
      {/* Placements Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold mb-2">Placements</h2>
        {Object.entries(defaultPlacement).map(([key, _]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</label>
            <input
              type={key === 'division' ? 'text' : 'number'}
              name={key}
              value={placement[key as keyof typeof defaultPlacement]}
              onChange={handlePlacementChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
        ))}
        <h2 className="text-lg font-semibold mt-6 mb-2">Results</h2>
        {results.map((result, idx) => (
          <div key={idx} className="border p-2 mb-2 rounded bg-gray-50">
            <div className="font-semibold mb-1">Leg {idx + 1}</div>
            {Object.entries(defaultResult).map(([key, _]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</label>
                <input
                  type={key === 'runner' || key === 'lap_time' ? 'text' : 'number'}
                  name={key}
                  value={result[key as keyof typeof defaultResult]}
                  onChange={e => handleResultChange(idx, e)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-xs"
                  required
                />
              </div>
            ))}
          </div>
        ))}
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {message && <div className="text-green-600 text-sm">{message}</div>}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload Data"}
        </button>
      </form>
    </div>
  );
};

export default UploadView; 