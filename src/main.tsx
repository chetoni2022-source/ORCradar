import './lib/env'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './App.tsx'

// Sem StrictMode: o duplo mount do dev quebrava a inicialização do MapLibre
// (mapa criado/destruído 2x → render loop não arrancava). Produção não dobra.
createRoot(document.getElementById('root')!).render(<App />)
