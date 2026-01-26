
import './Footer.css';
import React from "react";

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import { versionMajor, versionMinor } from "./config";

import { useEffect } from "react";

import TAG from './TAG';


export default function Footer() {
  const vMajor = versionMajor[0];
  const vMinor = versionMinor[0];

  const [tag, setTag] = React.useState("");

  useEffect(() => {
   
    fetch(TAG)
      .then(r => r.text())
      .then(text => {
        setTag(text);
    });
  }, []) ;

  return (
    <footer> 
       <Box sx={{ flexGrow: 1 }}>
       <AppBar position="static" style={{backgroundColor: '#005E60'}}>
            <Toolbar>
                <Typography variant="subtitle1" component="div" sx={{ flexGrow: 1 }}>
                    Copyright © 2026 GE Vernova
                </Typography>
                <a style={{ fontWeight: "bold"}}>version: {vMajor}.{vMinor}</a>
                <a style={{ marginLeft: "5px"}}> build:{tag} </a>
            </Toolbar>
            
        </AppBar>
        </Box>
    </footer>
  );
}
