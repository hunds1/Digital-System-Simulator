================================================================================
  DIGITAL SYSTEM SIMULATOR — руководство (актуально на текущую версию фронтенда)
================================================================================

1. НАЗНАЧЕНИЕ ПРИЛОЖЕНИЯ
--------------------------------------------------------------------------------

Веб-приложение для моделирования логистической сети: построение схемы
(пункты, склады, грузовики), настройка параметров симуляции, запуск расчёта
и просмотр результатов.

Сейчас это преимущественно ФРОНТЕНД. Полноценный расчёт логистической модели
на сервере ожидается от бэкенда. Без бэкенда приложение работает в ДЕМО-РЕЖИМЕ:
часть данных генерируется случайно или показывается как предпросмотр.


2. ТЕХНОЛОГИИ
--------------------------------------------------------------------------------

  React 19 + TypeScript
  Vite 8 (сборка и dev-сервер)
  TailwindCSS (оформление)
  React Router (маршруты)
  Zustand (история запусков симуляции, состояние UI)
  React Query (подключён в main.tsx; хук healthcheck есть, но в UI не используется)
  Axios (HTTP к API)
  React Flow (конструктор схемы)
  Recharts (графики результатов)
  AG Grid (таблица грузовиков)
  Lucide React (иконки)


3. СТРУКТУРА ЭКРАНОВ
--------------------------------------------------------------------------------

Маршруты (боковое меню):

  /constructor  — Конструктор логистической сети
  /simulation   — Параметры симуляции
  /settings     — Общие настройки (заглушка)
  /results      — Запуск и результаты симуляции

При открытии "/" выполняется переход на "/constructor".

Общая оболочка: Header + сворачиваемый Sidebar + область страницы.


3.1. КОНСТРУКТОР (/constructor)
--------------------------------------------------------------------------------

Назначение: визуальный редактор схемы на холсте React Flow.

Элементы сети (левая панель):
  - Point (пункт доставки) — синий
  - Warehouse (склад) — оранжевый
  - Truck (грузовик) — зелёный

Перетаскивание: элементы с панели на холст (drag & drop).

Соединения (рёбра маршрутов):
  - Разрешены ТОЛЬКО связи Point ↔ Warehouse (в обе стороны).
  - Truck не соединяется рёбрами с другими узлами.
  - При создании связи автоматически задаются:
      distance = случайное от 1 до 30 км (Math.ceil(Math.random() * 30))
      routeLoad = случайный процент 0–100 (Math.ceil(Math.random() * 100))
    Это НЕ физический расчёт расстояния — только демо-значения для отображения.

Цвет линии маршрута (RouteEdge) по загрузке routeLoad:
  - < 50%  — зелёный (#10b981)
  - 50–79% — оранжевый (#f59e0b)
  - >= 80% — красный (#ef4444)

Панель инструментов холста:
  - Масштаб + / −, Fit View
  - Undo / Redo (до 30 снимков состояния nodes + edges)
  - Сохранить схему / Загрузить схему

Панель свойств (правая):
  - Редактирование выбранного узла или просмотр ребра (расстояние и загрузка
    маршрута только для чтения на рёбрах).
  - Кнопки: Применить, Отмена, Удалить.

Параметры узлов (хранятся в node.data):
  Point:    label, subtitle, orders, queue, status (online/offline)
  Warehouse: label, capacity, throughput
  Truck:    label, status (idle/moving), load (%), capacity, trailer,
            targetNodeId, targetLabel (цель поездки)

Грузовик — визуальное движение (не расчёт симуляции):
  - При выборе «Пункт назначения» (склад или пункт) на схеме появляется
    пунктирная зелёная линия со стрелкой к цели (TruckGuidanceEdge).
  - Кнопка «Сдвинуть к цели» — плавная анимация ~1.6 с (easing easeOutCubic)
    к координатам целевого узла.
  - Во время движения кнопка меняется на «Остановить»; остановка фиксирует
    грузовик в текущей точке, статус → idle.
  - Иконка грузовика не анимируется — двигается только карточка узла на холсте.
  - Это чисто визуальный сценарий для конструктора, не отправляется на бэкенд
    как траектория unless вы сохраните схему с обновлёнными position.

Сохранение / загрузка схемы:
  - POST /api/schemas — при успехе API
  - При ошибке API: localStorage ключ "logistics-schema" (JSON { nodes, edges })
  - GET /api/schemas — берётся первый элемент массива [0]
  - При ошибке: чтение из "logistics-schema"

Горячие клавиши React Flow: стандартное поведение (перемещение узлов мышью и т.д.).


3.2. СИМУЛЯЦИЯ (/simulation)
--------------------------------------------------------------------------------

Назначение: форма параметров логистической модели с live-предпросмотром.

Конфигурация сохраняется в localStorage:
  - "simulation-config-v1" — текущие параметры (автосохранение при изменении)
  - "simulation-presets-v1"  — именованные пресеты

Пресеты: сохранить под именем, загрузить из списка, сброс к defaults.

Группы параметров (SimulationConfig):

  Логистика:
    orders              — кол-во заказов (100–2000)
    distanceDistribution — uniform | normal | poisson (тип распределения)
    deliveryDistance    — дистанция доставки (1–3)
    pointsCount         — кол-во пунктов (10–100)

  Транспорт:
    trucksCount, trailersCount
    truckCapacity       — '2' | '3' контейнера на грузовик
    containerCapacity   — '1' | '2' заказа на контейнер

  Время:
    loadingTime, transferTime (0.1–2)
    shiftDuration (4–16)
    shiftType — '8h' | '12h'

  Экономика:
    transportCost, transportExpenses, emptyMileage, loadingOperationCost
    optimizationType — cost | profit

  Поведение:
    planningMode — strict | multiagent
    allowOverloads, allowTrailerSwap, dynamicReplanning (переключатели)
    ordersDistribution — uniform | normal | poisson
    seed — seed ГПСЧ (кнопка случайного seed)

Валидация на фронте (ошибки в карточке, расчёт НЕ блокируется):
  1) trailersCount > trucksCount → ошибка
  2) loadingTime + transferTime > shiftDuration → ошибка

РАСЧЁТЫ НА СТРАНИЦЕ «СИМУЛЯЦИЯ» (только предпросмотр, в браузере):

  A) Распределение затрат (круговая диаграмма, conic-gradient):
     total = transportCost + transportExpenses + emptyMileage + loadingOperationCost
     transport%  = (transportCost / total) * 100
     expenses%   = (transportExpenses / total) * 100
     empty%      = (emptyMileage / total) * 100
     loading%    = 100 - transport% - expenses% - empty%

  B) Ожидаемое время доставки (показатель):
     expectedDeliveryTime = loadingTime + transferTime * deliveryDistance
     (вывод с .toFixed(2))

  C) Загрузка парка (%):
     maxOrders = trucksCount * truckCapacity * containerCapacity
       (truckCapacity и containerCapacity приводятся к Number: 2/3 и 1/2)
     fleetLoad = min(100, round((orders / max(1, maxOrders)) * 100))

  Эти формулы НЕ запускают симуляцию. Они обновляются с задержкой 500 мс
  после изменения полей (debounce previewConfig).

  Параметры planningMode, seed, распределения и флаги поведения сохраняются
  и передаются на страницу «Результаты», но на фронте не превращаются
  в полноценную модель — ожидается бэкенд.


3.3. РЕЗУЛЬТАТЫ (/results)
--------------------------------------------------------------------------------

Назначение: запуск симуляции и отображение итогов.

Источник параметров для запуска:
  1) Zustand store (simulationRunStore.selectedParameters), если не пусто
  2) Иначе localStorage "simulation-config-v1" (страница Симуляция)
  3) Иначе пустой объект (на экране будет «Нет данных»)

Запуск («Запустить»):
  1) POST /api/simulations с телом:
       { mode: planningMode || 'strict', parameters: { ...весь конфиг } }
  2) При ошибке API — id вида "local-{timestamp}", демо-режим
  3) WebSocket: ws://{VITE_WS_BASE_URL}/simulations/{id}
     - Только индикатор connected / reconnecting
     - Сообщения с сервера НЕ парсятся для обновления прогресса
  4) Прогресс на фронте — ИМИТАЦИЯ:
     - Таймер +7% каждые 420 мс до 100%
     - Шаги: «Генерация заказов» → «Распределение» → «Расчет метрик»
     - Общая длительность до завершения ~6.2 с (setTimeout 6200 мс)
  5) По завершении: GET /api/simulations/{id}
     - При ошибке — mockResult() со случайными/фиксированными демо-данными

mockResult (если бэкенд недоступен):
  - Случайный mode strict/multiagent
  - Фиксированные ordersTotal 1000, ordersCompleted 963, completion 96%
  - timeline, truckLoadByHour, statusDistribution — сгенерированы
  - comparison strict vs multiagent — фиксированные числа
  - 18 грузовиков со случайными метриками
  - heatmap 30 ячеек со случайными orders

Отображение после завершения:
  - Карточки: заказы, средняя загрузка, затраты, время симуляции
  - Таблица сравнения режимов (strict vs multiagent); «лучше» подсвечивается:
      Доставка % — больше лучше
      Стоимость, перегрузки, смены прицепов — меньше лучше
    diff = multiagent - strict (показ в колонке «Разница»)
  - Вкладки:
      Обзор — графики Recharts (линия, столбцы, круговая диаграмма)
      Грузовики — AG Grid + экспорт CSV
      Heatmap — матрица пункт × грузовик, цвет rgba по orders/12

История запусков (Zustand, до 20 записей в памяти сессии):
  - id, дата, mode, completionPercent, miniSeries из timeline.completed
  - Клик по записи — показ сохранённого SimulationResult

Экспорт:
  - CSV: колонки грузовиков из activeResult.trucks
  - JSON: полный отчёт activeResult


3.4. НАСТРОЙКИ (/settings)
--------------------------------------------------------------------------------

Поля: название системы, режим расчёта (Fast/Balanced/Accurate), интенсивность.

ВАЖНО: значения хранятся только в локальном state компонента. Не сохраняются
в localStorage, не влияют на симуляцию, API и конструктор. Экран-заглушка
для будущей интеграции.


4. ЧТО ПРИЛОЖЕНИЕ НЕ СЧИТАЕТ (ограничения текущей версии)
--------------------------------------------------------------------------------

  - Нет реального маршрутизатора заказов по схеме Point–Warehouse–Truck
  - Нет расчёта стоимости по всей сети из конструктора
  - Нет использования seed и распределений (uniform/normal/poisson) на фронте
    при запуске симуляции (только передаются в parameters на бэкенд)
  - WebSocket не управляет прогрессом
  - Страница Settings не подключена к логике
  - GET /health (useHealthcheck) не отображается в UI
  - Сравнение strict/multiagent в результатах приходит готовым с бэкенда
    (или захардкожено в mock)


5. ПОДКЛЮЧЕНИЕ БЭКЕНДА
--------------------------------------------------------------------------------

5.1. Переменные окружения

Создайте файл .env в корне проекта (рядом с package.json):

  VITE_API_BASE_URL=http://localhost:3000/api
  VITE_WS_BASE_URL=ws://localhost:3000/ws

Если .env нет:
  - HTTP: baseURL = "/api" (относительный путь; нужен proxy в Vite или общий хост)
  - WebSocket: ws://localhost:3000/ws

Перезапустите dev-сервер после изменения .env.

5.2. REST API (ожидаемый контракт)

Базовый URL: значение VITE_API_BASE_URL (например http://localhost:3000/api)

  GET  /health
       Ответ: { "status": "ok" | "error", "timestamp": "ISO-8601" }
       (хук useHealthcheck в src/hooks/useHealthcheck.ts — для мониторинга)

  POST /schemas
       Тело: SchemaPayload
         nodes: [{ id, type: "point"|"warehouse"|"truck", position:{x,y}, data:{} }]
         edges: [{ id, source, target, type?, data? }]
         id?, updatedAt?
       Ответ: сохранённый SchemaPayload

  GET  /schemas
       Ответ: SchemaPayload[]  (фронт берёт элемент [0] как последнюю схему)

  POST /simulations
       Тело: {
         "mode": "strict" | "multiagent",
         "parameters": { ...объект SimulationConfig со страницы Симуляция... }
       }
       Ответ: {
         "id": "string",
         "status": "queued" | "running",
         "startedAt": "ISO-8601"
       }

  GET  /simulations/:id
       Ответ: SimulationResult (см. src/api/schemaTypes.ts):

         id, mode, completionPercent,
         ordersTotal, ordersCompleted, averageTruckLoad, totalCost, simulationSeconds,
         timeline: [{ time, completed }],
         truckLoadByHour: [{ hour, load }],
         statusDistribution: [{ name, value }],
         comparison: {
           deliveryRate: { strict, multiagent },
           cost: { strict, multiagent },
           overloads: { strict, multiagent },
           trailerSwaps: { strict, multiagent }
         },
         trucks: [{ id, completedOrders, overloads, trailerSwaps, load, mileage }],
         heatmap: [{ point, truck, orders }],
         createdAt

5.3. WebSocket (опционально, для live-прогресса)

  URL: {VITE_WS_BASE_URL}/simulations/{simulationId}
  Пример: ws://localhost:3000/ws/simulations/abc-123

Сейчас фронт только проверяет факт подключения (onopen → «Подключен»).
Чтобы прогресс шёл с сервера, нужно доработать ResultsPage.tsx: парсить
сообщения WS и обновлять progress / currentStep (сейчас прогресс — таймер).

5.4. CORS и proxy

Если фронт на http://127.0.0.1:5173, а API на :3000 — на бэкенде нужен CORS
или proxy в vite.config.ts:

  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  }

5.5. Демо-режим без бэкенда

  - Схемы: localStorage "logistics-schema"
  - Симуляция: mockResult после таймера ~6.2 с
  - Параметры: localStorage "simulation-config-v1"
  - Toast «API недоступен» при запуске


6. ЗАПУСК ПРИЛОЖЕНИЯ
--------------------------------------------------------------------------------

Требования: Node.js 18+, npm.

  cd <корень проекта>
  npm install
  npm run dev

Откройте в браузере URL из терминала (обычно http://127.0.0.1:5173).
Если порт занят, Vite выберет следующий (5174 и т.д.) — смотрите строку Local.

Другие команды:
  npm run build   — сборка в dist/
  npm run preview — просмотр сборки
  npm run lint    — ESLint

Скрипта npm start нет — используйте npm run dev.


7. СТРУКТУРА ПРОЕКТА (исходный код)
--------------------------------------------------------------------------------

  src/
    main.tsx              — вход, Router, React Query, ToastProvider
    App.tsx               — маршруты страниц
    index.css             — Tailwind, CSS-переменные темы
    api/
      client.ts           — Axios (VITE_API_BASE_URL)
      endpoints.ts        — методы API
      schemaTypes.ts      — TypeScript-типы ответов API
    components/
      layout/             — Layout, Sidebar, Header
      ui/                 — Button, Card, Input, Select, Slider, Badge, Modal, Tabs, Toast
    pages/
      Constructor/        — схема, узлы, рёбра, движение грузовика
      Simulation/         — параметры и предпросмотр расчётов
      Results/            — запуск, графики, таблица, экспорт
      Settings/           — заглушка настроек
    store/
      uiStore.ts          — сворачивание сайдбара
      simulationRunStore.ts — параметры и история запусков
    hooks/
      useHealthcheck.ts   — опрос /health (не используется в UI)
    utils/
      cn.ts               — объединение CSS-классов

  tailwind.config.js      — палитра цветов UI
  vite.config.ts          — dev-сервер host/port
  package.json


8. ХРАНЕНИЕ ДАННЫХ В БРАУЗЕРЕ
--------------------------------------------------------------------------------

  logistics-schema         — схема конструктора (fallback)
  simulation-config-v1     — параметры симуляции
  simulation-presets-v1    — пресеты симуляции
  simulationRunStore       — история запусков (только в памяти до перезагрузки)


9. КРАТКАЯ СХЕМА ПОТОКА ДАННЫХ
--------------------------------------------------------------------------------

  [Симуляция] → localStorage simulation-config-v1
       ↓
  [Результаты] → POST /simulations → (WS) → GET /simulations/:id → графики/таблица
       ↑ при ошибке API: mockResult

  [Конструктор] → POST /schemas → (fallback: logistics-schema)
       грузовик: визуальная линия к цели + анимация по кнопке (не API)

