import type { AudioManager } from './audio'
import type { SpectrogramSettings } from './types'

export class SpectrogramRenderer {
	private readonly gl: WebGL2RenderingContext
	private readonly program: WebGLProgram
	private readonly vertexBuffer: WebGLBuffer
	private readonly dataTexture: WebGLTexture
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
		const { program, vertexBuffer, dataTexture, uniformLocations } = this.initWebGL(gl)

		this.program = program
		this.vertexBuffer = vertexBuffer
		this.dataTexture = dataTexture
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
		}

		const vertexBuffer = this.createVertexBuffer(gl)
		const dataTexture = this.createDataTexture(gl)

		return {
			program,
			vertexBuffer,
			dataTexture,
			uniformLocations,
		}
	}

	private getUniformLocation(
		gl: WebGLRenderingContext,
		program: WebGLProgram,
		name: string,
	): WebGLUniformLocation {
		const location = gl.getUniformLocation(program, name)
		// TODO
		//if (!location) {
		//    throw new Error(`Could not get uniform location for: ${name}`)
		//}
		return location!
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
            precision mediump float;
            varying vec2 texCoord;
            uniform sampler2D audioData;
            uniform float offset;
            uniform float speed;
            uniform float lowerFrequency;
            uniform float upperFrequency;
            uniform float hzPerBin;
            uniform float scala;
            uniform int colorMap;

            vec3 decibelToColor(float value) {
                return vec3(1.0 - value, 1.0 - value, 1.0 - value);
            }

            float logScale(float percentage) {
                float logRange = log2(upperFrequency) - log2(lowerFrequency);
	            return exp2(percentage * logRange + log2(lowerFrequency));
            }

            void main() {
                float x = 1.0 - (1.0 - texCoord.x) / speed + offset;
                float frequency = logScale(texCoord.y);
                vec2 scaledCoord = vec2(x, frequency / nyquistFrequency);
                float value = texture2D(audioData, scaledCoord).r;

                vec3 color = decibelToColor(value);
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
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
		this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1)

		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
		return texture
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

		this.timeIndex = (this.timeIndex + 1) % this.width
	}

	changeSettings(width: number, height: number, frequencyBinCount: number) {
		if (width !== this.width || this.height !== height) {
			this.canvas.width = width
			this.canvas.height = height
		}

		if (width !== this.width || frequencyBinCount != this.frequencyBinCount) {
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture)
			const emptyData = new Uint8Array(width * frequencyBinCount)
			this.gl.texImage2D(
				this.gl.TEXTURE_2D,
				0,
				this.gl.LUMINANCE,
				width,
				frequencyBinCount,
				0,
				this.gl.LUMINANCE,
				this.gl.UNSIGNED_BYTE,
				emptyData,
			)
			this.timeIndex = 0
			console.log(`Changed size to ${width} x ${frequencyBinCount}`)
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

		// Set uniform values
		this.gl.uniform1f(this.uniformLocations.offset, this.timeIndex / this.width)
		this.gl.uniform1f(this.uniformLocations.lowerFrequency, settings.lowerFrequency)
		this.gl.uniform1f(this.uniformLocations.upperFrequency, settings.upperFrequency)
		this.gl.uniform1f(this.uniformLocations.nyquistFrequency, this.audioManager.getSampleRate() / 2)
		this.gl.uniform1f(this.uniformLocations.speed, settings.speed)
		this.gl.uniform1f(this.uniformLocations.scala, 0)
		this.gl.uniform1i(this.uniformLocations.colorMap, 0)

		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
	}

	getCanvas() {
		return this.canvas
	}

	dispose() {
		this.gl.deleteProgram(this.program)
		this.gl.deleteBuffer(this.vertexBuffer)
		this.gl.deleteTexture(this.dataTexture)
	}
}
