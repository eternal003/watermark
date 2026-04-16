"use client";

import { useState, useRef, useCallback, useEffect } from "react";



interface WatermarkSettings {
  size: number;         // logo size as percentage of image shorter side (1-100)
  opacity: number;      // 0-100
  spacing: number;      // pixel gap between logos (0-500)
  rotation: number;     // degrees (-180 to 180)
  color: string;        // tint color for the logo
  useOriginalColor: boolean;
  offsetX: number;      // horizontal offset (-200 to 200)
  offsetY: number;      // vertical offset (-200 to 200)
}

const DEFAULT_SETTINGS: WatermarkSettings = {
  size: 15,
  opacity: 25,
  spacing: 100,
  rotation: -30,
  color: "#ffffff",
  useOriginalColor: false,
  offsetX: 0,
  offsetY: 0,
};

export default function WatermarkApp() {
  const [settings, setSettings] = useState<WatermarkSettings>(DEFAULT_SETTINGS);
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoOriginalRef = useRef<HTMLCanvasElement | null>(null);

  // Load the SVG logo on mount
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoImgRef.current = img;
      // Create an offscreen canvas with the original logo colors
      const offscreen = document.createElement("canvas");
      offscreen.width = img.naturalWidth || img.width;
      offscreen.height = img.naturalHeight || img.height;
      const ctx = offscreen.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        logoOriginalRef.current = offscreen;
      }
      setLogoLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load watermark logo");
      // Still set loaded to true so the app can function without the watermark if needed,
      // or handle the error state gracefully.
      setLogoLoaded(true);
    };
    img.src = "/logo/carrotd.svg";
  }, []);

  // Re-render watermark whenever settings or image changes
  useEffect(() => {
    if (uploadedImage && logoLoaded) {
      renderWatermark();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, uploadedImage, logoLoaded]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;

    setFileName(file.name);
    setFileSize(formatFileSize(file.size));

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setUploadedImage(img);
        setZoom(100);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const createTintedLogo = useCallback(
    (width: number, height: number): HTMLCanvasElement => {
      const tinted = document.createElement("canvas");
      tinted.width = width;
      tinted.height = height;
      const ctx = tinted.getContext("2d")!;

      if (settings.useOriginalColor && logoOriginalRef.current) {
        ctx.drawImage(logoOriginalRef.current, 0, 0, width, height);
      } else if (logoImgRef.current) {
        // Draw white version, then tint
        ctx.drawImage(logoImgRef.current, 0, 0, width, height);
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = settings.color;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
      }

      return tinted;
    },
    [settings.useOriginalColor, settings.color]
  );

  const renderWatermark = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedImage || !logoImgRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgW = uploadedImage.naturalWidth || uploadedImage.width;
    const imgH = uploadedImage.naturalHeight || uploadedImage.height;

    canvas.width = imgW;
    canvas.height = imgH;

    // Draw original image
    ctx.drawImage(uploadedImage, 0, 0, imgW, imgH);

    // Calculate logo dimensions
    const shorterSide = Math.min(imgW, imgH);
    const logoHeight = (shorterSide * settings.size) / 100;
    const logoAspect =
      (logoImgRef.current.naturalWidth || logoImgRef.current.width) /
      (logoImgRef.current.naturalHeight || logoImgRef.current.height);
    const logoWidth = logoHeight * logoAspect;

    // Create tinted logo
    const tintedLogo = createTintedLogo(
      Math.ceil(logoWidth),
      Math.ceil(logoHeight)
    );

    // Set opacity
    ctx.globalAlpha = settings.opacity / 100;

    const rad = (settings.rotation * Math.PI) / 180;
    const gap = settings.spacing;

    const stepX = logoWidth + gap;
    const stepY = logoHeight + gap;

    // Calculate the diagonal extent to cover rotated area
    const diag = Math.sqrt(imgW * imgW + imgH * imgH);
    const startX = -diag / 2;
    const startY = -diag / 2;
    const endX = diag / 2;
    const endY = diag / 2;

    ctx.save();
    ctx.translate(imgW / 2 + settings.offsetX, imgH / 2 + settings.offsetY);
    ctx.rotate(rad);

    for (let y = startY; y < endY; y += stepY) {
      const rowOffset = Math.round((y - startY) / stepY) % 2 === 0 ? 0 : stepX / 2;
      for (let x = startX; x < endX; x += stepX) {
        ctx.drawImage(
          tintedLogo,
          x + rowOffset - logoWidth / 2,
          y - logoHeight / 2,
          logoWidth,
          logoHeight
        );
      }
    }

    ctx.restore();

    ctx.globalAlpha = 1;
  }, [uploadedImage, settings, createTintedLogo]);


  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedImage) return;

    setIsProcessing(true);

    // Use setTimeout to let UI update
    setTimeout(() => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const ext = fileName.split(".").pop()?.toLowerCase();
            const baseName = fileName.replace(/\.[^/.]+$/, "");
            a.download = `${baseName}_watermarked.${ext === "png" ? "png" : "jpg"}`;
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);
          }
          setIsProcessing(false);
        },
        fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
        0.95
      );
    }, 50);
  }, [uploadedImage, fileName]);


  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setFileName("");
    setFileSize("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateSetting = <K extends keyof WatermarkSettings>(
    key: K,
    value: WatermarkSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-title">Watermark Studio</span>
        </div>
      </header>

      <div className="main-content">
        {/* Control Panel */}
        <aside className="control-panel">
          {/* Upload Section */}
          <div className="control-section fade-in">
            <div className="section-header">
              <div className="section-icon green">📁</div>
              <div>
                <div className="section-title">이미지 업로드</div>
                <div className="section-desc">워터마크를 적용할 이미지</div>
              </div>
            </div>

            <div
              className={`upload-zone ${isDragging ? "dragging" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="upload-icon">🖼️</span>
              <div className="upload-text">이미지를 드래그하거나</div>
              <div className="upload-hint">
                <span className="upload-browse">파일 선택</span>을 클릭하세요
              </div>
              <div className="upload-hint" style={{ marginTop: 4 }}>
                PNG, JPG, WEBP 지원
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            {uploadedImage && (
              <div className="file-info fade-in">
                <span className="file-info-icon">🖼️</span>
                <div className="file-info-details">
                  <div className="file-info-name">{fileName}</div>
                  <div className="file-info-size">
                    {fileSize} · {uploadedImage.naturalWidth} × {uploadedImage.naturalHeight}px
                  </div>
                </div>
                <button className="file-remove-btn" onClick={handleRemoveImage} title="이미지 제거" aria-label="이미지 제거">
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Size & Spacing Section */}
          <div className="control-section fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="section-header">
              <div className="section-icon green">📐</div>
              <div>
                <div className="section-title">크기 & 간격</div>
                <div className="section-desc">로고 크기와 반복 간격 조정</div>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">
                로고 크기
                <span className="control-value">{settings.size}%</span>
              </label>
              <input
                type="range"
                className="range-slider"
                min="1"
                max="60"
                value={settings.size}
                onChange={(e) => updateSetting("size", Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                간격
                <span className="control-value">{settings.spacing}px</span>
              </label>
              <input
                type="range"
                className="range-slider"
                min="0"
                max="500"
                value={settings.spacing}
                onChange={(e) => updateSetting("spacing", Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                회전
                <span className="control-value">{settings.rotation}°</span>
              </label>
              <input
                type="range"
                className="range-slider orange"
                min="-180"
                max="180"
                value={settings.rotation}
                onChange={(e) => updateSetting("rotation", Number(e.target.value))}
              />
            </div>
          </div>

          {/* Appearance Section */}
          <div className="control-section fade-in" style={{ animationDelay: "0.15s" }}>
            <div className="section-header">
              <div className="section-icon orange">🎨</div>
              <div>
                <div className="section-title">외관 설정</div>
                <div className="section-desc">투명도 및 색상 조정</div>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">
                투명도
                <span className="control-value">{settings.opacity}%</span>
              </label>
              <input
                type="range"
                className="range-slider"
                min="1"
                max="100"
                value={settings.opacity}
                onChange={(e) => updateSetting("opacity", Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="toggle-wrapper">
                <label className="control-label" style={{ marginBottom: 0 }}>
                  원본 색상 사용
                </label>
                <div
                  className={`toggle ${settings.useOriginalColor ? "active" : ""}`}
                  onClick={() => updateSetting("useOriginalColor", !settings.useOriginalColor)}
                >
                  <div className="toggle-knob" />
                </div>
              </div>
            </div>

            {!settings.useOriginalColor && (
              <div className="control-group fade-in">
                <label className="control-label">로고 색상</label>
                <div className="color-picker-group">
                  <input
                    type="color"
                    className="color-picker"
                    value={settings.color}
                    onChange={(e) => updateSetting("color", e.target.value)}
                  />
                  <span className="color-hex">{settings.color.toUpperCase()}</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "6px 10px", fontSize: "0.72rem", marginLeft: "auto" }}
                    onClick={() => updateSetting("color", "#ffffff")}
                    aria-label="색상 초기화"
                  >
                    리셋
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Offset Section */}
          <div className="control-section fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="section-header">
              <div className="section-icon green">↔️</div>
              <div>
                <div className="section-title">위치 오프셋</div>
                <div className="section-desc">패턴 시작 위치 미세 조정</div>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">
                X 오프셋
                <span className="control-value">{settings.offsetX}px</span>
              </label>
              <input
                type="range"
                className="range-slider"
                min="-200"
                max="200"
                value={settings.offsetX}
                onChange={(e) => updateSetting("offsetX", Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                Y 오프셋
                <span className="control-value">{settings.offsetY}px</span>
              </label>
              <input
                type="range"
                className="range-slider orange"
                min="-200"
                max="200"
                value={settings.offsetY}
                onChange={(e) => updateSetting("offsetY", Number(e.target.value))}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              className="btn btn-primary btn-full"
              disabled={!uploadedImage || isProcessing}
              onClick={handleDownload}
            >
              {isProcessing ? (
                <>
                  <span className="spinner" />
                  처리 중...
                </>
              ) : (
                <>
                  <span className="btn-icon">💾</span>
                  워터마크 이미지 다운로드
                </>
              )}
            </button>

            <button className="btn btn-secondary btn-full" onClick={handleReset}>
              <span className="btn-icon">↺</span>
              설정 초기화
            </button>
          </div>
        </aside>

        {/* Preview Area */}
        <main className="preview-area">
          <div className="preview-toolbar">
            <div className="preview-toolbar-left">
              <span className="preview-label">미리보기</span>
              {uploadedImage && (
                <div className="image-info-bar">
                  <div className="image-info-item">
                    <strong>{uploadedImage.naturalWidth}</strong> × <strong>{uploadedImage.naturalHeight}</strong>px
                  </div>
                </div>
              )}
            </div>
            <div className="zoom-controls">
              <button
                className="zoom-btn"
                onClick={() => setZoom((z) => Math.max(10, z - 10))}
                aria-label="축소"
              >
                −
              </button>
              <span className="zoom-level">{zoom}%</span>
              <button
                className="zoom-btn"
                onClick={() => setZoom((z) => Math.min(300, z + 10))}
                aria-label="확대"
              >
                +
              </button>
              <button
                className="zoom-btn"
                onClick={() => setZoom(100)}
                title="원본 크기"
                style={{ marginLeft: 4, fontSize: "0.75rem" }}
              >
                1:1
              </button>
            </div>
          </div>

          <div className="preview-canvas-container">
            {uploadedImage ? (
              <canvas
                ref={canvasRef}
                style={{
                  width: `${(uploadedImage.naturalWidth || uploadedImage.width) * (zoom / 100)}px`,
                  height: `${(uploadedImage.naturalHeight || uploadedImage.height) * (zoom / 100)}px`,
                  maxWidth: zoom <= 100 ? "100%" : "none",
                  maxHeight: zoom <= 100 ? "100%" : "none",
                }}
              />
            ) : (
              <div className="preview-empty">
                <div className="preview-empty-icon">🖼️</div>
                <div className="preview-empty-text">이미지를 업로드하세요</div>
                <div className="preview-empty-hint">
                  왼쪽 패널에서 이미지를 업로드하면 워터마크 미리보기가 표시됩니다
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
