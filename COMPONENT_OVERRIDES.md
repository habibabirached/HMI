# Component Visual Overrides System

## Overview
Added support for per-instance dimension and rotation overrides, allowing each component in a configuration to have custom width, height, and rotation independent of the component library defaults.

## What Was Done

### 1. Dimension Adjustments in Component Library
**File:** `dcs-ui/src/data/componentVisuals.js`

Fixed tight-fitting components:
- **LV Breaker**: Increased width from 50px to 65px (text no longer touches edges)
- **Gas Gen 10MW**: Increased from 130×75 to 140×85 (icon no longer touches top)

### 2. Per-Instance Override System
**File:** `dcs-ui/src/components/Canvas/Canvas.jsx`

Added support for `visualOverrides` property on any component instance:

```javascript
{
  "id": "comp-bus-mv",
  "type": "bus-mv",
  "name": "MV Bus",
  "position": { "x": 350, "y": 650 },
  // ... other properties ...
  "visualOverrides": {
    "width": 540,      // Override default width
    "height": 40,      // Override default height  
    "rotation": 90     // Rotate 90 degrees clockwise
  }
}
```

### 3. Implementation Details

#### Override Priority:
1. **Component instance override** (if `visualOverrides` exists)
2. **Component library default** (from `componentVisuals.js`)

#### Rotation:
- Rotation is applied around the component's center point
- Value is in degrees (0-360)
- 90 = vertical orientation (rotate clockwise 90°)
- 180 = upside down
- 270 = rotate counter-clockwise 90°

#### Example: MV Bus Configuration
**File:** `dcs-backend/sample_configs/tier3_full_redundancy.json`

Changed MV Bus to be a tall vertical bar (rotated 90°, 3× wider):
```json
{
  "type": "bus-mv",
  "name": "MV Bus",
  "position": { "x": 350, "y": 650 },
  "visualOverrides": {
    "width": 540,
    "height": 40,
    "rotation": 90
  }
}
```

## Usage Guide

### When to Use Overrides

Use `visualOverrides` when:
1. **Bus orientation**: Vertical buses for vertical power flow
2. **Space constraints**: Widen/narrow components to fit layout
3. **Equipment orientation**: Rotate generators, transformers for better flow
4. **Custom layouts**: Match real-world equipment placement

### How to Add Overrides

#### Option 1: Manual Configuration Edit
Edit the JSON configuration file directly:
```json
{
  "id": "my-component",
  "type": "transformer",
  "visualOverrides": {
    "width": 120,
    "height": 100,
    "rotation": 45
  }
}
```

#### Option 2: Future UI Feature (Not Yet Implemented)
- Right-click component → "Customize Dimensions"
- Dialog with width/height/rotation sliders
- Preview before applying
- "Reset to Default" button

## Examples

### Vertical Bus (for vertical power distribution)
```json
"visualOverrides": {
  "width": 400,
  "height": 40,
  "rotation": 90
}
```
Result: Tall thin vertical bar

### Wider Breaker (for better text fit)
```json
"visualOverrides": {
  "width": 80,
  "height": 60
}
```
Result: Wider breaker with more text space

### Rotated Generator (diagonal layout)
```json
"visualOverrides": {
  "width": 150,
  "height": 90,
  "rotation": 45
}
```
Result: Generator rotated 45° for diagonal flow

## Technical Notes

### SVG Transform Order
1. Component is translated to `position.x`, `position.y`
2. Rotation is applied around component center
3. All child elements (icon, text, buttons) rotate with it

### Connection Lines
- Connections still calculate to component center
- Center point accounts for overridden dimensions
- Rotation doesn't affect connection calculation (connects to rotated center)

### Text Positioning
- Text scales with component size
- Icon position: 28% from top (relative to height)
- Name: 52% from top
- Rating: 68% from top
- Status dot: Always top-right
- Chart buttons: Always bottom-left

## Testing

### Test Configuration: Tier III Full Redundancy
- MV Bus is now rotated 90° and 3× wider (540px)
- Acts as vertical distribution backbone
- All connections center properly on the rotated bus

### Verification Steps
1. Load "Tier III Data Center - Full Redundancy"
2. Check MV Bus appears as tall vertical bar
3. Verify all connections attach to bus center
4. Check LV Breakers have wider frames (text doesn't touch edges)
5. Check Gas Generators have more vertical space (icon doesn't touch top)

## Future Enhancements

### Planned Features:
1. **UI Editor**: Right-click → "Edit Dimensions/Rotation"
2. **Snap Rotation**: 0°, 45°, 90°, 135°, 180° presets
3. **Aspect Ratio Lock**: Maintain proportions when resizing
4. **Visual Guidelines**: Show bounding box when resizing
5. **Bulk Edit**: Apply same overrides to multiple components

### Configuration Migration:
- Old configurations without `visualOverrides` work fine
- Defaults are used automatically
- No breaking changes

## Files Changed

1. ✅ `dcs-ui/src/data/componentVisuals.js` (dimension fixes)
2. ✅ `dcs-ui/src/components/Canvas/Canvas.jsx` (override support)
3. ✅ `dcs-backend/sample_configs/tier3_full_redundancy.json` (MV Bus demo)

## API

### Component Schema Addition:
```typescript
{
  id: string,
  type: string,
  name: string,
  position: { x: number, y: number },
  // ... existing properties ...
  visualOverrides?: {           // Optional
    width?: number,              // Override width in pixels
    height?: number,             // Override height in pixels
    rotation?: number            // Rotation in degrees (0-360)
  }
}
```

## Benefits

✅ **Flexibility**: Each instance can be customized without changing library
✅ **Backwards Compatible**: Old configs work without modification
✅ **Professional Layouts**: Rotate buses for vertical/horizontal power flow
✅ **Better Fit**: Adjust dimensions for text readability
✅ **Real-World Matching**: Orient equipment to match actual installations
