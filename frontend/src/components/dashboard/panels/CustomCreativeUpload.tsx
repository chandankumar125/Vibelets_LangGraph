import { useState, useRef, useCallback } from 'react';
import { Upload, Image, Video, Check, AlertCircle, X, Info, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Facebook Ad Creative Guidelines
const CREATIVE_SPECS = {
  image: {
    formats: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 30 * 1024 * 1024, // 30MB
    aspectRatios: [
      { name: '1:1 (Square)', ratio: 1, dimensions: '1080 x 1080', recommended: true },
      { name: '4:5 (Vertical)', ratio: 0.8, dimensions: '1080 x 1350', recommended: true },
      { name: '9:16 (Stories/Reels)', ratio: 0.5625, dimensions: '1080 x 1920', recommended: false },
      { name: '1.91:1 (Landscape)', ratio: 1.91, dimensions: '1200 x 628', recommended: false }
    ],
    minDimension: 600,
    maxDimension: 8192
  },
  video: {
    formats: ['video/mp4', 'video/mov', 'video/quicktime'],
    maxSize: 4 * 1024 * 1024 * 1024, // 4GB
    maxDuration: 240 * 60, // 240 minutes in seconds
    recommendedDuration: { min: 15, max: 60 },
    aspectRatios: [
      { name: '1:1 (Square)', ratio: 1, dimensions: '1080 x 1080', recommended: true },
      { name: '4:5 (Vertical)', ratio: 0.8, dimensions: '1080 x 1350', recommended: true },
      { name: '9:16 (Stories/Reels)', ratio: 0.5625, dimensions: '1080 x 1920', recommended: true },
      { name: '16:9 (Landscape)', ratio: 1.78, dimensions: '1920 x 1080', recommended: false }
    ]
  }
};

const MAX_FILES = 16; // 4x4 grid

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  dimensions?: { width: number; height: number };
  duration?: number;
  aspectRatio?: string;
  isValid: boolean;
  errors: string[];
}

interface CustomCreativeUploadProps {
  onSubmit: (creative: { type: 'image' | 'video'; file: File; preview: string; name: string }) => void;
  onCancel: () => void;
}

export const CustomCreativeUpload = ({ onSubmit, onCancel }: CustomCreativeUploadProps) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(async (file: File): Promise<UploadedFile> => {
    const errors: string[] = [];
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const type = isImage ? 'image' : 'video';
    const specs = isImage ? CREATIVE_SPECS.image : CREATIVE_SPECS.video;

    // Check format
    if (!specs.formats.includes(file.type)) {
      errors.push(`Unsupported format. Use: ${specs.formats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`);
    }

    // Check file size
    if (file.size > specs.maxSize) {
      const maxMB = specs.maxSize / (1024 * 1024);
      errors.push(`File too large. Max: ${maxMB >= 1024 ? `${maxMB / 1024}GB` : `${maxMB}MB`}`);
    }

    // Create preview
    const preview = URL.createObjectURL(file);

    // Get dimensions and duration
    let dimensions: { width: number; height: number } | undefined;
    let duration: number | undefined;
    let aspectRatio: string | undefined;

    if (isImage) {
      dimensions = await getImageDimensions(preview);
      if (dimensions) {
        const ratio = dimensions.width / dimensions.height;
        aspectRatio = getClosestAspectRatio(ratio, CREATIVE_SPECS.image.aspectRatios);
        
        if (dimensions.width < CREATIVE_SPECS.image.minDimension || dimensions.height < CREATIVE_SPECS.image.minDimension) {
          errors.push(`Image too small. Min dimension: ${CREATIVE_SPECS.image.minDimension}px`);
        }
      }
    } else if (isVideo) {
      const videoInfo = await getVideoDimensions(preview);
      if (videoInfo) {
        dimensions = { width: videoInfo.width, height: videoInfo.height };
        duration = videoInfo.duration;
        const ratio = videoInfo.width / videoInfo.height;
        aspectRatio = getClosestAspectRatio(ratio, CREATIVE_SPECS.video.aspectRatios);
        
        if (duration > CREATIVE_SPECS.video.maxDuration) {
          errors.push(`Video too long. Max: ${CREATIVE_SPECS.video.maxDuration / 60} minutes`);
        }
      }
    }

    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview,
      type: type as 'image' | 'video',
      dimensions,
      duration,
      aspectRatio,
      isValid: errors.length === 0,
      errors
    };
  }, []);

  const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = src;
    });
  };

  const getVideoDimensions = (src: string): Promise<{ width: number; height: number; duration: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
      };
      video.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
      video.src = src;
    });
  };

  const getClosestAspectRatio = (ratio: number, ratios: typeof CREATIVE_SPECS.image.aspectRatios): string => {
    let closest = ratios[0];
    let minDiff = Math.abs(ratio - ratios[0].ratio);
    
    for (const r of ratios) {
      const diff = Math.abs(ratio - r.ratio);
      if (diff < minDiff) {
        minDiff = diff;
        closest = r;
      }
    }
    return closest.name;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const remainingSlots = MAX_FILES - uploadedFiles.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    const validatedFiles = await Promise.all(filesToProcess.map(validateFile));
    
    setUploadedFiles(prev => [...prev, ...validatedFiles]);
    
    // Switch tab based on first file type if needed
    if (validatedFiles.length > 0 && validatedFiles[0].type !== activeTab) {
      setActiveTab(validatedFiles[0].type);
    }
    
    // Select the first newly added file
    if (uploadedFiles.length === 0 && validatedFiles.length > 0) {
      setSelectedIndex(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    const selectedFile = uploadedFiles[selectedIndex];
    if (selectedFile && selectedFile.isValid) {
      onSubmit({
        type: selectedFile.type,
        file: selectedFile.file,
        preview: selectedFile.preview,
        name: `Custom ${selectedFile.type === 'video' ? 'Video' : 'Image'} Ad`
      });
    }
  };

  const removeFile = (index: number) => {
    const file = uploadedFiles[index];
    if (file) {
      URL.revokeObjectURL(file.preview);
    }
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Adjust selected index if needed
    if (selectedIndex >= index && selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    }
  };

  const clearAllUploads = () => {
    uploadedFiles.forEach(file => URL.revokeObjectURL(file.preview));
    setUploadedFiles([]);
    setSelectedIndex(0);
  };

  const navigateCarousel = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    } else if (direction === 'next' && selectedIndex < uploadedFiles.length - 1) {
      setSelectedIndex(prev => prev + 1);
    }
  };

  const specs = activeTab === 'image' ? CREATIVE_SPECS.image : CREATIVE_SPECS.video;
  const selectedFile = uploadedFiles[selectedIndex];
  const hasValidFile = uploadedFiles.some(f => f.isValid);

  return (
    <div className="p-6 space-y-5">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <Upload className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Upload Your Creatives</h2>
        <p className="text-sm text-muted-foreground">
          Upload up to {MAX_FILES} images or videos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'image' | 'video')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Video className="w-4 h-4" />
            Video
          </TabsTrigger>
        </TabsList>

        {/* Single hidden file input outside conditional blocks */}
        <input
          ref={fileInputRef}
          type="file"
          accept={activeTab === 'image' ? 'image/*' : 'video/*'}
          multiple={true}
          onChange={(e) => {
            handleFileSelect(e.target.files);
            // Reset input value to allow re-selecting same files
            e.target.value = '';
          }}
          className="hidden"
        />

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {uploadedFiles.length === 0 ? (
            /* Empty state - Upload Zone */
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-3">
                {activeTab === 'image' ? (
                  <Image className="w-7 h-7 text-muted-foreground" />
                ) : (
                  <Video className="w-7 h-7 text-muted-foreground" />
                )}
              </div>
              <p className="text-foreground font-medium">
                Drop your {activeTab}s here or click to browse
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === 'image' ? 'JPG, PNG, or WebP' : 'MP4 or MOV'}
              </p>
              
              {/* Compact specs inline */}
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1.5 cursor-help">
                      <Check className="w-3 h-3 text-secondary" />
                      1:1, 4:5{activeTab === 'video' ? ', 9:16' : ''}
                      <Info className="w-3 h-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium mb-1">Recommended Aspect Ratios</p>
                    <ul className="space-y-0.5">
                      {specs.aspectRatios.filter(r => r.recommended).map((ratio) => (
                        <li key={ratio.name}>{ratio.name} ({ratio.dimensions})</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
                <span className="text-border">•</span>
                <span>Max {specs.maxSize >= 1024 * 1024 * 1024 
                  ? `${specs.maxSize / (1024 * 1024 * 1024)}GB` 
                  : `${specs.maxSize / (1024 * 1024)}MB`}
                </span>
                {activeTab === 'video' && (
                  <>
                    <span className="text-border">•</span>
                    <span>15-60s recommended</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Files uploaded - Carousel + Grid */
            <div className="space-y-4">
              {/* Main Preview Carousel */}
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
                {/* Navigation arrows */}
                {uploadedFiles.length > 1 && (
                  <>
                    <button
                      onClick={() => navigateCarousel('prev')}
                      disabled={selectedIndex === 0}
                      className={cn(
                        "absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 flex items-center justify-center transition-all",
                        selectedIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-background hover:scale-110"
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigateCarousel('next')}
                      disabled={selectedIndex === uploadedFiles.length - 1}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 flex items-center justify-center transition-all",
                        selectedIndex === uploadedFiles.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-background hover:scale-110"
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Remove current file button */}
                <button
                  onClick={() => removeFile(selectedIndex)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-destructive/90 flex items-center justify-center hover:bg-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-destructive-foreground" />
                </button>

                {/* Counter badge */}
                <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-full bg-background/90 text-xs font-medium">
                  {selectedIndex + 1} / {uploadedFiles.length}
                </div>

                {/* Preview content */}
                {selectedFile?.type === 'image' ? (
                  <img 
                    src={selectedFile.preview} 
                    alt="Preview" 
                    className="w-full h-[200px] object-contain"
                  />
                ) : selectedFile?.type === 'video' ? (
                  <video 
                    key={selectedFile.id}
                    src={selectedFile.preview} 
                    controls 
                    className="w-full h-[200px] object-contain"
                  />
                ) : null}

                {/* Validation status overlay */}
                {selectedFile && !selectedFile.isValid && (
                  <div className="absolute bottom-2 left-2 right-2 z-10">
                    <div className="px-3 py-2 rounded-lg bg-destructive/90 text-destructive-foreground text-xs">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{selectedFile.errors[0]}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnail Grid (4x4) */}
              <div className="grid grid-cols-4 gap-2">
                {uploadedFiles.map((file, index) => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all group",
                      index === selectedIndex 
                        ? "border-primary ring-2 ring-primary/30" 
                        : "border-border hover:border-primary/50",
                      !file.isValid && "border-destructive/50"
                    )}
                  >
                    {file.type === 'image' ? (
                      <img src={file.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Video className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Remove button on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/90 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    >
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>

                    {/* Invalid indicator */}
                    {!file.isValid && (
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                        <AlertCircle className="w-3 h-3 text-destructive-foreground" />
                      </div>
                    )}

                    {/* Selected indicator */}
                    {index === selectedIndex && file.isValid && (
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}

                {/* Add more button */}
                {uploadedFiles.length < MAX_FILES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors group"
                  >
                    <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                )}
              </div>

              {/* Selected file info */}
              {selectedFile && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                      {selectedFile.file.name}
                    </span>
                    {selectedFile.isValid ? (
                      <span className="text-xs text-secondary flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Valid
                      </span>
                    ) : (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Issues
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {selectedFile.dimensions && (
                      <span>{selectedFile.dimensions.width} × {selectedFile.dimensions.height}</span>
                    )}
                    {selectedFile.aspectRatio && (
                      <span>{selectedFile.aspectRatio}</span>
                    )}
                    {selectedFile.duration !== undefined && (
                      <span>{Math.round(selectedFile.duration)}s</span>
                    )}
                    <span>{(selectedFile.file.size / (1024 * 1024)).toFixed(1)}MB</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => {
            clearAllUploads();
            onCancel();
          }}
          className="flex-1"
        >
          Back to AI Creatives
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!hasValidFile || !selectedFile?.isValid}
          className="flex-1 bg-secondary hover:bg-secondary/90"
        >
          <Check className="w-4 h-4 mr-2" />
          Use Selected
        </Button>
      </div>
    </div>
  );
};
