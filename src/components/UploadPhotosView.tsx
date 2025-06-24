import { Info, Upload, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Tables } from "../types/database.generated";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MultiSelect, type Option } from "./ui/multi-select";
import { Progress } from "./ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

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

  // Convert runners to options for MultiSelect
  const runnerOptions: Option[] = runners.map((runner) => ({
    label: runner.name,
    value: runner.id,
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Upload Photos</h2>
        <p className="text-muted-foreground mt-2">
          Share memorable moments from the race
        </p>
      </div>

      {/* File Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Select Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  Choose Photos
                </Button>
                <p className="text-sm text-muted-foreground">
                  or drag and drop multiple photos here
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              ref={fileInputRef}
            />
            <p className="text-xs text-muted-foreground">
              Supported formats: JPG, PNG, GIF, WebP. Maximum file size: 10MB
              per photo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Photo Preview and Metadata */}
      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Photos to Upload ({selectedFiles.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                selectedFiles.forEach((photo) =>
                  URL.revokeObjectURL(photo.preview)
                );
                setSelectedFiles([]);
                setUploadProgress({});
              }}
              disabled={isUploading}
            >
              Clear All
            </Button>
          </div>

          {selectedFiles.map((photo, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Photo Preview */}
                  <div className="space-y-4">
                    <div className="relative">
                      <img
                        src={photo.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-auto max-h-80 object-contain rounded-md border bg-muted"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => removePhoto(index)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {uploadProgress[index] !== undefined && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Upload Progress</span>
                          <span>
                            {uploadProgress[index] === -1
                              ? "Failed"
                              : `${uploadProgress[index]}%`}
                          </span>
                        </div>
                        <Progress
                          value={
                            uploadProgress[index] === -1
                              ? 100
                              : uploadProgress[index]
                          }
                          className={
                            uploadProgress[index] === -1 ? "bg-destructive" : ""
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Metadata Form */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year *</Label>
                      <Input
                        id="year"
                        type="number"
                        value={metadata.year}
                        onChange={(e) =>
                          setMetadata((prev) => ({
                            ...prev,
                            year: parseInt(e.target.value),
                          }))
                        }
                        disabled={isUploading}
                        min="2000"
                        max="2030"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Leg (optional)</Label>
                      <Select
                        value={metadata.selectedLeg || "none"}
                        onValueChange={(value) =>
                          setMetadata((prev) => ({
                            ...prev,
                            selectedLeg: value === "none" ? null : value,
                          }))
                        }
                        disabled={isUploading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a leg" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {legDefinitions.map((leg) => (
                            <SelectItem
                              key={`${leg.number}-${leg.version}`}
                              value={`${leg.number}-${leg.version}`}
                            >
                              Leg {leg.number} (v{leg.version})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="caption">Description</Label>
                      <Input
                        id="caption"
                        value={metadata.caption}
                        onChange={(e) =>
                          setMetadata((prev) => ({
                            ...prev,
                            caption: e.target.value,
                          }))
                        }
                        placeholder="Brief description of the photo..."
                        disabled={isUploading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tag Runners</Label>
                      <MultiSelect
                        options={runnerOptions}
                        selected={metadata.selectedRunners}
                        onChange={(selected) =>
                          setMetadata((prev) => ({
                            ...prev,
                            selectedRunners: selected,
                          }))
                        }
                        placeholder="Select runners in this photo..."
                        disabled={isUploading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Search and select multiple runners who appear in this
                        photo
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={uploadPhotos}
            disabled={isUploading || selectedFiles.length === 0}
            size="lg"
            className="min-w-32"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Uploading...
              </>
            ) : (
              `Upload ${selectedFiles.length} Photo${selectedFiles.length > 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      )}

      {/* Messages */}
      {uploadStatus && (
        <Card
          className={
            uploadStatus.includes("Successfully")
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }
        >
          <CardContent className="p-4">
            <p
              className={`text-sm whitespace-pre-line ${uploadStatus.includes("Successfully") ? "text-green-800" : "text-red-700"}`}
            >
              {uploadStatus}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 mb-2">
                Photo Upload Guidelines:
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  • A year must be provided for each photo. Associating a leg is
                  optional.
                </li>
                <li>• Add descriptive tags to help others find photos</li>
                <li>• Supported formats: JPG, PNG, GIF, WebP</li>
                <li>• Photos will be organized by year and leg number</li>
                <li>
                  • Use the runner tags to make photos searchable by team member
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadPhotosView;
