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

function App() {
  const [paths, setPaths] = useState([]);
  const [isErasing, setIsErasing] = useState(false);
  const [redoPaths, setRedoPaths] = useState([]); // Array of redo paths
  const [currentPoints, setCurrentPoints] = useState([]); // Points for the current path
  const [strokeColor, setStrokeColor] = useState("white"); // Current stroke color
  const [strokeSize, setStrokeSize] = useState(8); // Default stroke size
  const [imageUrl, setImageUrl] = useState(null); // State for the image URL
  const svgRef = useRef(); // Reference for the SVG

  const options = {
    size: strokeSize, // Use the stroke size from the state
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

  function handlePointerDown(e) {
    e.target.setPointerCapture(e.pointerId);
    setCurrentPoints([[e.pageX, e.pageY, e.pressure]]);
  }

  function handlePointerMove(e) {
    if (e.buttons !== 1) return;
    setCurrentPoints((prev) => [...prev, [e.pageX, e.pageY, e.pressure]]);
  }

  function handlePointerUp() {
    if (currentPoints.length > 0) {
      const stroke = getStroke(currentPoints, options);
      const pathData = getSvgPathFromStroke(stroke);
      setPaths((prev) => [...prev, { pathData, color: strokeColor }]); // Add the new path with color
      setCurrentPoints([]); // Reset current points for the next line
      setRedoPaths([]); // Clear redo stack when a new path is drawn
    }
  }

  const handleUndo = () => {
    if (paths.length > 0) {
      const lastPath = paths[paths.length - 1];
      setRedoPaths((prev) => [...prev, lastPath]); // Add the last path to redo stack
      setPaths((prev) => prev.slice(0, -1)); // Remove the last path from the stack
    }
  };

  const handleRedo = () => {
    if (redoPaths.length > 0) {
      const lastRedoPath = redoPaths[redoPaths.length - 1];
      setPaths((prev) => [...prev, lastRedoPath]); // Add the last redo path back to paths
      setRedoPaths((prev) => prev.slice(0, -1)); // Remove it from redo stack
    }
  };

  const handleColorChange = (color) => {
    if (isErasing) {
      setIsErasing(false);
      setStrokeSize(8);
    }
    setStrokeColor(color); // Update the current stroke color
  };
  const handleEraser = (color) => {
    setStrokeColor(color);
    setStrokeSize(25);
    setIsErasing(true);
    // Update the current stroke color
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "z":
          handleUndo();
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
  }, [paths, redoPaths]); // Dependencies to ensure the latest paths are used

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
          style={{ touchAction: "none", background: "#101214" }}
        >
          {paths.map((pathData, index) => (
            <path key={index} d={pathData.pathData} fill={pathData.color} />
          ))}
          {currentPoints.length > 0 && (
            <path
              d={getSvgPathFromStroke(getStroke(currentPoints, options))}
              fill={strokeColor}
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
            style={{ margin: "10px" }}
          >
            Undo
          </Button>
          <Button
            startIcon={<RedoOutlined />}
            variant="contained"
            onClick={handleRedo}
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
          <div className="space"></div>
          <IconButton
            onClick={() => handleEraser("rgb(16, 18, 20)")}
            className="color-button eraser"
            style={{ backgroundColor: "grey" }}
          >
            <EditOff style={{ color: "white" }} />
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
      <div style={{ fontFamily: "roboto", color: "white", fontSize: "14 px" }}>
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
