import HomeIcon from "@mui/icons-material/Home";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import "./Header.css";
import MultiScreenFullscreen from "./components/MultiScreenFullscreen";

export default function Header({ appName = "Data Center Simulator" }) {
  
  const handleHome = () => {
    window.location.href = "/home";
  };
  
  return (
    <header>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" style={{ backgroundColor: "#005E60" }}>
          <Toolbar>
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{ mr: 2 }}
              onClick={handleHome}
            >
              <img src="/gevernova_white.png" alt="GEV Logo" height="40" />

            </IconButton>
            <Typography fontWeight="bold" align="center" variant="h6" component="div" 
                        sx={{ marginLeft: "-150px", flexGrow: 1 }}>
              {appName}
            </Typography>
            <MultiScreenFullscreen />
          </Toolbar>
        </AppBar>
      </Box>
    </header>
  );
}
