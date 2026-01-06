import React, { useEffect, useRef, useState } from 'react';
import { Canvas, Rect, Circle, FabricImage, TPointerEvent, TPointerEventInfo, FabricObject, PencilBrush } from 'fabric';

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
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                const img = await FabricImage.fromURL(blobUrl);

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

                // Cleanup blob URL
                // URL.revokeObjectURL(blobUrl); // Keep it or revoke after load? revoking now is safe as img is loaded
            } catch (err) {
                console.error('Error loading image via blob:', err);

                // Fallback to direct load if fetch fails (though fetch is more likely to succeed if CORS is set up on bucket)
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
            {/* Toolbar */}
            <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px',
                display: 'flex',
                gap: '15px',
                alignItems: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
                {/* Tool Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setCurrentTool('select')}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: currentTool === 'select' ? '#4CAF50' : '#f0f0f0',
                            color: currentTool === 'select' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ↖️ Select
                    </button>
                    <button
                        onClick={() => setCurrentTool('pen')}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: currentTool === 'pen' ? '#4CAF50' : '#f0f0f0',
                            color: currentTool === 'pen' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ✏️ Pen
                    </button>
                    <button
                        onClick={() => setCurrentTool('rectangle')}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: currentTool === 'rectangle' ? '#4CAF50' : '#f0f0f0',
                            color: currentTool === 'rectangle' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ⬜ Rectangle
                    </button>
                    <button
                        onClick={() => setCurrentTool('circle')}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: currentTool === 'circle' ? '#4CAF50' : '#f0f0f0',
                            color: currentTool === 'circle' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ⭕ Circle
                    </button>
                    <button
                        onClick={clearCanvas}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#FF9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        ✨ Clear
                    </button>
                    <button
                        onClick={deleteSelected}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        🗑️ Delete
                    </button>
                </div>

                {/* Color Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label>Color:</label>
                    <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => setCurrentColor(e.target.value)}
                        style={{ width: '40px', height: '30px', cursor: 'pointer' }}
                    />
                </div>

                {/* Line Width */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label>Width:</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={lineWidth}
                        onChange={(e) => setLineWidth(Number(e.target.value))}
                        style={{ width: '100px' }}
                    />
                    <span>{lineWidth}px</span>
                </div>

                {/* Undo/Redo */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: historyIndex <= 0 ? '#ccc' : '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        ↩️ Undo
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: historyIndex >= history.length - 1 ? '#ccc' : '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        ↪️ Redo
                    </button>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#757575',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
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
