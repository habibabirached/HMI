# Multi-Screen Fullscreen Feature

## Overview
This feature allows the Data Center Simulator to span across **3 physical monitors** (or virtual screens if only one monitor is connected).

## How It Works

### 1. **Screen Detection**
- Automatically detects your main screen's width and height
- Calculates triple-width layout (3 × screen width)

### 2. **Fullscreen Button**
Located in the **top-right corner** of the header (fullscreen icon).

**When clicked:**
- Enters browser fullscreen mode
- Expands the application to **3× your screen width**
- Enables horizontal scrolling if fewer than 3 screens are attached

### 3. **Single Screen Setup (Development)**
When you have only **1 physical monitor**:
- Press the fullscreen button
- The app stretches to 3× width
- Use the **horizontal scrollbar** to navigate between virtual screens
- A **Screen Navigator** appears at the bottom with:
  - Previous/Next buttons
  - Screen number indicators (1, 2, 3)
  - Quick jump buttons to any screen

### 4. **Triple Screen Setup (Production)**
When you have **3 physical monitors** arranged horizontally:
- Connect 2 additional monitors to the right of your main screen
- Configure display settings to extend (not mirror) screens
- Press the fullscreen button
- The app automatically fills all 3 screens
- No scrollbar needed - seamless view across all monitors

## Usage

### Entering Triple Screen Mode
1. Click the **fullscreen icon** (⛶) in the header
2. Browser enters fullscreen
3. Content stretches across 3 screen widths

### Navigating (1 Screen Only)
- **Scrollbar**: Drag to move between virtual screens
- **Navigator Buttons**: Click Previous/Next
- **Screen Numbers**: Click 1, 2, or 3 to jump directly
- **Keyboard**: Use arrow keys or Page Up/Down

### Exiting Triple Screen Mode
- Click the **exit fullscreen icon** (⛶) in the header
- Press **Esc** key
- Press **F11** (browser shortcut)

## Technical Details

### Files Created/Modified
1. **`src/contexts/FullscreenContext.jsx`** - Manages fullscreen state
2. **`src/components/MultiScreenFullscreen.jsx`** - Fullscreen toggle button
3. **`src/components/ScreenNavigator.jsx`** - Navigation widget
4. **`src/fullscreen.css`** - Styling for fullscreen mode
5. **`src/AppLayout.jsx`** - Modified to support triple-width layout
6. **`src/Header.jsx`** - Added fullscreen button

### Browser Compatibility
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- Uses standard Fullscreen API with vendor prefixes

### Display Configuration for 3 Monitors

#### Windows
1. Right-click desktop → Display Settings
2. Arrange monitors in order: [1] [2] [3]
3. Select "Extend these displays"
4. Apply settings

#### macOS
1. System Preferences → Displays → Arrangement
2. Drag monitor icons to match physical layout
3. Uncheck "Mirror Displays"

#### Linux
1. Settings → Displays
2. Arrange monitors left to right
3. Apply configuration

## Benefits

✨ **Immersive Visualization**: See multiple simulation scenarios simultaneously  
✨ **Flexible Development**: Test with 1 screen, deploy to 3 screens  
✨ **Easy Navigation**: Smooth scrolling and quick-jump controls  
✨ **Professional Presentation**: Perfect for control rooms and demos  

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Exit fullscreen |
| `←` / `→` | Scroll horizontally |
| `Home` | Jump to Screen 1 |
| `End` | Jump to Screen 3 |

---

**Note**: When only 1 screen is attached, the horizontal scrollbar allows you to preview what will be displayed on each of the 3 screens once they're physically connected.

