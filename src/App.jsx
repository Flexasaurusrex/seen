import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Gallery from './Gallery'
import Admin from './Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
