import React from "react";
import { Route, Routes } from "react-router-dom";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import SinglePageLayout from "./pages/home/SinglePageLayout";
import { Provider } from "jotai";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

const AppRoutes = () => {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Provider>
        <Routes>
          {/* Single page 3-column layout as default */}
          <Route path="/" element={<SinglePageLayout />} />
        </Routes>
      </Provider>
    </ThemeProvider>
  );
};

export default AppRoutes;
