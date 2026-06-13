import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models.template import ProcessTemplate
from app.schemas.simulation import (
    PlanningMode,
    SimulationParameters,
    SimulationStartPayload,
    SimulationStartResponse,
)
from app.schemas.template import TemplateCreate, TemplateResponse
from app.simulation.engine import DigitalSystemSimulator

logger = logging.getLogger(__name__)

# Запуск локально:
#   cd backend
#   .\venv\Scripts\activate          # Windows PowerShell / CMD
#   uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
#
# API будет доступен по адресу: http://localhost:3000/api/simulations

app = FastAPI(title='Digital System Simulator API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class TimelinePoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    time: float
    completed: int


class TruckLoadByHour(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    hour: str
    load: float


class StatusShare(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    value: float


class ModeComparison(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    strict: float
    multiagent: float


class ComparisonMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    delivery_rate: ModeComparison = Field(alias='deliveryRate')
    cost: ModeComparison
    overloads: ModeComparison
    trailer_swaps: ModeComparison = Field(alias='trailerSwaps')


class TruckMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    completed_orders: int = Field(alias='completedOrders')
    overloads: int
    trailer_swaps: int = Field(alias='trailerSwaps')
    load: float
    mileage: float


class HeatmapCell(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    x: int
    y: int
    value: float


class SimulationResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    status: str = 'completed'
    mode: PlanningMode
    completion_percent: float = Field(alias='completionPercent')
    orders_total: int = Field(alias='ordersTotal')
    orders_completed: int = Field(alias='ordersCompleted')
    average_truck_load: float = Field(alias='averageTruckLoad')
    total_cost: float = Field(alias='totalCost')
    simulation_seconds: int = Field(alias='simulationSeconds')
    timeline: list[TimelinePoint]
    truck_load_by_hour: list[TruckLoadByHour] = Field(alias='truckLoadByHour')
    status_distribution: list[StatusShare] = Field(alias='statusDistribution')
    comparison: ComparisonMetrics
    trucks: list[TruckMetrics]
    heatmap: list[HeatmapCell]
    created_at: datetime = Field(alias='createdAt')
    point_labels: list[str] = Field(default_factory=list, alias='pointLabels')


# ---------------------------------------------------------------------------
# Startup: create DB tables
# ---------------------------------------------------------------------------

@app.on_event('startup')
def on_startup() -> None:
    logger.info('Creating database tables (if not exist)...')
    Base.metadata.create_all(bind=engine)
    logger.info('Database tables ready.')


# ---------------------------------------------------------------------------
# Simulation endpoints
# ---------------------------------------------------------------------------

# In-memory storage for simulation results (will be replaced by DB later)
active_simulations: Dict[str, Dict[str, Any]] = {}


@app.post('/api/simulations', response_model=SimulationStartResponse)
def start_simulation(payload: SimulationStartPayload) -> SimulationStartResponse:
    simulation_id = str(uuid4())
    started_at = datetime.now(timezone.utc)

    logger.info(
        "Starting simulation %s (mode=%s)", simulation_id, payload.mode.value,
    )

    # Run simulation synchronously
    simulator = DigitalSystemSimulator(payload.parameters, network=payload.network)
    result = simulator.run()

    # Fill API-layer fields that the engine leaves empty
    result['id'] = simulation_id
    result['createdAt'] = started_at.isoformat()

    # Store in memory
    active_simulations[simulation_id] = result

    logger.info(
        "Simulation %s completed: %d/%d orders",
        simulation_id,
        result.get('ordersCompleted', 0),
        result.get('ordersTotal', 0),
    )

    return SimulationStartResponse(
        id=UUID(simulation_id),
        status='running',
        started_at=started_at,
    )


@app.get('/api/simulations/{sim_id}', response_model=SimulationResult)
def get_simulation_result(sim_id: UUID) -> SimulationResult:
    key = str(sim_id)
    result = active_simulations.get(key)

    if result is None:
        raise HTTPException(status_code=404, detail='Simulation not found')

    return SimulationResult(**result)


# ---------------------------------------------------------------------------
# Template CRUD endpoints
# ---------------------------------------------------------------------------

@app.post('/api/templates', response_model=TemplateResponse, status_code=201)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
) -> TemplateResponse:
    template = ProcessTemplate(
        name=payload.name,
        description=payload.description or '',
        config=payload.config_as_dict(),
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    logger.info('Template created: %s (%s)', template.name, template.id)
    return TemplateResponse.model_validate(template)


@app.get('/api/templates', response_model=list[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
) -> list[TemplateResponse]:
    templates = db.query(ProcessTemplate).order_by(ProcessTemplate.created_at.desc()).all()
    return [TemplateResponse.model_validate(t) for t in templates]


@app.get('/api/templates/{template_id}', response_model=TemplateResponse)
def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
) -> TemplateResponse:
    template = db.query(ProcessTemplate).filter(ProcessTemplate.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=404, detail='Template not found')
    return TemplateResponse.model_validate(template)


@app.delete('/api/templates/{template_id}', status_code=204)
def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
) -> None:
    template = db.query(ProcessTemplate).filter(ProcessTemplate.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=404, detail='Template not found')
    db.delete(template)
    db.commit()
    logger.info('Template deleted: %s (%s)', template.name, template.id)


# ---------------------------------------------------------------------------
# WebSocket endpoint for step-by-step simulation broadcast
# ---------------------------------------------------------------------------

@app.websocket('/ws/simulation/{sim_id}')
async def ws_simulation(websocket: WebSocket, sim_id: str) -> None:
    """
    Bidirectional WebSocket for simulation streaming.

    Server -> Client:
      {"type": "TICK", "hour": <int>, "data": <tick metrics>}
      {"type": "COMPLETE", "data": <final SimulationResult>}

    Client -> Server:
      {"type": "PAUSE"}
      {"type": "RESUME"}
      {"type": "UPDATE_PARAMS", "payload": {<partial SimulationParameters>}}
    """
    await websocket.accept()
    logger.info('WebSocket connected: sim_id=%s', sim_id)

    # Wait for optional INIT message with params + network
    params = SimulationParameters()
    network = None
    try:
        init_raw = await asyncio.wait_for(websocket.receive_json(), timeout=3.0)
        if init_raw.get('type') == 'INIT':
            try:
                params = SimulationParameters(**init_raw.get('parameters', {}))
            except Exception:
                params = SimulationParameters()
            net_data = init_raw.get('network')
            if net_data:
                try:
                    from app.schemas.simulation import NetworkSchema
                    network = NetworkSchema(**net_data)
                except Exception:
                    network = None
    except (asyncio.TimeoutError, Exception):
        pass

    simulator = DigitalSystemSimulator(params, network=network)
    gen = simulator.run_generator()

    async def stream_simulation() -> None:
        """Task 1: iterate the generator, send ticks, respect pause."""
        for step_data in gen:
            # Respect pause before advancing to next step
            while simulator.is_paused:
                await asyncio.sleep(0.1)

            msg_type = step_data.get('type', 'TICK')

            if msg_type == 'TICK':
                message = {
                    'type': 'TICK',
                    'hour': step_data['hour'],
                    'data': step_data,
                }
            else:
                # COMPLETE — fill API-layer fields
                step_data['id'] = sim_id
                step_data['createdAt'] = datetime.now(timezone.utc).isoformat()
                active_simulations[sim_id] = step_data
                message = {
                    'type': 'COMPLETE',
                    'data': step_data,
                }

            await websocket.send_text(json.dumps(message, default=str))

            if msg_type == 'TICK':
                await asyncio.sleep(0.5)

    async def listen_client() -> None:
        """Task 2: receive control messages from the client."""
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get('type', '')

            if msg_type == 'PAUSE':
                simulator.is_paused = True
                logger.info('WS [%s] PAUSE', sim_id)

            elif msg_type == 'RESUME':
                simulator.is_paused = False
                logger.info('WS [%s] RESUME', sim_id)

            elif msg_type == 'UPDATE_PARAMS':
                payload = raw.get('payload', {})
                try:
                    # Merge partial params into current config
                    current = simulator.params.model_dump(by_alias=True)
                    current.update(payload)
                    simulator.params = SimulationParameters(**current)
                    logger.info(
                        'WS [%s] UPDATE_PARAMS applied: %s',
                        sim_id,
                        list(payload.keys()),
                    )
                    await websocket.send_text(json.dumps({
                        'type': 'PARAMS_UPDATED',
                        'payload': payload,
                    }))
                except Exception as exc:
                    logger.warning(
                        'WS [%s] UPDATE_PARAMS rejected: %s', sim_id, exc,
                    )
                    await websocket.send_text(json.dumps({
                        'type': 'PARAMS_ERROR',
                        'error': str(exc),
                    }))

    # Run both tasks concurrently; cancel the other when one finishes
    stream_task = asyncio.create_task(stream_simulation())
    listen_task = asyncio.create_task(listen_client())

    try:
        done, pending = await asyncio.wait(
            {stream_task, listen_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        # Await cancellation
        for task in pending:
            try:
                await task
            except asyncio.CancelledError:
                pass
        # Propagate exceptions from completed tasks
        for task in done:
            if task.exception() and not isinstance(task.exception(), WebSocketDisconnect):
                raise task.exception()
    except WebSocketDisconnect:
        logger.info('WebSocket disconnected: sim_id=%s', sim_id)
    except Exception:
        logger.exception('WebSocket error: sim_id=%s', sim_id)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info('WebSocket closed: sim_id=%s', sim_id)
