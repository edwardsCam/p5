import { init as initProps, getProp } from 'utils/propConfig'
import {
  Point,
  coordWithAngleAndDistance,
  thetaFromTwoPoints,
  distance,
  interpolate,
} from 'utils/math'
import { getCenter, getBoundedSize } from 'utils/window'
import SimplexNoise from 'simplex-noise'
import shuffle from 'utils/shuffle'
import { getRandomImage } from '../images'

const _COLOR_SCHEMES_ = ['oceanscape', 'iceland', 'fiery furnace'] as const
const _NOISE_MODE_ = ['simplex', 'perlin', 'curl', 'image'] as const
const _DRAW_MODE_ = ['streams', 'outlines', 'dots', 'fluid'] as const
const _CONSTRAINT_MODE_ = ['square', 'circle'] as const
const _COLOR_MODE_ = [
  'random from scheme',
  'angular',
  'sectors',
  'random',
  'monochrome',
] as const

type ColorScheme = typeof _COLOR_SCHEMES_[number]
type NoiseMode = typeof _NOISE_MODE_[number]
type DrawMode = typeof _DRAW_MODE_[number]
type ConstraintMode = typeof _CONSTRAINT_MODE_[number]
type ColorMode = typeof _COLOR_MODE_[number]

type Bounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type NoiseFn = (x: number, y: number) => number
type NumberConversionFn = (n: number) => number

type Props = {
  n: number
  noise: number
  distortion: number
  density: number
  continuation: number
  lineLength: number
  drawMode: DrawMode
  noiseMode: NoiseMode
  constraintMode: ConstraintMode
  constraintRadius: number
  allowGrowthOutsideRadius: boolean
  minWidth: number
  maxWidth: number
  colorScheme: ColorScheme
  colorMode: ColorMode
  showImage: boolean
  avoidanceRadius: number
  monochromeColor: string
  dotSkip: number
  squareCap: boolean
  outlineWidth: number
}

const coolColors = ['#314B99', '#058FE6', '#0FFFCF', '#0296BF', '#FFF8DB']
const hotColors = ['#801100', '#D73502', '#FAC000', '#A8A9AD', '#CB4446']
const oceanScapeColors = [
  '#FF1CAC',
  '#9F63FF',
  '#6696FF',
  '#ff6edf',
  '#0FFFF3',
  '#DEFFFC',
]

export default (s) => {
  initProps('field', {
    restart: {
      type: 'func',
      label: 'Restart',
      callback: initialize,
    },
    n: {
      type: 'number',
      default: 120,
      min: 3,
    },
    'Line Length': {
      type: 'number',
      default: 6,
      min: 1,
    },
    Noise: {
      type: 'number',
      default: 2,
      min: Number.NEGATIVE_INFINITY,
      step: 0.01,
    },
    Distortion: {
      type: 'number',
      default: 0,
      min: 0,
      step: 0.01,
    },
    Density: {
      type: 'number',
      default: 1,
      min: 0,
      max: 1,
      step: 0.025,
    },
    Continuation: {
      type: 'number',
      default: 1,
      min: 0,
      max: 1,
      step: 0.025,
      when: () => {
        const drawMode = get('Draw Mode')
        return drawMode === 'streams' || drawMode === 'outlines'
      },
    },
    'Min Width': {
      type: 'number',
      default: 3,
      min: 1,
    },
    'Max Width': {
      type: 'number',
      default: 6,
      min: 1,
    },
    'Avoidance Radius': {
      type: 'number',
      default: 2,
      min: Number.NEGATIVE_INFINITY,
    },
    'Noise Mode': {
      type: 'dropdown',
      default: _NOISE_MODE_[0],
      options: [..._NOISE_MODE_],
    },
    'Draw Mode': {
      type: 'dropdown',
      default: _DRAW_MODE_[0],
      options: [..._DRAW_MODE_],
      onChange: initialize,
    },
    'Dot Skip': {
      type: 'number',
      default: 2,
      min: 0,
      when: () => get('Draw Mode') === 'dots',
    },
    'Constraint Mode': {
      type: 'dropdown',
      default: _CONSTRAINT_MODE_[0],
      options: [..._CONSTRAINT_MODE_],
    },
    'Constraint Radius': {
      type: 'number',
      default: Math.min(window.innerWidth, window.innerHeight) / 2,
      min: 1,
    },
    'Allow Growth Outside Radius': {
      type: 'boolean',
      default: true,
    },
    'Color Mode': {
      type: 'dropdown',
      default: _COLOR_MODE_[0],
      options: [..._COLOR_MODE_],
    },
    'Color Scheme': {
      type: 'dropdown',
      default: _COLOR_SCHEMES_[0],
      options: [..._COLOR_SCHEMES_],
      when: () => {
        const mode = get('Color Mode')
        return mode === 'random from scheme' || mode === 'sectors'
      },
    },
    Color: {
      type: 'string',
      default: 'ffffff',
      when: () => get('Color Mode') === 'monochrome',
    },
    'Show Image': {
      type: 'boolean',
      default: false,
      when: () => get('Noise Mode') === 'image',
    },
    'Square Cap': {
      type: 'boolean',
      default: true,
      when: () => get('Draw Mode') === 'streams',
    },
    'Outline Width': {
      type: 'number',
      default: 3,
      when: () => get('Draw Mode') === 'outlines',
    },
  })
  const get = (prop: string) => getProp('field', prop)
  const getProps = (): Props => ({
    n: get('n'),
    lineLength: get('Line Length'),
    noise: get('Noise'),
    density: get('Density'),
    continuation: get('Continuation'),
    drawMode: get('Draw Mode'),
    noiseMode: get('Noise Mode'),
    distortion: get('Distortion'),
    constraintMode: get('Constraint Mode'),
    constraintRadius: get('Constraint Radius'),
    allowGrowthOutsideRadius: get('Allow Growth Outside Radius'),
    minWidth: get('Min Width'),
    maxWidth: get('Max Width'),
    colorScheme: get('Color Scheme'),
    colorMode: get('Color Mode'),
    showImage: get('Show Image'),
    avoidanceRadius: get('Avoidance Radius'),
    monochromeColor: get('Color'),
    dotSkip: get('Dot Skip'),
    squareCap: get('Square Cap'),
    outlineWidth: get('Outline Width'),
  })

  const getPointFromRC = (n: number, r: number, c: number): Point => {
    const center = getCenter()
    const totalLength = getBoundedSize()
    const squareLen = getSquareLen(n, totalLength)
    return {
      x: interpolate(
        [0, n - 1],
        [center.x - totalLength / 2, center.x + totalLength / 2 - squareLen],
        c
      ),
      y: interpolate(
        [0, n - 1],
        [center.y - totalLength / 2, center.y + totalLength / 2 - squareLen],
        r
      ),
    }
  }

  let points: Point[]
  let firstPoints: Point[]
  let timeouts: NodeJS.Timeout[] = []

  const buildStreamLines = (props: Props, noiseFn: NoiseFn): Point[][] => {
    const lines: Point[][] = []
    const center = getCenter()
    const { minX, maxX, minY, maxY } = getBounds(undefined, center)
    const {
      n,
      density,
      constraintMode,
      constraintRadius,
      allowGrowthOutsideRadius,
      lineLength,
      continuation,
    } = props

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (Math.random() > density) continue

        const p = getPointFromRC(n, r, c)
        lines.push([])
        if (constraintMode === 'circle') {
          if (distance(p, center) >= constraintRadius) {
            continue
          }
        } else if (constraintMode === 'square') {
          if (
            Math.abs(center.x - p.x) >= constraintRadius ||
            Math.abs(center.y - p.y) >= constraintRadius
          )
            continue
        }

        const inBounds = (): boolean => {
          if (constraintMode === 'circle') {
            if (allowGrowthOutsideRadius) {
              return (
                p.x >= 0 &&
                p.x <= window.innerWidth &&
                p.y >= 0 &&
                p.y <= window.innerHeight
              )
            } else {
              return distance(p, center) < constraintRadius
            }
          } else {
            if (allowGrowthOutsideRadius) {
              return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
            } else {
              return (
                Math.abs(center.x - p.x) < constraintRadius &&
                Math.abs(center.y - p.y) < constraintRadius
              )
            }
          }
        }
        while (Math.random() < continuation - 0.01 && inBounds()) {
          const angle = noiseFn(p.x, p.y)
          const nextP = coordWithAngleAndDistance(p, angle, lineLength)
          lines[lines.length - 1].push(nextP)
          p.x = nextP.x
          p.y = nextP.y
        }
      }
    }
    return lines
  }

  const getWidth = (minWidth: number, maxWidth: number): number =>
    interpolate([0, 1], [minWidth, maxWidth], Math.random())

  const setColor = (
    { colorMode, colorScheme, monochromeColor }: Props,
    x: number,
    y: number,
    type: 'stroke' | 'fill',
    angle?: number
  ): void => {
    const setFn =
      type === 'stroke'
        ? (...args) => s.stroke(...args)
        : (...args) => s.fill(...args)
    if (colorMode === 'monochrome') {
      let sanitized = monochromeColor
      if (!sanitized.startsWith('#')) {
        sanitized = '#' + sanitized
      }
      setFn(sanitized)
    } else if (colorMode === 'random from scheme') {
      setFn(randomColor(colorScheme))
    } else if (colorMode === 'sectors') {
      const colors = getColors(colorScheme)
      const colorNoise: number = s.noise(x / 200, y / 100)
      const quadrant = Math.floor(
        interpolate([0, 1], [0, colors.length - 1], colorNoise)
      )
      const alpha = interpolate([0, 1], [200, 255], Math.random())
      const alphaHex = Math.round(alpha).toString(16)
      setFn(`${colors[quadrant]}${alphaHex}`)
    } else if (colorMode === 'angular' && angle != null) {
      setFn(
        Math.floor(interpolate([-Math.PI, Math.PI], [34, 140], angle)),
        Math.floor(interpolate([-Math.PI, Math.PI], [13, 36], angle)),
        Math.floor(interpolate([-Math.PI, Math.PI], [94, 69], angle))
      )
    } else if (colorMode === 'random') {
      setFn(
        Math.floor(interpolate([0, 1], [0, 360], Math.random())),
        Math.floor(interpolate([0, 1], [70, 100], Math.random())),
        Math.floor(interpolate([0, 1], [70, 100], Math.random()))
      )
    }
  }

  const getColors = (colorScheme: ColorScheme): string[] => {
    switch (colorScheme) {
      case 'iceland':
        return coolColors
      case 'fiery furnace':
        return hotColors
      case 'oceanscape':
        return oceanScapeColors
    }
  }

  const randomColor = (colorScheme: ColorScheme): string => {
    const colors = getColors(colorScheme)
    return colors[Math.floor(Math.random() * (colors.length - 1))]
  }

  const drawStreams = (
    props: Props,
    noiseFn: NoiseFn,
    beforeDraw?: () => any
  ) => {
    const {
      minWidth,
      maxWidth,
      avoidanceRadius,
      colorMode,
      drawMode,
      dotSkip,
    } = props

    const drawnPoints: {
      point: Point
      width: number
    }[] = []
    const isClaimed = (
      p: Point,
      pointWidth: number,
      avoidanceRadius: number,
      line: Point[]
    ): boolean =>
      drawnPoints.some(({ point: otherPoint, width: otherPointWidth }) => {
        const dist =
          distance(p, otherPoint) - (pointWidth + otherPointWidth) / 2
        const isClose = dist < avoidanceRadius
        if (!isClose) return false
        if (line.includes(otherPoint)) return false
        return true
      })

    const isAngularColorMode = colorMode === 'angular'

    const lines = buildStreamLines(props, noiseFn)
    if (beforeDraw) beforeDraw()

    const constructChoppedLines = (
      line: Point[],
      strokeWeight: number
    ): Point[][] => {
      const choppedLines: Point[][] = []
      let cursor = 0
      while (cursor < line.length) {
        const sliced = line.slice(cursor)
        let breakFlag = false
        choppedLines.push([])
        sliced.forEach((p, i) => {
          cursor = i + 1
          if (breakFlag) return
          if (isClaimed(p, strokeWeight, avoidanceRadius, line)) {
            breakFlag = true
            return
          }
          drawnPoints.push({
            point: p,
            width: strokeWeight,
          })
          choppedLines[choppedLines.length - 1].push(p)
        })
      }
      return choppedLines
    }

    shuffle(lines).forEach((line) => {
      timeouts.push(
        setTimeout(() => {
          const [firstPoint] = line
          if (!firstPoint) return

          const strokeWeight = getWidth(minWidth, maxWidth)
          s.strokeWeight(strokeWeight)
          setColor(
            props,
            firstPoint.x,
            firstPoint.y,
            drawMode === 'dots' ? 'fill' : 'stroke'
          )

          const drawDot = (p: Point, i: number) => {
            if (i % dotSkip) return

            s.noStroke()
            s.circle(p.x, p.y, getWidth(minWidth, maxWidth))
          }

          const choppedLines = constructChoppedLines(line, strokeWeight)
          if (drawMode === 'outlines') {
            choppedLines.forEach((line) => {
              const queue: Point[] = []
              const stack: Point[] = []
              line.forEach((p, i) => {
                if (i > 0) {
                  const prev = line[i - 1]
                  const theta = thetaFromTwoPoints(p, prev)
                  const p1 = coordWithAngleAndDistance(
                    prev,
                    theta - Math.PI / 2,
                    strokeWeight / 2
                  )
                  const p2 = coordWithAngleAndDistance(
                    prev,
                    theta + Math.PI / 2,
                    strokeWeight / 2
                  )
                  queue.push(p1)
                  stack.push(p2)
                }
              })
              s.strokeWeight(props.outlineWidth)
              s.beginShape()
              line.forEach(() => {
                const p = queue.shift()
                if (!p) return
                s.vertex(p.x, p.y)
              })
              line.forEach(() => {
                const p = stack.pop()
                if (!p) return
                s.vertex(p.x, p.y)
              })
              s.endShape(s.CLOSE)
            })
          } else {
            choppedLines.forEach((line) => {
              if (!isAngularColorMode && drawMode !== 'dots') s.beginShape()
              line.forEach((p, i) => {
                if (isAngularColorMode) {
                  if (i > 0) {
                    const prev = line[i - 1]
                    const theta = thetaFromTwoPoints(p, prev)
                    setColor(
                      props,
                      p.x,
                      p.y,
                      drawMode === 'dots' ? 'fill' : 'stroke',
                      theta
                    )
                    if (drawMode === 'dots') {
                      drawDot(p, i)
                    } else {
                      s.line(prev.x, prev.y, p.x, p.y)
                    }
                  }
                } else {
                  if (drawMode === 'dots') {
                    drawDot(p, i)
                  } else {
                    s.vertex(p.x, p.y)
                  }
                }
              })
              if (!isAngularColorMode && drawMode !== 'dots') s.endShape()
            })
          }
        })
      )
    })
  }

  const drawFlow = (props: Props, noiseFn: NoiseFn): void => {
    const { lineLength, maxWidth } = props
    points.forEach((p, i) => {
      const angle = noiseFn(p.x, p.y)
      const nextP = coordWithAngleAndDistance(p, angle, lineLength)
      points[i] = nextP

      const firstPoint = firstPoints[i]
      setColor(
        props,
        firstPoint.x,
        firstPoint.y,
        'stroke',
        thetaFromTwoPoints(p, nextP)
      )
      s.strokeWeight(maxWidth)
      s.line(p.x, p.y, nextP.x, nextP.y)
    })
  }

  const getSquareLen = (n: number, totalLength?: number): number =>
    (totalLength == null ? getBoundedSize() : totalLength) / n

  const getBounds = (_totalLength?: number, _center?: Point): Bounds => {
    const totalLength = _totalLength == null ? getBoundedSize() : _totalLength
    const center = _center || getCenter()
    return {
      minX: center.x - totalLength / 2,
      maxX: center.x + totalLength / 2,
      minY: center.y - totalLength / 2,
      maxY: center.y + totalLength / 2,
    }
  }

  const normalizeAngle: NumberConversionFn = (angle) =>
    s.map(angle, 0, 1, 0, Math.PI * 2)

  const perlinNoiseFn =
    (distortionFn: NumberConversionFn, noiseDamp: number): NoiseFn =>
    (x: number, y: number) => {
      const angle: number = s.noise(x * noiseDamp, y * noiseDamp)
      const distorted = distortionFn(angle)
      return normalizeAngle(distorted)
    }

  const simplexNoiseFn =
    (distortionFn: NumberConversionFn, noiseDamp: number): NoiseFn =>
    (x: number, y: number) =>
      normalizeAngle(
        distortionFn(simplex.noise2D(x * noiseDamp, y * noiseDamp))
      )

  const curlNoiseFn =
    (distortionFn: NumberConversionFn, noiseDamp: number): NoiseFn =>
    (x: number, y: number) => {
      const eps = 0.0001
      const eps2 = 2 * eps

      // x rate of change
      const x1: number = s.noise((x + eps) * noiseDamp, y * noiseDamp)
      const x2: number = s.noise((x - eps) * noiseDamp, y * noiseDamp)

      // x derivative
      var dx = (x1 - x2) / eps2

      // y rate of change
      const y1: number = s.noise(x * noiseDamp, (y + eps) * noiseDamp)
      const y2: number = s.noise(x * noiseDamp, (y - eps) * noiseDamp)

      // y derivative
      var dy = (y1 - y2) / eps2

      return distortionFn(Math.atan2(dx, dy))
    }

  const imageNoiseFn =
    (distortionFn: NumberConversionFn, noiseDamp: number): NoiseFn =>
    (x: number, y: number) => {
      const [r, g, b] = s.get(x, y)
      const avg = (r + g + b) / 3
      const angle = interpolate([0, 255], [0, Math.PI * noiseDamp], avg)
      return distortionFn(angle)
    }

  let simplex: SimplexNoise
  let img

  const clearTimeouts = () => {
    timeouts.forEach((timeout) => clearTimeout(timeout))
    timeouts = []
  }

  function initialize() {
    s.clear()
    clearTimeouts()
    s.colorMode(s.HSB)
    simplex = new SimplexNoise()

    points = []
    firstPoints = []
    const props = getProps()
    const { n, density } = props

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (Math.random() > density) continue
        const p = getPointFromRC(n, r, c)
        points.push(p)
        firstPoints.push(p)
      }
    }
    last = undefined
  }

  s.setup = () => {
    s.createCanvas(window.innerWidth, window.innerHeight)
    s.frameRate(60)
    initialize()
  }

  s.preload = () => {
    img = s.loadImage(getRandomImage())
  }

  let last: Props | undefined

  s.draw = () => {
    const props = getProps()
    if (
      props.drawMode !== 'fluid' &&
      last &&
      Object.keys(last).every((prop) => last[prop] === props[prop])
    ) {
      return
    }

    clearTimeouts()

    // setProp('field', 'noise', Math.sin(s.frameCount / 5000) + 0.25)
    // setProp('field', 'distortion', interpolate([-1, 1], [0.75, 0], Math.sin(s.frameCount / 200)))
    const { distortion, noise, noiseMode, drawMode, squareCap } = props
    const normalizedNoise = noise / 1000
    const distortionFn: NumberConversionFn = (angle) =>
      distortion == 0 ? angle : distortion * Math.floor(angle / distortion)
    let noiseFn: NoiseFn
    if (drawMode !== 'fluid') {
      s.clear()
    }
    s.noFill()
    s.strokeCap(squareCap ? s.SQUARE : s.ROUND)
    s.strokeJoin(s.ROUND)
    switch (noiseMode) {
      case 'perlin': {
        noiseFn = perlinNoiseFn(distortionFn, normalizedNoise)
        break
      }
      case 'simplex': {
        noiseFn = simplexNoiseFn(distortionFn, normalizedNoise)
        break
      }
      case 'curl': {
        noiseFn = curlNoiseFn(distortionFn, normalizedNoise)
        break
      }
      case 'image': {
        const totalLength = getBoundedSize()
        const { minX, minY } = getBounds(totalLength)
        s.image(img, minX, minY, totalLength, totalLength)
        noiseFn = imageNoiseFn(distortionFn, noise)
      }
    }
    switch (drawMode) {
      case 'dots':
      case 'outlines':
      case 'streams': {
        drawStreams(props, noiseFn, () => {
          if (!props.showImage) s.clear()
        })
        break
      }
      case 'fluid': {
        s.push()
        s.noStroke()
        s.fill('rgba(0, 0, 0, 0.025)')
        s.rect(0, 0, window.innerWidth, window.innerHeight)
        s.pop()
        drawFlow(props, noiseFn)
        break
      }
    }

    last = props
  }
}
