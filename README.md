# PrestoBar · Sistema del restaurante

Es el sistema completo de PrestoBar. Incluye estos módulos:

- Administración
- Cajero
- Cocina
- Mesero
- Delivery
- Tienda online
- Pedido desde la mesa (con QR)
- Llamar al mesero
- Pantalla del cliente

Es una sola app que se adapta sola a la pantalla:

- En la **computadora** se ve en versión de escritorio. Úsala para Administración, Cajero y la pantalla de Cocina.
- En el **celular** se ve en versión móvil. Úsala para Mesero, Delivery, la Tienda y el QR de las mesas.

Mesero, Cocina, Cajero y Delivery también se pueden **instalar en el celular** como una app. Para eso, abre la web y elige «Agregar a pantalla de inicio».

Necesitas dos cuentas gratuitas:

- **Supabase:** guarda los datos (pedidos, productos, usuarios y fotos).
- **Netlify:** publica la web en internet.

La primera vez toma unos 20 minutos.

---

## Cómo entrar al sistema (cuando ya está instalado)

1. Abre **https://prestobar.netlify.app/entrar** (o `https://tu-sitio.netlify.app/entrar` si tu web tiene otro nombre).
   - También puedes abrir la portada y presionar **Entrar**.
2. Escribe tu **Correo** y tu **Contraseña** y presiona **Entrar**.
3. El sistema te lleva solo a tu pantalla, según tu rol:

   | Rol | Pantalla a la que entra |
   |---|---|
   | Dueño (administrador) | `/admin` · Administración |
   | Cajero | `/cajero` |
   | Cocina | `/cocina` |
   | Mesero | `/mesero` |
   | Repartidor | `/delivery` |

- **El Dueño** es el usuario del Paso 3 de abajo, convertido en administrador con `hacer-administrador.sql` (Paso 4).
- **El equipo** entra con el correo y la contraseña que el Dueño le creó en **Administración › Usuarios y roles**.
- **¿Olvidaste tu contraseña?** Escribe tu correo y presiona **Olvidé mi contraseña**: te llega un correo para cambiarla. El Dueño también puede cambiársela a cualquiera del equipo desde **Usuarios y roles › Cambiar contraseña**, y la del Dueño se cambia en Supabase › **Authentication › Users**.
- Si al abrir `/entrar` sale un mensaje rojo en vez del formulario (por ejemplo «Invalid API key»), el problema no es tu usuario: mira **«Si algo no funciona»** al final.

---

## Qué hay en esta carpeta

| Archivo o carpeta | Para qué sirve |
|---|---|
| `schema.sql` | **Archivo SQL 1.** Crea toda la base de datos. Se pega una sola vez. |
| `hacer-administrador.sql` | **Archivo SQL 2.** Convierte tu usuario en el administrador (el Dueño). Se usa una sola vez. |
| `fotos-del-menu/` | Las fotos de los platos (`P01.jpg`, `P02.jpg`…). Se suben todas juntas desde la app. |
| `.env.example` | Modelo del archivo con tus 2 datos de conexión. |
| `src/`, `public/` y los demás archivos | El programa. No hace falta tocarlos. |

---

## Paso 1 · Crear el proyecto en Supabase

1. Entra a **supabase.com**, crea una cuenta y presiona **New project**.
   - Nombre: el que quieras, por ejemplo `prestobar`.
   - Contraseña de la base de datos: invéntala y guárdala. Para este sistema no se vuelve a usar.
   - Región: la más cercana, por ejemplo **South America (São Paulo)**.
2. Espera 1 o 2 minutos a que termine de crearse.

## Paso 2 · Pegar el archivo SQL 1 (`schema.sql`)

1. En el menú de la izquierda abre **SQL Editor** y presiona **New query**.
2. Abre `schema.sql` con el Bloc de notas.
3. Selecciona **todo** con Ctrl + A y cópialo con Ctrl + C.
4. Pégalo en Supabase y presiona **Run**.
5. Abajo debe decir **Success**.

Si lo ejecutas dos veces no pasa nada malo: no borra ni duplica nada.

> **¿Hay que crear «buckets» (carpetas para fotos)?** **No.** El `schema.sql` ya los crea solos.
> Si quieres comprobarlo, en **Storage** deben aparecer estos tres:
>
> | Nombre exacto | Tipo | Para qué |
> |---|---|---|
> | `productos` | Público | Fotos de los platos |
> | `marca` | Público | Tu logo y los banners |
> | `comprobantes` | Privado | Fotos de facturas de compra y de pagos por QR |
>
> Solo si alguno no aparece, créalo así:
> 1. Presiona **Storage › New bucket**.
> 2. Escribe el nombre exacto de la tabla.
> 3. Activa «Public bucket» solo en `productos` y en `marca`.

## Paso 3 · Crear tu usuario (el del administrador)

1. En el menú de la izquierda abre **Authentication › Users**.
2. Presiona **Add user › Create new user**.
3. Escribe **tu correo** y **tu contraseña**, de 8 caracteres o más.
4. Marca la casilla **Auto Confirm User**.
5. Presiona **Create user**.

Es el **único** usuario que creas en Supabase. A los demás los creas después desde la app.

## Paso 4 · Pegar el archivo SQL 2 (`hacer-administrador.sql`)

1. Abre `hacer-administrador.sql` con el Bloc de notas.
2. Busca esta línea:

   ```
   v_correo text := 'tu-correo@ejemplo.com';
   ```

   Cambia `tu-correo@ejemplo.com` por **el mismo correo del Paso 3**. Deja las comillas.
3. En Supabase abre **SQL Editor › New query**, pega todo el archivo y presiona **Run**.
4. Abajo debe aparecer tu correo con rol `dueno` y activo `true`.

## Paso 5 · Copiar tus 2 datos de conexión

En Supabase abre **Project Settings** (la tuerca, abajo a la izquierda) y entra a **API Keys**. Copia estos dos datos en un bloc de notas:

| Dato | Cómo se ve | Variable |
|---|---|---|
| **Project URL** | `https://abcd1234.supabase.co` | `VITE_SUPABASE_URL` |
| **Publishable key** (o la **anon public key**) | `sb_publishable_…` (o un texto largo que empieza con `eyJ…`) | `VITE_SUPABASE_ANON_KEY` |

- Sirve cualquiera de las dos: la **publishable key** de la pestaña **API Keys**, o la **anon key** de la pestaña **Legacy API Keys**.
- La **Project URL** también aparece en el botón **Connect**, arriba.
- **Cópiala con el botón de copiar. Nunca la escribas a mano:** una letra **O** y un cero **0** se ven casi iguales, y con una sola letra distinta nadie puede entrar (sale «Invalid API key»).

> ⚠️ Nunca copies la **service_role** ni la **secret key**. Esas claves son secretas y no van en la app.

---

## Paso 6 · Publicar en Netlify

La conexión **no se escribe en el código**. Se escribe como 2 «variables» en Netlify.

### Opción A · Con GitHub (recomendada: se actualiza sola)

1. Sube esta carpeta a un repositorio de GitHub.
2. En **netlify.com** presiona **Add new project › Import an existing project** y elige tu repositorio.
3. Netlify lee solo la configuración del archivo `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Antes de publicar, en **Environment variables** agrega las 2 variables:
   - `VITE_SUPABASE_URL` → tu Project URL
   - `VITE_SUPABASE_ANON_KEY` → tu anon public key
5. Presiona **Deploy**. En unos minutos tendrás tu dirección, por ejemplo `https://prestobar.netlify.app`.

> Si agregas o cambias las variables después, ve a **Deploys › Trigger deploy › Deploy site** para que se apliquen.

> **¿Tu sitio ya existía en Netlify (lo subiste arrastrando) y quieres conectarlo a GitHub?** Abre el sitio y ve a **Site configuration › Build & deploy › Continuous deployment › Link repository**, elige GitHub, tu repositorio y la rama `main`. Desde ahí, cada `git push` se publica solo.
>
> **Para saber si está conectado:** en **Deploys** cada publicación debe decir «Production: main@…» con el mensaje de tu último cambio. Si solo dice «Manual deploy», no está conectado y `git push` no cambia la web.

### Opción B · Sin GitHub (con Netlify CLI o arrastrando)

Las variables se «meten» en la web al momento de armarla, así que con esta opción primero se arma en tu computadora.

1. Instala **Node.js 20** o más nuevo desde nodejs.org.
2. En esta carpeta, copia `.env.example`, llama a la copia `.env` y pega tus 2 datos.
3. Abre una terminal en esta carpeta y ejecuta estos dos comandos, uno por uno:

   ```bash
   npm install
   ```

   ```bash
   npm run build
   ```

4. En **app.netlify.com/drop** arrastra la carpeta `dist` que se creó.

> Para probar en tu computadora antes de publicar, ejecuta `npm run dev` y abre **http://localhost:5173**.

---

## Paso 7 · Primer uso (todo desde la app)

1. Abre tu web, presiona **Entrar** e inicia sesión con el correo y la contraseña del Paso 3.
2. **Crea las cuentas de tu equipo:**
   - Ve a **Administración › Usuarios y roles › Crear usuario**.
   - Escribe el nombre, el correo, una contraseña inicial, el rol (Cajero, Cocina, Mesero o Repartidor) y un PIN de 4 números.
   - Pásale a cada persona su correo y su contraseña.
   - Si alguien olvida su contraseña, ábrelo en esa misma lista y usa **Cambiar contraseña**.
3. **Sube las fotos:**
   - Ve a **Administración › Productos › «Subir fotos del menú en lote»**.
   - Elige todas las fotos de `fotos-del-menu/`.
   - Cada foto se une sola con su plato por el código: `P01.jpg` va con el producto P01.
4. **Imprime los QR:** en **Administración › Mesas**, presiona **«Imprimir todos los QR»** y pega cada uno en su mesa.
5. **Revisa tus datos** en **Administración › Configuración**:
   - Nombre, WhatsApp, dirección, horario y costo de envío.
   - En la pestaña **Operación**, sube la imagen del QR de cobro de tu banco.
   - En la pestaña **Seguridad**, cambia el **PIN de anulación**. Viene como `1234`.
6. **Comparte tu tienda:** `https://tu-sitio.netlify.app/tienda`

### Clientes (CRM)

En **Administración › Clientes** está la lista de tus clientes. Se arma **sola**: cada pedido que lleva teléfono (tienda online, delivery o caja) se une a la ficha de ese cliente, y si no existía, la crea.

- **Ficha de cada cliente:** visitas, total gastado, ticket promedio, última visita, lo que más pide, historial de pedidos, cumpleaños, etiquetas y notas.
- **Grupos:** Frecuentes, Nuevos, Dejaron de venir, Cumpleaños del mes y Con premio listo.
- **Puntos:** el cliente gana 1 punto por cada Bs 10 que consume. Con 100 puntos gana el premio (de fábrica, «Un plato fuerte gratis»). Desde su ficha, el premio se entrega con **Canjear premio**.
  - El Dueño cambia estos números y el premio en **Programa de puntos**.
- **Enviar promoción:** eliges un grupo, escribes el mensaje y presionas **Enviar** en cada cliente. Se abre WhatsApp con el mensaje listo y con su nombre.
  - Solo aparecen los clientes que aceptan recibir promociones.
- **Quién lo ve:** el Dueño, y el Cajero si se lo das en **Usuarios y roles › Permisos por rol › Clientes y puntos**.

> Si ya tenías el sistema funcionando, **vuelve a ejecutar `schema.sql`** en Supabase para activar Clientes. No borra nada, y une solos los pedidos anteriores que tenían teléfono.

### Direcciones de cada módulo

| Dirección | Quién la usa | Pantalla |
|---|---|---|
| `/admin` | Dueño | Computadora |
| `/cajero` | Caja | Computadora o tablet |
| `/cocina` | Cocina | Tablet o televisor |
| `/mesero` | Meseros | Celular (instalable) |
| `/delivery` | Repartidor | Celular (instalable) |
| `/tienda` | Clientes por internet | Celular |
| `/mesa/5` | Cliente de la mesa 5 (se abre con el QR) | Celular |
| `/llamar/5` | Llamar al mesero de la mesa 5 | Celular |
| `/pantalla` | Segundo monitor de la caja, mirando al cliente | Monitor horizontal |

---

## Si algo no funciona

| Lo que ves | Qué hacer |
|---|---|
| «Falta conectar Supabase» | Faltan las 2 variables. En Netlify, agrégalas y haz **Trigger deploy**. En tu computadora, revisa el archivo `.env`. |
| «Invalid API key» al abrir `/entrar` | La clave `VITE_SUPABASE_ANON_KEY` está mal copiada (muchas veces, una **O** escrita como **0**). Vuelve a copiarla con el botón de Supabase (Paso 5), pégala en Netlify › **Environment variables** y haz **Trigger deploy**. En tu computadora, pégala en `.env`. |
| Hiciste `git push` pero la web sigue igual | Netlify no está conectado a GitHub. Mira el recuadro del Paso 6, Opción A. |
| La web sigue mostrando el nombre anterior del negocio | En la app, cambia el nombre en **Administración › Configuración**. El nombre de la pestaña y del ícono cambia cuando se publica la versión nueva. |
| El correo de «Olvidé mi contraseña» abre una página que no carga | En Supabase › **Authentication › URL Configuration**, pon la dirección de tu web en **Site URL** y agrégala en **Redirect URLs**. |
| «Falta nombrar al Dueño» | Haz los Pasos 3 y 4. |
| «El correo o la contraseña no coinciden» con tu usuario | Revisa que el correo de `hacer-administrador.sql` sea igual al del Paso 3. Después vuelve a ejecutarlo. |
| «La base de datos todavía no está lista» | Falta el Paso 2. |
| Los pedidos no aparecen solos en Cocina | Vuelve a ejecutar `schema.sql`. Así se activa el tiempo real. |
| En Clientes sale un error o la lista no carga | Vuelve a ejecutar `schema.sql`: falta la parte nueva de Clientes. |
| Un error que no entiendes | Cópialo tal cual y escribe en el chat del curso: `ERROR: …` |

---

Las fotos son de Wikimedia Commons y tienen licencia libre. Los créditos están en la web, en `/creditos`, y en `fotos-del-menu/CREDITOS.md`. Cuando tengas fotos propias, súbelas con los mismos nombres (`P01.jpg`, …) y reemplazan a las anteriores.
