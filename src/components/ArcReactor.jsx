import React from 'react';
import { motion } from 'framer-motion';

export default function ArcReactor({ size = 38 }) {
  return (
    <motion.svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 200 200" 
      width={size} 
      height={size}
      animate={{ rotate: 360 }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
    >
      <defs>
        <radialGradient id="reactorGradSmall" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style={{stopColor: "#ffffff", stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: "#e6f7ff", stopOpacity: 1}} />
        </radialGradient>
        <filter id="reactorGlowSmall">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#reactorGlowSmall)">
        <polygon points="100,25 78,45 122,45" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="145,35 125,55 142,75" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="170,75 150,95 160,120" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="160,135 142,145 125,165" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="130,170 110,160 100,180" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="70,170 90,160 100,180" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="40,135 58,145 75,165" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="30,75 50,95 40,120" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="55,35 75,55 58,75" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
        <polygon points="70,25 78,45 122,45" fill="#e6f7ff" stroke="#66ccff" strokeWidth="3"/>
      </g>

      <circle cx="100" cy="100" r="38" fill="#ffffff" stroke="#66ccff" strokeWidth="5" filter="url(#reactorGlowSmall)"/>
    </motion.svg>
  );
}