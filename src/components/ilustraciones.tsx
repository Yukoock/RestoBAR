// Ilustraciones de platos (B1.8): se usan cuando un producto todavía no tiene foto.
// Vista desde arriba, misma luz y misma sombra en toda la serie, con los colores de cada plato.
import type { ReactNode } from "react";

export interface DatosIlus { nombre: string; cat: string; tipo: string; c1: string; c2: string }

/* ---------- Ilustraciones de platos (vista cenital, misma luz y sombra en toda la serie) ---------- */
const MANTEL: Record<string, string> = { entradas: "#F2E2C6", sopas: "#E8D2BB", fuertes: "#DDD0B8", parrilla: "#3B2D25", bebidas: "#CFE5DC", calientes: "#E4D8E6", postres: "#F3DCE3" };
const LINEA_MANTEL: Record<string, string> = { entradas: "#E3CBA3", sopas: "#D9BC9F", fuertes: "#CDBD9F", parrilla: "#2C211B", bebidas: "#BBD8CC", calientes: "#D4C4D8", postres: "#E7C6D1" };
const PLATO = "#FFFDF8", BORDE = "#E9E1D2", SOMBRA = "rgba(40,24,10,.22)";
const HUEVO = (c: number[]) => [<path key="cl" d={`M${c[0] - 12} ${c[1]}c0-8 6-12 12-11s13 5 11 12-10 9-15 7-8-3-8-8z`} fill="#FFFFFF" stroke="#EFE7DA" />, <circle key="ye" cx={c[0] + 1} cy={c[1] + 1} r="5.5" fill="#F4B400" />];
const HOJAS = (pts: number[][]) => pts.map(([x, y, r], i) => <ellipse key={"h" + i} cx={x} cy={y} rx="4" ry="1.8" transform={`rotate(${r} ${x} ${y})`} fill="#5E9B3F" />);

function Plato({ children, r = 44 }: { children: ReactNode; r?: number }) {
  return (
    <g>
      <ellipse cx="84" cy="67" rx={r} ry={r * 0.96} fill={SOMBRA} />
      <circle cx="80" cy="62" r={r} fill={PLATO} />
      <circle cx="80" cy="62" r={r - 8} fill="none" stroke={BORDE} strokeWidth="1.5" />
      {children}
    </g>
  );
}
const DIBUJOS: Record<string, (p: DatosIlus) => JSX.Element> = {
  sopa: (p: DatosIlus) => (
    <g>
      <ellipse cx="84" cy="67" rx="45" ry="43" fill={SOMBRA} />
      <circle cx="80" cy="62" r="44" fill="#E5D3BB" />
      <circle cx="80" cy="62" r="44" fill="none" stroke="#C9AE8C" strokeWidth="2" />
      <circle cx="80" cy="62" r="35" fill={p.c1} />
      <circle cx="72" cy="54" r="12" fill="#FFFFFF" opacity=".18" />
      {[[66, 66, 6], [92, 58, 5], [84, 76, 4.5], [74, 50, 4], [96, 72, 3.5]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? p.c2 : "#FFFFFF"} opacity={i % 2 ? 1 : .55} />)}
      {HOJAS([[70, 62, 20], [88, 66, -30], [82, 50, 60], [62, 74, -10]])}
    </g>
  ),
  arroz: (p: DatosIlus) => (
    <Plato>
      <ellipse cx="70" cy="66" rx="25" ry="19" fill={p.c1} />
      {[[60, 60], [66, 70], [74, 58], [78, 72], [64, 76], [70, 64]].map(([x, y], i) => <rect key={i} x={x} y={y} width="5" height="2.2" rx="1.1" fill="#FFFFFF" opacity=".5" transform={`rotate(${i * 30} ${x} ${y})`} />)}
      {[[66, 58], [76, 66], [62, 70]].map(([x, y], i) => <rect key={"c" + i} x={x} y={y} width="6" height="4" rx="1.5" fill={p.c2} />)}
      {HUEVO([92, 48])}
      {[[98, 74], [88, 82], [104, 64]].map(([x, y], i) => <ellipse key={"p" + i} cx={x} cy={y} rx="7" ry="4.5" transform={`rotate(${i * 25 - 20} ${x} ${y})`} fill="#E9BE4C" stroke="#C99A2E" />)}
    </Plato>
  ),
  carne: (p: DatosIlus) => (
    <Plato>
      <path d="M50 58c2-14 22-20 36-14s14 22 4 30-38 6-40-16z" fill={p.c1} />
      {[0, 1, 2, 3].map(i => <path key={i} d={`M${58 + i * 9} 50l-6 22`} stroke="#000" strokeOpacity=".25" strokeWidth="2.5" strokeLinecap="round" />)}
      <circle cx="66" cy="54" r="8" fill="#FFFFFF" opacity=".12" />
      {[[100, 52, 20], [106, 62, 8], [98, 70, -6]].map(([x, y, r], i) => <rect key={i} x={x - 4} y={y - 12} width="9" height="24" rx="4" fill={p.c2} stroke="#D9C79E" transform={`rotate(${r} ${x} ${y})`} />)}
      {p.nombre.includes("montado") && HUEVO([70, 56])}
      {HOJAS([[90, 84, 10], [82, 88, -20], [96, 86, 40]])}
      <circle cx="74" cy="86" r="4" fill="#D9452E" />
    </Plato>
  ),
  masa: (p: DatosIlus) => (
    <Plato>
      {[[62, 72], [98, 58]].map(([x, y], k) => (
        <g key={k}>
          <path d={`M${x - 24} ${y + 4}c0-14 11-22 24-22s24 8 24 22c0 4-11 7-24 7s-24-3-24-7z`} fill={p.c1} stroke={p.c2} strokeOpacity=".5" />
          {Array.from({ length: 7 }, (_, i) => { const a = Math.PI + (i / 6) * Math.PI; return <circle key={i} cx={x + 21 * Math.cos(a)} cy={y + 2 + 16 * Math.sin(a)} r="3" fill={p.c2} opacity=".85" />; })}
          <ellipse cx={x - 6} cy={y - 4} rx="8" ry="3.5" fill="#FFFFFF" opacity=".25" />
        </g>
      ))}
    </Plato>
  ),
  bolas: (p: DatosIlus) => (
    <Plato>
      {[[64, 52], [92, 50], [62, 78], [94, 76], [78, 64]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="13" fill={p.c1} stroke="#000" strokeOpacity=".08" /><circle cx={x - 4} cy={y - 4} r="4.5" fill="#FFFFFF" opacity=".35" />{p.nombre.includes("Sonso") && <path d={`M${x - 8} ${y + 2}h16`} stroke="#7A4A20" strokeOpacity=".5" strokeWidth="2.5" />}</g>
      ))}
      {p.c2 === "#FFF4CF" && [[78, 44], [100, 64], [56, 64]].map(([x, y], i) => <rect key={"q" + i} x={x} y={y} width="7" height="5" rx="1.2" fill={p.c2} stroke="#E9DAA8" />)}
    </Plato>
  ),
  brocheta: (p: DatosIlus) => (
    <Plato>
      {[[0, 0], [0, 18]].map(([dx, dy], k) => (
        <g key={k}>
          <path d={`M${42 + dx} ${76 + dy - 8}L${122} ${40 + dy}`} stroke="#B98A5A" strokeWidth="2.5" strokeLinecap="round" />
          {[0, 1, 2, 3].map(i => <rect key={i} x={54 + i * 16} y={62 + dy - i * 7.2 - 8} width="13" height="12" rx="3" fill={i % 2 && p.nombre.includes("Pacumutu") ? p.c2 : p.c1} transform={`rotate(-24 ${60 + i * 16} ${68 + dy - i * 7.2 - 8})`} />)}
        </g>
      ))}
      {p.nombre.includes("Anticucho") && <circle cx="60" cy="44" r="10" fill={p.c2} stroke="#C99A4E" />}
    </Plato>
  ),
  choclo: (p: DatosIlus) => (
    <Plato>
      <g transform="rotate(-25 74 62)">
        <ellipse cx="74" cy="62" rx="34" ry="13" fill={p.c1} />
        {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={48 + (i % 8) * 7.5} cy={55 + Math.floor(i / 8) * 7} r="2.6" fill="#E5AE22" />)}
      </g>
      <rect x="86" y="68" width="26" height="16" rx="3" fill={p.c2} stroke="#E9DAA8" />
      <rect x="90" y="60" width="20" height="10" rx="3" fill="#FFFFFF" stroke="#E9DAA8" />
    </Plato>
  ),
  tamal: (p: DatosIlus) => (
    <Plato>
      {[[66, 64, -20], [94, 60, 15]].map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x} ${y})`}>
          <rect x={x - 14} y={y - 22} width="28" height="44" rx="10" fill={p.c1} stroke="#A99A5C" />
          <path d={`M${x} ${y - 20}v40`} stroke="#A99A5C" opacity=".6" />
          <rect x={x - 15} y={y - 3} width="30" height="5" fill="#8A7A3E" />
        </g>
      ))}
    </Plato>
  ),
  papas: (p: DatosIlus) => (
    <Plato>
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={50 + (i * 13) % 52} y={44 + (i * 7) % 34} width="5" height="20" rx="2" fill={p.c2} stroke="#D9A44A" transform={`rotate(${(i * 47) % 180} ${52 + (i * 13) % 52} ${54 + (i * 7) % 34})`} />)}
      {[[64, 56], [88, 70], [76, 82], [96, 52]].map(([x, y], i) => <rect key={"m" + i} x={x} y={y} width="16" height="7" rx="3" fill={p.c1} transform={`rotate(${i * 40} ${x} ${y})`} />)}
      {[[70, 70], [100, 64]].map(([x, y], i) => <circle key={"s" + i} cx={x} cy={y} r="5" fill="#B14A2A" stroke="#7E2E16" />)}
      <circle cx="84" cy="48" r="6" fill="none" stroke="#C8432B" strokeWidth="3" />
      {HUEVO([60, 82]).map((e, i) => <g key={"e" + i} transform="scale(.7) translate(30 40)">{e}</g>)}
    </Plato>
  ),
  silpancho: (p: DatosIlus) => (
    <Plato>
      <ellipse cx="80" cy="64" rx="34" ry="30" fill={p.c2} />
      <path d="M50 62c0-16 16-26 32-24s28 12 26 26-18 24-34 22-24-10-24-24z" fill={p.c1} />
      {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={58 + (i * 11) % 44} cy={48 + (i * 9) % 30} r="1.4" fill="#000" opacity=".2" />)}
      {HUEVO([82, 60])}
      <circle cx="58" cy="84" r="4" fill="#D9452E" /><circle cx="66" cy="88" r="3" fill="#F1E3EE" />
    </Plato>
  ),
  mixto: (p: DatosIlus) => (
    <Plato>
      <ellipse cx="66" cy="62" rx="22" ry="24" fill={p.c1} />
      {[[60, 56], [70, 68], [62, 72]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="5" fill="#000" opacity=".16" />)}
      <circle cx="58" cy="52" r="6" fill="#FFFFFF" opacity=".18" />
      <ellipse cx="98" cy="52" rx="14" ry="11" fill={p.c2} />
      {[[96, 78], [108, 72]].map(([x, y], i) => <circle key={"pa" + i} cx={x} cy={y} r="8" fill="#E6D3A6" stroke="#CDB582" />)}
      {HOJAS([[92, 64, 10], [100, 66, -40]])}
    </Plato>
  ),
  vaso: (p: DatosIlus) => (
    <g>
      <circle cx="84" cy="66" r="38" fill={SOMBRA} />
      <circle cx="80" cy="62" r="38" fill="#FFFFFF" opacity=".55" />
      <circle cx="80" cy="62" r="31" fill={p.c1} />
      <circle cx="80" cy="62" r="31" fill="none" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="3" />
      {p.nombre.includes("Cerveza") ? <circle cx="80" cy="62" r="24" fill={p.c2} opacity=".9" /> :
        [[70, 54], [88, 56], [78, 72]].map(([x, y], i) => <rect key={i} x={x - 6} y={y - 6} width="12" height="12" rx="3" fill="#FFFFFF" opacity=".42" transform={`rotate(${i * 20} ${x} ${y})`} />)}
      {!p.nombre.includes("Cerveza") && !p.nombre.includes("Agua") && <circle cx="104" cy="40" r="9" fill={p.c2} stroke="#FFFFFF" strokeWidth="2" />}
      <path d="M86 58 L118 30" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      <path d="M86 58 L118 30" stroke={p.c2} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
    </g>
  ),
  taza: (p: DatosIlus) => (
    <g>
      <circle cx="80" cy="66" r="42" fill={SOMBRA} />
      <circle cx="76" cy="62" r="40" fill={PLATO} />
      <circle cx="76" cy="62" r="32" fill="none" stroke={BORDE} strokeWidth="1.5" />
      <rect x="98" y="54" width="18" height="12" rx="6" fill={PLATO} stroke={BORDE} strokeWidth="2" />
      <circle cx="76" cy="62" r="25" fill={PLATO} stroke={BORDE} strokeWidth="2" />
      <circle cx="76" cy="62" r="20" fill={p.c1} />
      <ellipse cx="70" cy="56" rx="7" ry="4" fill="#FFFFFF" opacity=".25" />
      {p.nombre.includes("coca") && HOJAS([[70, 62, 20], [82, 66, -30], [76, 54, 70]])}
      {p.nombre.includes("pastel") && <g><path d="M112 92c0-9 8-14 16-14s16 5 16 14c0 3-8 5-16 5s-16-2-16-5z" fill={p.c2} /><circle cx="122" cy="84" r="1.5" fill="#FFFFFF" /><circle cx="132" cy="86" r="1.5" fill="#FFFFFF" /></g>}
    </g>
  ),
  postre: (p: DatosIlus) => (
    <Plato r={40}>
      {p.nombre.includes("Flan") ? (
        <g><ellipse cx="80" cy="62" rx="24" ry="22" fill={p.c1} /><ellipse cx="80" cy="60" rx="16" ry="14" fill={p.c2} opacity=".85" /><ellipse cx="74" cy="55" rx="5" ry="3" fill="#FFFFFF" opacity=".35" /></g>
      ) : p.nombre.includes("frutas") ? (
        <g><circle cx="80" cy="62" r="26" fill="#FFFFFF" stroke={BORDE} />{([["#F2A33A", 68, 54], ["#D9467F", 86, 52], ["#5E9B3F", 92, 66], ["#F4D35E", 72, 70], ["#E85D3A", 82, 76], ["#9B5DB5", 64, 64]] as [string, number, number][]).map(([c, x, y], i) => <rect key={i} x={x - 5} y={y - 5} width="10" height="10" rx="2.5" fill={c} transform={`rotate(${i * 25} ${x} ${y})`} />)}</g>
      ) : p.nombre.includes("achachairú") ? (
        <g>{[[68, 56], [90, 54], [78, 72], [96, 72]].map(([x, y], i) => <g key={i}><ellipse cx={x} cy={y} rx="11" ry="9" fill={p.c1} /><ellipse cx={x - 3} cy={y - 3} rx="3.5" ry="2" fill="#FFFFFF" opacity=".4" /></g>)}<circle cx="80" cy="62" r="28" fill={p.c2} opacity=".25" /></g>
      ) : (
        <g><circle cx="80" cy="62" r="26" fill={p.c1} stroke={BORDE} />{Array.from({ length: 12 }, (_, i) => <circle key={i} cx={66 + (i * 7) % 28} cy={50 + (i * 5) % 24} r="1.6" fill={p.c2} />)}</g>
      )}
    </Plato>
  ),
};
export function Ilustracion({ datos }: { datos: DatosIlus }) {
  const m = MANTEL[datos.cat] || MANTEL.fuertes, l = LINEA_MANTEL[datos.cat] || LINEA_MANTEL.fuertes;
  const dibujo = DIBUJOS[datos.tipo] || DIBUJOS.arroz;
  return (
    <svg viewBox="0 0 160 120" role="img" aria-label={`Ilustración: ${datos.nombre}`}>
      <rect width="160" height="120" fill={m} />
      {datos.cat === "entradas" && [20, 60, 100, 140].map(x => <rect key={x} x={x} y="0" width="18" height="120" fill={l} opacity=".55" />)}
      {datos.cat === "entradas" && [16, 56, 96].map(y => <rect key={y} x="0" y={y} width="160" height="18" fill={l} opacity=".45" />)}
      {(datos.cat === "fuertes" || datos.cat === "parrilla") && [30, 70, 110, 150].map(y => <path key={y} d={`M0 ${y}H160`} stroke={l} strokeWidth="3" />)}
      {datos.cat === "parrilla" && [16, 40, 64, 88, 112, 136].map(x => <path key={x} d={`M${x} 0V120`} stroke="#000" strokeOpacity=".25" strokeWidth="4" />)}
      {["sopas", "bebidas", "calientes", "postres"].includes(datos.cat) && Array.from({ length: 20 }, (_, i) => <circle key={i} cx={(i * 37) % 160} cy={(i * 53) % 120} r="2" fill={l} />)}
      {dibujo(datos)}
    </svg>
  );
}

// Dibujo de cada plato del menú de PrestoBar (código → dibujo y colores). Platos nuevos usan el de su categoría.
const POR_CODIGO: Record<string, [string, string, string]> = {"P01":["brocheta","#7A3A1E","#E8C27A"],"P02":["choclo","#F3C846","#FFF4CF"],"P03":["bolas","#EFC572","#FFF4CF"],"P04":["masa","#F2D493","#C98B35"],"P05":["tamal","#D6CB93","#F3D98A"],"P06":["bolas","#C9B45C","#FFF4CF"],"P07":["masa","#E3A048","#9A5420"],"P08":["masa","#E8AE5A","#9A5420"],"P09":["bolas","#EAD49B","#B98A3E"],"P10":["tamal","#CDBF83","#E9C15A"],"P11":["sopa","#EBD38C","#F3E6C4"],"P12":["sopa","#B98A5A","#F3E6C4"],"P13":["sopa","#DE9E35","#F3E6C4"],"P14":["sopa","#E9B84E","#7A3E22"],"P15":["sopa","#E2CDA4","#F2C46B"],"P16":["mixto","#D0702E","#F3D98A"],"P17":["arroz","#F5E7B8","#FFF4CF"],"P18":["carne","#5E2F17","#F3E6C4"],"P19":["carne","#A0522D","#F3E6C4"],"P20":["mixto","#C24A2A","#E9D9B0"],"P21":["carne","#7E3F1F","#F3E6C4"],"P22":["carne","#6E3519","#FFFFFF"],"P23":["arroz","#EDB25A","#7A3E22"],"P24":["arroz","#E1A04A","#5E2F17"],"P25":["mixto","#C8432B","#F6F0DE"],"P26":["papas","#7A3E22","#F2C46B"],"P27":["carne","#C98A3E","#F3E6C4"],"P28":["mixto","#B5532E","#F6F0DE"],"P29":["silpancho","#9A5A2C","#F6F0DE"],"P30":["brocheta","#9A3A22","#B85A35"],"P31":["carne","#743A1C","#F3E6C4"],"P32":["carne","#9A4A24","#F3E6C4"],"P33":["brocheta","#6E3519","#F3E6C4"],"P34":["carne","#6A3418","#B85A35"],"P35":["vaso","#D6ECF4","#9CCBE0"],"P36":["vaso","#E9A83A","#FFF7E6"],"P37":["vaso","#E8D3A8","#C9A86A"],"P38":["vaso","#3B2416","#C8432B"],"P39":["vaso","#F2A33A","#F6C46A"],"P40":["vaso","#F3E2B8","#8A5A2C"],"P41":["vaso","#E6F0B5","#A9C94E"],"P42":["vaso","#B5652F","#E59A4E"],"P43":["vaso","#F1E7CF","#E6D3A6"],"P44":["taza","#6E2B5A","#E8B860"],"P45":["taza","#A7774E","#F6EEE2"],"P46":["taza","#A9BF6E","#5E9B3F"],"P47":["postre","#F6EEDC","#A0623A"],"P48":["postre","#F2A33A","#F7D9A0"],"P49":["postre","#F2A33A","#D9467F"],"P50":["postre","#F3C76A","#9A4E1C"]};
const CATEGORIA_ID: Record<string, string> = {"Entradas":"entradas","Sopas":"sopas","Platos fuertes":"fuertes","Parrilla":"parrilla","Bebidas frías":"bebidas","Bebidas calientes":"calientes","Postres":"postres"};
const POR_CATEGORIA: Record<string, [string, string, string]> = {"entradas":["masa","#E3A048","#9A5420"],"sopas":["sopa","#E9B84E","#7A3E22"],"fuertes":["arroz","#EDB25A","#7A3E22"],"parrilla":["carne","#743A1C","#F3E6C4"],"bebidas":["vaso","#E8D3A8","#C9A86A"],"calientes":["taza","#A7774E","#F6EEE2"],"postres":["postre","#F3C76A","#9A4E1C"]};
export function datosIlus(codigo: string, nombre: string, categoria: string | null | undefined): DatosIlus {
  const cat = CATEGORIA_ID[categoria || ""] || "fuertes";
  const [tipo, c1, c2] = POR_CODIGO[codigo] || POR_CATEGORIA[cat];
  return { nombre, cat, tipo, c1, c2 };
}
