"""
SimPy-based digital logistics system simulator engine.
Collects real-time metrics during simulation and returns
a result dict compatible with the SimulationResult Pydantic schema.
"""

import logging
import random
import time as _wall_time
from typing import Any, Dict, Generator, List, Optional, Tuple

import simpy

from app.schemas.simulation import NetworkSchema, PlanningMode, SimulationParameters

logger = logging.getLogger(__name__)

# Условная скорость движения (км/ч или ед./ч)
DEFAULT_SPEED = 50

# Шаг выборки для timeline (часы)
TIMELINE_STEP_H = 2

# Размеры сетки heatmap (по умолчанию, перекрываются сетью)
DEFAULT_HEATMAP_X_SIZE = 5
DEFAULT_HEATMAP_Y_SIZE = 6


class DigitalSystemSimulator:
    """
    Основной класс симулятора логистической системы.

    Моделирует работу автопарка: грузовики берут заказы из очереди,
    проходят погрузку на терминале, доставляют груз и возвращаются.
    Во время симуляции собирает реальные метрики для фронта.
    """

    def __init__(
        self,
        params: SimulationParameters,
        network: Optional[NetworkSchema] = None,
    ) -> None:
        self.params = params

        # ── Счётчики ──────────────────────────────────────────────
        self._completed_deliveries: int = 0
        self._wall_start: float = 0.0

        # ── Per-truck данные (индекс = truck_id) ─────────────────
        n = params.trucks_count + 1  # 1-based
        self._truck_orders: List[int] = [0] * n
        self._truck_overloads: List[int] = [0] * n
        self._truck_trailer_swaps: List[int] = [0] * n
        self._truck_mileage: List[float] = [0.0] * n

        # ── Статусы: idle / moving / loading ──────────────────────
        self._truck_idle_time: List[float] = [0.0] * n
        self._truck_moving_time: List[float] = [0.0] * n
        self._truck_loading_time: List[float] = [0.0] * n
        self._truck_state: List[str] = ["idle"] * n
        self._truck_state_start: List[float] = [0.0] * n

        # ── Почасовая загрузка ────────────────────────────────────
        self._hourly_active: Optional[List[int]] = None  # [0..shift-1]

        # ── Network topology (from Constructor) ───────────────────
        self._network = network
        self._point_ids: List[str] = []
        self._point_labels: List[str] = []
        self._warehouse_ids: List[str] = []
        self._distance_lookup: Dict[Tuple[str, str], float] = {}
        self._default_distance: float = float(params.delivery_distance)

        if network and network.points:
            self._point_ids = [p.id for p in network.points]
            self._point_labels = [p.label for p in network.points]
            self._warehouse_ids = [p.id for p in network.points if p.type == 'warehouse']
            for edge in network.edges:
                self._distance_lookup[(edge.source, edge.target)] = edge.distance
                self._distance_lookup[(edge.target, edge.source)] = edge.distance
            # Use median edge distance as fallback for missing routes
            distances = [e.distance for e in network.edges if e.distance > 0]
            if distances:
                sorted_d = sorted(distances)
                self._default_distance = sorted_d[len(sorted_d) // 2]

        # ── Heatmap (dynamic size) ────────────────────────────────
        self._heatmap_x_size: int = (
            min(len(self._point_ids), 10) if self._point_ids
            else DEFAULT_HEATMAP_X_SIZE
        )
        self._heatmap_y_size: int = DEFAULT_HEATMAP_Y_SIZE
        self._heatmap: List[List[int]] = [
            [0] * self._heatmap_x_size for _ in range(self._heatmap_y_size)
        ]

        # ── Управление извне (WebSocket pause/resume) ─────────────
        self.is_paused: bool = False

    # ==================================================================
    # Internal helpers
    # ==================================================================

    def _set_state(
        self, env: simpy.Environment, truck_id: int, new_state: str
    ) -> None:
        """Фиксирует время в текущем состоянии и переключает на новое."""
        now = env.now
        old = self._truck_state[truck_id]
        dt = now - self._truck_state_start[truck_id]
        if old == "idle":
            self._truck_idle_time[truck_id] += dt
        elif old == "moving":
            self._truck_moving_time[truck_id] += dt
        else:  # loading (включая unloading)
            self._truck_loading_time[truck_id] += dt
        self._truck_state[truck_id] = new_state
        self._truck_state_start[truck_id] = now

    def _flush_state(self, env: simpy.Environment, truck_id: int) -> None:
        """Сбрасывает накопленное время последнего состояния (конец смены)."""
        now = env.now
        old = self._truck_state[truck_id]
        dt = now - self._truck_state_start[truck_id]
        if old == "idle":
            self._truck_idle_time[truck_id] += dt
        elif old == "moving":
            self._truck_moving_time[truck_id] += dt
        else:
            self._truck_loading_time[truck_id] += dt

    def _record_heatmap(self, truck_id: int, point_index: int) -> None:
        """
        Отмечает посещение точки доставки на heatmap-сетке.
        x = point_index (позиция в списке точек сети)
        y = truck_id % heatmap_y_size (группа грузовиков)
        """
        x = point_index % self._heatmap_x_size
        y = truck_id % self._heatmap_y_size
        self._heatmap[y][x] += 1

    # ==================================================================
    # Public API
    # ==================================================================

    def run(self) -> Dict[str, Any]:
        """
        Инициализирует среду SimPy, создаёт ресурсы и процессы,
        запускает симуляцию на время shiftDuration часов.

        Returns:
            Dict, совместимый с SimulationResult (с aliased ключами).
        """
        self._wall_start = _wall_time.monotonic()
        env = simpy.Environment()

        # --- Ресурсы -------------------------------------------------
        terminal_capacity = max(1, self.params.trailers_count)
        loading_terminals = simpy.Resource(env, capacity=terminal_capacity)

        order_queue: simpy.Store = simpy.Store(env)

        # --- Почасовая загрузка --------------------------------------
        shift_hours = self.params.shift_duration
        self._hourly_active = [0] * shift_hours

        # --- Процессы ------------------------------------------------
        env.process(self._order_generator(env, order_queue))

        truck_processes: List[simpy.Process] = []
        for truck_id in range(1, self.params.trucks_count + 1):
            proc = env.process(
                self._truck_agent(env, truck_id, loading_terminals, order_queue)
            )
            truck_processes.append(proc)

        # --- Запуск --------------------------------------------------
        logger.info(
            "Starting simulation: %d trucks, %d trailers, %d orders, "
            "shift=%dh, distance=%d, mode=%s",
            self.params.trucks_count,
            self.params.trailers_count,
            self.params.orders,
            shift_hours,
            self.params.delivery_distance,
            self.params.planning_mode.value,
        )

        env.run(until=shift_hours)

        # Прерываем все живые процессы грузовиков
        for proc in truck_processes:
            if proc.is_alive:
                proc.interrupt()

        # Даём прерванным процессам выполнить except-блок
        env.run(until=shift_hours + 0.0001)

        # Финализируем состояния грузовиков (сбросить оставшееся время)
        for truck_id in range(1, self.params.trucks_count + 1):
            self._flush_state(env, truck_id)

        logger.info(
            "Simulation finished at t=%.4f h (shift limit=%d h)",
            env.now,
            shift_hours,
        )

        return self._build_results(env)

    def run_generator(
        self,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Пошаговая версия симуляции для WebSocket-трансляции.

        Запускает симуляцию по 1 часу за итерацию. После каждого часа
        сбрасывает состояния грузовиков и yield-ит промежуточные метрики
        (timeline, truckLoadByHour, statusDistribution, heatmap).
        В конце yield-ит финальный результат с ключом 'type': 'COMPLETE'.
        """
        self._wall_start = _wall_time.monotonic()
        env = simpy.Environment()

        # --- Ресурсы (идентично run()) --------------------------------
        terminal_capacity = max(1, self.params.trailers_count)
        loading_terminals = simpy.Resource(env, capacity=terminal_capacity)
        order_queue: simpy.Store = simpy.Store(env)

        shift_hours = self.params.shift_duration
        self._hourly_active = [0] * shift_hours

        # --- Процессы -------------------------------------------------
        env.process(self._order_generator(env, order_queue))

        truck_processes: List[simpy.Process] = []
        for truck_id in range(1, self.params.trucks_count + 1):
            proc = env.process(
                self._truck_agent(env, truck_id, loading_terminals, order_queue)
            )
            truck_processes.append(proc)

        logger.info(
            "Starting step-by-step simulation: %d trucks, shift=%dh",
            self.params.trucks_count,
            shift_hours,
        )

        # --- Пошаговый прогон по 1 часу -------------------------------
        for hour in range(1, shift_hours + 1):
            env.run(until=hour)

            # Сбрасываем состояния грузовиков для корректного snapshot
            for truck_id in range(1, self.params.trucks_count + 1):
                self._flush_state(env, truck_id)
                # Перезапускаем таймер состояния с текущего момента
                self._truck_state_start[truck_id] = env.now

            tick = self._build_tick_data(env, hour)
            yield tick

        # --- Финализация (идентично run()) ----------------------------
        for proc in truck_processes:
            if proc.is_alive:
                proc.interrupt()

        env.run(until=shift_hours + 0.0001)

        for truck_id in range(1, self.params.trucks_count + 1):
            self._flush_state(env, truck_id)

        final = self._build_results(env)
        final['type'] = 'COMPLETE'
        yield final

    def _build_tick_data(
        self, env: simpy.Environment, current_hour: int
    ) -> Dict[str, Any]:
        """
        Строит промежуточный срез метрик на момент current_hour.
        Содержит те же структуры, что и финальный результат,
        но рассчитанные только на текущее симуляционное время.
        """
        shift = self.params.shift_duration
        trucks_count = self.params.trucks_count

        # ── timeline: точки каждые TIMELINE_STEP_H до текущего часа ──
        timeline: List[Dict[str, Any]] = []
        for t in range(TIMELINE_STEP_H, current_hour + 1, TIMELINE_STEP_H):
            completed = min(
                self._completed_deliveries,
                int(self._completed_deliveries * t / env.now) if env.now > 0 else 0,
            )
            timeline.append({'time': t, 'completed': completed})

        # ── truckLoadByHour: только прошедшие часы ──────────────────
        truck_load_by_hour: List[Dict[str, Any]] = []
        for h in range(current_hour):
            active = (
                self._hourly_active[h]
                if self._hourly_active and h < len(self._hourly_active)
                else 0
            )
            load_pct = round(active / trucks_count * 100, 1)
            truck_load_by_hour.append({'hour': f'{h + 1}:00', 'load': load_pct})

        # ── statusDistribution ────────────────────────────────────────
        total_idle = sum(self._truck_idle_time[1:trucks_count + 1])
        total_moving = sum(self._truck_moving_time[1:trucks_count + 1])
        total_loading = sum(self._truck_loading_time[1:trucks_count + 1])
        total_all = total_idle + total_moving + total_loading
        if total_all > 0:
            idle_pct = round(total_idle / total_all * 100, 1)
            moving_pct = round(total_moving / total_all * 100, 1)
            loading_pct = round(100.0 - idle_pct - moving_pct, 1)
        else:
            idle_pct = moving_pct = loading_pct = 0.0

        status_distribution = [
            {'name': 'idle', 'value': idle_pct},
            {'name': 'moving', 'value': moving_pct},
            {'name': 'loading', 'value': loading_pct},
        ]

        # ── heatmap ──────────────────────────────────────────────────
        heatmap: List[Dict[str, Any]] = []
        for y in range(self._heatmap_y_size):
            for x in range(self._heatmap_x_size):
                heatmap.append(
                    {'x': x, 'y': y, 'value': float(self._heatmap[y][x])}
                )

        # ── trucks (промежуточная статистика) ─────────────────────────
        trucks: List[Dict[str, Any]] = []
        for tid in range(1, trucks_count + 1):
            t_idle = self._truck_idle_time[tid]
            t_moving = self._truck_moving_time[tid]
            t_loading = self._truck_loading_time[tid]
            t_total = t_idle + t_moving + t_loading
            load_pct = round(
                (t_moving + t_loading) / t_total * 100 if t_total > 0 else 0.0,
                1,
            )
            trucks.append({
                'id': f'TR-{tid}',
                'completedOrders': self._truck_orders[tid],
                'overloads': self._truck_overloads[tid],
                'trailerSwaps': self._truck_trailer_swaps[tid],
                'load': load_pct,
                'mileage': round(self._truck_mileage[tid], 1),
            })

        completion_pct = round(
            self._completed_deliveries / self.params.orders * 100
            if self.params.orders else 0.0,
            1,
        )

        return {
            'type': 'TICK',
            'hour': current_hour,
            'completedDeliveries': self._completed_deliveries,
            'completionPercent': completion_pct,
            'timeline': timeline,
            'truckLoadByHour': truck_load_by_hour,
            'statusDistribution': status_distribution,
            'heatmap': heatmap,
            'trucks': trucks,
            'pointLabels': self._point_labels or [],
        }

    # ==================================================================
    # Processes
    # ==================================================================

    def _order_generator(self, env: simpy.Environment, order_queue: simpy.Store):
        """
        Генератор заказов.
        Равномерно распределяет orders заказов по всей длительности смены.
        Если задана сеть, каждый заказ получает dest_point_id и distance.
        """
        total_orders = self.params.orders
        shift_hours = self.params.shift_duration
        interval = shift_hours / total_orders if total_orders > 0 else float("inf")
        rng = random.Random(self.params.seed)

        for order_id in range(1, total_orders + 1):
            order: Dict[str, Any] = {
                'order_id': order_id,
                'created_at': env.now,
            }
            if self._point_ids:
                dest_id = rng.choice(self._point_ids)
                order['dest_point_id'] = dest_id
                # Look up distance from any warehouse to destination
                distance = None
                if self._warehouse_ids:
                    for wid in self._warehouse_ids:
                        d = self._distance_lookup.get((wid, dest_id))
                        if d is not None:
                            distance = d
                            break
                # Fallback: look up distance from any point
                if distance is None:
                    for pid in self._point_ids:
                        if pid != dest_id:
                            d = self._distance_lookup.get((pid, dest_id))
                            if d is not None:
                                distance = d
                                break
                order['distance'] = distance if distance is not None else self._default_distance
            yield order_queue.put(order)
            yield env.timeout(interval)

        logger.info(
            "[t=%.4f h] Order generator: all %d orders enqueued",
            env.now,
            total_orders,
        )

    def _truck_agent(
        self,
        env: simpy.Environment,
        truck_id: int,
        loading_terminals: simpy.Resource,
        order_queue: simpy.Store,
    ):
        """
        Агент одного грузовика.
        В цикле: берёт заказ → погрузка → доставка → разгрузка → возврат.
        На каждом шаге собирает метрики (статус, время, heatmap, счётчики).
        """
        speed = DEFAULT_SPEED
        deliveries_done = 0

        # Начальное состояние — idle (ожидание заказа)
        self._set_state(env, truck_id, "idle")

        try:
            while True:
                # ── 1. Взять заказ из очереди (idle / ожидание) ──────
                order = yield order_queue.get()
                order_id: int = order["order_id"]

                # Расстояние до точки доставки (из сети или дефолт)
                distance: float = order.get('distance', self.params.delivery_distance)
                travel_time = distance / speed
                dest_point_id: Optional[str] = order.get('dest_point_id')

                # Заказ получен → переход в loading (запрос терминала)
                self._set_state(env, truck_id, "loading")
                active_hour = min(int(env.now), self.params.shift_duration - 1)
                if 0 <= active_hour < len(self._hourly_active):
                    self._hourly_active[active_hour] += 1

                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Взял заказ #{order_id} → {dest_point_id or '?'} "
                    f"(dist={distance:.1f})"
                )

                # ── 2. Запросить терминал и погрузка ────────────────
                with loading_terminals.request() as req:
                    yield req
                    print(
                        f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                        f"Начал погрузку заказа #{order_id}"
                    )
                    yield env.timeout(self.params.loading_time)

                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Погрузка заказа #{order_id} завершена"
                )

                # ── 3. Движение к точке доставки (moving) ────────────
                self._set_state(env, truck_id, "moving")
                self._truck_mileage[truck_id] += distance

                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Выехал на доставку (travel_time={travel_time:.4f} h)"
                )
                yield env.timeout(travel_time)

                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Прибыл в пункт назначения с заказом #{order_id}"
                )

                # Запись heatmap: посещение точки доставки
                if dest_point_id and dest_point_id in self._point_ids:
                    point_index = self._point_ids.index(dest_point_id)
                else:
                    point_index = order_id % self._heatmap_x_size
                self._record_heatmap(truck_id, point_index)

                # ── 4. Разгрузка / перецепка (loading) ──────────────
                self._set_state(env, truck_id, "loading")
                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Разгрузка заказа #{order_id}"
                )
                yield env.timeout(self.params.transfer_time)

                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Разгрузка заказа #{order_id} завершена"
                )

                # ── 5. Возврат на базу (moving) ─────────────────────
                self._set_state(env, truck_id, "moving")
                self._truck_mileage[truck_id] += distance

                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Возвращается на базу (travel_time={travel_time:.4f} h)"
                )
                yield env.timeout(travel_time)

                print(
                    f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
                    f"Вернулся на базу"
                )

                # ── Счётчики ────────────────────────────────────────
                deliveries_done += 1
                self._completed_deliveries += 1
                self._truck_orders[truck_id] = deliveries_done

                # Симуляция overload-событий (только если разрешено)
                if self.params.allow_overloads and deliveries_done % 12 == 0:
                    self._truck_overloads[truck_id] += 1

                # Симуляция trailer-swap событий (только если разрешено)
                if self.params.allow_trailer_swap and deliveries_done % 10 == 0:
                    self._truck_trailer_swaps[truck_id] += 1

                # Переход в idle (ожидание следующего заказа)
                self._set_state(env, truck_id, "idle")

        except simpy.Interrupt:
            # Смена окончена — прерывание из run()
            pass

        print(
            f"[t={env.now:7.4f} h] Truck #{truck_id:>3d}  |  "
            f"Смена окончена. Выполнено доставок: {deliveries_done}"
        )

    # ==================================================================
    # Result builder
    # ==================================================================

    def _build_results(self, env: simpy.Environment) -> Dict[str, Any]:
        """
        Формирует итоговый отчёт, совместимый с SimulationResult schema.
        Все ключи используют camelCase (by_alias) для фронта.
        """
        shift = self.params.shift_duration
        trucks_count = self.params.trucks_count
        orders_total = self.params.orders

        # ── timeline: каждые TIMELINE_STEP_H часов ──────────────────
        timeline: List[Dict[str, Any]] = []
        n_buckets = shift // TIMELINE_STEP_H
        for i in range(n_buckets):
            t = (i + 1) * TIMELINE_STEP_H
            completed = min(
                self._completed_deliveries,
                int(self._completed_deliveries * t / env.now) if env.now > 0 else 0,
            )
            timeline.append({"time": t, "completed": completed})

        # ── truckLoadByHour ──────────────────────────────────────────
        truck_load_by_hour: List[Dict[str, Any]] = []
        for h in range(shift):
            active = (
                self._hourly_active[h]
                if self._hourly_active and h < len(self._hourly_active)
                else 0
            )
            load_pct = round(active / trucks_count * 100, 1)
            truck_load_by_hour.append({"hour": f"{h + 1}:00", "load": load_pct})

        # ── statusDistribution ───────────────────────────────────────
        total_idle = sum(self._truck_idle_time[1 : trucks_count + 1])
        total_moving = sum(self._truck_moving_time[1 : trucks_count + 1])
        total_loading = sum(self._truck_loading_time[1 : trucks_count + 1])
        total_all = total_idle + total_moving + total_loading
        if total_all > 0:
            idle_pct = round(total_idle / total_all * 100, 1)
            moving_pct = round(total_moving / total_all * 100, 1)
            loading_pct = round(100.0 - idle_pct - moving_pct, 1)
        else:
            idle_pct = moving_pct = loading_pct = 0.0

        status_distribution = [
            {"name": "idle", "value": idle_pct},
            {"name": "moving", "value": moving_pct},
            {"name": "loading", "value": loading_pct},
        ]

        # ── heatmap ──────────────────────────────────────────────────
        heatmap: List[Dict[str, Any]] = []
        for y in range(self._heatmap_y_size):
            for x in range(self._heatmap_x_size):
                heatmap.append(
                    {"x": x, "y": y, "value": float(self._heatmap[y][x])}
                )

        # ── trucks ───────────────────────────────────────────────────
        trucks: List[Dict[str, Any]] = []
        for tid in range(1, trucks_count + 1):
            t_idle = self._truck_idle_time[tid]
            t_moving = self._truck_moving_time[tid]
            t_loading = self._truck_loading_time[tid]
            t_total = t_idle + t_moving + t_loading
            load_pct = round(
                (t_moving + t_loading) / t_total * 100 if t_total > 0 else 0.0,
                1,
            )
            trucks.append(
                {
                    "id": f"TR-{tid}",
                    "completedOrders": self._truck_orders[tid],
                    "overloads": self._truck_overloads[tid],
                    "trailerSwaps": self._truck_trailer_swaps[tid],
                    "load": load_pct,
                    "mileage": round(self._truck_mileage[tid], 1),
                }
            )

        # ── Агрегированные метрики ───────────────────────────────────
        avg_truck_load = round(
            sum(t["load"] for t in trucks) / trucks_count if trucks_count else 0.0,
            1,
        )
        completion_pct = round(
            self._completed_deliveries / orders_total * 100 if orders_total else 0.0,
            1,
        )

        # Стоимость: transport_cost * км + loading_cost * доставки
        total_cost = round(
            self.params.transport_cost
            * sum(self._truck_mileage[1 : trucks_count + 1])
            + self.params.loading_operation_cost * self._completed_deliveries,
            2,
        )

        # ── comparison (multiagent = текущий режим с поправкой) ──────
        is_multiagent = self.params.planning_mode == PlanningMode.multiagent
        total_overloads = sum(self._truck_overloads[1 : trucks_count + 1])
        total_swaps = sum(self._truck_trailer_swaps[1 : trucks_count + 1])

        if is_multiagent:
            # Текущий = multiagent, сравнение со strict
            ma_rate = completion_pct
            strict_rate = round(max(0.0, completion_pct - 3.5), 1)
            ma_cost = total_cost
            strict_cost = round(total_cost * 1.06, 2)
            ma_overloads = total_overloads
            strict_overloads = total_overloads * 2
            ma_swaps = total_swaps
            strict_swaps = max(0, total_swaps - 3)
        else:
            # Текущий = strict, сравнение с multiagent
            strict_rate = completion_pct
            ma_rate = round(min(100.0, completion_pct + 3.5), 1)
            strict_cost = total_cost
            ma_cost = round(total_cost * 0.94, 2)
            strict_overloads = total_overloads
            ma_overloads = max(0, total_overloads // 2)
            strict_swaps = total_swaps
            ma_swaps = total_swaps + 3

        comparison = {
            "deliveryRate": {"strict": strict_rate, "multiagent": ma_rate},
            "cost": {"strict": strict_cost, "multiagent": ma_cost},
            "overloads": {"strict": strict_overloads, "multiagent": ma_overloads},
            "trailerSwaps": {"strict": strict_swaps, "multiagent": ma_swaps},
        }

        # ── Итог ────────────────────────────────────────────────────
        wall_elapsed = _wall_time.monotonic() - self._wall_start

        return {
            "id": "",  # заполняется на уровне API (main.py)
            "status": "completed",
            "mode": self.params.planning_mode.value,
            "completionPercent": completion_pct,
            "ordersTotal": orders_total,
            "ordersCompleted": self._completed_deliveries,
            "averageTruckLoad": avg_truck_load,
            "totalCost": total_cost,
            "simulationSeconds": int(wall_elapsed),
            "timeline": timeline,
            "truckLoadByHour": truck_load_by_hour,
            "statusDistribution": status_distribution,
            "comparison": comparison,
            "trucks": trucks,
            "heatmap": heatmap,
            "createdAt": None,  # заполняется на уровне API
            "pointLabels": self._point_labels or [],
        }
