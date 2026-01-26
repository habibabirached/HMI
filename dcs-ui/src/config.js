// Configuration settings for Data Center Simulator UI

export const DATA_SAMPLING_STEP = 25; // skip data points for performance

export const CHART_MIN_HEIGHT = 250; // Minimum height for charts in pixels
export const CHART_MIN_WIDTH = 600; // Default animation duration in milliseconds

export const MECHANICAL_TORQUE_THRESHOLD = 1.07; // Mechanical torque threshold in p.u.
export const TIME_PRECISION = 3; // Number of decimal places for time values

export const MAIN_COLOR = "#5FB7FF"; // Sky (GE light blue) - for simulations without BESS
export const COMPARE_COLOR = "#C8FF08"; // Urgency Green (GE neon green) - for simulations with BESS (the good)
export const THRESHOLD_COLOR = "#d32f2f"; // Color for threshold lines
export const ALTERNATE_COLOR = "#5cf6d2ff"; // another high-contrast color

export const versionMajor = ["0"];
export const versionMinor = ["1"];

// Generate nice round tick values for X-axis (time axis)
// Creates ticks at intervals of 5 seconds: 0, 5, 10, 15, 20, 25, 30
export const TIME_AXIS_TICKS = [0, 5, 10, 15, 20, 25, 30];