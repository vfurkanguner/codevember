import createLine from './gl/gl-line-3d';
import createOrbit from 'orbit-controls';
import createCamera from 'perspective-camera';
import createShader from 'gl-shader';
import glAudioAnalyser from 'gl-audio-analyser';
import vignette from 'gl-vignette-background';

import { hexRgb, lerp, newArray, isMobile, setIdentity, getWebGLContext } from './utils';

const glslify = require('glslify');

const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent)
const steps = 200
const segments = isSafari ? 50 : 100
const radius = 0.1
const thickness = 0.01
const src = 'assets/highroad.mp3'

const defaults = {
  opacity: 0.5,
  useHue: false,
  additive: false
}

const presets = [
  {
    gradient: ['#00041B', '#00041B'],
    color: '#fff', useHue: true
  },
  // other styles that look decent
  // { gradient: [ '#fff', '#4f4f4f' ],
  //   color: '#000' },
  // { gradient: [ '#757575', '#1c0216' ],
  //   color: '#fff' }
]

let settings = presets[Math.floor(Math.random() * presets.length)]
settings = Object.assign({}, defaults, settings)

const colorVec = hexRgb(settings.color)

const gl = getWebGLContext();
const canvas = gl.canvas
document.body.appendChild(canvas)

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioPlayer = require('web-audio-player');
const supportedTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);

const app = require('canvas-loop')(canvas, {
  scale: window.devicePixelRatio
})

const background = vignette(gl)
background.style({
  aspect: 1,
  color1: hexRgb(settings.gradient[0]),
  // color2: hexRgb(settings.gradient[1]),
  smoothing: [-0.5, 1.0],
  noiseAlpha: 0.1,
  offset: [-0.05, -0.15]
})

const identity = setIdentity([])
const shader = createShader(gl,
  glslify(__dirname + '/shaders/21-line.vert'),
  glslify(__dirname + '/shaders/21-line.frag')
)

const camera = createCamera({
  fov: 50 * Math.PI / 180,
  position: [0, 0, 1],
  near: 0.0001,
  far: 10000
})

const controls = createOrbit({
  element: canvas,
  distanceBounds: [0.5, 100],
  distance: 0.5
})

const paths = newArray(segments).map(createSegment)
const lines = paths.map(path => {
  return createLine(gl, shader, path)
})

let analyser
start()

function start() {
  if (supportedTextures < 1) {
    throw new Error('Not supported')
  }
  if (!AudioContext) {
    throw new Error('This demo requires a WebAudio capable browser.')
  }
  if (isMobile()) {
    return 'Cant use on mobile'
  }

  const audioContext = new AudioContext()
  const audio = audioPlayer(src, {
    context: audioContext,
    loop: true,
    buffer: isSafari
  })
  const loader = document.querySelector('.loader')
  audio.once('load', () => {
    analyser = glAudioAnalyser(gl, audio.node, audioContext)
    audio.play()
    app.start()
    loader.style.display = 'none'
  })
}

let time = 0
app.on('tick', dt => {
  time += Math.min(30, dt) / 1000

  const width = gl.drawingBufferWidth
  const height = gl.drawingBufferHeight

  // set up our camera
  camera.viewport[2] = width
  camera.viewport[3] = height
  controls.update(camera.position, camera.direction, camera.up)
  camera.update()

  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const size = Math.min(width, height) * 1.5
  gl.disable(gl.DEPTH_TEST)
  background.style({
    scale: [1 / width * size, 1 / height * size]
  })
  background.draw()

  gl.disable(gl.DEPTH_TEST) // off for now
  gl.enable(gl.BLEND)
  if (settings.additive) gl.blendFunc(gl.ONE, gl.ONE)
  else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.disable(gl.CULL_FACE)

  shader.bind()
  shader.uniforms.iGlobalTime = time
  shader.uniforms.radius = radius
  shader.uniforms.audioTexture = 0
  shader.uniforms.opacity = settings.opacity
  shader.uniforms.useHue = settings.useHue

  analyser.bindFrequencies(0)

  lines.forEach((line, i, list) => {
    line.color = colorVec
    line.thickness = thickness
    line.model = identity
    line.view = camera.view
    line.projection = camera.projection
    line.aspect = width / height
    line.miter = 0
    shader.uniforms.index = i / (list.length - 1)
    line.draw()
  })
})

function createSegment() {
  return newArray(steps).map((i, _, list) => {
    const x = lerp(-1, 1, i / (list.length - 1))
    return [x, 0, 0]
  })
}
