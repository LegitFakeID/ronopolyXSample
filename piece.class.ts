import { ServerSyncValue } from "shared/Util/synchronisedValues";
import { Board } from "./board.class";

const board = Board.getInstance();

export class Piece {
	private boardPos: ServerSyncValue<number>;
	private pieceName: ServerSyncValue<string>;

	constructor(key: string) {
		this.boardPos = new ServerSyncValue(0, "pieceBoardPosition", key);
		this.pieceName = new ServerSyncValue("DefaultHat", "pieceName", key);
	}

	public moveTo(tileNumber : number) {}

	public moveBy(amount: number) {
		if (amount === 0) {
			error("Cannot move by 0");
		}
		const startPos = this.boardPos.Get();
		
		const newTile = board.getNextTile(this.boardPos.Get(), amount);
		this.boardPos.Set(board.getTilePosition(newTile));
		return board.getWaypoints(startPos, this.boardPos.Get(), math.sign(amount)as 1 | -1);
	}


	public teleportTo() {}

	public getPosition() {
		return this.boardPos.Get();
	}

	public getTile() {
		return board.getTile(this.boardPos.Get());
	}

	public destroy() {}
}
