import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Tables } from "../types/database.generated";

type Runner = Tables<"runners">;
type LegDefinition = Tables<"leg_definitions">;

interface PhotoFile {
  file: File;
  preview: string;
}

interface PhotoMetadata {
  year: number;
  selectedLeg: string | null;
  caption: string;
  selectedRunners: string[];
}

const UploadPhotosView: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<PhotoFile[]>([]);
  const [metadata, setMetadata] = useState<PhotoMetadata>({
    year: new Date().getFullYear(),
    selectedLeg: null,
    caption: "",
    selectedRunners: [],
  });
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [runners, setRunners] = useState<Runner[]>([]);
  const [legDefinitions, setLegDefinitions] = useState<LegDefinition[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch runners and leg definitions on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch runners
        const { data: runnersData, error: runnersError } = await supabase
          .from("runners")
          .select("*")
          .order("name");

        if (runnersError) throw runnersError;
        setRunners(runnersData || []);

        // Fetch leg definitions
        const { data: legsData, error: legsError } = await supabase
          .from("leg_definitions")
          .select("*")
          .order("number", { ascending: true })
          .order("version", { ascending: true });

        if (legsError) throw legsError;
        setLegDefinitions(legsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setUploadStatus("Error loading form data");
      }
    };

    fetchData();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: PhotoFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setSelectedFiles((prev) => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    setSelectedFiles((prev) => {
      const newPhotos = [...prev];
      URL.revokeObjectURL(newPhotos[index].preview);
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  };

  const uploadPhotos = async () => {
    if (selectedFiles.length === 0) {
      setUploadStatus("Please select at least one photo to upload.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("");
    setUploadProgress({});

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setUploadStatus("You must be logged in to upload photos.");
        setIsUploading(false);
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const photo = selectedFiles[i];

        try {
          setUploadProgress((prev) => ({ ...prev, [i]: 0 }));

          let legNumber: number | null = null;
          let legVersion: number | null = null;

          if (metadata.selectedLeg) {
            [legNumber, legVersion] = metadata.selectedLeg
              .split("-")
              .map(Number);
          }

          // Generate unique filename
          const fileExt = photo.file.name.split(".").pop();
          const randomString = `${Date.now()}_${Math.random()
            .toString(36)
            .substring(2)}`;
          const fileName = legNumber
            ? `${metadata.year}/leg_${legNumber}/${randomString}.${fileExt}`
            : `${metadata.year}/general/${randomString}.${fileExt}`;

          setUploadProgress((prev) => ({ ...prev, [i]: 25 }));

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("xtreme-photos")
            .upload(fileName, photo.file);

          if (uploadError) throw uploadError;

          setUploadProgress((prev) => ({ ...prev, [i]: 75 }));

          // Insert photo record into database
          const { data: photoData, error: photoError } = await supabase
            .from("photos")
            .insert({
              year: metadata.year,
              leg_number: legNumber,
              leg_version: legVersion,
              file_name: photo.file.name,
              storage_path: fileName,
              caption: metadata.caption || null,
              uploaded_by: session.user.id,
              file_size: photo.file.size,
              mime_type: photo.file.type,
            })
            .select()
            .single();

          if (photoError) throw photoError;

          // Insert photo tags if runners are selected
          if (metadata.selectedRunners.length > 0) {
            const photoTags = metadata.selectedRunners.map((runnerId) => ({
              photo_id: photoData.id,
              runner_id: runnerId,
            }));

            const { error: tagsError } = await supabase
              .from("photo_tags")
              .insert(photoTags);

            if (tagsError) {
              console.error("Error inserting photo tags:", tagsError);
              // Don't fail the entire upload for tag errors
            }
          }

          setUploadProgress((prev) => ({ ...prev, [i]: 100 }));
          successCount++;
        } catch (error) {
          console.error(`Error uploading photo ${i + 1}:`, error);
          errors.push(
            `Photo ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      setIsUploading(false);

      if (successCount > 0) {
        setUploadStatus(`Successfully uploaded ${successCount} photo(s)!`);
        if (successCount === selectedFiles.length) {
          // Clear all photos on complete success
          selectedFiles.forEach((photo) => URL.revokeObjectURL(photo.preview));
          setSelectedFiles([]);
          setUploadProgress({});
        }
      }

      if (errors.length > 0) {
        setUploadStatus(`Upload errors:\n${errors.join("\n")}`);
      }
    } catch (error) {
      setIsUploading(false);
      setUploadStatus(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress === -1) return "bg-red-500";
    if (progress === 100) return "bg-green-500";
    return "bg-blue-500";
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Upload Photos</h2>

      {/* File Selection */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-medium mb-4">Select Photos</h3>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="block w-full border border-gray-300 rounded-md shadow-sm p-2 mb-2"
          ref={fileInputRef}
        />
        <p className="text-sm text-gray-600">
          Select one or more photos to upload. Supported formats: JPG, PNG, GIF,
          WebP
        </p>
      </div>

      {/* Photo Preview and Metadata */}
      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Photos to Upload ({selectedFiles.length})
          </h3>

          {selectedFiles.map((photo, index) => (
            <div
              key={index}
              className="bg-white border rounded-lg p-4 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Photo Preview */}
                <div className="flex-shrink-0">
                  <img
                    src={photo.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg bg-gray-100"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="mt-2 text-red-600 hover:text-red-800 text-sm"
                    disabled={isUploading}
                  >
                    Remove
                  </button>
                </div>

                {/* Metadata Form */}
                <div className="flex-1 grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year *
                    </label>
                    <input
                      type="number"
                      value={metadata.year}
                      onChange={(e) =>
                        setMetadata((prev) => ({
                          ...prev,
                          year: parseInt(e.target.value),
                        }))
                      }
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isUploading}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="legNumber"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Leg (optional)
                    </label>
                    <select
                      id="legNumber"
                      value={metadata.selectedLeg || ""}
                      onChange={(e) =>
                        setMetadata((prev) => ({
                          ...prev,
                          selectedLeg: e.target.value || null,
                        }))
                      }
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isUploading}
                    >
                      <option value="">None</option>
                      {legDefinitions.map((leg) => (
                        <option
                          key={`${leg.number}-${leg.version}`}
                          value={`${leg.number}-${leg.version}`}
                        >
                          {`Leg ${leg.number} (v${leg.version})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={metadata.caption}
                      onChange={(e) =>
                        setMetadata((prev) => ({
                          ...prev,
                          caption: e.target.value,
                        }))
                      }
                      placeholder="Brief description of the photo..."
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isUploading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tag Runners
                    </label>
                    <select
                      multiple
                      value={metadata.selectedRunners}
                      onChange={(e) => {
                        const selectedOptions = Array.from(
                          e.target.selectedOptions,
                          (option) => option.value
                        );
                        setMetadata((prev) => ({
                          ...prev,
                          selectedRunners: selectedOptions,
                        }));
                      }}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                      disabled={isUploading}
                    >
                      {runners.map((runner) => (
                        <option key={runner.id} value={runner.id}>
                          {runner.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      Hold Ctrl/Cmd to select multiple runners
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {uploadProgress[index] !== undefined && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Upload Progress</span>
                    <span>
                      {uploadProgress[index] === -1
                        ? "Failed"
                        : `${uploadProgress[index]}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(uploadProgress[index])}`}
                      style={{
                        width: `${uploadProgress[index] === -1 ? 100 : uploadProgress[index]}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={uploadPhotos}
            disabled={isUploading || selectedFiles.length === 0}
            className="btn-primary px-6 py-3"
          >
            {isUploading
              ? "Uploading..."
              : `Upload ${selectedFiles.length} Photo(s)`}
          </button>
        </div>
      )}

      {/* Messages */}
      {uploadStatus && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded whitespace-pre-line">
          {uploadStatus}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
        <h4 className="font-medium mb-2">Photo Upload Guidelines:</h4>
        <ul className="text-sm space-y-1">
          <li>
            • A year must be provided for each photo. Associating a leg is
            optional.
          </li>
          <li>• Add descriptive tags to help others find photos</li>
          <li>• Supported formats: JPG, PNG, GIF, WebP</li>
          <li>• Photos will be organized by year and leg number</li>
        </ul>
      </div>
    </div>
  );
};

export default UploadPhotosView;
