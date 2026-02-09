# Step 7: Multi-Component Context Menu ✅

## Goal
When right-clicking on a component that's part of a multi-selection, show a specialized context menu with options for multi-component charts (like Animated Bar Chart).

## Implementation Details

### 1. Context Menu Type Detection
**File**: `dcs-ui/src/components/Canvas/Canvas.jsx`

Modified `handleComponentContextMenu()` to detect multi-selection scenarios:
```javascript
const handleComponentContextMenu = (e, component) => {
  e.preventDefault();
  e.stopPropagation();
  
  // CRITICAL: Clear any dragging state when context menu opens
  setDraggingComponent(null);
  setConnecting(null);
  setConnectingTo(null);
  
  // Check if this is a multi-selection scenario
  const isMultiSelect = selectedComponents.length > 1 && isComponentMultiSelected(component.id);
  
  if (isMultiSelect) {
    // Multi-component context menu
    console.log('🖱️ Right-click on multi-selection:', selectedComponents.length, 'components');
    setContextMenu({
      type: 'multi-component',
      components: selectedComponents.map(id => components.find(c => c.id === id)).filter(Boolean),
      position: { x: e.clientX, y: e.clientY }
    });
  } else {
    // Single component context menu (existing behavior)
    console.log('🖱️ Right-click on component:', component.name);
    setContextMenu({
      type: 'single-component',
      component,
      position: { x: e.clientX, y: e.clientY }
    });
  }
};
```

**Key Logic**:
- If `selectedComponents.length > 1` AND the right-clicked component is in the multi-selection → show multi-component menu
- Otherwise → show single-component menu (existing ChartContextMenu)

### 2. Multi-Component Menu UI
**File**: `dcs-ui/src/components/Canvas/Canvas.jsx`

Added new JSX rendering for multi-component context menu:
```jsx
{/* Multi-Component Context Menu */}
{contextMenu && contextMenu.type === 'multi-component' && (
  <div 
    className="multi-component-context-menu"
    style={{
      position: 'fixed',
      left: contextMenu.position.x,
      top: contextMenu.position.y,
      zIndex: 10000
    }}
  >
    <div className="context-menu-content">
      <div className="context-menu-header">
        📊 Multi-Component Charts
        <div className="context-menu-subtitle">
          {contextMenu.components.length} components selected
        </div>
      </div>
      <div className="context-menu-separator"></div>
      <button 
        className="context-menu-item"
        onClick={() => {
          console.log('📊 Animated Bar Chart selected for', contextMenu.components.length, 'components');
          setContextMenu(null);
          // TODO: Open multi-component chart dialog (Step 9)
        }}
      >
        <span className="context-menu-icon">📊</span>
        <span className="context-menu-label">Animated Bar Chart</span>
      </button>
      <button 
        className="context-menu-item"
        onClick={() => {
          console.log('📈 Multi-Line Plot selected');
          setContextMenu(null);
          // TODO: Implement multi-line plot
        }}
      >
        <span className="context-menu-icon">📈</span>
        <span className="context-menu-label">Multi-Line 2D Plot</span>
      </button>
      <button 
        className="context-menu-item"
        onClick={() => {
          console.log('📉 Stacked Area Chart selected');
          setContextMenu(null);
          // TODO: Implement stacked area
        }}
      >
        <span className="context-menu-icon">📉</span>
        <span className="context-menu-label">Stacked Area Chart</span>
      </button>
    </div>
  </div>
)}
```

**Menu Options**:
1. **📊 Animated Bar Chart** - Primary focus for next steps
2. **📈 Multi-Line 2D Plot** - Future implementation
3. **📉 Stacked Area Chart** - Future implementation

### 3. Professional GE Vernova Styling
**File**: `dcs-ui/src/components/Canvas/Canvas.css`

Added extensive CSS for the multi-component menu:
```css
.multi-component-context-menu {
  background: #1a1a1a;
  border: 2px solid #0066ff;
  border-radius: 8px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.8),
    0 0 20px rgba(0, 102, 255, 0.4);
  overflow: hidden;
  min-width: 280px;
  animation: context-menu-appear 0.2s ease-out;
}

@keyframes context-menu-appear {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.context-menu-header {
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(0, 102, 255, 0.2) 0%, rgba(0, 102, 255, 0.05) 100%);
  border-bottom: 1px solid rgba(0, 102, 255, 0.3);
  font-size: 13px;
  font-weight: 700;
  color: #0099ff;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.context-menu-item {
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #e0e0e0;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
}

.context-menu-item:hover {
  background: rgba(0, 102, 255, 0.15);
  color: #0099ff;
  padding-left: 20px;
}
```

**Visual Features**:
- Smooth scale-in animation (`context-menu-appear`)
- Blue glowing border matching GE Vernova theme
- Gradient header with component count
- Hover effects with slide animation
- Professional spacing and typography

### 4. Click-Outside Handler
**File**: `dcs-ui/src/components/Canvas/Canvas.jsx`

Added `useEffect` hook to close menu when clicking outside:
```javascript
// Click outside handler for multi-component context menu
useEffect(() => {
  if (!contextMenu || contextMenu.type !== 'multi-component') return;
  
  const handleClickOutside = (e) => {
    // If clicking outside the context menu, close it
    const menuElement = document.querySelector('.multi-component-context-menu');
    if (menuElement && !menuElement.contains(e.target)) {
      setContextMenu(null);
    }
  };
  
  // Use a small delay to avoid closing immediately on the same click that opened it
  setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
  }, 100);
  
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [contextMenu]);
```

**Note**: 100ms delay prevents menu from closing immediately on the right-click that opened it.

## Testing Instructions

### Test 1: Single Component Right-Click
1. **Action**: Right-click on a single component
2. **Expected**: Normal ChartContextMenu appears with single-component chart options (2D Plot, Histogram, etc.)
3. **Console**: `🖱️ Right-click on component: <name>`

### Test 2: Multi-Selection Right-Click
1. **Action**: 
   - Shift+Click to select multiple components (e.g., 3 components)
   - Right-click on one of the selected components
2. **Expected**: 
   - Multi-component context menu appears
   - Header shows "📊 Multi-Component Charts"
   - Subtitle shows "3 components selected"
   - Three menu options visible
3. **Console**: `🖱️ Right-click on multi-selection: 3 components`

### Test 3: Menu Item Click
1. **Action**: 
   - Multi-select components
   - Right-click
   - Click "📊 Animated Bar Chart"
2. **Expected**: 
   - Menu closes
   - Console logs: `📊 Animated Bar Chart selected for <N> components`
3. **Note**: Dialog will be implemented in Step 9

### Test 4: Click Outside to Close
1. **Action**: 
   - Open multi-component menu
   - Click anywhere outside the menu
2. **Expected**: Menu closes smoothly

### Test 5: Escape Key
1. **Action**: 
   - Open multi-component menu
   - Press Escape key
2. **Expected**: 
   - Menu closes
   - Multi-selection is cleared

### Test 6: Right-Click on Non-Selected Component
1. **Action**: 
   - Multi-select components A, B, C
   - Right-click on component D (not selected)
2. **Expected**: 
   - Single-component menu appears for component D
   - Multi-selection is NOT cleared

## Context Menu State Structure

### Single-Component Menu
```javascript
{
  type: 'single-component',
  component: { id, name, type, ... },
  position: { x: 123, y: 456 }
}
```

### Multi-Component Menu
```javascript
{
  type: 'multi-component',
  components: [
    { id: 1, name: 'Solar PV', ... },
    { id: 2, name: 'Wind Type III', ... },
    { id: 3, name: 'BESS', ... }
  ],
  position: { x: 123, y: 456 }
}
```

## Next Steps

**Step 8**: CSV Column Mapping UI
- Create a dialog for selecting which CSV columns map to which components
- Will be triggered from the "Animated Bar Chart" button

**Step 9**: Multi-Component Chart Dialog
- UI to select unified CSV file
- Column assignment for each selected component
- Bar chart configuration options

## Files Modified
- ✅ `dcs-ui/src/components/Canvas/Canvas.jsx` - Context menu logic & import
- ✅ `dcs-ui/src/components/Canvas/Canvas.css` - Cleaned up (removed inline menu styles)
- ✅ `dcs-ui/src/components/MultiComponentContextMenu/MultiComponentContextMenu.jsx` - **NEW** component
- ✅ `dcs-ui/src/components/MultiComponentContextMenu/MultiComponentContextMenu.css` - **NEW** styling

## Refactoring Notes

**Why separate component?**
1. **Consistency** - Matches `ChartContextMenu` pattern
2. **Maintainability** - Canvas.jsx reduced from 804 → 753 lines
3. **Reusability** - Can be used elsewhere if needed
4. **Cleaner code** - All menu logic in one place
5. **Better organization** - Menu CSS separate from Canvas CSS

## Status
✅ **COMPLETE** - Ready for testing

---

**Testing Checklist**:
- [ ] Single component right-click still works
- [ ] Multi-selection right-click shows new menu
- [ ] Menu displays correct component count
- [ ] Click outside closes menu
- [ ] Escape key closes menu
- [ ] Menu styling matches GE Vernova theme
- [ ] Hover effects work smoothly
- [ ] Console logs show correct selection info
