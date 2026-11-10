import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * MediaPipe Face Detection hook
 * Runs locally in browser via WASM - no server calls
 */
export function useFaceDetection(videoRef, options = {}) {
  const {
    enabled = true,
    minDetectionConfidence = 0.5,
    modelSelection = 0, // 0 = short range (2m), 1 = full range (5m)
    onFaceDetected,
    onFaceLost,
  } = options;

  const [faceDetected, setFaceDetected] = useState(false);
  const [detections, setDetections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const faceDetectionRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const faceLostTimeoutRef = useRef(null);

  // Load MediaPipe Face Detection from CDN
  const loadMediaPipe = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    
    // Check if already loaded
    if (window.FaceDetection) {
      return window.FaceDetection;
    }

    return new Promise((resolve, reject) => {
      // Load MediaPipe Face Detection script
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.min.js';
      script.async = true;
      script.onload = () => {
        if (window.FaceDetection) {
          resolve(window.FaceDetection);
        } else {
          reject(new Error('MediaPipe FaceDetection not available after load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load MediaPipe FaceDetection'));
      document.head.appendChild(script);
    });
  }, []);

  // Initialize Face Detection
  useEffect(() => {
    if (!enabled || !videoRef.current) return;

    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const FaceDetection = await loadMediaPipe();
        if (cancelled) return;

        const faceDetection = new FaceDetection({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`;
          },
        });

        faceDetection.setOptions({
          minDetectionConfidence,
          modelSelection,
        });

        faceDetection.onResults((results) => {
          if (cancelled) return;
          
          const faces = results.detections || [];
          setDetections(faces);
          const hasFace = faces.length > 0;
          setFaceDetected(hasFace);

          // Debounce face detection callbacks
          const now = Date.now();
          if (hasFace) {
            lastDetectionTimeRef.current = now;
            if (faceLostTimeoutRef.current) {
              clearTimeout(faceLostTimeoutRef.current);
              faceLostTimeoutRef.current = null;
            }
            if (onFaceDetected && faces.length > 0) {
              onFaceDetected(faces[0]); // Primary face
            }
          } else {
            // Face lost - debounce by 500ms
            if (!faceLostTimeoutRef.current) {
              faceLostTimeoutRef.current = setTimeout(() => {
                if (onFaceLost) onFaceLost();
                faceLostTimeoutRef.current = null;
              }, 500);
            }
          }
        });

        faceDetectionRef.current = faceDetection;
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (faceLostTimeoutRef.current) {
        clearTimeout(faceLostTimeoutRef.current);
      }
      if (faceDetectionRef.current) {
        faceDetectionRef.current.close();
        faceDetectionRef.current = null;
      }
    };
  }, [enabled, videoRef, minDetectionConfidence, modelSelection, onFaceDetected, onFaceLost, loadMediaPipe]);

  // Detection loop
  useEffect(() => {
    if (!enabled || !faceDetectionRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return; // Not enough data

    const detect = async () => {
      if (!faceDetectionRef.current || !enabled) return;
      
      try {
        await faceDetectionRef.current.send({ image: video });
      } catch (err) {
        console.warn('[FaceDetection] Detection error:', err);
      }
      
      if (enabled) {
        animationFrameRef.current = requestAnimationFrame(detect);
      }
    };

    animationFrameRef.current = requestAnimationFrame(detect);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, videoRef]);

  return {
    faceDetected,
    detections,
    isLoading,
    error,
    // Draw detections on canvas
    drawDetections: useCallback((canvasRef) => {
      if (!canvasRef.current || !detections.length) return;
      
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas to video size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Clear previous frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw face boxes
      detections.forEach((detection) => {
        const bbox = detection.boundingBox;
        if (!bbox) return;

        const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2;
        const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2;
        const w = bbox.width * canvas.width;
        const h = bbox.height * canvas.height;

        // Face box
        ctx.strokeStyle = '#2a7a3b';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Corner accents
        const cornerSize = 20;
        ctx.lineWidth = 4;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + cornerSize);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerSize, y);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + w - cornerSize, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + cornerSize);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x, y + h - cornerSize);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + cornerSize, y + h);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + w - cornerSize, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - cornerSize);
        ctx.stroke();

        // Confidence label
        if (detection.score) {
          ctx.fillStyle = '#2a7a3b';
          ctx.font = '14px system-ui, sans-serif';
          ctx.fillText(
            `${Math.round(detection.score[0] * 100)}%`,
            x,
            y > 20 ? y - 8 : y + h + 20
          );
        }

        // Draw keypoints (eyes, nose, mouth, ears)
        if (detection.keypoints) {
          ctx.fillStyle = '#2a7a3b';
          detection.keypoints.forEach((kp) => {
            ctx.beginPath();
            ctx.arc(kp.x * canvas.width, kp.y * canvas.height, 4, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });
    }, [detections, videoRef]),
  };
}

// Global type declaration for MediaPipe
declare global {
  interface Window {
    FaceDetection: any;
  }
}