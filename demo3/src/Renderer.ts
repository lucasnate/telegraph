import { mat4, vec2, vec3 } from 'gl-matrix';
import { GameState, MIN_X, MIN_Y, MAX_X, MAX_Y, WORLD_WIDTH, WORLD_HEIGHT, PLAYER1_INDEX, PLAYER2_INDEX, Entity, EntityType, Renderable, RenderableType, EntityState, EntityColor, getMaxHp, getMaxBatt, getMaxWarp, WinScreen, assertDefinedForAllEnum, getEntityState, getFadeFrames, THRUST_FRAMES, CollisionSide, WARP_AFTER_IMAGE_TTL_FRAMES } from './GameState';
import { MAX_INT_ANGLE, max, min } from './safeCalc';
import { KIDON_TRIANGLES, KIDON_SHOT_A1_TRIANGLES, KIDON_SHOT_A2_TRIANGLES, KIDON_SHOT_B1_TRIANGLES, KIDON_SHOT_B2_TRIANGLES, KIDON_SHOT_C1_BIG_TRIANGLES, KIDON_SHOT_C1_SMALL_TRIANGLES, KIDON_SHOT_C2_BIG_TRIANGLES, KIDON_SHOT_C2_SMALL_TRIANGLES, KIDON_COARSE_RECT, PARTICLE_TRIANGLES } from './shipShapes';

// Vertex shader program
const VERTEX_SHADER_SOURCE = `
attribute vec4 aVertexPosition;

uniform mat4 uCameraMatrix;
uniform mat4 uModelSpecificMatrix;
varying vec4 vVertexPosition;

void main() {
vVertexPosition = aVertexPosition;
gl_Position = uCameraMatrix * uModelSpecificMatrix * aVertexPosition;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision lowp float;

uniform lowp vec4 uColor1; 
uniform lowp vec4 uColor2; 
uniform lowp vec4 uColor3; 
varying vec4 vVertexPosition;

void main() {
    const lowp float laserBorder = 3500.0 / 4.0 / 2.0;
    const lowp float laserBorder1 = laserBorder / 3.0;
    lowp float y = abs(vVertexPosition.y);
    if (y < laserBorder1) {
        lowp float mixValue = (laserBorder1 - y) / laserBorder1;
        gl_FragColor = mix(uColor2, uColor1, mixValue);
    } else {
        y -= laserBorder1;
        lowp float mixValue = ((laserBorder - laserBorder1) - y) / (laserBorder - laserBorder1);
        gl_FragColor = mix(uColor3, uColor2, clamp(mixValue, 0.0, 1.0));
    }
}
`
interface Color {
	r: number;
	g: number;
	b: number;
	a: number;
}
interface AttribLocations {
	vertexPosition: number;
}

interface UniformLocations {
	cameraMatrix: WebGLUniformLocation;
	modelSpecificMatrix: WebGLUniformLocation;
	color1: WebGLUniformLocation;
	color2: WebGLUniformLocation;
	color3: WebGLUniformLocation;
}

interface ProgramInfo {
	program: WebGLProgram;
	attribLocations: AttribLocations;
	uniformLocations: UniformLocations;
}

type BufferWithCount = { buffer: WebGLBuffer, count: number };
type EntityBufferMap = Map<EntityType, BufferWithCount>;
type RenderableBufferMap = Map<RenderableType, BufferWithCount>;

interface Buffers {
	entityBuffers: EntityBufferMap;
	renderableBuffers: RenderableBufferMap;
	grid: BufferWithCount;
	stars: BufferWithCount;
	margin: BufferWithCount;
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

function getIdleShipColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	switch (entity.color) {
		case EntityColor.Red:
			color1.r = color2.r = color3.r = 1;
			color1.g = color2.g = color3.g = 0;
			color1.b = color2.b = color3.b = 0;
			color1.a = color2.a = color3.a = 1;
			break;
		case EntityColor.Blue:
			color1.r = color2.r = color3.r = 0;
			color1.g = color2.g = color3.g = 0;
			color1.b = color2.b = color3.b = 1;
			color1.a = color2.a = color3.a = 1;
			break;
		default:
			throw new Error("Unknown color");
	}
}

function getMovingShipColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	switch (entity.color) {
		case EntityColor.Red:
			color1.r = color2.r = color3.r = 0.7;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 0.5;
			color1.a = color2.a = color3.a = 1;
			break;
		case EntityColor.Blue:
			color1.r = color2.r = color3.r = 0.5;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 0.7;
			color1.a = color2.a = color3.a = 1;
			break;
		default:
			throw new Error("Unknown color");
	}
}

function getStartupShipColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	switch (entity.color) {
		case EntityColor.Red:
			color1.r = color2.r = color3.r = 1;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 0.5;
			color1.a = color2.a = color3.a = 1;
			break;
		case EntityColor.Blue:
			color1.r = color2.r = color3.r = 0.5;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 1;
			color1.a = color2.a = color3.a = 1;
			break;
		default:
			throw new Error("Unknown color");
	}	
}

function getHitstunShipColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	color1.r = color2.r = color3.r = 1;
	color1.g = color2.g = color3.g = 1;
	color1.b = color2.b = color3.b = 1;
	color1.a = color2.a = color3.a = 1;
}

function getBlockstunShipColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	switch (entity.color) {
		case EntityColor.Red:
			color1.r = color2.r = color3.r = 1;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 0.5;
			color1.a = color2.a = color3.a = 1;
			break;
		case EntityColor.Blue:
			color1.r = color2.r = color3.r = 0.5;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 1;
			color1.a = color2.a = color3.a = 1;
			break;
		default:
			throw new Error("Unknown color");
	}	
}

function getWarpShipColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	color1.r = color2.r = color3.r = 0;
	color1.g = color2.g = color3.g = 1.0;
	color1.b = color2.b = color3.b = 0;
	color1.a = color2.a = color3.a = 1;
}

type EntityColorHandler = { (x: Entity, color1: Color, color2: Color, color3: Color): void };
type RenderableColorHandler = { (x: Renderable, color1: Color, color2: Color, color3: Color): void };
const SHIP_COLOR_HANDLER_MAP = (() => {
	let map = new Map<EntityState, EntityColorHandler>();
	map.set(EntityState.Idle, getIdleShipColor);
	map.set(EntityState.Recovery, getMovingShipColor);
	map.set(EntityState.Moving, getMovingShipColor);
	map.set(EntityState.Startup, getStartupShipColor);
	map.set(EntityState.Active, getStartupShipColor);
	map.set(EntityState.Hitstun, getHitstunShipColor);
	map.set(EntityState.Blockstun, getBlockstunShipColor);
	map.set(EntityState.Warp, getWarpShipColor);
	return map;
})();
assertDefinedForAllEnum(SHIP_COLOR_HANDLER_MAP, EntityState);

function getShipColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	SHIP_COLOR_HANDLER_MAP.get(getEntityState(entity))!(entity, color1, color2, color3);
}

function getShotColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	switch (entity.color) {
		case EntityColor.Neutral:
			color1.r = color2.r = color3.r = 1;
			color1.g = color2.g = color3.g = 1;
			color1.b = color2.b = color3.b = 1;
			color1.a = color2.a = color3.a = 1;
			break;
		case EntityColor.Red:
			color1.r = color2.r = color3.r = 1;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 0.5;
			color1.a = color2.a = color3.a = 1;
			break;
		case EntityColor.Blue:
			color1.r = color2.r = color3.r = 0.5;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 1;
			color1.a = color2.a = color3.a = 1;
			break;
		case EntityColor.Purple:
			color1.r = color2.r = color3.r = 1;
			color1.g = color2.g = color3.g = 0.5;
			color1.b = color2.b = color3.b = 1;
			color1.a = color2.a = color3.a = 1;
			break;
		default:
			throw new Error("Unknown color");
	}
}

function getLaserShotColor(entity: Entity, color1: Color, color2: Color, color3: Color): void {
	const alpha = entity.collisionSide == CollisionSide.None ? (entity.framesToStateChange / getFadeFrames(entity.type) * 1.0) : 1.0;	
	switch (entity.color) {
		case EntityColor.Blue:
		case EntityColor.Red:
		case EntityColor.Purple:
			color1.r = entity.color !== EntityColor.Blue ? 1 : 0.5;
			color1.g = 0.5;
			color1.b = entity.color !== EntityColor.Red ? 1 : 0.5;
			color1.a = alpha;
			color2.r = entity.color !== EntityColor.Blue ? 1 : 0;
			color2.g = 0;
			color2.b = entity.color !== EntityColor.Red ? 1 : 0;
			color2.a = alpha / 2;
			color3.r = entity.color !== EntityColor.Blue ? 1 : 0;
			color3.g = 0;
			color3.b = entity.color !== EntityColor.Red ? 1 : 0;
			color3.a = 0;			
			break;
		default:
			throw new Error("Unknown color");
	}
}

function getParticleColor(rend: Renderable, color1: Color, color2: Color, color3: Color): void
{
	const m1 = rend.remainingFrames;
	const m2 = rend.totalFrames - rend.remainingFrames;
	const d = rend.totalFrames;
	let r1 = 0, g1 = 0, b1 = 0, a1 = 0, r2 = 0, g2 = 0, b2 = 0, a2 = 0;
	switch (rend.type) {
		case RenderableType.WhiteExplosionParticle:
			r1 = g1 = b1 = 1;
			a1 = 0.8;
			r2 = 1;
			g2 = 0.8;
			b2 = 0;
			a2 = 0;
			break;
		case RenderableType.BlueExplosionParticle:
		case RenderableType.RedExplosionParticle:
			r1 = g1 = b1 = 0;
			r2 = g2 = b2 = 0;
			a1 = 1;
			a2 = 0;
			if (rend.type === RenderableType.BlueExplosionParticle)
				b1 = b2 = 1;
			else
				r1 = r2 = 1;
			break;
		case RenderableType.ThrustParticle:
			r1 = r2 = 1;
			b1 = b2 = 0;
			g1 = 0.8;
			g2 = 0;
			a1 = 1;
			a2 = 0;
			break;
	}
	color1.r = color2.r = color3.r = (r1 * m1 + r2 * m2) / d;
	color1.g = color2.g = color3.g = (g1 * m1 + g2 * m2) / d;
	color1.b = color2.b = color3.b = (b1 * m1 + b2 * m2) / d;
	color1.a = color2.a = color3.a = (a1 * m1 + a2 * m2) / d;
}

function getAfterImageColor(renderable: Renderable, color1: Color, color2: Color, color3: Color): void {
	color1.r = color2.r = color3.r = 0;
	color1.g = color2.g = color3.g = 255;
	color1.b = color2.b = color3.b = 0;
	color1.a = color2.a = color3.a = 0.9 * renderable.remainingFrames / WARP_AFTER_IMAGE_TTL_FRAMES;
}

const ENTITY_COLOR_HANDLER_MAP = (() => {
	let map = new Map<EntityType, EntityColorHandler>();
	map.set(EntityType.Ship, getShipColor);
	map.set(EntityType.ShotA1, getShotColor);
	map.set(EntityType.ShotA2, getShotColor);
	map.set(EntityType.ShotB1, getLaserShotColor);
	map.set(EntityType.ShotB2, getLaserShotColor);
	map.set(EntityType.ShotC1Big, getShotColor);
	map.set(EntityType.ShotC1Small, getShotColor);
	map.set(EntityType.ShotC2Big, getShotColor);
	map.set(EntityType.ShotC2Small, getShotColor);
	return map;
})();

const RENDERABLE_COLOR_HANDLER_MAP = new Map<RenderableType, RenderableColorHandler>(
	[[RenderableType.ThrustParticle, getParticleColor],
	 [RenderableType.BlueExplosionParticle, getParticleColor],
	 [RenderableType.RedExplosionParticle, getParticleColor],
	 [RenderableType.WhiteExplosionParticle, getParticleColor],
	 [RenderableType.KidonWarpAfterImage, getAfterImageColor]]);

assertDefinedForAllEnum(ENTITY_COLOR_HANDLER_MAP, EntityType);

function getEntityColor(entity: Entity, color1: Color, color2: Color, color3: Color) {
	return ENTITY_COLOR_HANDLER_MAP.get(entity.type)!(entity, color1, color2, color3);
}

function getRenderableColor(renderable: Renderable, color1: Color, color2: Color, color3: Color) {
	return RENDERABLE_COLOR_HANDLER_MAP.get(renderable.type)!(renderable, color1, color2, color3);
}

function textMetricsHeight(metrics: TextMetrics): number {
	return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
}

const HP = '♥';
const BATT = '⚛';
const WARP = '✥';
const BAR_COUNT = 3;
const BAR_HSEP_RATIO = 1;
const BAR_VSEP_RATIO = 1;
const TITLE_VSEP_RATIO = 1;
const TITLE_RATIO = 0.5;
const COMBO_HITS_RATIO = 0.25;
const MAX_GLOW_FRAMES = 16;

export enum BarType {
	HP,
	BATT,
	WARP
}

export class Renderer {
	readonly gl: WebGLRenderingContext;
	readonly player1Canvas: HTMLCanvasElement;
	readonly player2Canvas: HTMLCanvasElement;
	readonly player1: CanvasRenderingContext2D;
	readonly player2: CanvasRenderingContext2D;
	readonly programInfo: ProgramInfo;
	readonly buffers: Buffers;
	lastDiff: number | null = null;
	fpsDisplayValue: string = "";

	lastPlayerCanvasWidth: number = 0;
	lastPlayerCanvasHeight: number = 0;
	barWidth: number = 0;
	titleFontSize: number = 0;
	winFontSize: number = 0;
	comboFontSize: number = 0;
	hpFontSize: number = 0;
	battFontSize: number = 0;
	warpFontSize: number = 0;
	barSymbolHeight: number = 0;
	titleHeight: number = 0;
	winHeight: number = 0;
	comboHeight: number = 0;
	hpWidth: number = 0;
	battWidth: number = 0;
	warpWidth: number = 0;

	barGlowFrames: number[] = new Array(256).fill(0);
	barLastValue: number[] = new Array(256).fill(0);
	// lastPlayer1Hp: number = 0;
	// lastPlayer2Hp: number = 0;
	// player1HpGlowFrames: number = 0;
	// player2HpGlowFrames: number = 0;
	
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
				color1: this.gl.getUniformLocation(shaderProgram, 'uColor1')!,
				color2: this.gl.getUniformLocation(shaderProgram, 'uColor2')!,
				color3: this.gl.getUniformLocation(shaderProgram, 'uColor3')!,
			},
		};
		this.gl.useProgram(shaderProgram);
		return ret;
	}

	bufferWithCount(vertices: number[]) {
		return {buffer: this.createBuffer(vertices), count: vertices.length / 2};
	}

	createBuffer(vertices: number[]): WebGLBuffer {
		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
		return buffer!;
	}

	createBuffers(): Buffers  {
		const kidonTrianglesBuf = this.bufferWithCount(KIDON_TRIANGLES);
		const particleBuf = this.bufferWithCount(PARTICLE_TRIANGLES);
		let map1 = new Map([[EntityType.Ship, kidonTrianglesBuf],
							[EntityType.ShotA1, this.bufferWithCount(KIDON_SHOT_A1_TRIANGLES)],
							[EntityType.ShotA2, this.bufferWithCount(KIDON_SHOT_A2_TRIANGLES)],
							[EntityType.ShotB1, this.bufferWithCount(KIDON_SHOT_B1_TRIANGLES)],
							[EntityType.ShotB2, this.bufferWithCount(KIDON_SHOT_B2_TRIANGLES)],
							[EntityType.ShotC1Big, this.bufferWithCount(KIDON_SHOT_C1_BIG_TRIANGLES)],
							[EntityType.ShotC1Small, this.bufferWithCount(KIDON_SHOT_C1_SMALL_TRIANGLES)],
							[EntityType.ShotC2Big, this.bufferWithCount(KIDON_SHOT_C2_BIG_TRIANGLES)],
							[EntityType.ShotC2Small, this.bufferWithCount(KIDON_SHOT_C2_SMALL_TRIANGLES)]]);
		let map2 = new Map([[RenderableType.ThrustParticle, particleBuf],
							[RenderableType.RedExplosionParticle, particleBuf],
							[RenderableType.BlueExplosionParticle, particleBuf],
							[RenderableType.WhiteExplosionParticle, particleBuf],
							[RenderableType.KidonWarpAfterImage, kidonTrianglesBuf]]);
		assertDefinedForAllEnum(map1, EntityType);
		assertDefinedForAllEnum(map2, RenderableType);

		return {
			entityBuffers: map1,
			renderableBuffers: map2,
			grid: this.bufferWithCount(GRID_LINES),
			stars: this.bufferWithCount(STAR_TRIANGLES),
			margin: this.bufferWithCount(MARGIN_TRIANGLES),
		};
	}
	
	clear() {
		this.gl.enable(this.gl.BLEND);  
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);  
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
		this.gl.clearDepth(1.0);                 // Clear everything
		// this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
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
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.stars.buffer);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniform4f(this.programInfo.uniformLocations.color1, 0.8, 0.8, 0.8, 1);
		this.gl.uniform4f(this.programInfo.uniformLocations.color2, 0.8, 0.8, 0.8, 1);
		this.gl.uniform4f(this.programInfo.uniformLocations.color3, 0.8, 0.8, 0.8, 1);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, this.buffers.stars.count);
	}

	renderGrid() {
		this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, mat4.create());
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.grid.buffer);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniform4f(this.programInfo.uniformLocations.color1, 0.3, 0.3, 0.3, 1);
		this.gl.uniform4f(this.programInfo.uniformLocations.color2, 0.8, 0.8, 0.8, 1);
		this.gl.uniform4f(this.programInfo.uniformLocations.color3, 0.8, 0.8, 0.8, 1);
		this.gl.drawArrays(this.gl.LINES, 0, this.buffers.grid.count);
	}

	renderMargin() {
		this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, mat4.create());
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.margin.buffer);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniform4f(this.programInfo.uniformLocations.color1, 0.5, 0.25, 0.5, 1);
		this.gl.uniform4f(this.programInfo.uniformLocations.color2, 0.5, 0.25, 0.5, 1);
		this.gl.uniform4f(this.programInfo.uniformLocations.color3, 0.5, 0.25, 0.5, 1);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, this.buffers.margin.count);
	}

	posForRenderEntity = vec3.create();
	matrixForRenderEntity = mat4.create();
	scaleVecForRenderEntity = vec3.create();
	axisVecForRenderEntity = vec3.clone([0,0,1]);
	renderEntity(x: number, y: number, angle: number, sizePct: number, bufWithCnt: BufferWithCount,
				 color1: Color, color2: Color, color3: Color) {
		const pos = this.posForRenderEntity;
		const matrix = this.matrixForRenderEntity;
		this.gl.uniform4f(this.programInfo.uniformLocations.color1, color1.r, color1.g, color1.b, color1.a);
		this.gl.uniform4f(this.programInfo.uniformLocations.color2, color2.r, color2.g, color2.b, color2.a);
		this.gl.uniform4f(this.programInfo.uniformLocations.color3, color3.r, color3.g, color3.b, color3.a);
		
		pos[0] = x;
		pos[1] = y;
		mat4.identity(matrix);
		mat4.translate(matrix, matrix, pos);
		mat4.rotate(matrix, matrix, angle * 2 * Math.PI / MAX_INT_ANGLE, this.axisVecForRenderEntity);
		this.scaleVecForRenderEntity[0] = this.scaleVecForRenderEntity[1] = this.scaleVecForRenderEntity[2] = sizePct / 100.0;
		mat4.scale(matrix, matrix, this.scaleVecForRenderEntity);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, bufWithCnt.buffer);
		this.gl.vertexAttribPointer(this.programInfo.attribLocations.vertexPosition, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
		this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelSpecificMatrix, false, matrix);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, bufWithCnt.count);
	}
	
	renderEntities(state: GameState) {
		let color1: Color = {r: 0, g: 0, b: 0, a: 0};
		let color2: Color = {r: 0, g: 0, b: 0, a: 0};
		let color3: Color = {r: 0, g: 0, b: 0, a: 0};
		
		for (let i = 0, l = state.entities.length; i < l; ++i) {
			const entity = state.entities[i];
			getEntityColor(entity, color1, color2, color3);
			this.renderEntity(entity.x, entity.y, entity.angleInt, 100,
							  this.buffers.entityBuffers.get(entity.type)!, color1, color2, color3);
		}
		
		for (let i = 0, l = state.renderables.length; i < l; ++i) {
			const renderable = state.renderables[i];
			getRenderableColor(renderable, color1, color2, color3);
			this.renderEntity(renderable.x, renderable.y, renderable.angleInt, renderable.sizePct,
							  this.buffers.renderableBuffers.get(renderable.type)!, color1, color2, color3);
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
		this.titleFontSize = this.getBestFontSize('Player 12', canvas.width * TITLE_RATIO);
		this.winFontSize = min(min(this.getBestFontSize('Lose', canvas.width),
								   this.getBestFontSize('Win', canvas.width)),
							   this.getBestFontSize('Draw', canvas.width));
		this.comboFontSize = this.getBestFontSize('000 hits', canvas.width * COMBO_HITS_RATIO);
		this.hpFontSize = this.getBestFontSize(HP, this.barWidth);
		this.battFontSize = this.getBestFontSize(BATT, this.barWidth);
		this.warpFontSize = this.getBestFontSize(WARP, this.barWidth);
		this.barSymbolHeight = 0;
		ctx.font = this.hpFontSize.toString() + 'px monospace';
		let hpMeasure = ctx.measureText(HP);
		this.barSymbolHeight = Math.max(textMetricsHeight(hpMeasure), this.barSymbolHeight);
		ctx.font = this.battFontSize.toString() + 'px monospace';
		let battMeasure = ctx.measureText(BATT);
		this.barSymbolHeight = Math.max(textMetricsHeight(battMeasure), this.barSymbolHeight);
		ctx.font = this.warpFontSize.toString() + 'px monospace';
		let warpMeasure = ctx.measureText(WARP)
		this.barSymbolHeight = Math.max(textMetricsHeight(warpMeasure), this.barSymbolHeight);
		ctx.font = this.titleFontSize.toString() + 'px monospace';
		this.titleHeight = textMetricsHeight(ctx.measureText('Player 12'));
		ctx.font = this.winFontSize.toString() + 'px monospace';
		this.winHeight = max(max(textMetricsHeight(ctx.measureText('Lose')),
								 textMetricsHeight(ctx.measureText('Win'))),
							 textMetricsHeight(ctx.measureText('Draw')));
		this.hpWidth = hpMeasure.width;
		this.battWidth = battMeasure.width;
		this.warpWidth = warpMeasure.width;
		this.lastPlayerCanvasWidth = canvas.width;
		this.lastPlayerCanvasHeight = canvas.height;
	}

	handleBarRendering(barType: BarType, isPlayer2: boolean, entity: Entity) {
		const BAR_TYPE_COUNT = 3;

		const ctx = isPlayer2 ? this.player2 : this.player1;
		const canvas = isPlayer2 ? this.player2Canvas : this.player1Canvas;
		const barTop = max(this.titleHeight, this.comboHeight) * (1 + TITLE_VSEP_RATIO);
		const barBottom = canvas.height - (1 + BAR_VSEP_RATIO) * this.barSymbolHeight;
		const barOffset = (isPlayer2 ? BAR_TYPE_COUNT : 0) + barType;

		if (this.barGlowFrames[barOffset] > 0) {
			--this.barGlowFrames[barOffset];
		}
		const curValue = barType === BarType.HP ? entity.hp : barType === BarType.BATT ? entity.batt : entity.warp;
		const maxValue = barType === BarType.HP ? getMaxHp(entity.type) : barType === BarType.BATT ? getMaxBatt(entity.type) : getMaxWarp(entity.type);
		if (this.barLastValue[barOffset] != curValue &&
			!(barType === BarType.BATT && curValue > this.barLastValue[barOffset]) &&
			!(barType === BarType.WARP && curValue > this.barLastValue[barOffset])) {
			this.barGlowFrames[barOffset] = MAX_GLOW_FRAMES;
		}
		this.barLastValue[barOffset] = curValue;

		switch (barType) {
			case BarType.HP:
				ctx.fillStyle = ('rgb(' +
					'0' +
					',' +
					(128 + Math.floor(127 * this.barGlowFrames[barOffset] / MAX_GLOW_FRAMES)).toString() +
					',' +
					'0' + 
					')');
				break;
			case BarType.BATT:
				ctx.fillStyle = ('rgb(' +
					(194 + Math.floor(36 * this.barGlowFrames[barOffset] / MAX_GLOW_FRAMES)).toString() +
					',' +
					(126 + Math.floor(28 * this.barGlowFrames[barOffset] / MAX_GLOW_FRAMES)).toString() +
					',' +
					'0' +
					')');
				break;
			case BarType.WARP:
				ctx.fillStyle = ('rgb(' +
					'0' +
					',' +
					(128 + Math.floor(127 * this.barGlowFrames[barOffset] / MAX_GLOW_FRAMES)).toString() +
					',' +
					(128 + Math.floor(127 * this.barGlowFrames[barOffset] / MAX_GLOW_FRAMES)).toString() + 
					')');
				break;
			default:
				throw new Error("Unknown BarType");
		}
		ctx.fillRect(this.barWidth * barType * (BAR_HSEP_RATIO + 1),
					 barTop + (barBottom - barTop) * (maxValue - curValue) / maxValue,
					 this.barWidth,
					 (barBottom - barTop) * curValue / maxValue);
	}
	
	renderSinglePlayerCanvas(state: GameState, isPlayer2: boolean, localPlayerHandle: number) {
		if (localPlayerHandle !== 1 && localPlayerHandle !== 2) {
			throw new Error("unexpected localPlayerHandle in renderSinglePlayerCanvas");
		}
		const localIsPlayer2 = localPlayerHandle === 1;
		const ctx = isPlayer2 ? this.player2 : this.player1;
		const canvas = isPlayer2 ? this.player2Canvas : this.player1Canvas;
		const width = canvas.width, height = canvas.height;
		const entity = state.entities[isPlayer2 ? PLAYER2_INDEX : PLAYER1_INDEX];
		const maxHp = getMaxHp(entity.type);
		const hp = entity.hp;
		ctx.font = this.titleFontSize.toString() + 'px monospace';
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = 'white';
		if (state.winScreen !== WinScreen.None) {
			ctx.font = this.winFontSize.toString() + 'px monospace';
			switch (state.winScreen) {
				case WinScreen.Player1:
					ctx.fillText(localIsPlayer2 ? 'Lose' : 'Win', 0, this.winHeight);
					break;
				case WinScreen.Player2:
					ctx.fillText(localIsPlayer2 ? 'Win' : 'Lose', 0, this.winHeight);
					break;
				case WinScreen.Draw:
					ctx.fillText('Draw', 0, this.winHeight);
					break;
				default:
					throw new Error("Unknown win screen value");
			}
			return;
		}
		ctx.fillText(isPlayer2 ? 'Player 2' : 'Player 1', 0, this.titleHeight);
		ctx.fillText((isPlayer2 ? state.player2CurrentComboHits : state.player1CurrentComboHits).toString() + " hits", canvas.width * (1 - COMBO_HITS_RATIO), this.titleHeight);
		if (!isPlayer2) {
			ctx.font = '10px monospace';
			ctx.fillText(this.fpsDisplayValue, 0, canvas.height);
		}
		ctx.font = this.hpFontSize.toString() + 'px monospace';
		ctx.fillText(HP, this.barWidth / 2 - this.hpWidth / 2, height);
		ctx.font = this.battFontSize.toString() + 'px monospace';
		ctx.fillText(BATT, this.barWidth * (1 + BAR_HSEP_RATIO) + this.barWidth / 2 - this.battWidth / 2, height);
		ctx.font = this.warpFontSize.toString() + 'px monospace';
		ctx.fillText(WARP, this.barWidth * (2 + 2 * BAR_HSEP_RATIO) + this.barWidth / 2 - this.warpWidth / 2, height);
		this.handleBarRendering(BarType.HP, isPlayer2, entity);
		this.handleBarRendering(BarType.BATT, isPlayer2, entity);
		this.handleBarRendering(BarType.WARP, isPlayer2, entity);	
	}
		
	renderPlayerCanvas(state: GameState, localPlayerHandle: number) {
		this.recalculateFontSizes();
		this.renderSinglePlayerCanvas(state, false, localPlayerHandle);
		this.renderSinglePlayerCanvas(state, true, localPlayerHandle);
	}
	
	render(state: GameState, localPlayerHandle: number) {
		// if localPlayerHandle is passed to other functions except for renderPlayerCanvas,
		// it is likely we're doing something wrong.
		this.clear();
		this.setupCameraMatrix(state);
		// this.renderGrid();
		this.renderStars();
		this.renderMargin();
		this.renderEntities(state);
		this.renderPlayerCanvas(state, localPlayerHandle);
	}
}
