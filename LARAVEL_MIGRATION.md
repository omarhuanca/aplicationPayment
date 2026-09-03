# Migración del backend a Laravel (PHP)

Guía técnica para reescribir el backend actual (NestJS + Prisma + PostgreSQL) en Laravel, preservando el comportamiento exacto: mismas rutas, mismas reglas de negocio, mismas validaciones, mismo esquema de datos. No es una guía genérica de "cómo armar un CRUD en Laravel" — documenta específicamente las decisiones no obvias de *esta* app para que no se pierdan en el port.

El frontend (Next.js) **no cambia**. Solo se reemplaza `apps/api` por una app Laravel que exponga la misma API HTTP (mismos paths, mismos verbos, mismos shapes de request/response), para que `apps/web/src/lib/api-client.ts` siga funcionando sin tocar una línea.

---

## 1. Alcance y estado actual

- Sin autenticación. Multi-tenant por path param (`companyId` en la URL), no por sesión/JWT.
- Sin roles ni permisos.
- 4 entidades: `Company → Client → OfferedService → Payment`, más 4 catálogos fijos (`Coin`, `PaymentState`, `PaymentMethod`, `BillingPeriod`) que hoy son enums de Postgres, no tablas.
- Reglas de cascada/borrado distintas por entidad (ver §4).
- Generación de PDF sin motor de plantillas: dibujo vectorial directo (texto, líneas, coordenadas) con `pdfkit`.
- Validación de teléfono custom (país por defecto Bolivia si no hay prefijo internacional).

---

## 2. Equivalencias de stack

| NestJS + Prisma | Laravel |
|---|---|
| `@Controller()` + métodos con `@Get/@Post/@Patch/@Delete` | `routes/api.php` + Controllers (`Route::apiResource` no aplica 1:1 por las rutas anidadas — ver §5) |
| DTO + `class-validator` | `FormRequest` con `rules()` |
| `PartialType(CreateXDto)` (update opcional) | Un `UpdateXRequest` separado, o `sometimes` en las reglas |
| Prisma schema + migrations | Eloquent migrations (`database/migrations/`) |
| Prisma Client (`this.prisma.x.findMany(...)`) | Eloquent (`Model::where(...)->get()`) |
| `@prisma/client` enums | PHP 8.1+ `enum` nativo, o simple `const` + validación `in:` |
| Service class (lógica de negocio) | Un Service class propio (Laravel no impone capa de servicio, pero conviene mantenerla igual que hoy para no mezclar lógica en el controller) |
| `NotFoundException` / `ConflictException` | `abort(404, ...)` / `abort(409, ...)`, o excepciones custom + `App\Exceptions\Handler` |
| `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` | `FormRequest::rules()` ya solo deja pasar campos declarados; para forbid-no-whitelisted explícito, validar `array_keys($request->all())` contra las keys esperadas, o usar `Request::validate()` estricto |
| `pdfkit` (dibujo programático) | `dompdf`/`mpdf` (HTML→PDF) o `setasign/tcpdf`/`Spatie\PdfToImage` para dibujo directo. Ver §7 |
| `libphonenumber-js` | `giggsey/libphonenumber-for-php` (mismo proyecto base de Google, paridad de comportamiento) |
| `@db.Citext` (Postgres) | Laravel no tiene tipo citext nativo — dos opciones en §3 |
| Vitest | PHPUnit o Pest |

---

## 3. Modelo de datos

Mantener **PostgreSQL** (no migrar a MySQL): la unicidad case-insensitive (`citext`) y los enums nativos de Postgres son más simples de preservar así. Laravel soporta Postgres de forma nativa (`DB_CONNECTION=pgsql`).

### 3.1 Extensión `citext`

Una migration inicial debe habilitar la extensión antes de crear las tablas:

```php
// database/migrations/2024_01_01_000000_enable_citext.php
public function up(): void
{
    DB::statement('CREATE EXTENSION IF NOT EXISTS citext');
}
```

Luego, en las migrations de tabla, las columnas que hoy son `@db.Citext` se declaran como tipo `citext` crudo (Laravel no tiene un helper `$table->citext()`, se usa `DB::statement` o `$table->addColumn('citext', 'name')`).

### 3.2 Tablas (estado final, no la historia incremental de Prisma)

**`companies`**
```php
Schema::create('companies', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->addColumn('citext', 'name')->unique();
    $table->string('address');
    $table->string('cellphone');
    $table->timestamps();
});
```

**`clients`**
```php
Schema::create('clients', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
    $table->addColumn('citext', 'fullname');
    $table->boolean('active')->default(true);
    $table->timestamps();
    $table->unique(['company_id', 'fullname']);
    $table->index('company_id');
});
```

**`offered_services`**
```php
Schema::create('offered_services', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('client_id')->constrained('clients')->cascadeOnDelete();
    $table->addColumn('citext', 'description');
    $table->decimal('price', 12, 2);
    $table->enum('coin', ['ARS', 'USD', 'EUR', 'BOB']);
    $table->enum('billing_period', ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICO']);
    $table->boolean('active')->default(true);
    $table->timestamps();
    $table->unique(['client_id', 'description']);
    $table->index('client_id');
});
```

**`payments`**
```php
Schema::create('payments', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('offered_service_id')->constrained('offered_services')->restrictOnDelete();
    $table->decimal('amount', 12, 2);
    $table->date('start_date');
    $table->date('end_date');
    $table->enum('payment_state', ['PENDIENTE', 'PAGADO', 'VENCIDO', 'CANCELADO'])->default('PAGADO');
    $table->enum('payment_method', ['EFECTIVO', 'QR']);
    $table->timestamps();
    $table->unique(['offered_service_id', 'start_date', 'end_date']);
    $table->index('offered_service_id');
});
```

> Nota sobre `restrictOnDelete()`: es el equivalente exacto de `onDelete: Restrict` en Prisma — bloquea el `DELETE` de un `offered_service` a nivel de base de datos si tiene pagos. Es justamente lo que hoy fuerza a `OfferedServicesService.remove()` a desactivar en vez de borrar. **No lo cambies a `cascadeOnDelete()`** o se pierde historial de pagos silenciosamente.

### 3.3 Eloquent Models

```php
// app/Models/Company.php
class Company extends Model
{
    use HasUuids;
    protected $fillable = ['name', 'address', 'cellphone'];
    public function clients(): HasMany { return $this->hasMany(Client::class); }
}

// app/Models/Client.php
class Client extends Model
{
    use HasUuids;
    protected $fillable = ['fullname', 'active'];
    protected $casts = ['active' => 'boolean'];
    public function company(): BelongsTo { return $this->belongsTo(Company::class); }
    public function offeredServices(): HasMany { return $this->hasMany(OfferedService::class); }
}

// app/Models/OfferedService.php
class OfferedService extends Model
{
    use HasUuids;
    protected $fillable = ['description', 'price', 'coin', 'billing_period', 'active'];
    protected $casts = ['price' => 'decimal:2', 'active' => 'boolean'];
    public function client(): BelongsTo { return $this->belongsTo(Client::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }
}

// app/Models/Payment.php
class Payment extends Model
{
    use HasUuids;
    protected $fillable = ['amount', 'start_date', 'end_date', 'payment_state', 'payment_method'];
    protected $casts = ['amount' => 'decimal:2', 'start_date' => 'date', 'end_date' => 'date'];
    public function offeredService(): BelongsTo { return $this->belongsTo(OfferedService::class); }
}
```

---

## 4. Reglas de negocio por módulo

Esta sección es la que importa de verdad — es donde un port ingenuo (solo copiar el CRUD) rompe comportamiento.

### 4.1 Company

- **Crear/editar**: `name` y `address` con mínimo 2 caracteres. `cellphone` validado con la regla custom de teléfono (§6.2).
- **Unicidad de `name`**: case-insensitive (vía `citext`), global (no por nada). Violación → **409**, no 422 genérico: `"Ya existe una empresa con ese nombre"`.
- **Borrado**: `Company` **no tiene soft-delete**. Solo se puede borrar físicamente, y **solo si no tiene ningún `Client`** (ni siquiera inactivo). Si tiene clientes: **409** `"No se puede eliminar la empresa: todavía tiene N cliente(s) asociado(s)."` — el número real de clientes va en el mensaje.

### 4.2 Client

- **Crear**: `fullname` mínimo 2 caracteres. `company_id` **no viene en el body** — sale del path param (`companies/{company}/clients`).
- **Unicidad de `fullname`**: case-insensitive, **por empresa** (`unique(company_id, fullname)`). Violación → 409 `"Ya existe un cliente con ese nombre en esta empresa"`.
- **Listado por empresa**: solo `active = true`, ordenado por `fullname` asc. Los clientes desactivados **no aparecen** en el listado normal.
- **`findOne`**: incluye `offeredServices`, pero filtrados a `active = true` únicamente — un cliente puede tener servicios desactivados que no se muestran en su ficha.
- **Borrado (regla no obvia)**:
  - Contar `OfferedService` del cliente, **sin filtrar por `active`** (cuenta también los desactivados).
  - Si el conteo es **0** → borrado físico → responder `{ "deleted": true }`.
  - Si el conteo es **> 0** → no borrar, solo `active = false` (soft-delete) → responder `{ "deleted": false }`.

### 4.3 OfferedService

- **Crear**: `description` mínimo 2 caracteres; `price` numérico positivo (`> 0`, no `>= 0`); `coin` y `billing_period` deben ser valores válidos del enum.
- **`client_id` no viene en el body**, sale del path (`clients/{client}/services`).
- **Unicidad de `description`**: case-insensitive, por cliente.
- **Listado por cliente**: solo `active = true`, ordenado por `created_at` desc.
- **`findOne`**: incluye `client` y `payments` (todos, sin filtrar), ordenados por `start_date` desc.
- **Borrado**: mismo patrón que Client —
  - 0 pagos asociados → borrado físico → `{ "deleted": true }`.
  - Algún pago asociado → no se puede borrar físicamente de todas formas (la FK es `restrictOnDelete`) → desactivar (`active = false`) → `{ "deleted": false }`.

### 4.4 Payment — la lógica más densa

- **`amount` nunca viene del cliente HTTP.** Al crear un pago, `amount = offeredService.price` en ese momento (snapshot, no referencia viva — si después cambia el precio del servicio, los pagos viejos no cambian).
- **`payment_state` está hardcodeado a `PAGADO` al crear**, sin importar qué mande el request (de hecho el DTO/Request de creación ni siquiera tiene ese campo). Solo se puede cambiar después vía `PATCH`.
- **Cálculo automático de fechas para servicios `MENSUAL`** (la parte más delicada de todo el sistema):
  1. Si `offeredService.billing_period === 'MENSUAL'`:
     - Buscar el pago más reciente de ese servicio (`ORDER BY end_date DESC LIMIT 1`).
     - Si existe: `start_date = lastPayment.start_date + 1 mes`, `end_date = lastPayment.end_date + 1 mes`. **Se ignoran `start_date`/`end_date` del request por completo** en este caso.
     - Si no existe (primer pago del servicio): cae al comportamiento manual de abajo.
  2. Para cualquier otro `billing_period`, o el primer pago `MENSUAL`: `start_date` y `end_date` son **obligatorios** en el request. Si falta alguno → **400** `"Hay que indicar la fecha de inicio y la fecha de fin"`.
  3. **`end_date < start_date` → 400.**
  4. **Suma de un mes con clamp de fin de mes** (crítico, fácil de romper): 31 de enero + 1 mes debe dar 28 o 29 de febrero (según año bisiesto), **no** 3 de marzo. En Laravel/Carbon esto es `Carbon::parse($date)->addMonthNoOverflow()` — **nunca uses `->addMonth()` a secas**, que sí overflowea. Verificar con un test explícito: `Carbon::parse('2026-01-31')->addMonthNoOverflow()->toDateString() === '2026-02-28'`.
- **Duplicados**: un mismo `(offered_service_id, start_date, end_date)` no puede repetirse. Chequeo previo explícito (para dar 409 con mensaje claro) + constraint único en DB como respaldo (por si hay una carrera).
- **`update`**: solo permite cambiar `payment_state` y/o `payment_method`. No hay endpoint para editar fechas o monto de un pago ya creado.
- **`remove`**: borrado físico sin restricciones (a diferencia de Client/OfferedService, Payment no tiene soft-delete — es la hoja del árbol de cascada).
- **`findAllByService`**: todos los pagos del servicio, sin filtro de estado, ordenados por `start_date` desc.
- **`findOne`**: incluye la cadena completa `offeredService → client → company` (necesario para la vista de detalle del pago y el recibo).

### 4.5 Catalogs

Endpoint puramente estático, sin DB:

```
GET /catalogs
{
  "coins": ["ARS","USD","EUR","BOB"],
  "paymentStates": ["PENDIENTE","PAGADO","VENCIDO","CANCELADO"],
  "paymentMethods": ["EFECTIVO","QR"],
  "billingPeriods": ["MENSUAL","TRIMESTRAL","SEMESTRAL","ANUAL","UNICO"]
}
```

En Laravel, un controller con un método que devuelve un array hardcodeado (o los `->cases()` de PHP enums nativos) alcanza — no hace falta tabla ni modelo.

### 4.6 Dashboard

`GET /companies/{company}/dashboard/summary`

- 404 si la empresa no existe.
- Todo el scope de "pagos de esta empresa" se resuelve atravesando la cadena FK: `Payment → OfferedService → Client → company_id`. En Eloquent: `Payment::whereHas('offeredService.client', fn ($q) => $q->where('company_id', $companyId))`.
- **Los límites del mes actual se calculan en UTC**, no en la timezone del server ni del usuario: `monthStart` = primer día del mes actual en UTC a las 00:00, `monthEnd` = primer día del mes siguiente en UTC (límite superior exclusivo). Esto importa porque un pago cargado el día 1 cerca de medianoche puede quedar fuera del mes "equivocado" si se usa timezone local. En PHP: `CarbonImmutable::now('UTC')->startOfMonth()` y `->addMonthNoOverflow()->startOfMonth()`, forzando siempre `'UTC'` explícito, nunca `date_default_timezone_get()`.
- 5 cálculos (se pueden lanzar en paralelo con Postgres, aunque Eloquent no paraleliza queries de forma nativa — no es crítico, el volumen de datos es bajo):
  1. `pendingCount`: `Payment.count()` con `payment_state = PENDIENTE`, scoped a la empresa.
  2. `overdueCount`: ídem con `VENCIDO`.
  3. `activeClients`: `Client.count()` con `company_id` y `active = true`.
  4. `activeServices`: `OfferedService.count()` con `active = true`, scoped a la empresa vía `client.company_id`.
  5. `incomeThisMonth`: `SUM(amount)` de pagos con `payment_state = PAGADO` y `start_date` en `[monthStart, monthEnd)`, scoped a la empresa. Si no hay filas, el resultado es `0`, no `null`.

### 4.7 Reports

Tres endpoints, misma query base, tres formatos de salida:

- `GET /companies/{company}/reports/payments` → JSON
- `GET /companies/{company}/reports/payments.csv` → CSV
- `GET /companies/{company}/reports/payments.pdf` → PDF tabular

Query params opcionales: `state` (enum `PaymentState`), `from`/`to` (fechas, filtran por `start_date`).

- 404 si la empresa no existe.
- Filas: `id, clientId, serviceId, clientName, serviceDescription, startDate, endDate, amount, coin, paymentState, paymentMethod`, ordenadas por `start_date` desc.
- **CSV**: header `Cliente,Servicio,Inicio,Fin,Monto,Moneda,Estado,Método`; fechas en `YYYY-MM-DD`; cualquier valor con coma, comilla o salto de línea se envuelve en comillas dobles y las comillas internas se duplican (escape CSV estándar — en PHP, `fputcsv` a un stream en memoria hace esto automáticamente, no hace falta reimplementarlo a mano).
- **PDF tabular**: A4, márgenes 40pt. Título "Reporte de pagos" + subtítulo "Generado el {fecha} · {N} pagos". Columnas de ancho fijo: Cliente 110, Servicio 110, Período 100, Monto 70, Estado 70, Método 60 (en puntos). Fila de encabezado en negrita con línea divisoria gris debajo. Alto de fila fijo 16pt, texto truncado con ellipsis si no entra. **Paginación manual**: antes de dibujar cada fila, si `y` se pasa del margen inferior, salto de página y reset de `y` al margen superior — no hay auto-flow de tabla, hay que reimplementar ese chequeo a mano en el equivalente Laravel (ver §7).

---

## 5. Rutas (`routes/api.php`)

Mapeo completo, mismo path y verbo que hoy (para no tocar el frontend):

```php
// Companies
Route::post('/companies', [CompanyController::class, 'store']);
Route::get('/companies', [CompanyController::class, 'index']);
Route::get('/companies/{company}', [CompanyController::class, 'show']);
Route::patch('/companies/{company}', [CompanyController::class, 'update']);
Route::delete('/companies/{company}', [CompanyController::class, 'destroy']); // 204

// Clients (anidado bajo company para crear/listar, plano para el resto)
Route::post('/companies/{company}/clients', [ClientController::class, 'store']);
Route::get('/companies/{company}/clients', [ClientController::class, 'indexByCompany']);
Route::get('/clients/{client}', [ClientController::class, 'show']);
Route::patch('/clients/{client}', [ClientController::class, 'update']);
Route::delete('/clients/{client}', [ClientController::class, 'destroy']); // 200 + { deleted: bool }

// OfferedServices
Route::post('/clients/{client}/services', [OfferedServiceController::class, 'store']);
Route::get('/clients/{client}/services', [OfferedServiceController::class, 'indexByClient']);
Route::get('/services/{service}', [OfferedServiceController::class, 'show']);
Route::patch('/services/{service}', [OfferedServiceController::class, 'update']);
Route::delete('/services/{service}', [OfferedServiceController::class, 'destroy']); // 200 + { deleted: bool }

// Payments
Route::post('/services/{service}/payments', [PaymentController::class, 'store']);
Route::get('/services/{service}/payments', [PaymentController::class, 'indexByService']);
Route::get('/payments/{payment}', [PaymentController::class, 'show']);
Route::get('/payments/{payment}/export.pdf', [PaymentController::class, 'exportPdf']);
Route::patch('/payments/{payment}', [PaymentController::class, 'update']);
Route::delete('/payments/{payment}', [PaymentController::class, 'destroy']); // 204

// Catalogs
Route::get('/catalogs', [CatalogController::class, 'index']);

// Dashboard
Route::get('/companies/{company}/dashboard/summary', [DashboardController::class, 'summary']);

// Reports
Route::get('/companies/{company}/reports/payments', [ReportController::class, 'json']);
Route::get('/companies/{company}/reports/payments.csv', [ReportController::class, 'csv']);
Route::get('/companies/{company}/reports/payments.pdf', [ReportController::class, 'pdf']);
```

Notas:
- Usar **route model binding** (`{company}` → `Company $company` inyectado directo) simplifica los `findOrFail` que hoy son chequeos manuales de 404 — pero cuidado: el binding por defecto tira un 404 de Laravel genérico, no el mensaje en español que hoy devuelve la API (`"Empresa no encontrada"`, etc.). Si el frontend depende de ese `message` textual (lo hace: `ApiError` en `api-client.ts` lee `data.message`), hay que customizar el handler de `ModelNotFoundException` para mantener los mismos mensajes, o volver a los `findOrFail` manuales con mensaje explícito.
- Los códigos de status exactos importan: `DELETE /companies/{id}` y `DELETE /payments/{id}` devuelven **204 sin body**; `DELETE /clients/{id}` y `DELETE /services/{id}` devuelven **200 con `{ "deleted": true|false }"`** en el body. No unificar esto "por consistencia" sin actualizar el frontend (`useRemoveClient`/`useRemoveService` esperan ese body).

---

## 6. Validación

### 6.1 FormRequests (equivalente a los DTOs)

```php
// app/Http/Requests/StoreCompanyRequest.php
public function rules(): array
{
    return [
        'name' => ['required', 'string', 'min:2'],
        'address' => ['required', 'string', 'min:2'],
        'cellphone' => ['required', new LatamOrIntlPhoneNumber],
    ];
}
```

Para el equivalente de `forbidNonWhitelisted: true` (Nest rechaza el request si trae campos no declarados en el DTO), Laravel no lo hace por defecto — solo ignora campos extra. Si se quiere paridad exacta, agregar una regla `Rule::prohibitedIf` por cada campo no permitido, o un `prepareForValidation()` que compare `array_keys($this->all())` contra la lista blanca y aborte con 422/400 si hay extras. Evaluar si realmente hace falta esa paridad estricta — es defensivo pero no afecta el comportamiento visible del frontend actual.

### 6.2 Regla de teléfono custom

Réplica exacta de `is-phone-number.validator.ts` (§3 del inventario): válido para cualquier país si trae su código internacional (`+591...`, `+34...`, etc.); si **no** trae prefijo, se interpreta como número boliviano local en vez de rechazarse.

```php
// composer require giggsey/libphonenumber-for-php

use libphonenumber\PhoneNumberUtil;
use libphonenumber\NumberParseException;
use Illuminate\Contracts\Validation\ValidationRule;

class LatamOrIntlPhoneNumber implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_string($value)) {
            $fail("{$attribute} must be a valid phone number");
            return;
        }

        $util = PhoneNumberUtil::getInstance();
        try {
            // 'BO' como región por defecto: si $value ya trae '+', la región
            // por defecto se ignora y se usa el código de país del propio número.
            $parsed = $util->parse($value, 'BO');
            if (!$util->isValidNumber($parsed)) {
                $fail("{$attribute} must be a valid phone number");
            }
        } catch (NumberParseException) {
            $fail("{$attribute} must be a valid phone number");
        }
    }
}
```

Esto preserva el comportamiento actual: `71234567` (sin prefijo) pasa como boliviano; `+34612345678` pasa como español; `123` falla. Si en algún momento se vuelve a pedir restringir a solo Latinoamérica (se pidió y se revirtió dos veces en este proyecto — ver historial de commits `feat: restrict Company.cellphone to Latin American numbers` → `revert: allow Company.cellphone from any country`), la lista de países queda documentada ahí mismo por si hace falta reinstaurarla.

### 6.3 Enums con class-validator → PHP enums

```php
enum Coin: string { case ARS = 'ARS'; case USD = 'USD'; case EUR = 'EUR'; case BOB = 'BOB'; }
enum PaymentState: string { case PENDIENTE = 'PENDIENTE'; case PAGADO = 'PAGADO'; case VENCIDO = 'VENCIDO'; case CANCELADO = 'CANCELADO'; }
enum PaymentMethod: string { case EFECTIVO = 'EFECTIVO'; case QR = 'QR'; }
enum BillingPeriod: string { case MENSUAL = 'MENSUAL'; case TRIMESTRAL = 'TRIMESTRAL'; case SEMESTRAL = 'SEMESTRAL'; case ANUAL = 'ANUAL'; case UNICO = 'UNICO'; }
```

Validación: `Rule::enum(Coin::class)` en vez de `@IsEnum(Coin)`.

---

## 7. Generación de PDF

Hoy `pdfkit` dibuja el PDF a mano (coordenadas, texto, líneas) sin ningún motor de plantillas HTML. Hay dos caminos en Laravel:

**Opción A — mantener dibujo directo (más fiel al original):** `setasign/tcpdf` o `dompdf` en modo de bajo nivel permiten posicionar texto y líneas con coordenadas igual que `pdfkit`. Es más código pero replica el layout exacto (ancho fijo 227pt/80mm para el recibo térmico, alto dinámico según contenido, fuente monoespaciada `Courier`).

**Opción B — pasar a HTML→PDF (`barryvdh/laravel-dompdf`):** más simple de mantener a futuro, pero hay que recrear el layout en una vista Blade con CSS que imite el ancho de 80mm y la tipografía monoespaciada. Recomendado si el equipo va a tocar el diseño del recibo seguido; si el recibo es "set and forget", la Opción A es menos trabajo de reescritura ahora.

Cualquiera sea la opción, preservar:
- **Recibo de pago** (`payments/{id}/export.pdf`): ancho fijo 227pt (~80mm), margen 10pt, fuente `Courier`/`Courier-Bold`, alto de página **calculado dinámicamente** según el contenido (no una página A4 fija). Contenido en orden: nombre empresa (negrita, centrado), dirección, celular, línea divisoria, "DETALLE DE PAGO" (negrita, centrado), línea, cliente, servicio, precio, periodicidad, línea, período, monto (negrita), método, línea.
- **Reporte de pagos** (`companies/{id}/reports/payments.pdf`): A4, tabla con paginación manual (chequear `y` contra el margen inferior antes de cada fila, `addPage()` si no entra).

---

## 8. Configuración

### CORS

```php
// config/cors.php
'allowed_origins' => [env('WEB_ORIGIN', 'http://localhost:3000')],
'supports_credentials' => true,
```

Equivalente exacto de `app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true })`.

### Variables de entorno

Mismo patrón que hoy (ver `apps/api/.env.example`):

```
DB_CONNECTION=pgsql
DB_HOST=...
DB_PORT=5432
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...
WEB_ORIGIN=http://localhost:3000
```

Si se despliega en Supabase/Neon con pooler, Laravel no tiene el concepto separado de `DATABASE_URL`/`DIRECT_URL` de Prisma — las migraciones (`php artisan migrate`) deben correr contra la conexión **directa** (sin pooler), mientras la app en runtime puede usar la conexión con pooler. Se resuelve con dos connections distintas en `config/database.php` (ej. `pgsql` para runtime, `pgsql_direct` para el comando de deploy).

---

## 9. Plan de migración sugerido

No es necesario (ni conviene) escribirlo todo de una vez. Orden sugerido, cada paso dejando el backend Laravel funcionalmente probable con Postman/curl antes de pasar al siguiente:

1. Setup del proyecto Laravel + conexión a la misma base Postgres (o una copia) + extensión `citext`.
2. Migrations + Models (§3) — correr contra una DB de prueba y comparar `\d nombre_tabla` con el schema actual.
3. `Company` completo (CRUD + reglas de unicidad + borrado condicionado) — es el módulo más simple, sirve para validar el patrón de FormRequest/Service/Controller antes de encarar los más densos.
4. `Client` (incluye la regla de soft-delete condicional).
5. `OfferedService` (mismo patrón de soft-delete, más la unicidad por cliente).
6. `Payment` — el más delicado: primero `resolvePeriod`/`addMonthNoOverflow` con tests unitarios explícitos (casos: primer pago MENSUAL, segundo pago MENSUAL, fin de mes/año bisiesto, billing period no-MENSUAL), después el resto del CRUD.
7. `Catalogs` (trivial, 10 minutos).
8. `Dashboard` (cuidado con UTC).
9. `Reports` (JSON primero, después CSV, después PDF — así se valida la query antes de pelear con el layout del PDF).
10. Recibo PDF de `Payment` (el layout térmico).
11. Apuntar el frontend (`NEXT_PUBLIC_API_URL`) al Laravel local y probar el flujo completo end-to-end antes de tocar producción.
12. Recién ahí, planear el corte en producción (ver §10 sobre despliegue) — no antes de tener paridad completa verificada.

En cada paso, comparar request/response contra el backend NestJS actual corriendo en paralelo (mismo `curl`, misma company/client/service de prueba) para detectar diferencias de comportamiento antes de que lleguen a producción.

---

## 10. Paquetes Composer recomendados

```
composer require giggsey/libphonenumber-for-php   # validación de teléfono
composer require barryvdh/laravel-dompdf           # si se opta por Opción B en §7
# o
composer require setasign/tcpdf                    # si se opta por Opción A en §7
```

No hace falta Sanctum/Passport/JWT (no hay auth). No hace falta Laravel Excel para el CSV (`fputcsv` a un stream de memoria alcanza, es lo que ya hace la implementación actual).

---

## 11. Despliegue

El backend ya está desplegado en Railway (ver README/histórico del proyecto). Railway soporta PHP/Laravel vía Nixpacks sin configuración especial (detecta `composer.json` automáticamente), así que el mismo proveedor sirve para el nuevo backend — no hace falta migrar de plataforma solo por cambiar de framework. Recordar:

- `php artisan migrate --force` como paso de release (equivalente a `prisma migrate deploy` en el `start:prod` actual).
- Servir con `php artisan serve` no es apto para producción — usar `php-fpm` + Nginx (buildpack de Railway ya lo resuelve) o `octane` si se quiere performance tipo Node.
- Mantener el mismo dominio/URL pública si es un reemplazo in-place, para no tener que re-configurar `NEXT_PUBLIC_API_URL` en Vercel.
