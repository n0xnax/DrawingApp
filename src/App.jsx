import { useState, useEffect, useRef } from "react";
import "./App.css";
import { getStroke } from "perfect-freehand";
import { Button, Card, Slider, IconButton, Tooltip } from "@mui/material";
import {
  UndoOutlined,
  RedoOutlined,
  Delete,
  EditOff,
  DownloadOutlined,
  Layers,
  CleaningServices,
  DragIndicator,
} from "@mui/icons-material";

const average = (a, b) => (a + b) / 2;

function getSvgPathFromStroke(points, closed = true) {
  const len = points.length;

  if (len < 4) {
    return ``;
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1]
  ).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2
    )} `;
  }

  if (closed) {
    result += "Z";
  }

  return result;
}

function isPointNearStroke(x, y, rawPoints, threshold) {
  const thresholdSq = threshold * threshold;
  return rawPoints.some(([px, py]) => {
    const dx = px - x;
    const dy = py - y;
    return dx * dx + dy * dy <= thresholdSq;
  });
}

function App() {
  const [paths, setPaths] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isErasing, setIsErasing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [strokeColor, setStrokeColor] = useState("white");
  const [strokeSize, setStrokeSize] = useState(8);
  const [bgColor, setBgColor] = useState("#101214");
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });

  // Movable toolbar positioning state
  const [toolbarPos, setToolbarPos] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight - 50,
  });
  const isDraggingToolbar = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isDraggingDelete = useRef(false);
  const hasDeletedInCurrentDrag = useRef(false);
  const svgRef = useRef();

  const contrastColor = bgColor === "#101214" ? "white" : "#101214";

  const options = {
    size: strokeSize,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    easing: (t) => t,
    start: {
      easing: (t) => t * (2 - t),
      cap: true,
    },
    end: {
      easing: (t) => --t * t * t + 1,
      cap: true,
    },
  };

  const pushToHistory = (newPaths) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newPaths]);
    setHistoryIndex(nextHistory.length);
    setPaths(newPaths);
  };

  function deleteLinesNearPointer(x, y) {
    const radius = Math.max(strokeSize, 15);
    setPaths((prevPaths) => {
      const filtered = prevPaths.filter(
        (pathItem) => !isPointNearStroke(x, y, pathItem.rawPoints, radius)
      );

      if (filtered.length !== prevPaths.length) {
        hasDeletedInCurrentDrag.current = true;
      }

      return filtered;
    });
  }

  function handlePointerDown(e) {
    e.target.setPointerCapture(e.pointerId);
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (isDeleting) {
      isDraggingDelete.current = true;
      hasDeletedInCurrentDrag.current = false;
      deleteLinesNearPointer(e.clientX, e.clientY);
      return;
    }

    const pressure =
      e.pointerType === "touch" || e.pointerType === "pen" ? e.pressure : 0.5;
    setCurrentPoints([[e.clientX, e.clientY, pressure]]);
  }

  function handlePointerMove(e) {
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (e.buttons !== 1) return;

    if (isDeleting && isDraggingDelete.current) {
      deleteLinesNearPointer(e.clientX, e.clientY);
      return;
    }

    const pressure =
      e.pointerType === "touch" || e.pointerType === "pen" ? e.pressure : 0.5;
    setCurrentPoints((prev) => [...prev, [e.clientX, e.clientY, pressure]]);
  }

  function handlePointerUp() {
    if (isDeleting) {
      if (isDraggingDelete.current && hasDeletedInCurrentDrag.current) {
        pushToHistory(paths);
      }
      isDraggingDelete.current = false;
      hasDeletedInCurrentDrag.current = false;
      return;
    }

    if (currentPoints.length > 0) {
      const stroke = getStroke(currentPoints, options);
      const pathData = getSvgPathFromStroke(stroke);
      const newPaths = [
        ...paths,
        { pathData, color: strokeColor, rawPoints: currentPoints },
      ];

      pushToHistory(newPaths);
      setCurrentPoints([]);
    }
  }

  // Drag handlers for floating toolbar
  const handleToolbarDragStart = (e) => {
    e.stopPropagation();
    isDraggingToolbar.current = true;
    dragOffset.current = {
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y,
    };
  };

  const handleToolbarDragMove = (e) => {
    if (!isDraggingToolbar.current) return;
    setToolbarPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  };

  const handleToolbarDragEnd = () => {
    isDraggingToolbar.current = false;
  };

  useEffect(() => {
    const onMove = (e) => handleToolbarDragMove(e);
    const onUp = () => handleToolbarDragEnd();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [toolbarPos]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setPaths(history[prevIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setPaths(history[nextIndex]);
    }
  };

  const handleClearCanvas = () => {
    if (paths.length > 0) {
      pushToHistory([]);
    }
  };

  const handleColorChange = (color) => {
    setIsDeleting(false);
    if (isErasing) {
      setIsErasing(false);
      setStrokeSize(8);
    }
    setStrokeColor(color);
  };

  const handleEraser = () => {
    setIsDeleting(false);
    setStrokeColor(bgColor);
    setStrokeSize(25);
    setIsErasing(true);
  };

  const toggleDeleteMode = () => {
    setIsDeleting((prev) => !prev);
    setIsErasing(false);
  };

  const handleBgChange = (newBg) => {
    if (newBg === bgColor) return;

    const oldTargetColor = newBg === "#f5f5f5" ? "white" : "#101214";
    const newTargetColor = newBg === "#f5f5f5" ? "#101214" : "white";

    const updatedPaths = paths.map((path) => {
      if (path.color === oldTargetColor) {
        return { ...path, color: newTargetColor };
      }
      return path;
    });

    setBgColor(newBg);

    if (strokeColor === oldTargetColor) {
      setStrokeColor(newTargetColor);
    } else if (isErasing) {
      setStrokeColor(newBg);
    }

    pushToHistory(updatedPaths);
  };

  const handleExportPNG = () => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    // Temporarily hide cursor indicator so it isn't rendered in the output PNG
    const cursorCircle = svgElement.querySelector("circle");
    if (cursorCircle) cursorCircle.style.display = "none";

    const svgString = new XMLSerializer().serializeToString(svgElement);

    // Restore cursor visibility immediately after serialization
    if (cursorCircle) cursorCircle.style.display = "";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = svgElement.clientWidth || 1200;
      canvas.height = svgElement.clientHeight || 800;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "drawing.png";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "z":
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          break;
        case "y":
          handleRedo();
          break;
        default:
          break;
      }
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [historyIndex, history]);

  return (
    <div
      className="wrapper"
      tabIndex={0}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <svg
        ref={svgRef}
        className="paint"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          touchAction: "none",
          background: bgColor,
          cursor: "none",
          width: "100vw",
          height: "100vh",
        }}
      >
        {paths.map((pathItem, index) => (
          <path
            key={index}
            d={pathItem.pathData}
            fill={pathItem.color}
            style={{ pointerEvents: "none" }}
          />
        ))}
        {currentPoints.length > 0 && (
          <path
            d={getSvgPathFromStroke(getStroke(currentPoints, options))}
            fill={strokeColor}
            style={{ pointerEvents: "none" }}
          />
        )}

        <circle
          cx={cursorPos.x}
          cy={cursorPos.y}
          r={isDeleting ? Math.max(strokeSize, 15) : strokeSize / 2}
          fill={isDeleting ? "rgba(229, 57, 53, 0.25)" : "none"}
          stroke={
            isDeleting
              ? "#e53935"
              : isErasing
              ? bgColor === "#101214"
                ? "#ffffff"
                : "#000000"
              : strokeColor
          }
          strokeWidth={isDeleting ? 1.5 : 1}
          style={{ pointerEvents: "none" }}
        />
      </svg>

      {/* Compact & Movable Floating Control Card */}
      <Card
        className="settings"
        variant="outlined"
        sx={{
          backgroundColor: "#12171c",
          position: "absolute",
          left: `${toolbarPos.x}px`,
          top: `${toolbarPos.y}px`,
          transform: "translate(-50%, -50%)",
          padding: "4px 8px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          width: "max-content",
          borderRadius: "8px",
          zIndex: 10,
          boxShadow: "0px 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        {/* Drag handle icon */}
        <div
          onPointerDown={handleToolbarDragStart}
          style={{
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            color: "#666",
            paddingRight: "2px",
          }}
        >
          <DragIndicator fontSize="small" />
        </div>

        <div
          className="undoredo"
          style={{ display: "flex", alignItems: "center" }}
        >
          <Button
            startIcon={<UndoOutlined fontSize="small" />}
            variant="contained"
            size="small"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            style={{
              margin: "0 2px",
              padding: "2px 8px",
              fontSize: "11px",
              minWidth: "auto",
            }}
          >
            Undo
          </Button>
          <Button
            startIcon={<RedoOutlined fontSize="small" />}
            variant="contained"
            size="small"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            style={{
              margin: "0 2px",
              padding: "2px 8px",
              fontSize: "11px",
              minWidth: "auto",
            }}
          >
            Redo
          </Button>
          <Tooltip title="Clear Canvas">
            <Button
              startIcon={<CleaningServices fontSize="small" />}
              variant="outlined"
              size="small"
              color="error"
              onClick={handleClearCanvas}
              style={{
                margin: "0 2px",
                padding: "2px 6px",
                fontSize: "11px",
                minWidth: "auto",
              }}
            >
              Clear
            </Button>
          </Tooltip>
          <Tooltip title="Export Drawing as PNG">
            <Button
              startIcon={<DownloadOutlined fontSize="small" />}
              variant="outlined"
              size="small"
              color="success"
              onClick={handleExportPNG}
              style={{
                margin: "0 2px",
                padding: "2px 6px",
                fontSize: "11px",
                minWidth: "auto",
              }}
            >
              Export
            </Button>
          </Tooltip>
        </div>

        <div
          className="color-buttons"
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          {[
            contrastColor,
            "firebrick",
            "dodgerblue",
            "green",
            "yellow",
            "hotpink",
            "darkviolet",
          ].map((color) => (
            <IconButton
              key={color}
              size="small"
              onClick={() => handleColorChange(color)}
              className="color-button"
              style={{
                backgroundColor: color,
                margin: "0 2px",
                width: "22px",
                height: "22px",
                border:
                  strokeColor === color && !isErasing && !isDeleting
                    ? "2px solid #00e5ff"
                    : "1px solid #444",
              }}
            />
          ))}

          <Tooltip title="Background Eraser">
            <IconButton
              size="small"
              onClick={handleEraser}
              className="color-button eraser"
              style={{
                backgroundColor: isErasing ? "#00e5ff" : "grey",
                margin: "0 2px",
                width: "24px",
                height: "24px",
              }}
            >
              <EditOff style={{ color: "white", fontSize: "14px" }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Line Deletion Mode">
            <IconButton
              size="small"
              onClick={toggleDeleteMode}
              className="color-button delete"
              style={{
                backgroundColor: isDeleting ? "#e53935" : "grey",
                margin: "0 2px",
                width: "24px",
                height: "24px",
              }}
            >
              <Delete style={{ color: "white", fontSize: "14px" }} />
            </IconButton>
          </Tooltip>

          <div
            style={{
              marginLeft: "4px",
              borderLeft: "1px solid #444",
              paddingLeft: "4px",
              display: "flex",
            }}
          >
            <Tooltip title="Dark Canvas">
              <IconButton
                size="small"
                onClick={() => handleBgChange("#101214")}
                style={{
                  color: bgColor === "#101214" ? "#00e5ff" : "#fff",
                  padding: "2px",
                }}
              >
                <Layers style={{ fontSize: "16px" }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Light Canvas">
              <IconButton
                size="small"
                onClick={() => handleBgChange("#f5f5f5")}
                style={{
                  color: bgColor === "#f5f5f5" ? "#00e5ff" : "#aaa",
                  padding: "2px",
                }}
              >
                <Layers style={{ fontSize: "16px" }} />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        <StrokeSizeSlider
          strokeSize={strokeSize}
          setStrokeSize={setStrokeSize}
        />
      </Card>
    </div>
  );
}

const StrokeSizeSlider = ({ strokeSize, setStrokeSize }) => {
  return (
    <div
      style={{
        width: "90px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <div style={{ fontFamily: "roboto", color: "white", fontSize: "11px" }}>
        Size
      </div>
      <Slider
        size="small"
        aria-label="Stroke Size"
        value={strokeSize}
        onChange={(e, newValue) => setStrokeSize(newValue)}
        step={2}
        min={2}
        max={20}
        valueLabelDisplay="auto"
        sx={{ padding: "8px 0" }}
      />
    </div>
  );
};

export default App;
