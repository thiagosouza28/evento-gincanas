import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Sorteio from "./pages/Sorteio";
import Inscritos from "./pages/Inscritos";
import SorteioPopup from "./pages/SorteioPopup";
import PublicoSorteio from "./pages/PublicoSorteio";
import PublicoTorneio from "./pages/PublicoTorneio";
import PublicoPodio from "./pages/PublicoPodio";
import Equipes from "./pages/Equipes";
import Gincanas from "./pages/Gincanas";
import Pontuacao from "./pages/Pontuacao";
import Podio from "./pages/Podio";
import Configuracoes from "./pages/Configuracoes";
import Torneios from "./pages/Torneios";
import Premiacao from "./pages/Premiacao";
import PublicoPremiacao from "./pages/PublicoPremiacao";
import Relatorio from "./pages/Relatorio";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/publico" element={<PublicoSorteio />} />
            <Route path="/publico-torneio" element={<PublicoTorneio />} />
            <Route path="/publico-premiacao" element={<PublicoPremiacao />} />
            <Route path="/publico-podio" element={<PublicoPodio />} />
            <Route path="/popup" element={<SorteioPopup />} />
            
            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/sorteio" element={<ProtectedRoute><Sorteio /></ProtectedRoute>} />
            <Route path="/inscritos" element={<ProtectedRoute><Inscritos /></ProtectedRoute>} />
            <Route path="/equipes" element={<ProtectedRoute><Equipes /></ProtectedRoute>} />
            <Route path="/gincanas" element={<ProtectedRoute><Gincanas /></ProtectedRoute>} />
            <Route path="/torneios" element={<ProtectedRoute><Torneios /></ProtectedRoute>} />
            <Route path="/premiacao" element={<ProtectedRoute><Premiacao /></ProtectedRoute>} />
            <Route path="/pontuacao" element={<ProtectedRoute><Pontuacao /></ProtectedRoute>} />
            <Route path="/podio" element={<ProtectedRoute><Podio /></ProtectedRoute>} />
            <Route path="/relatorio" element={<ProtectedRoute><Relatorio /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
