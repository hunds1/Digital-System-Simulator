"""
Проверочный скрипт: создаёт дефолтные параметры, запускает симуляцию
и выводит полный JSON-результат, совместимый с SimulationResult schema.

Запуск из директории backend/:
    python test_simulation_run.py

Или из корня проекта:
    python backend/test_simulation_run.py
"""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

# Гарантируем, что пакет app доступен для импорта независимо от cwd
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from app.schemas.simulation import SimulationParameters  # noqa: E402
from app.simulation.engine import DigitalSystemSimulator   # noqa: E402
from app.main import SimulationResult                      # noqa: E402


def main() -> None:
    # Включаем логирование уровня INFO
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    )

    # 1. Создаём объект параметров со значениями по умолчанию
    params = SimulationParameters()
    print("=" * 60)
    print("  Simulation Parameters (defaults)")
    print("=" * 60)
    print(f"  trucks_count      = {params.trucks_count}")
    print(f"  trailers_count    = {params.trailers_count}")
    print(f"  orders            = {params.orders}")
    print(f"  points_count      = {params.points_count}")
    print(f"  delivery_distance = {params.delivery_distance}")
    print(f"  loading_time      = {params.loading_time} h")
    print(f"  transfer_time     = {params.transfer_time} h")
    print(f"  shift_duration    = {params.shift_duration} h")
    print(f"  planning_mode     = {params.planning_mode.value}")
    print(f"  allow_overloads   = {params.allow_overloads}")
    print(f"  allow_trailer_swap= {params.allow_trailer_swap}")
    print("=" * 60)

    # 2. Создаём и запускаем симуляцию
    simulator = DigitalSystemSimulator(params)
    raw_result = simulator.run()

    # 3. Заполняем поля, которые normalmente задаёт API-слой
    sim_id = str(uuid4())
    raw_result["id"] = sim_id
    raw_result["createdAt"] = datetime.now(timezone.utc).isoformat()

    # 4. Валидируем через Pydantic-схему SimulationResult
    try:
        validated = SimulationResult(**raw_result)
        result_json = validated.model_dump(by_alias=True, mode="json")
        print("\n" + "=" * 60)
        print("  Pydantic validation: OK")
        print("=" * 60)
    except Exception as exc:
        print(f"\n  [WARNING] Pydantic validation failed: {exc}")
        print("  Falling back to raw dict output.")
        result_json = raw_result

    # 5. Выводим полный JSON
    print("\n" + "=" * 60)
    print("  FULL SIMULATION RESULT (JSON)")
    print("=" * 60)
    print(json.dumps(result_json, indent=2, ensure_ascii=False, default=str))

    # 6. Краткая сводка
    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"  Orders completed  : {result_json['ordersCompleted']} / {result_json['ordersTotal']}")
    print(f"  Completion %      : {result_json['completionPercent']}%")
    print(f"  Avg truck load    : {result_json['averageTruckLoad']}%")
    print(f"  Total cost        : {result_json['totalCost']}")
    print(f"  Sim wall time     : {result_json['simulationSeconds']}s")
    print(f"  Timeline points   : {len(result_json['timeline'])}")
    print(f"  Hourly load rows  : {len(result_json['truckLoadByHour'])}")
    print(f"  Status distrib.   : {result_json['statusDistribution']}")
    print(f"  Heatmap cells     : {len(result_json['heatmap'])}")
    print(f"  Truck records     : {len(result_json['trucks'])}")
    print("=" * 60)
    print("  Simulation completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
