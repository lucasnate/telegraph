import { SavedChecksum } from '../types';

export class ChecksumVerifier {
	private checksums: SavedChecksum[] = [];
	private lastVerifiedFrame: number = 0;

	add(newChecksums: SavedChecksum[]): boolean {
		for (let newChecksum of newChecksums)
			if (!this.addSingleChecksum(newChecksum))
				return false;
		this.cleanOldChecksums();
		return true;
	}

	private addSingleChecksum(newChecksum: SavedChecksum): boolean {
		if (newChecksum.frame < this.lastVerifiedFrame)
			return true;
		for (let checksum of this.checksums) {
			if (checksum.frame === newChecksum.frame) {
				this.lastVerifiedFrame = newChecksum.frame;
				return checksum.checksum === newChecksum.checksum;
			}
		}
		this.checksums.push(newChecksum);
		return true;
	}

	private cleanOldChecksums() {
		this.checksums = this.checksums.filter(checksum => checksum.frame > this.lastVerifiedFrame);
	}
}
