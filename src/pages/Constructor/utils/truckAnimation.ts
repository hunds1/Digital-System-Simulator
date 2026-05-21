export interface FlowPosition {
  x: number
  y: number
}

export const TRUCK_TRAVEL_MS = 1600

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

export const lerpPosition = (from: FlowPosition, to: FlowPosition, t: number): FlowPosition => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
})
