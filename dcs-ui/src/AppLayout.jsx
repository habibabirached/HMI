// import { Outlet } from "react-router-dom";
// import Header from "./components/Header";
// import Footer from "./components/Footer";
// import { Box } from "@mui/material";

// const AppLayout = () => {
//   return (
//     <>
//       <Header />

//       <Box sx={{ m: 2 }}>
//         <Outlet />
//       </Box>

//       <Footer />
//     </>
//   );
// };

// export default AppLayout;

import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { Box } from "@mui/material";
import { Provider } from "jotai";
import { FullscreenProvider, useFullscreen } from "./contexts/FullscreenContext";
import ScreenNavigator from "./components/ScreenNavigator";
import "./fullscreen.css";

const AppLayoutContent = () => {
  const { isFullscreen, tripleWidth, screenWidth } = useFullscreen();

  return (
    <>
      <Box 
        sx={{ 
          height: "100vh", 
          display: "flex", 
          flexDirection: "column",
          width: isFullscreen ? `${tripleWidth}px` : '100%',
          minWidth: isFullscreen ? `${tripleWidth}px` : 'auto',
          overflow: isFullscreen ? 'auto' : 'visible',
        }}
      >
        <Header />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </Box>
        <Footer />
      </Box>
      <ScreenNavigator />
    </>
  );
};

const AppLayout = () => {
  return (
    <FullscreenProvider>
      <Provider> {/* -- Jotai provider -- */}
        <AppLayoutContent />
      </Provider>
    </FullscreenProvider>
  );
};

export default AppLayout;
