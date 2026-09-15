import { useState, useEffect, useRef } from "react";
import "./App.css";
import { getStroke } from "perfect-freehand";
import { Button, Card, Slider, IconButton } from "@mui/material";
import {
  UndoOutlined,
  RedoOutlined,
  Delete,
  EditOff,
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
  const [history, setHistory] = useState([[]]); // Full snapshots history
  const [historyIndex, setHistoryIndex] = useState(0); // Current index in history

  const [isErasing, setIsErasing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [strokeColor, setStrokeColor] = useState("white");
  const [strokeSize, setStrokeSize] = useState(8);
  const [imageUrl, setImageUrl] = useState(null);

  const isDraggingDelete = useRef(false);
  const hasDeletedInCurrentDrag = useRef(false);
  const svgRef = useRef();

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

  // Helper to append a new state to history and truncate redo steps
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

    if (isDeleting) {
      isDraggingDelete.current = true;
      hasDeletedInCurrentDrag.current = false;
      deleteLinesNearPointer(e.pageX, e.pageY);
      return;
    }

    setCurrentPoints([[e.pageX, e.pageY, e.pressure]]);
  }

  function handlePointerMove(e) {
    if (e.buttons !== 1) return;

    if (isDeleting && isDraggingDelete.current) {
      deleteLinesNearPointer(e.pageX, e.pageY);
      return;
    }

    setCurrentPoints((prev) => [...prev, [e.pageX, e.pageY, e.pressure]]);
  }

  function handlePointerUp() {
    if (isDeleting) {
      if (isDraggingDelete.current && hasDeletedInCurrentDrag.current) {
        // Record deletion snapshot to history
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

  const handleColorChange = (color) => {
    setIsDeleting(false);
    if (isErasing) {
      setIsErasing(false);
      setStrokeSize(8);
    }
    setStrokeColor(color);
  };

  const handleEraser = (color) => {
    setIsDeleting(false);
    setStrokeColor(color);
    setStrokeSize(25);
    setIsErasing(true);
  };

  const toggleDeleteMode = () => {
    setIsDeleting((prev) => !prev);
    setIsErasing(false);
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
    <div className="wrapper" tabIndex={0}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Exported Drawing"
          style={{ width: "100%", height: "auto" }}
        />
      ) : (
        <svg
          ref={svgRef}
          className="paint"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            touchAction: "none",
            background: "#101214",
            cursor: isDeleting ? "crosshair" : "default",
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
        </svg>
      )}

      <Card
        className="settings"
        variant="outlined"
        sx={{ backgroundColor: "#12171c" }}
      >
        <div className="undoredo">
          <Button
            startIcon={<UndoOutlined />}
            variant="contained"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            style={{ margin: "10px" }}
          >
            Undo
          </Button>
          <Button
            startIcon={<RedoOutlined />}
            variant="contained"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            style={{ margin: "10px" }}
          >
            Redo
          </Button>
        </div>
        <div className="color-buttons">
          <IconButton
            onClick={() => handleColorChange("white")}
            className="color-button"
            style={{ backgroundColor: "white" }}
          ></IconButton>
          <div className="space"></div>
          <IconButton
            onClick={() => handleColorChange("firebrick")}
            className="color-button"
            style={{ backgroundColor: "firebrick" }}
          ></IconButton>
          <div className="space"></div>
          <IconButton
            onClick={() => handleColorChange("dodgerblue")}
            className="color-button"
            style={{ backgroundColor: "dodgerblue" }}
          ></IconButton>
          <div className="space"></div>
          <IconButton
            onClick={() => handleColorChange("green")}
            className="color-button"
            style={{ backgroundColor: "green" }}
          ></IconButton>
          <div className="space"></div>
          <IconButton
            onClick={() => handleColorChange("yellow")}
            className="color-button"
            style={{ backgroundColor: "yellow" }}
          ></IconButton>
          <div className="space"></div>
          <IconButton
            onClick={() => handleColorChange("hotpink")}
            className="color-button"
            style={{ backgroundColor: "hotpink" }}
          ></IconButton>
          <div className="space"></div>
          <IconButton
            onClick={() => handleColorChange("darkviolet")}
            className="color-button"
            style={{ backgroundColor: "darkviolet" }}
          ></IconButton>
          <div className="space"></div>
          <IconButton
            onClick={() => handleEraser("rgb(16, 18, 20)")}
            className="color-button eraser"
            style={{ backgroundColor: "grey" }}
          >
            <EditOff style={{ color: "white" }} />
          </IconButton>
          <div className="space"></div>
          <IconButton
            onClick={toggleDeleteMode}
            className="color-button delete"
            style={{ backgroundColor: isDeleting ? "#e53935" : "grey" }}
          >
            <Delete style={{ color: "white" }} />
          </IconButton>
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
  const marks = [
    { value: 2 },
    { value: 4 },
    { value: 6 },
    { value: 8 },
    { value: 10 },
    { value: 12 },
    { value: 14 },
    { value: 16 },
    { value: 18 },
    { value: 20 },
  ];

  return (
    <div
      style={{
        width: "200px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ fontFamily: "roboto", color: "white", fontSize: "14px" }}>
        Size
      </div>
      <Slider
        size="medium"
        aria-label="Stroke Size"
        value={strokeSize}
        onChange={(e, newValue) => setStrokeSize(newValue)}
        step={2}
        marks={marks}
        min={2}
        max={20}
        valueLabelDisplay="auto"
      />
    </div>
  );
};

export default App;
