// Rutas del sistema (B9). Las de operación y administración piden usuario; las del cliente son públicas.
import { Route, Routes } from "react-router-dom";
import { faltaConexion } from "./lib/supabase";
import { RutaProtegida } from "./components/RutaProtegida";
import { FaltaConexion } from "./paginas/FaltaConexion";
import { Portada } from "./paginas/Portada";
import { Entrar } from "./paginas/Entrar";
import { NoEncontrada } from "./paginas/NoEncontrada";
import { Admin } from "./admin/Admin";
import { Cajero } from "./operacion/Cajero";
import { Cocina } from "./operacion/Cocina";
import { Mesero } from "./operacion/Mesero";
import { Delivery } from "./operacion/Delivery";
import { Creditos } from "./paginas/Creditos";
import { Tienda, SeguimientoPedido } from "./cliente/Tienda";
import { PedidoMesa, LlamarMesero } from "./cliente/Mesa";
import { PantallaCliente } from "./cliente/Pantalla";

export function App() {
  if (faltaConexion) return <FaltaConexion />;
  return (
    <Routes>
      <Route path="/" element={<Portada />} />
      <Route path="/entrar" element={<Entrar />} />
      <Route path="/admin/*" element={<RutaProtegida pantalla="Administración"><Admin /></RutaProtegida>} />
      <Route path="/cajero" element={<RutaProtegida pantalla="Cajero"><Cajero /></RutaProtegida>} />
      <Route path="/cocina" element={<RutaProtegida pantalla="Cocina"><Cocina /></RutaProtegida>} />
      <Route path="/mesero" element={<RutaProtegida pantalla="Mesero"><Mesero /></RutaProtegida>} />
      <Route path="/delivery" element={<RutaProtegida pantalla="Delivery"><Delivery /></RutaProtegida>} />
      <Route path="/pantalla" element={<RutaProtegida pantalla="Cajero"><PantallaCliente /></RutaProtegida>} />
      <Route path="/tienda" element={<Tienda />} />
      <Route path="/tienda/pedido/:id" element={<SeguimientoPedido />} />
      <Route path="/mesa/:numero" element={<PedidoMesa />} />
      <Route path="/llamar/:numero" element={<LlamarMesero />} />
      <Route path="/creditos" element={<Creditos />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
