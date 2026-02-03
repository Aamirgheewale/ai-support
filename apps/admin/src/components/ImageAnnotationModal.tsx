import React, { useEffect, useRef, useState } from 'react';
import { Canvas, Rect, Circle, FabricImage, TPointerEvent, TPointerEventInfo, FabricObject, PencilBrush } from 'fabric';
import { MousePointer2, Pencil, Square, Circle as CircleIcon, Undo2, Redo2, Trash2, Eraser, X, Check, type Icon } from 'lucide-react';

interface ImageAnnotationModalProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (annotatedImageBlob: Blob) => void;
}

type Tool = 'pen' | 'rectangle' | 'circle' | 'eraser' | 'select';

export default function ImageAnnotationModal({ imageUrl, onClose, onSave }: ImageAnnotationModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvas, setCanvas] = useState<any | null>(null);
    const [currentTool, setCurrentTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState('#FF0000');
    const [lineWidth, setLineWidth] = useState(3);
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Drawing state refs to avoid re-render issues
    const isDrawingRef = useRef(false);
    const shapeRef = useRef<FabricObject | null>(null);
    const startXRef = useRef(0);
    const startYRef = useRef(0);

    // Initialize canvas
    useEffect(() => {
        if (!canvasRef.current) return;

        const fabricCanvas = new Canvas(canvasRef.current, {
            width: window.innerWidth * 0.9,
            height: window.innerHeight * 0.8,
            backgroundColor: '#f0f0f0'
        });

        // Fabric 7 requires explicit brush initialization
        fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);

        // Load image using Blob to avoid CORS issues and "dirty canvas"
        const loadImage = async () => {
            try {
                // Check if this is an Appwrite storage URL - if so, proxy through our API
                let fetchUrl = imageUrl;
                const isAppwriteUrl = imageUrl.includes('appwrite.io') || imageUrl.includes('fra.cloud.appwrite.io');

                if (isAppwriteUrl) {
                    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
                    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

                    // Use proxy endpoint
                    const proxyUrl = `${API_BASE}/api/proxy/image?url=${encodeURIComponent(imageUrl)}`;
                    const response = await fetch(proxyUrl, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        throw new Error(`Proxy fetch failed: ${response.status}`);
                    }

                    const blob = await response.blob();
                    fetchUrl = URL.createObjectURL(blob);
                } else {
                    // Non-Appwrite URL, try direct fetch
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    fetchUrl = URL.createObjectURL(blob);
                }

                const img = await FabricImage.fromURL(fetchUrl);

                // Calculate scale to fit image within canvas while maintaining aspect ratio
                const padding = 40;
                const maxWidth = fabricCanvas.width! - padding;
                const maxHeight = fabricCanvas.height! - padding;

                const scaleX = maxWidth / img.width!;
                const scaleY = maxHeight / img.height!;
                const scale = Math.min(scaleX, scaleY, 1); // Don't upscale small images too much

                img.scale(scale);
                img.set({
                    left: (fabricCanvas.width! - img.width! * scale) / 2,
                    top: (fabricCanvas.height! - img.height! * scale) / 2,
                    selectable: true, // Allow selection
                    evented: true,    // Allow events
                    hoverCursor: 'move'
                });

                fabricCanvas.add(img);
                fabricCanvas.sendObjectToBack(img);
                fabricCanvas.renderAll();

                // Save initial state
                saveState(fabricCanvas);
            } catch (err) {
                console.error('Error loading image via blob/proxy:', err);

                // Fallback to direct load if fetch fails
                FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
                    const scale = Math.min(
                        fabricCanvas.width! / img.width!,
                        fabricCanvas.height! / img.height!
                    );
                    img.scale(scale);
                    img.set({
                        left: (fabricCanvas.width! - img.width! * scale) / 2,
                        top: (fabricCanvas.height! - img.height! * scale) / 2,
                        selectable: false,
                        evented: false
                    });
                    fabricCanvas.add(img);
                    fabricCanvas.sendObjectToBack(img);
                    fabricCanvas.renderAll();
                    saveState(fabricCanvas);
                }).catch(e => console.error('Fallback load failed:', e));
            }
        };

        loadImage();
        setCanvas(fabricCanvas);

        return () => {
            fabricCanvas.dispose();
        };
    }, [imageUrl]);

    // Save canvas state for undo/redo
    const saveState = (canvas: Canvas) => {
        const json = JSON.stringify(canvas.toJSON());
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(json);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    // Setup drawing tools
    useEffect(() => {
        if (!canvas) return;

        canvas.isDrawingMode = currentTool === 'pen';
        canvas.selection = currentTool === 'select';

        // Ensure objects are only selectable/movable in select mode
        canvas.getObjects().forEach((obj: any) => {
            obj.selectable = currentTool === 'select';
            obj.evented = currentTool === 'select';
            if (obj.type === 'image') {
                obj.hoverCursor = currentTool === 'select' ? 'move' : 'default';
            }
        });

        if (currentTool === 'pen' && canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = currentColor;
            canvas.freeDrawingBrush.width = lineWidth;
        }

        // Handle shape drawing
        const onMouseDown = (e: any) => {
            if (currentTool === 'select' || currentTool === 'pen') return;

            isDrawingRef.current = true;
            const pointer = canvas.getScenePoint(e.e);
            startXRef.current = pointer.x;
            startYRef.current = pointer.y;

            if (currentTool === 'rectangle') {
                shapeRef.current = new Rect({
                    left: startXRef.current,
                    top: startYRef.current,
                    width: 0,
                    height: 0,
                    fill: 'transparent',
                    stroke: currentColor,
                    strokeWidth: lineWidth
                });
                canvas.add(shapeRef.current);
            } else if (currentTool === 'circle') {
                shapeRef.current = new Circle({
                    left: startXRef.current,
                    top: startYRef.current,
                    radius: 0,
                    fill: 'transparent',
                    stroke: currentColor,
                    strokeWidth: lineWidth
                });
                canvas.add(shapeRef.current);
            }
        };

        const onMouseMove = (e: any) => {
            if (!isDrawingRef.current || !shapeRef.current) return;

            const pointer = canvas.getScenePoint(e.e);

            if (currentTool === 'rectangle') {
                const rect = shapeRef.current as Rect;
                rect.set({
                    width: Math.abs(pointer.x - startXRef.current),
                    height: Math.abs(pointer.y - startYRef.current),
                    left: Math.min(startXRef.current, pointer.x),
                    top: Math.min(startYRef.current, pointer.y)
                });
            } else if (currentTool === 'circle') {
                const circle = shapeRef.current as Circle;
                const radius = Math.sqrt(
                    Math.pow(pointer.x - startXRef.current, 2) + Math.pow(pointer.y - startYRef.current, 2)
                ) / 2;
                circle.set({ radius });
            }

            canvas.renderAll();
        };

        const onMouseUp = () => {
            if (isDrawingRef.current) {
                isDrawingRef.current = false;
                shapeRef.current = null;
                saveState(canvas);
            }
        };

        canvas.on('mouse:down', onMouseDown);
        canvas.on('mouse:move', onMouseMove);
        canvas.on('mouse:up', onMouseUp);

        // Save state after freehand drawing
        canvas.on('path:created', () => {
            saveState(canvas);
        });

        return () => {
            canvas.off('mouse:down', onMouseDown);
            canvas.off('mouse:move', onMouseMove);
            canvas.off('mouse:up', onMouseUp);
            canvas.off('path:created');
        };
    }, [canvas, currentTool, currentColor, lineWidth]);

    const undo = () => {
        if (historyIndex > 0 && canvas) {
            const newIndex = historyIndex - 1;
            canvas.loadFromJSON(history[newIndex]).then(() => {
                canvas.renderAll();
                setHistoryIndex(newIndex);
            });
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1 && canvas) {
            const newIndex = historyIndex + 1;
            canvas.loadFromJSON(history[newIndex]).then(() => {
                canvas.renderAll();
                setHistoryIndex(newIndex);
            });
        }
    };

    const handleSave = () => {
        if (!canvas) return;

        // toDataURL in Fabric 7 might have strict typing
        const dataUrl = (canvas as any).toDataURL({ format: 'png' });
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                onSave(blob);
                onClose();
            });
    };

    const deleteSelected = () => {
        if (!canvas) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
            activeObjects.forEach((obj: any) => canvas.remove(obj));
            canvas.discardActiveObject();
            canvas.renderAll();
            saveState(canvas);
        }
    };

    const clearCanvas = () => {
        if (!canvas) return;
        // Remove all objects except the background image
        const objects = canvas.getObjects();
        objects.forEach((obj: any) => {
            if (obj.type !== 'image') {
                canvas.remove(obj);
            }
        });
        canvas.renderAll();
        saveState(canvas);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            {/* Modern Floating Toolbar */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-full px-4 py-2 flex items-center gap-4 z-50 transition-all duration-300 hover:shadow-xl">

                {/* Group 1: Tools */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setCurrentTool('select')}
                        className={`p-2 rounded-full transition-all ${currentTool === 'select'
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                        title="Select"
                    >
                        <MousePointer2 size={18} />
                    </button>
                    <button
                        onClick={() => setCurrentTool('pen')}
                        className={`p-2 rounded-full transition-all ${currentTool === 'pen'
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                        title="Pen"
                    >
                        <Pencil size={18} />
                    </button>
                    <button
                        onClick={() => setCurrentTool('rectangle')}
                        className={`p-2 rounded-full transition-all ${currentTool === 'rectangle'
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                        title="Rectangle"
                    >
                        <Square size={18} />
                    </button>
                    <button
                        onClick={() => setCurrentTool('circle')}
                        className={`p-2 rounded-full transition-all ${currentTool === 'circle'
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                        title="Circle"
                    >
                        <CircleIcon size={18} />
                    </button>
                </div>

                {/* Vertical Divider */}
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

                {/* Group 2: Properties (Color & Width) - Compact */}
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => setCurrentColor(e.target.value)}
                            className="w-6 h-6 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer shadow-sm"
                            title="Color"
                        />
                    </div>
                    <div className="flex flex-col gap-1 w-16">
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={lineWidth}
                            onChange={(e) => setLineWidth(Number(e.target.value))}
                            className="h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            title={`Width: ${lineWidth}px`}
                        />
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

                {/* Group 3: History */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className={`p-1.5 rounded-full transition-all ${historyIndex <= 0
                                ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                            }`}
                        title="Undo"
                    >
                        <Undo2 size={18} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className={`p-1.5 rounded-full transition-all ${historyIndex >= history.length - 1
                                ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                            }`}
                        title="Redo"
                    >
                        <Redo2 size={18} />
                    </button>
                </div>

                {/* Vertical Divider */}
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

                {/* Group 4: Actions (Clear/Delete) */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={clearCanvas}
                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all"
                        title="Clear Canvas"
                    >
                        <Eraser size={18} />
                    </button>
                    <button
                        onClick={deleteSelected}
                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all"
                        title="Delete Selected"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* Vertical Divider */}
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

                {/* Group 5: Finalize */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full shadow-md hover:shadow-lg flex items-center gap-1.5 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Check size={14} strokeWidth={3} />
                        Attach to Reply
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div style={{
                backgroundColor: 'white',
                padding: '10px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}
