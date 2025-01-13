import type { AudioManager } from './audio'
import { COLOR_MAPS, getColorMap } from './color_maps'
import { MAX_ESTIMATOR_RESULTS } from './estimator'
import type { SpectrogramSettings } from './settings'
import { SCALA_VARIANTS } from './scales'

const SPECTROGRAM_WIDTH = MAX_ESTIMATOR_RESULTS

export class SpectrogramRenderer {
	private readonly gl: WebGL2RenderingContext
	private readonly program: WebGLProgram
	private readonly vertexBuffer: WebGLBuffer
	private readonly dataTexture: WebGLTexture
	private readonly colorMapTexture: WebGLTexture
	private readonly uniformLocations: {
		offset: WebGLUniformLocation
		lowerFrequency: WebGLUniformLocation
		upperFrequency: WebGLUniformLocation
		nyquistFrequency: WebGLUniformLocation
		speed: WebGLUniformLocation
		scala: WebGLUniformLocation
		colorMap: WebGLUniformLocation
	}
	private readonly canvas: HTMLCanvasElement

	// Mutable state
	private timeIndex = 0
	private width: number
	private height: number
	private frequencyBinCount: number

	constructor(private audioManager: AudioManager) {
		this.canvas = document.createElement('canvas')
		this.width = 0
		this.height = 0
		this.frequencyBinCount = -1

		// Initialize WebGL context
		const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: false })
		if (!gl) {
			throw new Error('WebGL not supported')
		}
		this.gl = gl

		// Initialize all required WebGL resources
		const { program, vertexBuffer, dataTexture, colorMapTexture, uniformLocations } =
			this.initWebGL(gl)

		this.program = program
		this.vertexBuffer = vertexBuffer
		this.dataTexture = dataTexture
		this.colorMapTexture = colorMapTexture
		this.uniformLocations = uniformLocations
		this.changeSettings(1, 1, 1)
	}

	private initWebGL(gl: WebGLRenderingContext) {
		const program = this.createProgram(gl)

		// Get all uniform locations
		const uniformLocations = {
			offset: this.getUniformLocation(gl, program, 'offset'),
			lowerFrequency: this.getUniformLocation(gl, program, 'lowerFrequency'),
			upperFrequency: this.getUniformLocation(gl, program, 'upperFrequency'),
			nyquistFrequency: this.getUniformLocation(gl, program, 'nyquistFrequency'),
			speed: this.getUniformLocation(gl, program, 'speed'),
			scala: this.getUniformLocation(gl, program, 'scala'),
			colorMap: this.getUniformLocation(gl, program, 'colorMap'),
			colorMapTexture: this.getUniformLocation(gl, program, 'colorMapTexture'),
		}

		const vertexBuffer = this.createVertexBuffer(gl)
		const dataTexture = this.createDataTexture(gl)
		const colorMapTexture = this.createColorMapTexture(gl)

		return {
			program,
			vertexBuffer,
			dataTexture,
			colorMapTexture,
			uniformLocations,
		}
	}

	private createVertexBuffer(gl: WebGLRenderingContext) {
		const vertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])

		const buffer = gl.createBuffer()
		if (!buffer) {
			throw new Error('Failed to create vertex buffer')
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

		return buffer
	}

	private createDataTexture(gl: WebGLRenderingContext) {
		const texture = gl.createTexture()
		if (!texture) {
			throw new Error('Failed to create texture')
		}
		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		return texture
	}

	private createColorMapTexture(gl: WebGLRenderingContext): WebGLTexture {
		const texture = gl.createTexture()
		if (!texture) {
			throw new Error('Failed to create color map texture')
		}

		// Generate color map lookup table
		const colorData = new Uint8Array(256 * 3 * COLOR_MAPS.length)

		// Fill the color data using the provided getColor function
		for (let i = 0; i < COLOR_MAPS.length; i++) {
			let array = getColorMap(COLOR_MAPS[i])
			for (let j = 0; j < 256; j++) {
				const [r, g, b] = array[j]
				colorData[(i * 256 + j) * 3] = r
				colorData[(i * 256 + j) * 3 + 1] = g
				colorData[(i * 256 + j) * 3 + 2] = b
			}
		}

		gl.bindTexture(gl.TEXTURE_2D, texture)
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGB,
			256,
			COLOR_MAPS.length,
			0,
			gl.RGB,
			gl.UNSIGNED_BYTE,
			colorData,
		)

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

		return texture
	}

	private createProgram(gl: WebGLRenderingContext) {
		const vertexShaderSource = `
            attribute vec2 position;
            varying vec2 texCoord;

            void main() {
                texCoord = position;
                gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
            }
        `

		const fragmentShaderSource = `
            precision highp float;
            varying vec2 texCoord;
            uniform sampler2D audioData;
            uniform sampler2D colorMapTexture;
            uniform float offset;
            uniform float speed;
            uniform float lowerFrequency;
            uniform float upperFrequency;
            uniform float nyquistFrequency;
            uniform int scala;
            uniform float colorMap;

            float logScale(float percentage) {
                float logRange = log(upperFrequency) - log(lowerFrequency);
                return exp(percentage * logRange + log(lowerFrequency));
            }

			float linearScale(float percentage) {
			    return lowerFrequency + percentage * (upperFrequency - lowerFrequency);
			}

			float melScale(float percentage) {
			    float lower = 1127.0 * log(1.0 + lowerFrequency / 700.0);
			    float upper = 1127.0 * log(1.0 + upperFrequency / 700.0);
			    float mel = lower + percentage * (upper - lower);
			    return 700.0 * (exp(mel / 1127.0) - 1.0);
			}

			float scaleFrequency(float percentage) {
			    if (scala == 1) {
			        return linearScale(percentage);
			    } else if (scala == 2) {
			        return melScale(percentage);
			    } else {
			        return logScale(percentage);
			    }
			}

            void main() {
                float x = (texCoord.x - 1.0) / speed + offset;
                float frequency = scaleFrequency(texCoord.y);
                vec2 scaledCoord = vec2(x, frequency / nyquistFrequency);
                float value = texture2D(audioData, scaledCoord).r;

                vec2 colorCoord = vec2(value, colorMap);
                vec3 color = texture2D(colorMapTexture, colorCoord).rgb;

                gl_FragColor = vec4(color, 1.0);
            }
        `

		const vertexShader = this.compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
		const fragmentShader = this.compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)

		const program = gl.createProgram()
		if (!program) {
			throw new Error('Failed to create WebGL program')
		}

		gl.attachShader(program, vertexShader)
		gl.attachShader(program, fragmentShader)
		gl.linkProgram(program)

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const info = gl.getProgramInfoLog(program)
			gl.deleteProgram(program)
			throw new Error(`Could not compile WebGL program: ${info}`)
		}

		gl.deleteShader(vertexShader)
		gl.deleteShader(fragmentShader)

		return program
	}

	private compileShader(gl: WebGLRenderingContext, source: string, type: number) {
		const shader = gl.createShader(type)
		if (!shader) {
			throw new Error('Failed to create WebGL shader')
		}

		gl.shaderSource(shader, source)
		gl.compileShader(shader)

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const info = gl.getShaderInfoLog(shader)
			gl.deleteShader(shader)
			throw new Error(`Could not compile WebGL shader: ${info}`)
		}

		return shader
	}

	private getUniformLocation(
		gl: WebGLRenderingContext,
		program: WebGLProgram,
		name: string,
	): WebGLUniformLocation {
		const location = gl.getUniformLocation(program, name)
		if (!location) {
			console.warn(`Could not get uniform location for: ${name}`)
		}
		return location!
	}

	update(freqBuffer: Uint8Array) {
		this.changeSettings(this.width, this.height, freqBuffer.length)

		this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture)
		this.gl.texSubImage2D(
			this.gl.TEXTURE_2D,
			0,
			this.timeIndex,
			0,
			1,
			this.frequencyBinCount,
			this.gl.LUMINANCE,
			this.gl.UNSIGNED_BYTE,
			freqBuffer,
		)

		this.timeIndex = (this.timeIndex + 1) % SPECTROGRAM_WIDTH
	}

	changeSettings(width: number, height: number, frequencyBinCount: number) {
		if (width !== this.width || this.height !== height) {
			this.canvas.width = width
			this.canvas.height = height
		}

		if (frequencyBinCount !== this.frequencyBinCount) {
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture)
			const emptyData = new Uint8Array(SPECTROGRAM_WIDTH * frequencyBinCount)
			this.gl.texImage2D(
				this.gl.TEXTURE_2D,
				0,
				this.gl.LUMINANCE,
				SPECTROGRAM_WIDTH,
				frequencyBinCount,
				0,
				this.gl.LUMINANCE,
				this.gl.UNSIGNED_BYTE,
				emptyData,
			)
			this.timeIndex = 0
		}

		this.width = width
		this.height = height
		this.frequencyBinCount = frequencyBinCount
	}

	render(settings: SpectrogramSettings, width: number, height: number) {
		this.changeSettings(width, height, this.frequencyBinCount)

		this.gl.viewport(0, 0, this.width, this.height)
		this.gl.clear(this.gl.COLOR_BUFFER_BIT)

		this.gl.useProgram(this.program)

		const positionLocation = this.gl.getAttribLocation(this.program, 'position')
		this.gl.enableVertexAttribArray(positionLocation)
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)
		this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

		// Bind textures
		this.gl.activeTexture(this.gl.TEXTURE0)
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture)
		this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'audioData'), 0)
		const textureInterpolation =
			settings.interpolation === 'nearest' ? this.gl.NEAREST : this.gl.LINEAR
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, textureInterpolation)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, textureInterpolation)

		this.gl.activeTexture(this.gl.TEXTURE1)
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.colorMapTexture)
		this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'colorMapTexture'), 1)

		// Set other uniform values
		this.gl.uniform1f(this.uniformLocations.offset, this.timeIndex / SPECTROGRAM_WIDTH)
		this.gl.uniform1f(this.uniformLocations.lowerFrequency, settings.lowerFrequency)
		this.gl.uniform1f(this.uniformLocations.upperFrequency, settings.upperFrequency)
		this.gl.uniform1f(this.uniformLocations.nyquistFrequency, this.audioManager.getSampleRate() / 2)
		this.gl.uniform1f(this.uniformLocations.speed, settings.speed)
		this.gl.uniform1i(this.uniformLocations.scala, SCALA_VARIANTS.indexOf(settings.scala))
		this.gl.uniform1f(
			this.uniformLocations.colorMap,
			(COLOR_MAPS.indexOf(settings.colorMap) + 0.5) / COLOR_MAPS.length,
		)

		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
	}

	getCanvas() {
		return this.canvas
	}

	dispose() {
		this.gl.deleteProgram(this.program)
		this.gl.deleteBuffer(this.vertexBuffer)
		this.gl.deleteTexture(this.dataTexture)
		this.gl.deleteTexture(this.colorMapTexture)
	}
}
