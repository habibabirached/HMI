# Step 8: Multi-Component Chart Configuration Dialog ✅

## Goal
Create a professional dialog that allows users to configure multi-component bar charts by selecting a CSV file and mapping columns to each selected component.

## Implementation Details

### 1. New Dialog Component
**File**: `dcs-ui/src/components/MultiComponentChartDialog/MultiComponentChartDialog.jsx`

A full-featured React component that handles:
- **CSV file selection** from database
- **Column discovery** for selected CSV
- **Component-to-column mapping** UI
- **Time column selection** (X-axis)
- **Chart title customization**
- **Validation** before chart creation
- **Auto-detection** of time columns

**Key Features**:
```javascript
// Auto-fetch CSV files on mount
useEffect(() => {
  fetchCsvFiles();
}, []);

// Auto-select if only one CSV exists
if (data.csv_files && data.csv_files.length === 1) {
  handleCsvSelect(data.csv_files[0]);
}

// Auto-detect time column
const timeCol = data.columns.find(col => 
  col.toLowerCase().includes('time') || 
  col.toLowerCase().includes('timestamp') ||
  col.toLowerCase().includes('seconds')
);
```

**Validation**:
- Ensures all components have columns assigned
- Requires time column selection
- Shows error messages for missing data

**Chart Configuration Output**:
```javascript
{
  type: 'multi-bar-chart',
  csvFile: 'Tier III Data Center - Horizontal Layout.csv',
  timeColumn: 'time_minutes',
  title: 'Power Generation vs Load',
  components: [
    { id: 'comp-1', name: 'Solar PV', type: 'solar', columnName: 'solar_output_mw' },
    { id: 'comp-2', name: 'Wind Type III', type: 'wind', columnName: 'wind_output_mw' },
    { id: 'comp-3', name: 'BESS', type: 'battery', columnName: 'bess_soc_percent' }
  ]
}
```

### 2. Professional GE Vernova Styling
**File**: `dcs-ui/src/components/MultiComponentChartDialog/MultiComponentChartDialog.css`

**Visual Features**:
- **Dark overlay** with backdrop blur
- **Teal glowing border** matching GE Vernova theme
- **Smooth animations**: slide-in, fade-in, error shake
- **Responsive layout** with max-height scrolling
- **Professional typography** with proper hierarchy
- **Hover effects** on all interactive elements
- **Loading spinner** animation
- **Preview section** showing configuration summary

**Key CSS Classes**:
```css
.dialog-overlay - Full-screen dark backdrop
.multi-chart-dialog - Main dialog container with animations
.dialog-header - Gradient header with title
.dialog-body - Scrollable content area
.dialog-section - Form sections
.component-mappings - Component-to-column UI
.mapping-row - Individual component mapping
.dialog-preview - Configuration preview
.dialog-footer - Action buttons
```

### 3. Canvas Integration
**File**: `dcs-ui/src/components/Canvas/Canvas.jsx`

**New State**:
```javascript
const [showMultiChartDialog, setShowMultiChartDialog] = useState(false);
const [multiChartComponents, setMultiChartComponents] = useState([]);
```

**Updated Handler**:
```javascript
const handleMultiComponentChartTypeSelected = (chartType) => {
  if (chartType === 'animated-bar-chart') {
    setMultiChartComponents(contextMenu.components);
    setShowMultiChartDialog(true);
  }
  setContextMenu(null);
};
```

**New Handler**:
```javascript
const handleCreateMultiChart = (chartConfig) => {
  console.log('✅ Multi-component chart created:', chartConfig);
  if (onCreateMultiComponentChart) {
    onCreateMultiComponentChart(chartConfig);
  }
};
```

**Dialog Rendering**:
```jsx
{showMultiChartDialog && (
  <MultiComponentChartDialog
    components={multiChartComponents}
    onClose={() => setShowMultiChartDialog(false)}
    onCreateChart={handleCreateMultiChart}
  />
)}
```

### 4. App.js Integration
**File**: `dcs-ui/src/App.js`

**New Handler**:
```javascript
const handleCreateMultiComponentChart = (chartConfig) => {
  console.log('📊 Creating multi-component chart:', chartConfig);
  
  const multiChart = {
    id: `multi-${Date.now()}`,
    type: 'multi-component',
    chartType: chartConfig.type,
    title: chartConfig.title,
    csvName: chartConfig.csvFile,
    timeColumn: chartConfig.timeColumn,
    components: chartConfig.components,
    isMultiComponent: true
  };
  
  setOpenCharts(prev => [...prev, multiChart]);
};
```

**Canvas Prop**:
```jsx
<Canvas
  ...
  onCreateMultiComponentChart={handleCreateMultiComponentChart}
  ...
/>
```

## API Endpoints Used

### 1. List CSV Files
```
GET http://localhost:8000/api/csv/list
Response: { csv_files: ['file1.csv', 'file2.csv'] }
```

### 2. Get CSV Columns
```
GET http://localhost:8000/api/csv/{csvName}/columns
Response: { columns: ['time_minutes', 'solar_output_mw', ...] }
```

## Testing Instructions

### Test 1: Open Dialog
1. **Shift+Click** to select 2-3 components (e.g., Solar PV, Wind, BESS)
2. **Right-click** on a selected component
3. Click **"📊 Animated Bar Chart"**
4. **Expected**: Dialog opens with smooth slide-in animation

### Test 2: CSV Auto-Load
1. Open dialog with components selected
2. **Expected**: 
   - "Tier III Data Center - Horizontal Layout.csv" auto-selected (if it's the only CSV)
   - Columns loaded automatically
   - Time column auto-detected

### Test 3: Component Mapping UI
1. Dialog open with CSV selected
2. **Expected**: See mapping rows for each selected component:
   ```
   ⚡ Solar PV (solar) → [Select Column ▼]
   ⚡ Wind Type III (wind) → [Select Column ▼]
   ⚡ BESS (battery) → [Select Column ▼]
   ```
3. Hover over mapping rows → Should highlight with teal background

### Test 4: Column Assignment
1. For "Solar PV", select "solar_output_mw"
2. For "Wind Type III", select "wind_output_mw"
3. For "BESS", select "bess_soc_percent"
4. **Expected**: Preview section appears at bottom showing configuration

### Test 5: Validation
1. Leave one component unmapped
2. Click **"✓ Create Chart"**
3. **Expected**: Red error message with shake animation
4. Complete all mappings
5. **Expected**: Create button enabled and glowing

### Test 6: Chart Creation
1. Complete all mappings
2. Change title to "Power Generation vs Load"
3. Click **"✓ Create Chart"**
4. **Expected**:
   - Dialog closes
   - Console logs: `✅ Multi-component chart created: {...}`
   - Chart configuration passed to App.js
   - (Chart will render in Step 9)

### Test 7: Cancel/Close
1. Open dialog
2. Click **"Cancel"** or **"✕"** or click outside dialog
3. **Expected**: Dialog closes smoothly without creating chart

### Test 8: Multiple CSVs
1. Upload additional CSVs via toolbar
2. Open dialog
3. **Expected**: Dropdown shows all available CSVs

## Dialog Flow

```
1. Multi-select components (Shift+Click)
2. Right-click → "📊 Animated Bar Chart"
3. Dialog opens
   ├─ CSV files fetched from backend
   ├─ Auto-select if only one CSV
   └─ Auto-detect time column
4. User selects CSV (if not auto-selected)
5. Columns fetched for selected CSV
6. User maps each component to a column
7. User optionally customizes title
8. User clicks "✓ Create Chart"
   ├─ Validation runs
   ├─ Chart config created
   └─ Passed to App.js
9. Dialog closes
10. (Step 9: Render bar chart in ChartPanel)
```

## Component Props

### MultiComponentChartDialog Props
```javascript
{
  components: Array<Component>,      // Selected components from canvas
  onClose: () => void,               // Called when dialog closes
  onCreateChart: (config) => void    // Called when "Create Chart" clicked
}
```

### Chart Config Structure
```javascript
{
  type: 'multi-bar-chart',
  csvFile: string,                   // CSV filename
  timeColumn: string,                // X-axis column
  title: string,                     // Chart title
  components: [
    {
      id: string,                    // Component ID
      name: string,                  // Component name
      type: string,                  // Component type (solar, wind, etc.)
      columnName: string             // CSV column for this component
    }
  ]
}
```

## Files Created
- ✅ `dcs-ui/src/components/MultiComponentChartDialog/MultiComponentChartDialog.jsx` - Dialog component (243 lines)
- ✅ `dcs-ui/src/components/MultiComponentChartDialog/MultiComponentChartDialog.css` - Professional styling (348 lines)

## Files Modified
- ✅ `dcs-ui/src/components/Canvas/Canvas.jsx` - Integrated dialog
- ✅ `dcs-ui/src/App.js` - Added `handleCreateMultiComponentChart`

## Next Step

**Step 9**: Multi-Component Bar Chart Rendering
- Create Plotly multi-bar chart component
- Handle animated bar updates during simulation
- Integrate with ChartPanel
- Add real-time data updates

## Status
✅ **COMPLETE** - Ready for testing

---

**Testing Checklist**:
- [ ] Dialog opens with slide-in animation
- [ ] CSV files load from backend
- [ ] Auto-detection works (CSV & time column)
- [ ] Component mapping UI displays correctly
- [ ] Column dropdowns work
- [ ] Preview section shows correct info
- [ ] Validation catches missing mappings
- [ ] Error messages shake and display
- [ ] Create button enables/disables correctly
- [ ] Chart config logged to console
- [ ] Dialog closes on cancel/close/outside click
- [ ] GE Vernova styling looks professional
