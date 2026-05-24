import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext.jsx";

const COLORS = [
  "#0b1020", "#ffffff", "#ef4444", "#f97316", "#f59e0b",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#a16207", "#64748b",
];

const BRUSH_SIZES = [2, 4, 8, 14, 22, 32];

const SERIALIZE_PROPS = ["objectId", "createdBy"];

function genId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function Whiteboard({ isDrawer }) {
  const { roomId } = useParams();
  const { socket } = useSocket();

  const wrapperRef = useRef(null);
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawerRef = useRef(isDrawer);
  const myUndoStackRef = useRef([]);

  const [color, setColor] = useState("#0b1020");
  const [brushSize, setBrushSize] = useState(4);

  useEffect(() => {
    isDrawerRef.current = isDrawer;
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = !!isDrawer;
    canvas.selection = false;
    canvas.skipTargetFind = true;
    canvas.defaultCursor = isDrawer ? "crosshair" : "not-allowed";
    canvas.hoverCursor = isDrawer ? "crosshair" : "not-allowed";
  }, [isDrawer]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const brush = canvas.freeDrawingBrush;
    if (!brush) return;
    brush.color = color;
    brush.width = brushSize;
  }, [color, brushSize]);

  useEffect(() => {
    if (!canvasElRef.current || !wrapperRef.current) return;

    const wrapper = wrapperRef.current;
    const rect = wrapper.getBoundingClientRect();

    const canvas = new fabric.Canvas(canvasElRef.current, {
      isDrawingMode: !!isDrawerRef.current,
      selection: false,
      skipTargetFind: true,
      backgroundColor: "#ffffff",
      width: rect.width,
      height: rect.height,
      enableRetinaScaling: true,
    });

    const brush = new fabric.PencilBrush(canvas);
    brush.color = color;
    brush.width = brushSize;
    brush.decimate = 2;
    canvas.freeDrawingBrush = brush;

    fabricRef.current = canvas;

    // STEP 3 — path:created fires after the user finishes a stroke
    const onPathCreated = (e) => {
      if (!isDrawerRef.current) return;
      const path = e?.path;
      if (!path) return;

      // STEP 4 — assign a permanent global ID + author
      path.set({
        objectId: genId(),
        createdBy: socket?.id || "local",
      });

      // STEP 5 — serialize to a network-safe JSON
      const objectData = path.toJSON(SERIALIZE_PROPS);

      // STEP 6 — wrap in a high-level operation packet
      const operation = {
        type: "ADD_OBJECT",
        roomId,
        objectData,
        origin: socket?.id,
      };

      myUndoStackRef.current.push(path.objectId);

      // STEP 7 — send through socket.io
      if (socket) socket.emit("canvas-operation", operation);
    };

    canvas.on("path:created", onPathCreated);

    const ro = new ResizeObserver(() => {
      const r = wrapper.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        canvas.setDimensions({ width: r.width, height: r.height });
        canvas.requestRenderAll();
      }
    });
    ro.observe(wrapper);

    return () => {
      ro.disconnect();
      canvas.off("path:created", onPathCreated);
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    const applyAddObject = async (objectData) => {
      if (!objectData) return;
      // STEP 14 — rebuild the Fabric object from JSON
      const objects = await fabric.util.enlivenObjects([objectData]);
      const obj = objects?.[0];
      if (!obj) return;
      // STEP 15 — mark it as remote so we never re-broadcast it
      obj.remote = true;
      obj.selectable = false;
      obj.evented = false;
      if (objectData.objectId) obj.objectId = objectData.objectId;
      if (objectData.createdBy) obj.createdBy = objectData.createdBy;
      // STEP 16 — add to canvas (STEP 17: user sees it)
      canvas.add(obj);
      canvas.requestRenderAll();
    };

    const removeObjectById = (objectId) => {
      if (!objectId) return;
      const target = canvas.getObjects().find((o) => o.objectId === objectId);
      if (target) {
        canvas.remove(target);
        canvas.requestRenderAll();
      }
    };

    // STEP 12 — remote client receives the operation
    const onOperation = (operation) => {
      if (!operation) return;
      // STEP 13 — switch on operation type
      switch (operation.type) {
        case "ADD_OBJECT":
          applyAddObject(operation.objectData);
          break;
        case "REMOVE_OBJECT":
          removeObjectById(operation.objectId);
          break;
        case "CLEAR":
          canvas.clear();
          canvas.backgroundColor = "#ffffff";
          canvas.requestRenderAll();
          myUndoStackRef.current = [];
          break;
        default:
          break;
      }
    };

    const onCanvasState = async ({ objects } = {}) => {
      if (!Array.isArray(objects)) return;
      canvas.clear();
      canvas.backgroundColor = "#ffffff";
      if (objects.length === 0) {
        canvas.requestRenderAll();
        return;
      }
      const enlivened = await fabric.util.enlivenObjects(objects);
      for (let i = 0; i < enlivened.length; i++) {
        const obj = enlivened[i];
        const src = objects[i] || {};
        obj.remote = true;
        obj.selectable = false;
        obj.evented = false;
        if (src.objectId) obj.objectId = src.objectId;
        if (src.createdBy) obj.createdBy = src.createdBy;
        canvas.add(obj);
      }
      canvas.requestRenderAll();
    };

    socket.on("canvas-operation", onOperation);
    socket.on("canvas-state", onCanvasState);

    socket.emit("request-canvas-state", { roomId });

    return () => {
      socket.off("canvas-operation", onOperation);
      socket.off("canvas-state", onCanvasState);
    };
  }, [socket, roomId]);

  const clearAll = () => {
    const canvas = fabricRef.current;
    if (!canvas || !isDrawer) return;
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    canvas.requestRenderAll();
    myUndoStackRef.current = [];
    if (socket) {
      socket.emit("canvas-operation", {
        type: "CLEAR",
        roomId,
        origin: socket.id,
      });
    }
  };

  const undo = () => {
    const canvas = fabricRef.current;
    if (!canvas || !isDrawer) return;
    const lastId = myUndoStackRef.current.pop();
    if (!lastId) return;
    const target = canvas.getObjects().find((o) => o.objectId === lastId);
    if (!target) return;
    canvas.remove(target);
    canvas.requestRenderAll();
    if (socket) {
      socket.emit("canvas-operation", {
        type: "REMOVE_OBJECT",
        roomId,
        objectId: lastId,
        origin: socket.id,
      });
    }
  };

  return (
    <div className="relative w-full h-full rounded-2xl bg-white overflow-hidden border border-white/10 shadow-card">
      <div ref={wrapperRef} className="absolute inset-0">
        <canvas ref={canvasElRef} />
      </div>

      {!isDrawer && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full
                        bg-ink-900/70 text-white text-[11px] tracking-wider uppercase
                        backdrop-blur border border-white/10 pointer-events-none">
          Watching
        </div>
      )}

      {isDrawer && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2
                        px-3 py-2 rounded-2xl bg-ink-900/85 border border-white/10
                        shadow-card backdrop-blur max-w-[95%] flex-wrap justify-center">
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                className={`w-6 h-6 rounded-full border-2 transition ${
                  color === c
                    ? "border-white scale-110 shadow-glow"
                    : "border-white/20 hover:scale-105"
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/15 mx-1" />

          <div className="flex items-center gap-1">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                title={`${s}px`}
                className={`w-7 h-7 rounded-full grid place-items-center border transition ${
                  brushSize === s
                    ? "border-brand-400 bg-brand-500/20"
                    : "border-white/15 hover:bg-white/10"
                }`}
                aria-label={`Brush ${s}px`}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: Math.min(s, 18),
                    height: Math.min(s, 18),
                    background: color,
                  }}
                />
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-white/15 mx-1" />

          <button
            onClick={undo}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10
                       hover:bg-white/20 border border-white/15 text-white transition"
            title="Undo your last stroke"
          >
            Undo
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/20
                       hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 transition"
            title="Clear the whole board"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
