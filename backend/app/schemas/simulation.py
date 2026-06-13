from datetime import datetime
from enum import Enum
from typing import Literal, Optional, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PlanningMode(str, Enum):
    strict = 'strict'
    multiagent = 'multiagent'


class DistanceDistribution(str, Enum):
    uniform = 'uniform'
    normal = 'normal'
    poisson = 'poisson'


class ShiftType(str, Enum):
    h8 = '8h'
    h12 = '12h'


class OptimizationType(str, Enum):
    cost = 'cost'
    profit = 'profit'


class CalculationMode(str, Enum):
    fast = 'fast'
    balanced = 'balanced'
    accurate = 'accurate'


TruckCapacity = Literal['2', '3']
ContainerCapacity = Literal['1', '2']
SimulationStatus = Literal['queued', 'running']


class SimulationParameters(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Логистика
    orders: int = Field(default=1000, ge=100, le=2000)
    distance_distribution: DistanceDistribution = Field(
        default=DistanceDistribution.uniform,
        alias='distanceDistribution',
    )
    delivery_distance: int = Field(default=2, ge=1, le=3, alias='deliveryDistance')
    points_count: int = Field(default=30, ge=10, le=100, alias='pointsCount')

    # Транспорт
    trucks_count: int = Field(default=50, ge=10, le=100, alias='trucksCount')
    trailers_count: int = Field(default=20, ge=0, le=50, alias='trailersCount')
    truck_capacity: TruckCapacity = Field(default='3', alias='truckCapacity')
    container_capacity: ContainerCapacity = Field(default='2', alias='containerCapacity')

    # Время
    loading_time: float = Field(default=0.5, ge=0.1, le=2, alias='loadingTime')
    transfer_time: float = Field(default=0.5, ge=0.1, le=2, alias='transferTime')
    shift_duration: int = Field(default=8, ge=4, le=16, alias='shiftDuration')
    shift_type: ShiftType = Field(default=ShiftType.h8, alias='shiftType')

    # Экономика
    transport_cost: float = Field(default=1.0, alias='transportCost')
    transport_expenses: float = Field(default=0.5, alias='transportExpenses')
    empty_mileage: float = Field(default=0.2, alias='emptyMileage')
    loading_operation_cost: float = Field(default=0.1, alias='loadingOperationCost')
    optimization_type: OptimizationType = Field(
        default=OptimizationType.cost,
        alias='optimizationType',
    )

    # Поведение
    planning_mode: PlanningMode = Field(default=PlanningMode.strict, alias='planningMode')
    allow_overloads: bool = Field(default=False, alias='allowOverloads')
    allow_trailer_swap: bool = Field(default=True, alias='allowTrailerSwap')
    dynamic_replanning: bool = Field(default=False, alias='dynamicReplanning')
    orders_distribution: DistanceDistribution = Field(
        default=DistanceDistribution.poisson,
        alias='ordersDistribution',
    )
    seed: int = Field(default=42)

    # Настройки
    system_name: str = Field(default='', alias='systemName')
    calculation_mode: CalculationMode = Field(
        default=CalculationMode.balanced,
        alias='calculationMode',
    )
    intensity: int = Field(default=45, ge=0, le=100)

    @model_validator(mode='after')
    def validate_business_rules(self) -> Self:
        if self.trailers_count > self.trucks_count:
            raise ValueError('trailersCount cannot be greater than trucksCount')
        if self.loading_time + self.transfer_time > self.shift_duration:
            raise ValueError('loadingTime + transferTime must not exceed shiftDuration')
        return self


class SimulationStartPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    mode: PlanningMode
    parameters: SimulationParameters
    network: Optional['NetworkSchema'] = None


# ---------------------------------------------------------------------------
# Network topology models (from Constructor)
# ---------------------------------------------------------------------------

class NetworkPoint(BaseModel):
    """A point/warehouse node from the logistics network."""
    id: str
    label: str
    type: Literal['point', 'warehouse']
    x: float = 0.0
    y: float = 0.0


class NetworkEdge(BaseModel):
    """A route between two nodes with a precomputed distance."""
    source: str
    target: str
    distance: float  # Euclidean distance from frontend positions


class NetworkSchema(BaseModel):
    """Full logistics network designed in the Constructor."""
    points: list[NetworkPoint] = Field(default_factory=list)
    edges: list[NetworkEdge] = Field(default_factory=list)


# Re-resolve forward reference
SimulationStartPayload.model_rebuild()


class SimulationStartResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    status: SimulationStatus
    started_at: datetime = Field(alias='startedAt')
