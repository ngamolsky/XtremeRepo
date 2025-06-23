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

const UploadResultsView: React.FC = () => {
  const [placement, setPlacement] = useState({ ...defaultPlacement });
  const [results, setResults] = useState(
    Array(7)
      .fill(null)
      .map(() => ({ ...defaultResult }))
  );
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
  const handleResultChange = (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
        const filled = parsedData.results
          .slice(0, 7)
          .map((r) => ({ ...defaultResult, ...r }));
        while (filled.length < 7) filled.push({ ...defaultResult });
        setResults(filled);
      }
    }
  }, [parsedData]);

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

    // Upsert results
    const resultsToInsert = results.map((r) => ({
      year: Number(r.year),
      leg_number: Number(r.leg_number),
      leg_version: Number(r.leg_version),
      runner: r.runner,
      lap_time: r.lap_time,
    }));

    const { error: resultsError } = await supabase
      .from("results")
      .upsert(resultsToInsert);
    if (resultsError) {
      setError(resultsError.message);
    } else {
      setMessage("Race data uploaded successfully!");
    }
    setLoading(false);
  };

  const uploadFile = async (file: File) => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setFileError("You must be logged in!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (response.ok) {
        const responseData = await response.json();
        setParsedData({
          placements: responseData.placements || [],
          results: responseData.results || [],
        });
        setFileError(null);
      } else {
        const errorText = await response.text();
        setFileError(`Upload failed: ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      setFileError(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setFileLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        Upload Race Results
      </h2>

      {/* File Upload Section */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-medium mb-4">Upload CSV File</h3>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setParsedData(null);
            setFileError(null);
          }}
          className="block w-full border border-gray-300 rounded-md shadow-sm p-2 mb-2"
        />
        <button
          className="btn-primary w-full mb-2"
          disabled={!file || fileLoading}
          onClick={async (e) => {
            e.preventDefault();
            if (!file) return;
            setFileLoading(true);
            setFileError(null);
            setParsedData(null);
            await uploadFile(file);
          }}
        >
          {fileLoading ? "Uploading..." : "Upload File"}
        </button>
        {fileError && <div className="text-red-600 text-sm">{fileError}</div>}
        {parsedData && (
          <div className="mt-4 text-xs max-h-48 overflow-auto bg-white p-3 rounded border">
            <div className="font-bold mb-1">Placements:</div>
            <pre className="mb-2">
              {JSON.stringify(parsedData.placements, null, 2)}
            </pre>
            <div className="font-bold mb-1">Results:</div>
            <pre>{JSON.stringify(parsedData.results, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Manual Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Team Placement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(defaultPlacement).map(([key, _]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 capitalize mb-1">
                  {key.replace(/_/g, " ")}
                </label>
                <input
                  type={key === "division" ? "text" : "number"}
                  name={key}
                  value={placement[key as keyof typeof defaultPlacement]}
                  onChange={handlePlacementChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Leg Results</h3>
          <div className="space-y-4">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="border border-gray-200 p-4 rounded-lg bg-gray-50"
              >
                <div className="font-medium mb-3 text-gray-900">
                  Leg {idx + 1}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {Object.entries(defaultResult).map(([key, _]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-700 capitalize mb-1">
                        {key.replace(/_/g, " ")}
                      </label>
                      <input
                        type={
                          key === "runner" || key === "lap_time"
                            ? "text"
                            : "number"
                        }
                        name={key}
                        value={result[key as keyof typeof defaultResult]}
                        onChange={(e) => handleResultChange(idx, e)}
                        className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {message}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload Race Data"}
        </button>
      </form>
    </div>
  );
};

export default UploadResultsView;
