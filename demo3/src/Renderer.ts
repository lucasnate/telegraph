import { mat4, vec2, vec3 } from 'gl-matrix';
import { GameState, MIN_X, MIN_Y, MAX_X, MAX_Y, WORLD_WIDTH, WORLD_HEIGHT, PLAYER1_INDEX, PLAYER2_INDEX, Entity, EntityType, EntityState, EntityColor } from './GameState';
import { MAX_INT_ANGLE, max } from './safeCalc';
import { KIDON_TRIANGLES, KIDON_COARSE_RECT } from './shipShapes';

// Vertex shader program
const VERTEX_SHADER_SOURCE = `
attribute vec4 aVertexPosition;

uniform mat4 uCameraMatrix;
uniform mat4 uModelSpecificMatrix;

void main() {
gl_Position = uCameraMatrix * uModelSpecificMatrix * aVertexPosition;
}
`;

const FRAGMENT_SHADER_SOURCE = `
uniform lowp vec4 uColor; 

void main() {
gl_FragColor = uColor;
}
`
interface Color {
	r: number;
	g: number;
	b: number;
}
interface AttribLocations {
	vertexPosition: number;
}

interface UniformLocations {
	cameraMatrix: WebGLUniformLocation;
	modelSpecificMatrix: WebGLUniformLocation;
	color: WebGLUniformLocation;
}

interface ProgramInfo {
	program: WebGLProgram;
	attribLocations: AttribLocations;
	uniformLocations: UniformLocations;
}

interface Buffers {
	kidon: WebGLBuffer;
	kidonVertexCount: number;
	grid: WebGLBuffer;
	gridVertexCount: number;
};

let debug = true;

const GRID_COUNT = 21;
const GRID_LINES = (() => {
	let grid = [];
	for (let i = 0; i < GRID_COUNT; ++i) {
		let x = MIN_X + WORLD_WIDTH / (GRID_COUNT - 1) * i;
		grid.push(x);
		grid.push(MIN_Y);
		grid.push(x);
		grid.push(MAX_Y);
		let y = MIN_Y + WORLD_HEIGHT / (GRID_COUNT - 1) * i;
		grid.push(MIN_X);
		grid.push(y);
		grid.push(MAX_X);
		grid.push(y);		
	}
	return grid;
})();
const MIN_ZOOM_DIFF = max(WORLD_WIDTH, WORLD_HEIGHT) / 4;

function getEntityColor(entity: Entity) {
	switch (entity.type) {
		case EntityType.Ship:
			switch (entity.state) {
				case EntityState.Idle:
					switch (entity.color) {
						case EntityColor.Red:
							return {r: 1, g: 0, b: 0};
						case EntityColor.Blue:
							return {r: 0, g: 0, b: 1};
						default:
							throw new Error("Unknown color");
					}
				case EntityState.Moving:
					return {r: 0.5, g: 0.5, b: 0.5};
				default:
					throw new Error("Unknown state");
			}
		default:
			throw new Error("Unknown entity type");
	}
}

export class Renderer {
	readonly gl: WebGLRenderingContext;
	readonly programInfo: ProgramInfo;
	readonly buffers: Buffers;
	constructor() {
		this.gl = (document.getElementById('glCanvas') as HTMLCanvasElement).getContext("webgl")!;
		this.programInfo = this.createProgramInfo();
		this.buffers = this.createBuffers();
	}

	createShader(type: number, source: string) {
		const shader = this.gl.createShader(type)!;
		
		// Send the source to the shader object
		
		this.gl.shaderSource(shader, source);
		
		// Compile the shader program
		
		this.gl.compileShader(shader);
		
		// See if it compiled successfully
		
		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			alert('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
			this.gl.deleteShader(shader);
			return null;
		}
		
		return shader;
	}
	
	createShaderProgram() : WebGLProgram {
		const vertexShader = this.createShader(this.gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)!;
		const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)!;
		
		// Create the shader program
		
		const shaderProgram = this.gl.createProgram()!;
		this.gl.attachShader(shaderProgram, vertexShader);
		this.gl.attachShader(shaderProgram, fragmentShader);
		this.gl.linkProgram(shaderProgram);
		
		// If creating the shader program failed, alert
		
		if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
			throw Error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(shaderProgram));
		}
		
		return shaderProgram;		
	}
	
	createProgramInfo() {
		const shaderProgram = this.createShaderProgram();
		const ret = {
			program: shaderProgram,
			attribLocations: {
				vertexPosition: this.gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
			},
			uniformLocations: {
				cameraMatrix: this.gl.getUniformLocation(shaderProgram, 'uCameraMatrix')!,
				modelSpecificMatrix: this.gl.getUniformLocation(shaderProgram, 'uModelSpecificMatrix')!,
				color: this.gl.getUniformLocation(shaderProgram, 'uColor')!,
			},
		};
		this.gl.useProgram(shaderProgram);
		return ret;
	}

	createBuffer(vertices: number[]): WebGLBuffer {
		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
		return buffer!;
	}

	createBuffers() {
		return {
			kidon: this.createBuffer(KIDON_TRIANGLES),
			kidonVertexCount: KIDON_TRIANGLES.length / 2,
			grid: this.createBuffer(GRID_LINES),
			gridVertexCount: GRID_LINES.length / 2
		};
	}
	
	clear() {
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
		this.gl.clearDepth(1.0);                 // Clear everything
		// this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
		// this.gl.enable(this.gl.BLEND);  
		// this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);  
		// this.gl.depthFunc(this.gl.LEQUAL);            // Near things obscure far things
		
		// Clear the canvas before we start drawing on it.
		
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
	}

	setupCameraMatrix(state: GameState) {
		let cameraMatrix = mat4.create();
		let boundingRectPoint = vec2.create();

		let minx = Math.min(state.entities[PLAYER1_INDEX].x, state.entities[PLAYER2_INDEX].x);
		let miny = Math.min(state.entities[PLAYER1_INDEX].y, state.entities[PLAYER2_INDEX].y);
		let maxx = Math.max(state.entities[PLAYER1_INDEX].x, state.entities[PLAYER2_INDEX].x);
		let maxy = Math.max(state.entities[PLAYER1_INDEX].y, state.entities[PLAYER2_INDEX].y);
		minx += KIDON_COARSE_RECT.minxy;
		miny += KIDON_COARSE_RECT.minxy;
		maxx += KIDON_COARSE_RECT.maxxy;
		maxy += KIDON_COARSE_RECT.maxxy;
		const dx = maxx - minx;
		const dy = maxy - miny;
		if (dx > dy) {
			miny -= (dx - dy) / 2;
			maxy += (dx - dy) / 2;
		} else {
			minx -= (dy - dx) / 2;
			maxx += (dy - dx) / 2;
		}

		const diffWithoutPad = maxx - minx;
		minx -= diffWithoutPad / 10;
		maxx += diffWithoutPad / 10;
		miny -= diffWithoutPad / 10;
		maxy += diffWithoutPad / 10;
		let diffWithoutLimit = maxx - minx;
		if (diffWithoutLimit < MIN_ZOOM_DIFF) {
			minx -= (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			miny -= (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			maxx += (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			maxy += (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
		}
		
		mat4.scale(cameraMatrix, cameraMatrix, [2 / (maxx - minx), 2 / (maxy - miny), 1]);
		mat4.translate(cameraMatrix, cameraMatrix,
					   [-(minx + maxx) / 2, -(miny + maxy) / 2, 0]);
		if (debug) {
			console.log("-----DEBUG-----");
			console.log(MIN_X);
			console.log(WORLD_WIDTH);
			console.log(GRID_COUNT);
			console.log(cameraMatrix);
			console.log(GRID_LINES);
			console.log(minx);
			console.log(miny);
			console.log(maxx);
			console.log(maxy);
			debug = false;
		}
		this.gl.uniformMatrix4fv( this.programInfo.uniformLocations.cameraMatrix, false, cameraMatrix);
	}

	renderGrid() {
		this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, mat4.create());
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.grid);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniform4f(this.programInfo.uniformLocations.color, 0.3, 0.3, 0.3, 1);
		this.gl.drawArrays(this.gl.LINES, 0, this.buffers.gridVertexCount);
	}

	renderEntities(state: GameState) {
		let pos = vec3.create();
		let matrix = mat4.create();
		let color: Color = {r: 0, g: 0, b: 0};
		for (let i = 0, l = state.entities.length; i < l; ++i) {
			color = getEntityColor(state.entities[i]);
			this.gl.uniform4f(this.programInfo.uniformLocations.color, color.r, color.g, color.b, 1);

			pos[0] = state.entities[i].x;
			pos[1] = state.entities[i].y;
			mat4.identity(matrix);
			mat4.translate(matrix, matrix, pos);
			mat4.rotate(matrix, matrix, state.entities[i].angleInt * 2 * Math.PI / MAX_INT_ANGLE, [0,0,1]);
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.kidon);
			this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
			this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
			this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, matrix);
			this.gl.drawArrays(this.gl.TRIANGLES, 0, this.buffers.kidonVertexCount);
		}
	}
	
	render(state: GameState) {
		this.clear();
		this.setupCameraMatrix(state);
		this.renderGrid();
		this.renderEntities(state);
	}
}
