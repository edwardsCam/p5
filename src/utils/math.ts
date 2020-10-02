/**
  mathUtil:
    Extensions to the Math class.
* */

export interface Point {
  x: number
  y: number
  z?: number
}

export const TWO_PI = Math.PI * 2
export const PI_HALVES = Math.PI / 2

type Range = [number, number]

const toRadians = (d: number): number => (d * Math.PI) / 180
const toDegrees = (r: number): number => (r * 180) / Math.PI

/**
  coordsFromTheta:
    Given an angle (from origin), return the coordinate at the given radius.
* */
const coordsFromTheta = (theta: number, radius: number): Point => ({
  x: Math.cos(theta) * radius,
  y: Math.sin(theta) * radius,
})

/**
    thetaFromTwoPoints:
        Given two points, get the angle they make from x-axis.
* */
function thetaFromTwoPoints(p1: Point, p2: Point): number {
  const dy = p2.y - p1.y
  const dx = p2.x - p1.x
  return Math.atan2(dy, dx)
}

function thetaFromTwoPoints3d(p1: Point, p2: Point) {
  const r = distance(p1, p2)
  const dz = (p2.z || 0) - (p1.z || 0)
  return {
    phi: thetaFromTwoPoints(p1, p2),
    theta: Math.asin(dz / r),
  }
}

/**
  clamp:
    Return the given value, constrained by a min and max.
* */
function clamp(min: number, max: number, value: number): number {
  if (value <= min) {
    return min
  }
  if (value >= max) {
    return max
  }
  return value
}

/**
    distance:
        Gets the distance between two points.
* */
function distance(p1: Point, p2: Point): number {
  const dy = p2.y - p1.y
  const dx = p2.x - p1.x
  const dz = (p2.z || 0) - (p1.z || 0)
  return Math.sqrt(dy * dy + dx * dx + dz * dz)
}

/**
  normalizeScreenPos:
    Normalizes a screen position to [-1, 1]
* */
const normalizeScreenPos = (x: number, y: number): Point => ({
  x: (x / window.innerWidth) * 2 - 1,
  y: -(y / window.innerHeight) * 2 + 1,
})

/**
  denormalizeScreenPos:
    Denormalizes a screen position from [-1, 1] to [0, (width or height)]
* */
const denormalizeScreenPos = (x: number, y: number): Point => ({
  x: ((x + 1) * window.innerWidth) / 2,
  y: ((y - 1) * window.innerHeight) / 2,
})

/**
    interpolate:
        Linear interpolation between a domain and a range.
        Given a value, output where it will fit within these boundaries.

    @param {array} domain - Two values for min and max X.
    @param {array}  range - Two values for min and max Y.
    @param {number} value - The value to interpolate within the domain.

    Example:
        domain: [0, 10]
        range: [0, 100]
        value: 6
        output: 60
* */
function interpolate(domain: Range, range: Range, value: number): number {
  const x1 = domain[0]
  const x2 = domain[1]
  const y1 = range[0]
  const y2 = range[1]
  const min = Math.min(y1, y2)
  const max = Math.max(y1, y2)
  const result = y1 + ((y2 - y1) * (value - x1)) / (x2 - x1)
  return clamp(min, max, result)
}

/**
  interpolateSmooth:
    Sinusoidal interpolation between a domain and a range.
    Essentially the same as interpolate, but with a softer transition.

        Like this:             rather than this:
                 ___
               /                  /
             /                   /
        ___/                    /
* */
function interpolateSmooth({
  domain,
  range,
  value,
}: {
  domain: Range
  range: Range
  value: number
}): number {
  const x1 = domain[0]
  const x2 = domain[1]
  const y1 = range[0]
  const y2 = range[1]
  if (value > x2) return y2
  if (value < x1) return y1
  if (x1 === x2) return y1

  const period = Math.PI / (x2 - x1)
  const sinArg = period * (value - x1) - Math.PI / 2
  const result = interpolate([-1, 1], [y1, y2], Math.sin(sinArg))
  const min = Math.min(y1, y2)
  const max = Math.max(y1, y2)
  return clamp(min, max, result)
}

/**
  randomInRange:
    Given a min and max, return a random within that range.

  @param {boolean} round - if true, return an integer (truncated)
* */
function randomInRange(min: number, max: number, round?: boolean): number {
  const result = min + Math.random() * (max - min)
  return round ? Math.floor(result) : result
}

/**
    coordWithAngleAndDistance:
        Given a point, an angle, and a distance,
        return the point you get from traveling <distance> units at <theta> degrees from <start>.

    Example:
        start: (0, 0)
        theta (radians): pi / 2
        distance: 3
        output: (0, 3)
* */
function coordWithAngleAndDistance(
  start: Point,
  theta: number,
  distanceFromCenter: number
): Point {
  const xdist = distanceFromCenter * Math.cos(theta)
  const ydist = distanceFromCenter * Math.sin(theta)
  return {
    x: start.x + xdist,
    y: start.y + ydist,
  }
}

/**
  coinToss:
    50% chance of returning true
* */
const coinToss = (): boolean => Math.random() > 0.5

/**
  diff:
    Returns the absolute difference between two numbers.
* */
const diff = (x: number, y: number): number => Math.abs(x - y)

function percentWithinRange(min: number, max: number, value: number): number {
  const result = (value - min) / (max - min)
  return clamp(0, 1, result)
}

function valueFromPercent(min: number, max: number, percent: number): number {
  const result = (max - min) * percent + min
  return clamp(min, max, result)
}

function smoothToStep(value: number, step: number): number {
  if (!step) return value
  return step * Math.round(value / step)
}

function getIntersectionPoint(
  [v1, v2]: [Point, Point],
  [v3, v4]: [Point, Point]
): null | Point {
  const a1 = v2.y - v1.y
  const b1 = v1.x - v2.x
  const c1 = a1 * v1.x + b1 * v1.y

  // Line CD represented as a2x + b2y = c2
  const a2 = v4.y - v3.y
  const b2 = v3.x - v4.x
  const c2 = a2 * v3.x + b2 * v3.y

  const determinant = a1 * b2 - a2 * b1

  if (determinant == 0) {
    // The lines are parallel
    return null
  }

  const x = Number(((b2 * c1 - b1 * c2) / determinant).toFixed(6))
  const y = Number(((a1 * c2 - a2 * c1) / determinant).toFixed(6))

  const line1minx = Number(Math.min(v1.x, v2.x).toFixed(6))
  const line1miny = Number(Math.min(v1.y, v2.y).toFixed(6))
  const line1maxx = Number(Math.max(v1.x, v2.x).toFixed(6))
  const line1maxy = Number(Math.max(v1.y, v2.y).toFixed(6))
  const line2minx = Number(Math.min(v3.x, v4.x).toFixed(6))
  const line2miny = Number(Math.min(v3.y, v4.y).toFixed(6))
  const line2maxx = Number(Math.max(v3.x, v4.x).toFixed(6))
  const line2maxy = Number(Math.max(v3.y, v4.y).toFixed(6))

  if (
    x < line1minx ||
    x > line1maxx ||
    y < line1miny ||
    y > line1maxy ||
    x < line2minx ||
    x > line2maxx ||
    y < line2miny ||
    y > line2maxy
  ) {
    // outside the segment
    return null
  }
  return { x, y }
}

export {
  getIntersectionPoint,
  clamp,
  diff,
  distance,
  toRadians,
  toDegrees,
  normalizeScreenPos,
  denormalizeScreenPos,
  coordsFromTheta,
  thetaFromTwoPoints,
  thetaFromTwoPoints3d,
  interpolate,
  interpolateSmooth,
  randomInRange,
  coordWithAngleAndDistance,
  coinToss,
  percentWithinRange,
  valueFromPercent,
  smoothToStep,
}