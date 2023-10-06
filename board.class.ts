import { GameTile } from "./tile/subclasses/property/subclasses/GameTile.class";
import { Tile } from "./tile/tile.class";
import { TileCollection } from "./tile/tileCollection";
import * as server from "@rbxts/services";
import Object from "@rbxts/object-utils";
import { Group } from "./group/Group.class";
import { PurchasableTile } from "./tile/subclasses/property/purchasableTile.class";
import { settings } from "shared/config/settings";
import { TycoonGroup } from "./group/subclasses/TycoonGroup.class";
import { GameCard } from "./card/propertyCard/gameCard.class";
import { HttpService } from '@rbxts/services';

export interface BoardInterface {
	getTile(index: number): Tile;
	getTilePosition(tile: Tile): number;
}

export class Board implements BoardInterface {
	private static instance: Board;
	private tiles = [] as Tile[];
	private bloxiedTile = undefined as  GameTile | undefined
	private groups = [] as Group[];
	private tycoons: TycoonGroup

	constructor() {
		this.tycoons = TycoonGroup.getInstance();
	}

	public static getInstance(): Board {
		if (!Board.instance) {
			Board.instance = new Board();
		}

		return Board.instance;
	}

	//Add tiles to tiles array, and if purchasable add to group
	public Start() {

		const board = "Board1" //CHANGE THIS

		const boardsFolder = server.ServerStorage.FindFirstChild("Boards") as Folder
		const groupsFolder = boardsFolder.FindFirstChild(board)!.FindFirstChild("Groups") as Folder
		const miscFolder = boardsFolder.FindFirstChild(board)!.FindFirstChild("Misc") as Folder
		const tycoonsFolder = boardsFolder.FindFirstChild(board)!.FindFirstChild("Tycoons") as Folder

		//Add misc tiles
		for (const misc of miscFolder.GetChildren()) {
			this.createTileObject(misc as Model)
		}
		
		//Add game tiles 
		for (const group of groupsFolder.GetChildren()) {
			for (const tileModel of group.GetChildren()) {
				const tileObject = this.createTileObject(tileModel as Model) as PurchasableTile
				this.addToGroup(tileObject, tonumber(group.Name)!, group.GetAttribute("groupName")! as string)
			}
		}

		//Add tycoons
		for (const tycoonModel of tycoonsFolder.GetChildren()) {
			const tycoonObject = this.createTileObject(tycoonModel as Model) as PurchasableTile
			this.addTileToGroup(tycoonObject, this.tycoons)
		}

		//Set prices
		let currPrice = settings.gameTileBasePrice
		for (const group of this.groups) {
			const tiles = group.getTiles()
			for (let i = 0; i < group.getTiles().size(); i++) {
				const card = tiles[i].getCard() 
				card.setPrice(currPrice * (settings.intraGroupPriceMult/group.getTiles().size()) * i)
			}
			currPrice *= settings.intraGroupPriceMult * settings.interGroupPriceMult
		}
	}

	//Add to tiles array and return tile object
	private createTileObject(tileModel : Model) : Tile{
		const index = tonumber(tileModel.Name) as number
		const tileTypeString = server.CollectionService.GetTags(tileModel)[0]
		const tileObject = TileCollection.newInstance(tileTypeString);

		if( tileTypeString === "GameTile" || tileTypeString === "TycoonTile") {
			const gameName = this.GetGameName(tileModel);
			const tile = tileObject as PurchasableTile
			tile.setName(gameName);
		}

		tileObject.setModel(tileModel);

		this.tiles[index] = tileObject;
		tileModel.Parent = server.Workspace.FindFirstChild("Board") as Folder
		return tileObject;
	}

	public getGroupFromGameName(gameName: string) {
		for (const group of this.groups) {
			for (const tile of group.getTiles()) {
				if (tile.getName() === gameName) {
					return [group, tile];
				}
			}
		}
		//check tycoons
		for (const tile of this.tycoons.getTiles()) {
			if (tile.getName() === gameName) {
				return [this.tycoons, tile];
			}
		}
		return undefined;
	}

	public getGameGroupAndHasBloxyFromName(gameName: string) : string[]  {
		const group = this.getGroupFromGameName(gameName);
		if (group) {
			if (group[0].getName() === "Tycoons") {
				return ["Tycoons", "false"];
			}
			const tile = group[1] as GameTile;
			let groupName = group[0].getName();
			if (groupName === undefined) {
				groupName = "undefined";
			}
			return [groupName, tile.getCurrentlyHasBloxy() ? "T" : "F"];
		}
		return ["undefined", "undefined"];
	}


	public addTileToGroup(tile: PurchasableTile, group: Group) {
		const tileTable = group.getTiles();
        tileTable.push(tile);
        tileTable.sort((a, b) => this.getTilePosition(a) < this.getTilePosition(b) );
		group.setTiles(tileTable);
    }
	
	//Add tile to group and create group if group undefined
	private addToGroup(tileObject : PurchasableTile, groupIndex : number, name: string){
		if (this.groups[groupIndex] === undefined){
			this.groups[groupIndex] = new Group(name)
		}

		this.addTileToGroup(tileObject, this.groups[groupIndex])
	}

	public getTile(index: number) {
		return this.tiles[index];
	}

	public getTileGroup(tile: PurchasableTile) {
		for (const group of this.groups) {
			if (group.getTiles().includes(tile)) {
				return group;
			}
		}
		return undefined;
	}

	public getTilePosition(tile: Tile) {
		return this.tiles.indexOf(tile);
	}

	public getTycoonGroup() {
		return this.tycoons;
	}

	public getNextTile(currentPos: number, Steps: number) {
		const nextPos = currentPos + Steps;
		let tilePos
		if (nextPos >= this.tiles.size()) {
			tilePos = nextPos % this.tiles.size();
		} else if  (nextPos < 0) {
			tilePos = this.tiles.size() + nextPos; 
		} else{
			tilePos = nextPos;
		}
		// print(this.tiles.size())
		// print(this.tiles[0])

		// print(tilePos)
		// print(currentPos)
		// print(Steps)
		return this.tiles[tilePos];
	}

	public getWaypoints(startIndex: number, EndIndex: number, direction: 1 | -1) {
		const waypoints = [] as Vector3[];
		let index = startIndex;
		while (index !== EndIndex) {
			index += direction;
			if (index >= this.tiles.size()) {
				index = 0;
			} else if (index < 0) {
				index = this.tiles.size() - 1;
			}
			waypoints.push(this.tiles[index].landingPosition);
		}

		return waypoints;
	}

	public setBloxiedTile(tile: Tile) {
		if (tile instanceof GameTile) {

			if (this.bloxiedTile !== undefined){
				const pastBloxiedCard = this.bloxiedTile.getCard() as GameCard
				pastBloxiedCard.removeBloxy()
			}

			this.bloxiedTile = tile;

			const card = tile.getCard() as GameCard
			card.addBloxy();
		}
	}

	private GetGameName(tileModel: Model) {
		return HttpService.GenerateGUID(false); //! REPLACE THIS with name fromm list of game ids passed in.
	}
}
