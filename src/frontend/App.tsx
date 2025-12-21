import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { MotiaStreamProvider } from '@motiadev/stream-client-react'
import Home from './pages/Home'
import AuditFlow from './pages/AuditFlow'

function App() {
  // Configure WebSocket connection for Motia streams
  const streamAddress = `ws://localhost:3001`

  return (
    <MotiaStreamProvider address={streamAddress}>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/audit/:sessionId" element={<AuditFlow />} />
        </Routes>
      </div>
    </MotiaStreamProvider>
  )
}

export default App
