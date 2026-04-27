import React, { useState, useEffect } from 'react';
import FlashSale from './components/FlashSale';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>⚡ Flash Sale Platform</h1>
        <p>High-Performance Limited Edition Sale</p>
      </header>
      <main>
        <FlashSale />
      </main>
    </div>
  );
}

export default App;