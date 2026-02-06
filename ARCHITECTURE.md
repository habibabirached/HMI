# Data Center Power System Designer - Software Architecture

---

## System Architecture Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                           PRESENTATION LAYER (Frontend)                      ┃
┃                                                                              ┃
┃  ┌────────────────────────────────────────────────────────────────────┐    ┃
┃  │                    React-Based HMI (HTML5/CSS3/JS)                 │    ┃
┃  │                                                                     │    ┃
┃  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │    ┃
┃  │  │  Design Mode    │  │ Simulation Mode │  │  Data Viz Layer  │  │    ┃
┃  │  │                 │  │                 │  │                  │  │    ┃
┃  │  │ • Component     │  │ • Real-time     │  │ • 2D/3D Plots   │  │    ┃
┃  │  │   Library       │  │   Controls      │  │ • Histograms    │  │    ┃
┃  │  │ • Drag & Drop   │  │ • Trip/Restart  │  │ • Gauges        │  │    ┃
┃  │  │ • Canvas Editor │  │ • Breaker Ctrl  │  │ • Time Series   │  │    ┃
┃  │  │ • Properties    │  │ • Scenarios     │  │ • Interactive   │  │    ┃
┃  │  └─────────────────┘  └─────────────────┘  └──────────────────┘  │    ┃
┃  │                                                                     │    ┃
┃  └────────────────────────────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                      ▲
                                      │ HTTPS/REST API
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                        APPLICATION LAYER (Backend)                           ┃
┃                                                                              ┃
┃  ┌────────────────────────────────────────────────────────────────────┐    ┃
┃  │                   Python FastAPI Backend Server                     │    ┃
┃  │                                                                     │    ┃
┃  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │    ┃
┃  │  │   API        │  │  Business    │  │   Data Processing      │  │    ┃
┃  │  │   Endpoints  │  │  Logic       │  │   Engine               │  │    ┃
┃  │  │              │  │              │  │                        │  │    ┃
┃  │  │ • /api/save  │  │ • Config Mgmt│  │ • CSV Parser          │  │    ┃
┃  │  │ • /api/load  │  │ • Component  │  │ • Data Transformation │  │    ┃
┃  │  │ • /api/sim   │  │   Validation │  │ • Result Aggregation  │  │    ┃
┃  │  │ • /api/viz   │  │ • Simulation │  │ • Pickle Unpacker     │  │    ┃
┃  │  └──────────────┘  └──────────────┘  └────────────────────────┘  │    ┃
┃  │                                                                     │    ┃
┃  └────────────────────────────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                      ▲
                                      │ SQLAlchemy ORM
                                      ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                           DATA PERSISTENCE LAYER                             ┃
┃                                                                              ┃
┃  ┌────────────────────────────────────────────────────────────────────┐    ┃
┃  │                      PostgreSQL Database                            │    ┃
┃  │                                                                     │    ┃
┃  │  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐  │    ┃
┃  │  │  Configurations  │  │  Components    │  │  Simulation Data │  │    ┃
┃  │  │                  │  │                │  │                  │  │    ┃
┃  │  │ • Canvas Layout  │  │ • Properties   │  │ • Time Series   │  │    ┃
┃  │  │ • Connections    │  │ • Metadata     │  │ • State History │  │    ┃
┃  │  │ • System State   │  │ • Library Def  │  │ • Results Cache │  │    ┃
┃  │  └──────────────────┘  └────────────────┘  └──────────────────┘  │    ┃
┃  │                                                                     │    ┃
┃  └────────────────────────────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Integration with PSCAD Simulation Engine

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                       SIMULATION INTEGRATION LAYER                           ┃
┃                                                                              ┃
┃                           Python Backend (FastAPI)                           ┃
┃                                    ▲                                         ┃
┃                                    │                                         ┃
┃             ┌──────────────────────┼──────────────────────┐                 ┃
┃             │                      │                      │                 ┃
┃             ▼                      ▼                      ▼                 ┃
┃  ┌────────────────────┐ ┌───────────────────┐ ┌────────────────────┐      ┃
┃  │   MODALITY 1:      │ │   MODALITY 2:     │ │   MODALITY 3:      │      ┃
┃  │   CSV Upload       │ │   Database        │ │   API Endpoint     │      ┃
┃  │                    │ │   Connection      │ │   Integration      │      ┃
┃  │ • Browser Upload   │ │                   │ │                    │      ┃
┃  │ • File Validation  │ │ • Direct Query    │ │ • REST/gRPC API   │      ┃
┃  │ • Manual Config    │ │ • Auto-Sync       │ │ • Real-time Data  │      ┃
┃  │ • Quick Setup      │ │ • Batch Results   │ │ • Event Streaming │      ┃
┃  │                    │ │ • Scheduled Jobs  │ │ • Async Execution │      ┃
┃  └────────────────────┘ └───────────────────┘ └────────────────────┘      ┃
┃             │                      │                      │                 ┃
┃             └──────────────────────┼──────────────────────┘                 ┃
┃                                    ▼                                         ┃
┃  ┌────────────────────────────────────────────────────────────────────┐    ┃
┃  │                     FlexSim Automation Tool                         │    ┃
┃  │                     (Python - Megan's Tool)                         │    ┃
┃  │                                                                     │    ┃
┃  │  • Component Parameterization (CSV Config)                         │    ┃
┃  │  • Event/Case Management                                           │    ┃
┃  │  • Analysis File Configuration                                     │    ┃
┃  │  • Post-Processing Scripts                                         │    ┃
┃  │  • Pickle File Generation                                          │    ┃
┃  └────────────────────────────────────────────────────────────────────┘    ┃
┃                                    ▲                                         ┃
┃                                    │ Python API                              ┃
┃                                    ▼                                         ┃
┃  ┌────────────────────────────────────────────────────────────────────┐    ┃
┃  │                       PSCAD Simulation Engine                       │    ┃
┃  │                                                                     │    ┃
┃  │  • Power System Model (Circuit/Network)                            │    ┃
┃  │  • Component Library (Generators, Breakers, BESS, etc.)           │    ┃
┃  │  • Control Systems & Protection Logic                             │    ┃
┃  │  • Time-Domain Simulation                                          │    ┃
┃  │  • Fault Analysis & Event Studies                                  │    ┃
┃  │  • Output Channel Configuration                                    │    ┃
┃  └────────────────────────────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## NEW - Modality 4: Hardware-in-the-Loop (HIL) Integration

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                          MODALITY 4: HIL/SCADA Layer                         ┃
┃                                                                              ┃
┃  ┌────────────────────────────────────────────────────────────────────┐    ┃
┃  │               Python Backend (Real-Time Interface)                  │    ┃
┃  │                                                                     │    ┃
┃  │  • OPC UA/DA Protocol Handlers                                     │    ┃
┃  │  • Modbus TCP/RTU Connectors                                       │    ┃
┃  │  • DNP3/IEC 61850 Support                                          │    ┃
┃  │  • WebSocket Streaming to Frontend                                 │    ┃
┃  │  • Real-Time Data Buffering                                        │    ┃
┃  └────────────────────────────────────────────────────────────────────┘    ┃
┃                                    ▲                                         ┃
┃                                    │ Industrial Protocols                    ┃
┃                                    ▼                                         ┃
┃  ┌────────────────────────────────────────────────────────────────────┐    ┃
┃  │              SCADA/DCS/RTU Systems or HIL Simulator                │    ┃
┃  │                                                                     │    ┃
┃  │  • Live Equipment Telemetry                                        │    ┃
┃  │  • Real-Time State Monitoring                                      │    ┃
┃  │  • Command & Control Interface                                     │    ┃
┃  │  • Hardware Fault Injection                                        │    ┃
┃  │  • Physical Equipment Testing                                      │    ┃
┃  └────────────────────────────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

USE CASES:
• Validate HMI against actual operational data
• Real-time monitoring of deployed systems
• Live demonstration with physical equipment
• Training operators on real hardware behavior
• Commissioning and acceptance testing
```

---

## Data Flow Architecture

```
┌─────────────┐         ┌──────────────┐        ┌───────────────┐
│   User      │         │   Designer   │        │   PSCAD       │
│  (Customer) │         │   (Megan)    │        │   Engineer    │
└──────┬──────┘         └──────┬───────┘        └───────┬───────┘
       │                       │                        │
       │ View Simulation       │ Design System          │ Run Simulations
       │                       │ Upload Config          │ Generate Results
       ▼                       ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│                  React Frontend (HMI)                        │
│  • Interactive Canvas  • Simulation Controls  • Data Viz    │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API (HTTPS)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              Python FastAPI Backend                          │
│  • Authentication  • Business Logic  • Data Processing       │
└───────────────────────────┬──────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
    ┌──────────┐    ┌──────────────┐  ┌───────────┐
    │PostgreSQL│    │   FlexSim    │  │  PSCAD    │
    │ Database │    │  (Python)    │  │  (Python  │
    │          │    │              │  │   API)    │
    └──────────┘    └──────────────┘  └───────────┘
         │                 │                │
         │                 └────────────────┘
         │                         │
         └─────────────────────────┘
                    Simulation Results
```

---

## Technology Stack Summary

### **Frontend Layer**
- **Framework**: React 18+ (JavaScript/JSX)
- **UI Components**: Custom SVG-based canvas, drag-and-drop interface
- **Visualization**: D3.js, Chart.js, Plotly.js for dynamic data viz
- **State Management**: React Hooks (useState, useCallback, useEffect)
- **HTTP Client**: Fetch API / Axios for REST communication

### **Backend Layer**
- **Framework**: Python FastAPI (ASGI)
- **ORM**: SQLAlchemy (PostgreSQL adapter)
- **Data Validation**: Pydantic schemas
- **Authentication**: JWT tokens / OAuth2 (future)
- **CORS**: Middleware for cross-origin requests
- **File Handling**: CSV parsing, Pickle deserialization

### **Database Layer**
- **DBMS**: PostgreSQL 14+
- **Schema**: Configurations, Components, Simulation Results
- **Backup**: Dual storage (DB + JSON files on disk)

### **Simulation Integration**
- **PSCAD**: Python API automation
- **FlexSim**: Custom Python tool (Megan's automation suite)
- **Data Exchange**: CSV, Pickle, JSON, Direct API

### **Deployment & Infrastructure**
- **Containerization**: Docker (Frontend & Backend)
- **Orchestration**: Docker Compose
- **CI/CD**: Automated git polling, build, deploy pipeline
- **Hosting**: On-premise (Bultown Campus - Customer Experience Center)
- **Display**: Large-format touchscreens / interactive kiosks

---

## Key Features & Capabilities

### **Design Mode (Expert Interface)**
✓ Drag-and-drop component library
✓ Visual circuit/network builder
✓ Property editing panel
✓ Connection management
✓ Configuration save/load
✓ Multi-customer configurations

### **Simulation Mode (Customer Interface)**
✓ Interactive component control (trip, restart, open/close breakers)
✓ Pre-built scenario execution (grid loss, turbine failure, etc.)
✓ Real-time data visualization (2D/3D plots, histograms, gauges)
✓ Hierarchical view (compressed/expanded components)
✓ "What-if" scenario exploration
✓ Intuitive, non-technical UI

### **Integration Capabilities**
✓ Four data modalities (CSV, Database, API, HIL/SCADA)
✓ PSCAD Python API integration
✓ FlexSim automation tool compatibility
✓ Real-time and batch simulation support
✓ Post-processing and analysis

---

## Deployment Architecture

```
┌────────────────────────────────────────────────────────────┐
│          Bultown Campus - Customer Experience Center       │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Interactive Display (High Bay - 18ft x 10ft)     │    │
│  │                                                    │    │
│  │  • Large Touchscreen Kiosk                        │    │
│  │  • HMI Frontend (React App)                       │    │
│  │  • Customer-facing Interface                      │    │
│  └───────────────────────────────────────────────────┘    │
│                        ▲                                    │
│                        │ HTTPS/Local Network                │
│                        ▼                                    │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Backend Server (On-Premise / Docker Container)   │    │
│  │                                                    │    │
│  │  • Python FastAPI Service                         │    │
│  │  • PostgreSQL Database                            │    │
│  │  • PSCAD Integration (via FlexSim)               │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Security & Access Control

- **Authentication**: User roles (Designer, Customer, Admin)
- **Authorization**: Route-level permissions, read-only customer access
- **Data Protection**: HTTPS/TLS encryption, input validation
- **Configuration Locking**: Prevent customer modifications to pre-built configs
- **Audit Logging**: Track design changes and simulation executions

---

## Future Enhancements

1. **Advanced Visualizations**: AR/VR integration for 3D power system walkthrough
2. **Machine Learning**: Predictive maintenance, anomaly detection
3. **Multi-Site Management**: Federated control across data center portfolio
4. **Energy Market Integration**: Real-time pricing, demand response optimization
5. **Digital Twin**: Continuous synchronization with operational facilities
6. **Mobile App**: iOS/Android companion for on-the-go monitoring
7. **Collaborative Features**: Multi-user design sessions, commenting, version control

---

## Success Metrics

- **User Experience**: <2s page load, drag-drop <100ms latency
- **Simulation Speed**: Results rendered within 5s for pre-computed data
- **Scalability**: Support 50+ concurrent users, 100+ saved configurations
- **Reliability**: 99.9% uptime, automated failover
- **Customer Engagement**: Demo completion rate >80%, positive feedback

---

## Presentation Narrative: How to Explain This Architecture

### Introduction: The Problem We're Solving

When presenting this architecture, start by establishing context. Explain that modern data centers, particularly those operated by hyperscalers like Meta and Google, are incredibly complex power systems. These facilities consume hundreds of megawatts of power and require sophisticated redundancy and reliability planning. Traditionally, engineers use specialized simulation software like PSCAD to model these systems, but PSCAD is a highly technical tool designed for electrical engineers with advanced degrees. The graphical interface is cluttered with electrical symbols, differential equations, and control system diagrams that make perfect sense to a power systems engineer but are completely opaque to business executives, facility managers, or customer decision-makers who need to understand these systems to make multimillion-dollar procurement decisions.

This creates a fundamental communication gap. When GE Vernova's consulting services team develops a data center power system design for Meta, they produce hundreds of pages of technical documentation and PSCAD simulation results, but what the customer really needs is to *understand* the system intuitively. They need to see what happens when a turbine fails, when the grid goes down, or when battery storage kicks in. They need to explore "what-if" scenarios without requiring a PhD in electrical engineering. That's exactly what we've built: a Human-Machine Interface that bridges the gap between sophisticated power system simulation and intuitive, interactive customer experience.

### The Three-Layer Architecture: Building on Proven Foundations

Our architecture follows a classic three-tier design pattern that has proven successful in enterprise applications for decades. Let me walk you through each layer and explain why we made specific technology choices. At the top, we have the Presentation Layer, which is what users actually interact with. We built this using React, a modern JavaScript framework developed by Facebook that powers some of the world's most sophisticated web applications including Facebook itself, Netflix, Airbnb, and Instagram. React excels at creating highly interactive, dynamic interfaces where data changes frequently and the screen needs to update in real-time without full page refreshes. This is perfect for our use case because when a customer clicks "Trip Turbine," we need the entire visualization to update instantly—components change color, power flow animations adjust, graphs redraw, and status indicators update—all in milliseconds without any jarring page reloads.

Within the React frontend, we've organized the interface into three major functional areas. First is Design Mode, which is an expert interface intended for people like Megan, our PSCAD specialist. Design Mode provides a drag-and-drop component library on the left side of the screen containing every power system component you might need: gas turbines of various sizes, wind turbines, solar arrays, battery energy storage systems, transformers, circuit breakers, buses, and loads. Engineers can drag these components onto a canvas and connect them visually by clicking from one component to another, creating a power flow diagram that represents the actual electrical architecture. Each component has editable properties—you can set the rating of a generator, the voltage level of a bus, or the capacity of a battery. This design interface allows us to create and save multiple configurations for different customers. For example, we might have a "Meta Tier III Configuration" with three 10MW gas turbines, wind, solar, and BESS, or a "Google Islanded Configuration" with different specifications. The key innovation here is that once an engineer creates and saves a configuration, it's immediately available for customer demonstrations without requiring any developer intervention or code changes.

The second major area of the frontend is Simulation Mode, which is the customer-facing interface. When presenting to executives or facility managers, we switch to this view which hides the complexity of the design tools and instead shows the power system in a clean, simplified format with intuitive controls. Users can click on any component and see context-sensitive action buttons—if you click a generator, you get "Trip Turbine" and "Restart" buttons; if you click a breaker, you get "Open," "Close," and "Trip" buttons; if you click a battery, you get "Battery Failure" and "Enable Battery" buttons. There's also a Quick Scenarios section with pre-programmed buttons like "Trip Random Turbine," "Trip All Turbines," "Grid Loss," and "Open All Breakers" that allow customers to explore common failure modes with a single click. This transforms a passive presentation into an interactive exploration where the customer can ask "what if?" questions and see the answer immediately.

The third functional area is the Data Visualization Layer, which is where we present simulation results in intuitive, dynamic formats. We support traditional 2D time-series plots showing voltage, frequency, and power over time, but we also implement more creative visualizations like animated histograms showing real-time power contribution from different sources, gauge displays showing battery state-of-charge or frequency deviation, and interactive 3D plots for multi-variable analysis. The critical insight here is that our target audience includes non-technical decision-makers, so we've prioritized clarity and intuitiveness over engineering precision. A customer should be able to look at the screen and immediately understand "the system is healthy" or "power is flowing from batteries because the turbines tripped"—they shouldn't need to interpret complex waveforms or read technical axis labels.

### The Application Layer: Python Powering the Intelligence

Behind this polished frontend sits our Python-based application layer, which is the brain of the entire system. We chose FastAPI as our web framework, which is a modern Python framework that's faster than Flask (the traditional choice) and simpler than Django. FastAPI provides automatic API documentation, built-in data validation through Pydantic, and excellent performance through asynchronous request handling. The backend exposes a REST API with endpoints for all major operations: `/api/save` for saving configurations, `/api/load` for loading configurations, `/api/configs` for listing available configurations, `/api/delete` for removing old configurations, and eventually `/api/simulate` for triggering new simulations.

Within the backend, we've implemented clean separation of concerns. The API endpoints handle HTTP request parsing and response formatting but delegate actual business logic to service layers. For example, when a save request comes in, the endpoint validates the incoming JSON data using Pydantic schemas, then passes it to a configuration management service that handles the database transaction and file system backup. We're using SQLAlchemy as our Object-Relational Mapping layer, which abstracts away the differences between database systems and lets us write Python code instead of raw SQL. This makes the code more maintainable and easier to test, and it means we could theoretically switch from PostgreSQL to Oracle or MySQL in the future with minimal code changes, though PostgreSQL is our production choice for good reasons I'll explain shortly.

One of the backend's key responsibilities is data processing and transformation. When simulation results come from PSCAD through FlexSim, they often arrive in formats optimized for engineering analysis—raw CSV files, Python pickle files, or database tables with cryptic column names. Our backend includes processing engines that parse these files, extract relevant time series data, perform any necessary calculations or aggregations, and reformat everything into JSON structures that the React frontend can easily consume. We also handle CSV file uploads directly through the web interface, which is part of Modality 1 that I'll explain in detail shortly. This upload mechanism includes validation—we check file sizes to prevent overload, verify CSV structure to catch formatting errors, and sanitize data to prevent security issues.

### The Data Persistence Layer: PostgreSQL as the Foundation

At the bottom of our architecture is the data persistence layer, anchored by PostgreSQL. You might wonder why we chose PostgreSQL specifically when we could have used MySQL, MongoDB, Oracle, or even stuck with SQLite that we started with. PostgreSQL is widely considered the most advanced open-source relational database in the world. It's used by Apple for their internal infrastructure, by Instagram to manage billions of photos, and by the US Government for critical systems. PostgreSQL provides ACID compliance (Atomicity, Consistency, Isolation, Durability), which guarantees that our data transactions are reliable even if the server crashes mid-operation. It handles JSON data natively, which is perfect for storing our component configurations that have nested structures and varying properties. It supports full-text search, so we could add features like "find all configurations containing a 10MW generator." It has sophisticated indexing capabilities that keep queries fast even as we accumulate thousands of configurations and gigabytes of simulation results. And critically, it has excellent Python support through psycopg2 and SQLAlchemy.

Within PostgreSQL, we've designed three main table schemas. The Configurations table stores complete system layouts including all components, their positions on the canvas, their connections, and all property values. Each configuration has metadata like name, description, creation timestamp, and last modified timestamp, which helps users find and manage their saved designs. The Components table stores the master library of available components with their default properties, specifications, and metadata. When you drag a "Gas Turbine 10MW" from the library onto the canvas, the system looks up this component definition to populate default values for voltage, rating, and other parameters. The Simulation Data table stores results from PSCAD runs—time series data, steady-state values, event logs, and analysis outputs. This is the largest table by far and could grow to gigabytes or even terabytes as we accumulate simulation history.

We've also implemented a belt-and-suspenders approach to data safety. Every configuration that's saved to the database is also serialized to a JSON file on disk in a `saved_configs` directory. This serves multiple purposes: it provides a backup if the database fails, it allows us to version control configurations using Git if needed, and it makes it easy to manually inspect or edit configurations using a text editor for debugging purposes. The JSON files are human-readable and follow a consistent schema, so an engineer could theoretically hand-edit a configuration file to make bulk changes and then upload it.

### Integration with PSCAD: The Four Modalities

This is where our architecture becomes truly innovative and differentiates us from any other solution in the market. Most tools that try to simplify power system simulation either ignore detailed physics-based simulation entirely (making them useless for serious engineering) or tightly couple to one specific simulation engine in one specific way (making them inflexible). We've designed four completely different integration modalities that can be used independently or in combination depending on the use case, timeline, and available infrastructure.

**Modality 1: CSV Upload** is the simplest and was how we delivered our first demonstration to Meta. In this approach, an engineer runs PSCAD simulations using traditional methods, which generates CSV output files containing time series data for various electrical quantities—voltage, current, frequency, power, etc. These CSV files are uploaded through the HMI's web interface, where they're parsed, validated, and stored in the database. The engineer can then associate these results with specific components or system-wide views, and configure how the data should be visualized—which columns map to which graph axes, what colors to use, what time ranges to display, etc. This modality requires zero integration with PSCAD itself—it's purely file-based. The advantage is that it works immediately with any PSCAD version, requires no API access or network configuration, and gives engineers complete control over what data is shown and how it's presented. The disadvantage is that it's manual—someone has to run PSCAD, export files, and upload them. This makes it perfect for prepared demonstrations where we know in advance what scenarios we want to show, but less suitable for interactive exploration where a customer might ask unexpected questions.

**Modality 2: Database Connection** represents a more sophisticated integration where our Python backend connects directly to a database where PSCAD stores its simulation results. PSCAD can be configured to write output data to databases like PostgreSQL, MySQL, or even Excel-like file formats that can be programmatically accessed. In this modality, our backend establishes a database connection using standard protocols and periodically queries for new simulation results. This enables batch processing workflows: an engineer might queue up 50 different fault scenarios in PSCAD, let them run overnight, and the next morning all 50 result sets are automatically available in the HMI without any manual file transfers. We can even implement automated scenario libraries where certain common analyses (single-phase fault at bus 3, three-phase fault at bus 5, voltage sag to 70%, etc.) are pre-computed and cached. The database connection approach scales much better than CSV uploads because it's automated, supports concurrent access from multiple users, and enables sophisticated querying—for example, "show me all scenarios where frequency dropped below 59.5 Hz."

**Modality 3: API Integration** is where the system becomes truly interactive and represents the cutting edge of what we're building. PSCAD provides a Python API that allows external programs to programmatically control the simulation engine—loading models, setting parameters, running simulations, and extracting results. Megan has developed an automation tool called FlexSim that wraps this PSCAD Python API and adds higher-level functionality for component parameterization, event scheduling, and results post-processing. Our HMI backend can call FlexSim's functions directly using Python-to-Python integration. This means when a customer clicks "Trip Turbine 2" in the HMI, our backend can construct a FlexSim command that tells PSCAD to load the appropriate model, inject a turbine trip event at time T=5 seconds, run the simulation for 30 seconds, and return voltage and frequency waveforms for all buses. The simulation completes in seconds (PSCAD is very fast), results flow back through FlexSim to our backend, get formatted into JSON, and stream to the frontend where graphs animate and components update. This creates a genuinely interactive experience where customers can explore unexpected scenarios on the fly. The technical challenge here is managing asynchronous execution—we can't block the web interface waiting for simulations to complete, so we use background task queues and WebSocket connections to stream results as they become available.

**Modality 4: Hardware-in-the-Loop and SCADA Integration** is our vision for the future and represents the evolution from a design tool to an operational monitoring system. In this modality, we connect to real-time data sources—either Hardware-in-the-Loop simulators that model physical equipment, or actual SCADA systems monitoring operational data centers. Industrial control systems communicate using specialized protocols like OPC UA (OLE for Process Control Unified Architecture), Modbus TCP, DNP3 (Distributed Network Protocol), or IEC 61850 (the international standard for electrical substation automation). Python has excellent libraries for these protocols, so our backend can establish connections to PLCs (Programmable Logic Controllers), RTUs (Remote Terminal Units), or DCS (Distributed Control System) platforms. Once connected, we receive real-time telemetry—actual voltage, current, and frequency measurements from installed sensors; breaker positions; generator outputs; battery charge states; temperature readings; alarm conditions; etc. This data flows into the HMI and updates the visualization in real-time, creating a live monitoring dashboard. We can also send commands back to the equipment—remotely opening breakers, adjusting generator setpoints, or enabling battery discharge—making this a full-fledged control interface. The use cases for this modality include commissioning new facilities (using HIL simulation to validate control logic before energizing equipment), training operators on realistic scenarios, providing remote monitoring for facility managers, and potentially even participating in energy markets by automatically responding to price signals or grid operator requests.

### FlexSim: Megan's Tool as the Integration Bridge

It's critical to understand and give credit to Megan's FlexSim tool, which serves as the bridge between our web-based HMI and PSCAD's complex simulation engine. FlexSim is a Python-based automation framework that Megan developed over months of iterative refinement while working with PSCAD on various customer projects. It abstracts away the low-level PSCAD Python API quirks and provides a much cleaner, higher-level interface for running power system studies. FlexSim takes three CSV configuration files as inputs: one for component specifications (defining parameters like generator ratings, transformer ratios, or cable impedances), one for control settings (simulation duration, compiler options, event schedules), and one for analysis requirements (which signals to plot, what calculations to perform, how to format output reports). FlexSim reads these CSVs, programmatically manipulates the PSCAD model by setting parameter values and component states, executes the simulation, collects results from PSCAD's output channels, performs post-processing like FFT analysis or RMS calculations, and packages everything into pickle files (Python's native serialization format) for efficient storage and retrieval.

Rather than reinventing this functionality in our HMI backend—which would require months of development and duplicate Megan's expertise—we're taking a modular approach where our backend simply calls FlexSim as a library or subprocess. When the HMI needs to run a simulation, it constructs the three CSV files that FlexSim expects, invokes FlexSim's main simulation routine, waits for the pickle files to be generated, deserializes the pickles back into Python data structures, transforms the data into JSON format, and sends it to the frontend. This architectural decision means Megan can continue improving FlexSim independently—adding new features, fixing bugs, optimizing performance—and our HMI automatically benefits from those improvements. It also means other engineering teams at GE Vernova can use FlexSim for their own purposes independent of the HMI, creating reusable shared infrastructure.

### Data Flow: Tracing a Request Through the System

To make this architecture concrete, let me trace exactly what happens when a customer performs a specific action. Imagine a Meta executive visiting our Bultown Customer Experience Center, standing in front of the large touchscreen display, looking at a pre-loaded configuration showing their proposed data center power system with three gas turbines, wind, solar, BESS, and multiple redundant paths. The executive asks, "What happens if we lose Grid connection while also having a turbine trip?" This is a compound failure scenario that wasn't pre-computed. Here's the journey through our system:

First, the engineer operating the demo (let's say Partha) clicks the "Grid Loss" button in the Quick Scenarios panel. This is a React component that captures the click event and calls an onClick handler function. The handler makes an HTTP POST request to our Python backend's `/api/scenario/grid-loss` endpoint, sending a JSON payload that includes the current configuration ID and any additional parameters like which grid connection to disconnect. The request travels over HTTPS (encrypted) from the frontend React app running in the web browser to the FastAPI backend server running on an on-premise machine in the Bultown facility.

The FastAPI backend receives the request at the endpoint, which is a Python function decorated with `@app.post("/api/scenario/grid-loss")`. FastAPI automatically validates the incoming JSON against a Pydantic schema, ensuring required fields are present and types are correct. If validation fails, it returns an immediate error response. If validation succeeds, the endpoint function retrieves the configuration from the PostgreSQL database using SQLAlchemy—this is a SELECT query that fetches the configuration record with all component definitions and connections. The configuration data is a large JSON blob stored in the database, which gets deserialized into Python objects representing each component and connection.

Next, the backend needs to determine whether we have pre-computed results for this scenario. It queries the Simulation Data table looking for an entry matching this configuration ID and scenario type. In this case, let's assume we don't have pre-computed data for grid loss with turbine trip—this is a novel combination. The backend therefore needs to trigger a new PSCAD simulation. It prepares the three CSV files that FlexSim expects: the component CSV gets populated with parameters from our configuration (turbine ratings, voltage levels, cable lengths, etc.); the control CSV specifies a 30-second simulation with the grid disconnection event at T=5 seconds and the turbine trip at T=8 seconds; the analysis CSV lists all the signals we want plotted (bus voltages, generator outputs, battery discharge rate, frequency).

The backend then invokes FlexSim, which could happen in several ways depending on deployment. In development, it might import FlexSim as a Python module and call functions directly. In production, it might spawn FlexSim as a separate subprocess to isolate failures and manage resource consumption. FlexSim reads the CSVs, uses the PSCAD Python API to open the appropriate PSCAD model file (which Megan maintains separately), sets parameter values by navigating PSCAD's component hierarchy, injects the event schedule (grid disconnection at 5s, turbine trip at 8s), starts the simulation, and waits for completion. PSCAD runs its time-domain differential-algebraic equation solver, stepping through simulation time in milliseconds, calculating voltage and current at every node, checking for protection relay operations, modeling battery charge/discharge, and generally solving the full physics of the power system. This might take 10-30 seconds of real-world time to simulate 30 seconds of power system time.

When PSCAD finishes, FlexSim extracts results from PSCAD's output buffers, performs post-processing (perhaps calculating RMS values or identifying the nadir of the frequency dip), saves everything to pickle files in a results directory, and returns control to our backend. The backend deserializes the pickle files, extracting NumPy arrays of time-series data. It transforms this data into JSON-serializable format (converting NumPy arrays to lists, rounding floating-point numbers to reasonable precision, adding metadata like units and labels). It also updates the database by creating a new record in the Simulation Data table so this scenario is cached for future requests.

Finally, the backend sends an HTTP response back to the frontend containing the simulation results as JSON. This response might be several megabytes if we're returning 30 seconds of data sampled at 1kHz for 20 signals, so we employ compression (gzip) and potentially chunking to manage the transfer. The React frontend receives the response, parses the JSON, and begins updating the UI. The canvas component re-renders, changing the color of the grid connection and turbine to red to indicate they're offline. Graph components plot the new time-series data showing voltage dip, frequency excursion, and battery ramp-up. The histogram component animates showing the power contribution shifting from turbines to batteries. Status indicators update showing that despite the double failure, the system remained stable and loads stayed energized. All of this happens in a few seconds from the customer's perspective, creating the illusion of instant simulation.

### Deployment at Bultown: The Physical Installation

Beyond the software architecture, it's important to understand the physical deployment at the Bultown Campus Customer Experience Center because this influences many design decisions. Jaron has been coordinating with facilities to secure space in the high bay area, which is a large open space with high ceilings, excellent natural lighting from floor-to-ceiling windows on the west facade, and proximity to the main entrance where board members and VIP customers enter. The planned installation is a large-format interactive display measuring approximately 18 feet wide by 10 feet tall—this is not a typical desktop monitor but rather a video wall or large touchscreen kiosk similar to what you'd see in a museum or trade show booth. This scale is necessary to create impact when executives walk through; we want them to be visually impressed before they even touch the interface.

The display connects to a dedicated on-premise server rack located nearby, likely in a back room or equipment closet to keep noise and heat away from the demonstration area. This server runs our full stack: the PostgreSQL database, the Python FastAPI backend, and likely serves the React frontend as well (though the frontend could also be served from a CDN for faster loading). We're using Docker containers for both the frontend and backend, which simplifies deployment and ensures consistency between development and production environments. Docker Compose orchestrates the multi-container setup, defining how the frontend container, backend container, and database container communicate with each other over a private network.

Network infrastructure is critical. The server needs sufficient bandwidth to stream high-resolution graphics and simulation data to the large display without lag. It needs to be on a secured VLAN (Virtual Local Area Network) to prevent unauthorized access from the broader corporate network. We need to implement proper firewall rules allowing inbound HTTPS traffic from the display but blocking other traffic. For demonstrations involving FlexSim and PSCAD, we need to consider whether PSCAD runs on the same server (resource-intensive but low-latency) or on a separate simulation cluster (better resource isolation but adds network latency). We're planning to have PSCAD on the same physical server initially to minimize moving parts, with an upgrade path to a dedicated simulation server if performance becomes an issue or if we need to run multiple concurrent simulations.

Power and cooling are also considerations for the server rack. The hardware will consume several hundred watts continuously and generate significant heat, so facilities will need to ensure adequate HVAC in the equipment room. We need UPS (Uninterruptible Power Supply) backup to prevent data loss if power flickers during a demonstration—nothing would be more embarrassing than having the system crash while showing Meta executives a power reliability demo. We also need to coordinate with IT for network switch configuration, firewall rules, and potentially VPN access if remote engineers need to troubleshoot issues or upload new configurations.

### Technology Stack Justification: Why These Choices

Every significant technology choice in this architecture was deliberate and based on specific requirements. Let me explain the rationale for each major component. We chose React for the frontend not just because it's popular but because it solves specific problems we face. React's virtual DOM and efficient diffing algorithm mean we can update parts of the UI without redrawing everything, critical when animating power flow or updating graphs in real-time. React's component model encourages code reusability—we've built components like `<Canvas>`, `<ComponentLibrary>`, `<SimulationControls>` that can be independently tested and reused across different views. React has a massive ecosystem of third-party libraries for everything from date pickers to data visualization, so we don't reinvent wheels. React's JSX syntax combines markup and logic, which some developers dislike but which we find helpful for understanding component behavior at a glance. And React has excellent developer tools for debugging, profiling, and inspecting component state.

We chose Python FastAPI for the backend because Python is the lingua franca of scientific computing and data science. Megan's FlexSim is in Python, PSCAD's API is Python, most data processing libraries (NumPy, Pandas, SciPy) are Python, and most GE engineers are comfortable reading and writing Python even if they're not software developers by training. FastAPI specifically adds modern conveniences: automatic OpenAPI documentation (you can browse our API endpoints in a web interface), Pydantic validation (catch data errors before they cause runtime exceptions), async/await support (handle multiple requests concurrently without threading complexity), and excellent performance (benchmarks show FastAPI competing with Node.js and Go for request throughput). Alternative frameworks like Flask would work but lack these modern features; Django would work but is overly complex for an API-focused application that doesn't need Django's admin interface or ORM.

PostgreSQL was chosen for the database because SQLite (which we started with for prototyping) doesn't support concurrent writes well—if two users try to save configurations simultaneously, one would fail. PostgreSQL handles concurrent transactions gracefully using MVCC (Multi-Version Concurrency Control), allowing multiple users to read and write without blocking each other. PostgreSQL's JSON and JSONB datatypes let us store complex nested structures (like our component configurations) efficiently while still supporting queries and indexes. PostgreSQL's full-text search could enable "find all configurations containing a wind turbine," though we haven't implemented this yet. PostgreSQL's extensions ecosystem includes PostGIS for geospatial data (potentially useful for multi-site deployments showing data center locations on maps) and TimescaleDB for time-series optimization (potentially useful for storing years of simulation results efficiently). And PostgreSQL is completely open source with no licensing fees, while Oracle or SQL Server would cost tens of thousands of dollars.

Docker containerization solves deployment headaches. Without Docker, deploying our application would require manually installing Python, Node.js, PostgreSQL, and all dependencies on the production server, hoping versions match what we tested, and troubleshooting cryptic errors when something doesn't work. With Docker, we define a Dockerfile that specifies the exact environment—operating system version, Python version, installed packages, environment variables, and startup commands. We build a Docker image from this file during development, test it thoroughly, and deploy that exact same image to production. This eliminates "it works on my machine" problems. Docker Compose adds orchestration, letting us define multi-container applications where frontend, backend, and database run as separate containers communicating over defined ports. We can start the entire stack with `docker-compose up` and tear it down with `docker-compose down`, making it easy for new developers to get started or for us to create isolated environments for testing.

### Security, Scalability, and Future Enhancements

Security was a consideration throughout the architecture design. The frontend communicates with the backend exclusively over HTTPS, ensuring data is encrypted in transit. We plan to implement JWT (JSON Web Token) authentication where users log in and receive a token that must be included with every API request, preventing unauthorized access. The backend validates all inputs using Pydantic schemas, protecting against injection attacks where malicious users try to submit crafted data to break the system. PostgreSQL connection strings include credentials that are stored in environment variables, not hard-coded in source files, preventing accidental credential leaks if code is shared. We're implementing role-based access control with at least three roles: Designers (like Megan) who can create and edit configurations, Customers who can only view and simulate pre-approved configurations, and Admins who can manage users and delete configurations. Audit logging tracks who did what and when, providing forensics if something goes wrong.

Scalability is architected in from the start. The React frontend is stateless—all application state lives in the backend or database, so we could deploy multiple frontend instances behind a load balancer to handle thousands of concurrent users if needed. The FastAPI backend is designed for horizontal scaling using async/await, meaning a single server can handle hundreds of concurrent requests, and we could deploy multiple backend servers sharing the same database if traffic grows. PostgreSQL itself can scale to terabytes of data and billions of rows, far exceeding our foreseeable needs. The separation between backend and database means they could run on separate physical servers, with the database on specialized hardware with fast SSDs and lots of RAM. Our Docker-based deployment makes it easy to deploy to cloud platforms like AWS or Azure if we outgrow on-premise infrastructure.

Looking forward, we have a roadmap of enhancements that would take this from a demonstration tool to a commercial product. Advanced visualizations like augmented reality or virtual reality would let customers "walk through" a 3D model of their data center seeing power flow as colored streams. Machine learning could analyze thousands of simulation runs to predict maintenance needs or identify vulnerable components. Multi-site management could coordinate multiple data centers, optimizing which site runs which workloads based on energy pricing or renewable availability. Integration with energy markets could automate participation in demand response programs or frequency regulation services. A digital twin capability would continuously synchronize the HMI with actual operational data centers, alerting operators to anomalies and optimizing performance in real-time. Mobile apps for iOS and Android would let facility managers monitor their systems anywhere. Collaborative features like multi-user editing, commenting, and version control would let distributed engineering teams work together on designs. Each of these features builds on the architecture we've established, demonstrating that we've built a solid foundation for years of future innovation.

### Closing: Why This Matters

In summary, this architecture represents a comprehensive solution to a real business problem. GE Vernova competes in a market where technical excellence is necessary but not sufficient—we need to communicate that excellence to non-technical decision-makers. This HMI does exactly that, translating sophisticated power system simulation into intuitive interactive experiences. The three-layer architecture provides separation of concerns, making the system maintainable as it grows. The four integration modalities provide flexibility to serve different use cases from quick demos to real-time operations. The technology stack leverages industry-proven tools that any competent developer can work with. The deployment plan at Bultown creates a physical space that impresses customers. And the roadmap shows how this grows from a demo tool into a commercial product that could serve customers across the data center industry and beyond. When you present this architecture, emphasize these points: we've built something that works today, scales for tomorrow, and positions GE Vernova as a leader in making power systems accessible and understandable to everyone who depends on reliable electricity.

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Prepared By**: Habib (Lead Developer)  
**Contact**: habib@ge.com
