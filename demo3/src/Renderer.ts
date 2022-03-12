// You must make camera movement softer, it fucking makes you sick!

import { mat4, vec2, vec3 } from 'gl-matrix';
import { GameState, MIN_X, MIN_Y, MAX_X, MAX_Y, WORLD_WIDTH, WORLD_HEIGHT, PLAYER1_INDEX, PLAYER2_INDEX, Entity, EntityType, EntityState, EntityColor, getMaxHp } from './GameState';
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
	stars: WebGLBuffer;
	starsVertexCount: number;
	margin: WebGLBuffer;
	marginVertexCount: number;
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

const MARGIN_FRACTION = 0.05
const MIN_ZOOM_DIFF = max(WORLD_WIDTH * (1 + MARGIN_FRACTION * 2) / 2,
						  WORLD_HEIGHT * (1 + MARGIN_FRACTION * 2) / 2);

const STAR_POINTS = (() => {
	let points = [];
	const STAR_COUNT_SQRT = 10;
	for (let i = 0; i < STAR_COUNT_SQRT; ++i) {
		for (let j = 0; j < STAR_COUNT_SQRT; ++j) {
			let x = MIN_X + (i + Math.random()) * WORLD_WIDTH / STAR_COUNT_SQRT;
			let y = MIN_Y + (j + Math.random()) * WORLD_HEIGHT / STAR_COUNT_SQRT;
			points.push(x);
			points.push(y);
		}
	}
	return points;
})();

const STAR_SIZE = 100;

const STAR_TRIANGLES = (() => {
	let triangles = [];
	for (let i = 0, l = STAR_POINTS.length; i < l; i += 2) {
		const x = STAR_POINTS[i], y = STAR_POINTS[i+1];
		triangles.push(x + STAR_SIZE);
		triangles.push(y);
		triangles.push(x - STAR_SIZE);
		triangles.push(y);
		triangles.push(x);
		triangles.push(y + STAR_SIZE);

		triangles.push(x + STAR_SIZE);
		triangles.push(y);
		triangles.push(x - STAR_SIZE);
		triangles.push(y);
		triangles.push(x);
		triangles.push(y - STAR_SIZE);
	}

	return triangles;
})();

function makeTriangleRect(minx: number,miny: number,maxx: number,maxy: number) {
	return [minx,miny,minx,maxy,maxx,maxy,
			minx,miny,maxx,miny,maxx,maxy];
}


const LEFT_MARGIN = makeTriangleRect(WORLD_WIDTH  * (-0.5 - MARGIN_FRACTION),
									 WORLD_HEIGHT * (-0.5 - MARGIN_FRACTION),
									 WORLD_WIDTH  * (-0.5                  ),
									 WORLD_HEIGHT * (+0.5 + MARGIN_FRACTION));
const RIGHT_MARGIN = LEFT_MARGIN.map((x) => { return -x; });
const BOTTOM_MARGIN = makeTriangleRect(WORLD_WIDTH  * (-0.5 - MARGIN_FRACTION),
									   WORLD_HEIGHT * (-0.5 - MARGIN_FRACTION),
									   WORLD_WIDTH  * (+0.5 + MARGIN_FRACTION),
									   WORLD_HEIGHT * (-0.5                  ));
const TOP_MARGIN = BOTTOM_MARGIN.map((x) => { return -x; });
const MARGIN_TRIANGLES = LEFT_MARGIN.concat(RIGHT_MARGIN).concat(BOTTOM_MARGIN).concat(TOP_MARGIN);

function getIdleShipColor(entity: Entity) {
	switch (entity.color) {
		case EntityColor.Red:
			return {r: 1, g: 0, b: 0};
		case EntityColor.Blue:
			return {r: 0, g: 0, b: 1};
		default:
			throw new Error("Unknown color");
	}
}

function getMovingShipColor(entity: Entity) {
	return {r: 0.5, g: 0.5, b:0.5};
}

function getStartupShipColor(entity: Entity) {
	switch (entity.color) {
		case EntityColor.Red:
			return {r: 1.0, g: 0.5, b: 0.5};
		case EntityColor.Blue:
			return {r: 0.5, g: 0.5, b: 1.0};
		default:
			throw new Error("Unknown color");
	}	
}

function getHitstunShipColor(entity: Entity) {
	return {r: 1.0, g: 1.0, b: 1.0};
}

function getBlockstunShipColor(entity: Entity) {
	switch (entity.color) {
		case EntityColor.Red:
			return {r: 1.0, g: 0.5, b: 0.5};
		case EntityColor.Blue:
			return {r: 0.5, g: 0.5, b: 1.0};
		default:
			throw new Error("Unknown color");
	}	
}


type EntityColorHandler = { (x: Entity): Color };
const SHIP_COLOR_HANDLER_MAP = (() => {
	let map = new Map<EntityState, EntityColorHandler>();
	map.set(EntityState.Idle, getIdleShipColor);
	map.set(EntityState.Recovery, getMovingShipColor);
	map.set(EntityState.Moving, getMovingShipColor);
	map.set(EntityState.Startup, getStartupShipColor);
	map.set(EntityState.Hitstun, getHitstunShipColor);
	map.set(EntityState.Blockstun, getBlockstunShipColor);
	return map;
})();
for (const value1 in EntityState) {
	const value1Num = Number(value1);
	if (isNaN(value1Num)) continue;
	if (SHIP_COLOR_HANDLER_MAP.get(value1Num) == null)
		throw new Error("Missing color handler function");
}

function getShipColor(entity: Entity) {
	return SHIP_COLOR_HANDLER_MAP.get(entity.state)!(entity);
}

function getShotAColor(entity: Entity) {
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
}

const ENTITY_COLOR_HANDLER_MAP = (() => {
	let map = new Map<EntityType, EntityColorHandler>();
	map.set(EntityType.Ship, getShipColor);
	map.set(EntityType.ShotA, getShotAColor);
	return map;
})();
for (const value1 in EntityType) {
	const value1Num = Number(value1);
	if (isNaN(value1Num)) continue;
	if (ENTITY_COLOR_HANDLER_MAP.get(value1Num) == null)
		throw new Error("Missing color handler function");
}

function getEntityColor(entity: Entity) {
	return ENTITY_COLOR_HANDLER_MAP.get(entity.type)!(entity);
}

function textMetricsHeight(metrics: TextMetrics): number {
	return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
}

const Hp = '♥';
const BATT = '⚛';
const WARP = '✥';
const BAR_COUNT = 3;
const BAR_HSEP_RATIO = 1;
const BAR_VSEP_RATIO = 1;
const TITLE_VSEP_RATIO = 1;
const MAX_HP_GLOW_FRAMES = 16;

export class Renderer {
	readonly gl: WebGLRenderingContext;
	readonly player1Canvas: HTMLCanvasElement;
	readonly player2Canvas: HTMLCanvasElement;
	readonly player1: CanvasRenderingContext2D;
	readonly player2: CanvasRenderingContext2D;
	readonly programInfo: ProgramInfo;
	readonly buffers: Buffers;
	lastDiff: number | null = null;
	fpsDisplayValue: number = 0;

	lastPlayerCanvasWidth: number = 0;
	lastPlayerCanvasHeight: number = 0;
	barWidth: number = 0;
	titleFontSize: number = 0;
	hpFontSize: number = 0;
	battFontSize: number = 0;
	warpFontSize: number = 0;
	barSymbolHeight: number = 0;
	titleHeight: number = 0;
	hpWidth: number = 0;
	battWidth: number = 0;
	warpWidth: number = 0;

	lastPlayer1Hp: number = 0;
	lastPlayer2Hp: number = 0;
	player1HpGlowFrames: number = 0;
	player2HpGlowFrames: number = 0;
	
	constructor() {
		this.gl = (document.getElementById('glCanvas') as HTMLCanvasElement).getContext("webgl")!;
		this.player1Canvas = document.getElementById('player1Canvas')! as HTMLCanvasElement;
		this.player2Canvas = document.getElementById('player2Canvas')! as HTMLCanvasElement;
		this.player1 = this.player1Canvas.getContext("2d")!;
		this.player2 = this.player2Canvas.getContext("2d")!;
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
			gridVertexCount: GRID_LINES.length / 2,
			stars: this.createBuffer(STAR_TRIANGLES),
			starsVertexCount: STAR_TRIANGLES.length / 2,
			margin: this.createBuffer(MARGIN_TRIANGLES),
			marginVertexCount: MARGIN_TRIANGLES.length / 2
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

		const PAD = Math.max(WORLD_WIDTH, WORLD_HEIGHT) * MARGIN_FRACTION;
		minx -= PAD;
		maxx += PAD;
		miny -= PAD;
		maxy += PAD;
		
		const diffWithoutLimit = maxx - minx;
		if (diffWithoutLimit < MIN_ZOOM_DIFF) {
			minx -= (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			miny -= (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			maxx += (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
			maxy += (MIN_ZOOM_DIFF - diffWithoutLimit) / 2;
		}

		const diffWithoutSoften = maxx - minx;
		let newWantedDiff = 0;
		let SOFTEN_THRESHOLD = 1.0030433141195583; // pow(1.2,1/60.0)
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

		if (minx < -(WORLD_WIDTH / 2 + WORLD_WIDTH * MARGIN_FRACTION)) {
			maxx += -(WORLD_WIDTH / 2 + WORLD_WIDTH * MARGIN_FRACTION) - minx;
			minx = -(WORLD_WIDTH / 2 + WORLD_WIDTH * MARGIN_FRACTION);
		}
		if (miny < -(WORLD_HEIGHT / 2 + WORLD_HEIGHT * MARGIN_FRACTION)) {
			maxy += -(WORLD_HEIGHT / 2 + WORLD_HEIGHT * MARGIN_FRACTION) - miny;
			miny = -(WORLD_HEIGHT / 2 + WORLD_HEIGHT * MARGIN_FRACTION);
		}
		if (maxx > +(WORLD_WIDTH / 2 + WORLD_WIDTH * MARGIN_FRACTION)) {
			minx += +(WORLD_WIDTH / 2 + WORLD_WIDTH * MARGIN_FRACTION) - maxx;
			maxx = +(WORLD_WIDTH / 2 + WORLD_WIDTH * MARGIN_FRACTION);
		}
		if (maxy > +(WORLD_HEIGHT / 2 + WORLD_HEIGHT * MARGIN_FRACTION)) {
			miny += +(WORLD_HEIGHT / 2 + WORLD_HEIGHT * MARGIN_FRACTION) - maxy;
			maxy = +(WORLD_HEIGHT / 2 + WORLD_HEIGHT * MARGIN_FRACTION);
		}

		// document.getElementById("debug2")!.innerText = JSON.stringify({zoomx: WORLD_WIDTH * (1 + MARGIN_FRACTION * 2) / (maxx - minx),
		// 															   zoomy: WORLD_HEIGHT * (1 + MARGIN_FRACTION * 2) / (maxy - miny)});
		
		this.lastDiff = maxx - minx;

		mat4.scale(cameraMatrix, cameraMatrix, [2 / (maxx - minx), 2 / (maxy - miny), 1]);
		mat4.translate(cameraMatrix, cameraMatrix,
					   [-(minx + maxx) / 2, -(miny + maxy) / 2, 0]);
		this.gl.uniformMatrix4fv( this.programInfo.uniformLocations.cameraMatrix, false, cameraMatrix);
	}


	renderStars() {
		this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, mat4.create());
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.stars);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniform4f(this.programInfo.uniformLocations.color, 0.8, 0.8, 0.8, 1);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, this.buffers.starsVertexCount);
	}

	renderGrid() {
		this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, mat4.create());
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.grid);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniform4f(this.programInfo.uniformLocations.color, 0.3, 0.3, 0.3, 1);
		this.gl.drawArrays(this.gl.LINES, 0, this.buffers.gridVertexCount);
	}

	renderMargin() {
		this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, mat4.create());
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.margin);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniform4f(this.programInfo.uniformLocations.color, 0.5, 0.25, 0.5, 1);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, this.buffers.marginVertexCount);
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

	getBestFontSize(text: string, maxWidth: number): number {
		let fontSize = 90;
		let ctx = this.player1;
		ctx.font = fontSize.toString() + 'px monospace';
		while (ctx.measureText(text).width > maxWidth) {
			fontSize = Math.floor(fontSize / 2);
			ctx.font = fontSize.toString() + 'px monospace';
		}
		return fontSize;
	}
	
	recalculateFontSizes() {
		let canvas = this.player1Canvas;
		let ctx = this.player1;
		if (canvas.width == this.lastPlayerCanvasWidth && canvas.height == this.lastPlayerCanvasHeight) {
			return;
		}
		this.barWidth = canvas.width / (BAR_COUNT + (BAR_COUNT - 1) * BAR_HSEP_RATIO);
		this.titleFontSize = this.getBestFontSize('Player 12', canvas.width);
		this.hpFontSize = this.getBestFontSize(Hp, this.barWidth);
		this.battFontSize = this.getBestFontSize(BATT, this.barWidth);
		this.warpFontSize = this.getBestFontSize(WARP, this.barWidth);
		this.barSymbolHeight = 0;
		ctx.font = this.hpFontSize.toString() + 'px monospace';
		let hpMeasure = ctx.measureText(Hp);
		this.barSymbolHeight = Math.max(textMetricsHeight(hpMeasure), this.barSymbolHeight);
		ctx.font = this.battFontSize.toString() + 'px monospace';
		let battMeasure = ctx.measureText(BATT);
		this.barSymbolHeight = Math.max(textMetricsHeight(battMeasure), this.barSymbolHeight);
		ctx.font = this.warpFontSize.toString() + 'px monospace';
		let warpMeasure = ctx.measureText(WARP)
		this.barSymbolHeight = Math.max(textMetricsHeight(warpMeasure), this.barSymbolHeight);
		ctx.font = this.titleFontSize.toString() + 'px monospace';
		this.titleHeight = textMetricsHeight(ctx.measureText('Player 12'));
		this.hpWidth = hpMeasure.width;
		this.battWidth = battMeasure.width;
		this.warpWidth = warpMeasure.width;
		this.lastPlayerCanvasWidth = canvas.width;
		this.lastPlayerCanvasHeight = canvas.height;
	}

	renderSinglePlayerCanvas(state: GameState, isPlayer2: boolean) {	
		const ctx = isPlayer2 ? this.player2 : this.player1;
		const canvas = isPlayer2 ? this.player2Canvas : this.player1Canvas;
		const width = canvas.width, height = canvas.height;
		const barWidth = width / (BAR_COUNT + (BAR_COUNT - 1) * BAR_HSEP_RATIO);
		const barTop = this.titleHeight * (1 + TITLE_VSEP_RATIO);
		const barBottom = height - (1 + BAR_VSEP_RATIO) * this.barSymbolHeight;
		const entity = state.entities[isPlayer2 ? PLAYER2_INDEX : PLAYER1_INDEX];
		const maxHp = getMaxHp(entity.type);
		const hp = entity.hp;
		let lastHp = isPlayer2 ? this.lastPlayer2Hp : this.lastPlayer1Hp;
		// const hpBarColor = getEntityColor(state.entities[isPlayer2 ? PLAYER2_INDEX : PLAYER1_INDEX]);
		ctx.font = this.titleFontSize.toString() + 'px monospace';
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = 'white';
		ctx.fillText(isPlayer2 ? 'Player 2' : 'Player 1', 0, this.titleHeight);
		if (!isPlayer2) {
			ctx.font = '10px monospace';
			ctx.fillText(this.fpsDisplayValue.toString(), 0, canvas.height);
		}
		ctx.font = this.hpFontSize.toString() + 'px monospace';
		ctx.fillText(Hp, barWidth / 2 - this.hpWidth / 2, height);
		ctx.font = this.battFontSize.toString() + 'px monospace';
		ctx.fillText(BATT, barWidth * (1 + BAR_HSEP_RATIO) + barWidth / 2 - this.battWidth / 2, height);
		ctx.font = this.warpFontSize.toString() + 'px monospace';
		ctx.fillText(WARP, barWidth * (2 + 2 * BAR_HSEP_RATIO) + barWidth / 2 - this.warpWidth / 2, height);
		if (this.player1HpGlowFrames > 0) --this.player1HpGlowFrames;
		if (this.player2HpGlowFrames > 0) --this.player2HpGlowFrames;
		if (hp !== lastHp) {
			if (isPlayer2) {
				this.player2HpGlowFrames = MAX_HP_GLOW_FRAMES;
				this.lastPlayer2Hp = hp;
			} else {
				this.player1HpGlowFrames = MAX_HP_GLOW_FRAMES;
				this.lastPlayer1Hp = hp;
			}
		}
		if ((isPlayer2 ? this.player2HpGlowFrames : this.player1HpGlowFrames) > 0) {
			console.log((isPlayer2 ? this.player2HpGlowFrames : this.player1HpGlowFrames));
		}
		ctx.fillStyle = 'rgb(0,' + (128 + Math.floor(127 * (isPlayer2 ? this.player2HpGlowFrames : this.player1HpGlowFrames) / MAX_HP_GLOW_FRAMES)).toString() + ',0)';
		ctx.fillRect(0, barTop + (barBottom - barTop) * (maxHp - entity.hp) / maxHp, barWidth, (barBottom - barTop) * entity.hp / maxHp);
		ctx.fillStyle = 'rgb(194,126,0)';
		ctx.fillRect(barWidth * (BAR_HSEP_RATIO + 1), barTop, barWidth, barBottom - barTop);
		ctx.fillStyle = 'rgb(0,128,128)';
		ctx.fillRect(barWidth * 2 * (BAR_HSEP_RATIO + 1), barTop, barWidth, barBottom - barTop);		
	}
		
	renderPlayerCanvas(state: GameState) {
		this.recalculateFontSizes();
		this.renderSinglePlayerCanvas(state, false);
		this.renderSinglePlayerCanvas(state, true);
	}
	
	render(state: GameState) {
		this.clear();
		this.setupCameraMatrix(state);
		// this.renderGrid();
		this.renderStars();
		this.renderMargin();
		this.renderEntities(state);
		this.renderPlayerCanvas(state);
	}
}
