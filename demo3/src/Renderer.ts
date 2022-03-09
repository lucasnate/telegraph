// You must make camera movement softer, it fucking makes you sick!

import { mat4, vec2, vec3 } from 'gl-matrix';
import { GameState, MIN_X, MIN_Y, MAX_X, MAX_Y, WORLD_WIDTH, WORLD_HEIGHT, PLAYER1_INDEX, PLAYER2_INDEX, Entity, EntityType, EntityState, EntityColor } from './GameState';
import { MAX_INT_ANGLE, max } from './safeCalc';
import { KIDON_TRIANGLES, KIDON_SHOT_A_TRIANGLES, KIDON_COARSE_RECT } from './shipShapes';

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
	kidonShotA: WebGLBuffer;
	kidonShotAVertexCount: number;
	grid: WebGLBuffer;
	gridVertexCount: number;
};

let debug = 200;

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
const MIN_ZOOM_DIFF = max(WORLD_WIDTH, WORLD_HEIGHT);

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
				case EntityState.Recovery:
				case EntityState.Moving:
					return {r: 0.5, g: 0.5, b: 0.5};
				case EntityState.Startup:
					switch (entity.color) {
						case EntityColor.Red:
							return {r: 1.0, g: 0.5, b: 0.5};
						case EntityColor.Blue:
							return {r: 0.5, g: 0.5, b: 1.0};
						default:
							throw new Error("Unknown color");
					}
				default:
					throw new Error("Unknown state");
			}
		case EntityType.ShotA:
			switch (entity.color) {
				case EntityColor.Neutral:
					return {r: 1, g: 1, b: 1};
				case EntityColor.Red:
					return {r: 1.0, g: 0.5, b: 0.5};
				case EntityColor.Blue:
					return {r: 0.5, g: 0.5, b: 1.0};
				default:
					throw new Error("Unknown color");
			}
		default:
			throw new Error("Unknown entity type");
	}
}

export class Renderer {
	readonly gl: WebGLRenderingContext;
	readonly programInfo: ProgramInfo;
	readonly buffers: Buffers;
	lastDiff: number | null = null;
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
			kidonShotA: this.createBuffer(KIDON_SHOT_A_TRIANGLES),
			kidonShotAVertexCount: KIDON_SHOT_A_TRIANGLES.length / 2,
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
		const diffWithoutLimit = maxx - minx;
		if (diffWithoutLimit < MIN_ZOOM_DIFF) {
			minx -= (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			miny -= (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			maxx += (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			maxy += (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
		}

		// let's say we have show dx_new. Let's say we have a square of size 100x100.
		// If dx_new is 100, this square covers the entire screen.
		// If dx_new is 200, this square covers a 1/4.
		// If dx_new is 300, this square covers a 1/9.
		//
		// This can be measured by 100 / dx_new^2.
		//
		// 1/dx_new^2 - 1/dx_old^2 < -THRESHOLD      --> in case we are zooming out too fast.
		//   1/dx_new^2 < -THRESHOLD + 1/dx_old^2
		//   dx_new^2 > 1 / (-THRESHOLD + 1/dx_old^2)
		//   dx_new = sqrt(1 / (-THRESHOLD + 1/dx_old^2))
		// 1/dx_new^2 - 1/dx_old^2 > +THRESHOLD      --> in case we are zooming in too fast.
		//   1/dx_new^2 > THRESHOLD + 1/dx_old^2
		//   dx_new^2 < 1 / (THRESHOLD + 1/dx_old^2)
		//   dx_new = sqrt(1 / (THRESHOLD + 1/dx_old^2))
		const diffWithoutSoften = maxx - minx;
		let newWantedDiff = 0;
		// let SOFTEN_THRESHOLD = 0.00000000001;
		// if (this.lastDiff == null) {
		// 	newWantedDiff = diffWithoutSoften;
		// } else if (1 / (diffWithoutSoften * diffWithoutSoften) - 1 / (this.lastDiff * this.lastDiff) < -SOFTEN_THRESHOLD) {
		// 	newWantedDiff = Math.sqrt(1 / (-SOFTEN_THRESHOLD + 1 / (this.lastDiff * this.lastDiff)));
		// } else if (1 / (diffWithoutSoften * diffWithoutSoften) - 1 / (this.lastDiff * this.lastDiff) > SOFTEN_THRESHOLD) {
		// 	newWantedDiff = Math.sqrt(1 / (+SOFTEN_THRESHOLD + 1 / (this.lastDiff * this.lastDiff)));
		// } else {
		// 	newWantedDiff = diffWithoutSoften;
		// }

		// Our zoom level is 1/dx_new. We don't want to multiply our zoom level by more
		// than SOFTEN_THRESHOLD.
		//
		// Thus, we say
		//  (1/dx_new)/(1/dx_old) > SOFTEN_THRESHOLD
		//    dx_old/dx_new < SOFTEN_THRESHOLD
		//    dx_old / SOFTEN_THRESHOLD < dx_new
		//    dx_old / SOFTEN_THRESHOLD = dx_new
		//  (1/dx_old)/(1/dx_new) > SOFTEN_THRESHOLD
		//    dx_new/dx_old < SOFTEN_THRESHOLD
		//    dx_new < SOFTEN_THRESHOLD * dx_old
		//    dx_new = SOFTEN_THRESHOLD * dx_old
		let SOFTEN_THRESHOLD = 1.0067806369281345; // pow(1.5,1/60.0)
		if (--debug > 0)
			console.log("Last diff is " + this.lastDiff +
				" diffWithoutSoften is " + diffWithoutSoften);
		if (this.lastDiff == null) {
			newWantedDiff = diffWithoutSoften;
		} else if (this.lastDiff / diffWithoutSoften > SOFTEN_THRESHOLD) {
			newWantedDiff = this.lastDiff / SOFTEN_THRESHOLD;
		} else if (diffWithoutSoften / this.lastDiff > SOFTEN_THRESHOLD) {
			newWantedDiff = this.lastDiff * SOFTEN_THRESHOLD;
		} else {
			newWantedDiff = diffWithoutSoften;
		}
		// if (--debug > 0)
		// 	console.log("Adding to zoom " + (newWantedDiff - diffWithoutSoften) / 2);
		minx -= (newWantedDiff - diffWithoutSoften) / 2;
		miny -= (newWantedDiff - diffWithoutSoften) / 2;
		maxx += (newWantedDiff - diffWithoutSoften) / 2;
		maxy += (newWantedDiff - diffWithoutSoften) / 2;
		this.lastDiff = maxx - minx;

		
		
		mat4.scale(cameraMatrix, cameraMatrix, [2 / (maxx - minx), 2 / (maxy - miny), 1]);
		mat4.translate(cameraMatrix, cameraMatrix,
					   [-(minx + maxx) / 2, -(miny + maxy) / 2, 0]);
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
			let vertexCount = 0;
			switch (state.entities[i].type) {
				case EntityType.Ship: 
					this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.kidon);
					vertexCount = this.buffers.kidonVertexCount;
					break;
				case EntityType.ShotA: 
					this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.kidonShotA);
					vertexCount = this.buffers.kidonShotAVertexCount;
					break;
				default:
					throw new Error("Unknown entity to draW");
			}
			this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
			this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
			this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, matrix);
			this.gl.drawArrays(this.gl.TRIANGLES, 0, vertexCount);
		}
	}
	
	render(state: GameState) {
		this.clear();
		this.setupCameraMatrix(state);
		this.renderGrid();
		this.renderEntities(state);
	}
}
