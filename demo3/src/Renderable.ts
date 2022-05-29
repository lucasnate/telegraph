export enum RenderableType {
	ThrustParticle,
	WhiteExplosionParticle,
	BlueExplosionParticle,
	RedExplosionParticle,
	KidonWarpAfterImage,
	AyinHelperB1WarpAfterImage
}

export interface Renderable {
	type: RenderableType,
	x: number,
	y: number,
	angleInt: number,
	vx: number,
	vy: number,
	ax: number,
	ay: number,
	remainingFrames: number,
	totalFrames: number,
	sizePct: number
}
