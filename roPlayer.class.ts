import { ServerSyncValue } from "shared/Util/synchronisedValues";
import { InventoryDeck } from "./inventoryDeck.class";
import { Money } from "./money.class";
import { Piece } from "./piece.class";
import { HttpService, Players } from "@rbxts/services";
import { RunStartAction } from "./turnStartAction.class";
import { settings } from "shared/config/settings";
import { botInputCollection } from "server/Classes/botInputs/botInputCollection";
import { Remotes } from "shared/Events";
import { PlayerInputHandler } from "./playerInputHandler.class";
import { VisualsHandler } from "./visualsHandler.class";
import { DecisionMessages } from "shared/config/decisionMessages";

export class RoPlayer {
	public roPlayerID: string;
	private player: Player | undefined;
	private playerId: ServerSyncValue<string>;
	private isBot: ServerSyncValue<boolean>;
	private inJail: ServerSyncValue<boolean>;
	public onTurn: ServerSyncValue<boolean>;
	private playerInputHandler = PlayerInputHandler.getInstance()
	private visualsHandler = VisualsHandler.getInstance()
	private team: number | undefined
	
	public Piece: Piece;
	public InventoryDeck: InventoryDeck;
	public Money: Money;



	constructor(player?: Player) {
		//warn("creating roPlayer");
		this.roPlayerID = HttpService.GenerateGUID(false);
		this.isBot = new ServerSyncValue(player === undefined, "isBot", this.roPlayerID);
		this.inJail = new ServerSyncValue(false, "inJail", this.roPlayerID);
		this.onTurn = new ServerSyncValue(false, "onTurn", this.roPlayerID);
		this.player = player;
		if (player !== undefined) {
			this.playerId = new ServerSyncValue(tostring(player.UserId), "playerId", this.roPlayerID);
		} else {
			this.playerId = new ServerSyncValue("", "playerId", this.roPlayerID);
		}
		this.Piece = new Piece(this.roPlayerID);
		this.InventoryDeck = new InventoryDeck(this.isBot, this.playerId);
		this.Money = new Money(2000000, this.roPlayerID); //default starting money

	}
	
	public getTeam() {
		return this.team
	}

	public isTeam(number: number) {
		return this.team === number
	}

	public setTeam(team: number) {
		this.team = team
		print("i am: "+ this.roPlayerID + " and my team is: " + this.team)
	}

	public runTurn() {
		//print("running turn");
		return this.InventoryDeck.runPlayCardsWithCircumstance(this)
			.andThen(()=> {return RunStartAction(this)})
			.andThen(() => {
				return this.InventoryDeck.runPlayCardsWithCircumstance(this);
			});
		//possibly should be finally or there should be a separate finally.
	}

	public isBotPastPlayer(playerId: string) {
		return this.isBot.Get() && this.playerId.Get() === playerId;
	}

	public getPlayerID() {
		return this.playerId.Get();
	}

	public isVacantBot() {
		return this.isBot.Get() && this.playerId.Get() === "";
	}

	public botify() {
		this.isBot.Set(true);
		this.player = undefined;
	}

	public rePossess(player: Player) {
		//print("repossessing");
		this.isBot.Set(false);
		this.playerId.Set(tostring(player.UserId));
		this.player = player;
		//print("repossessed");
	}

	public getInput(decisionType : string, ...args : unknown[]) : Promise<unknown> {
		//print("getting input");
		const timerTime = 10

		const timerVisual = this.visualsHandler.Play("PlayerTimerVisual", Players.GetPlayers(), this.roPlayerID, timerTime);
		const doingSomethingVisual = this.visualsHandler.Play("DoingSomethingVisual", Players.GetPlayers().filter((player) => tostring(player.UserId) !== this.playerId.Get()), DecisionMessages[decisionType as keyof typeof DecisionMessages]);

		let inputPromise
		if (this.isBot.Get()) {
			inputPromise = botInputCollection.newInstance(decisionType).getInput(this, false, args);
		}else{
			inputPromise = this.playerInputHandler.GetInput(decisionType, this.player!, args);
		}

		const race = Promise.race([
			inputPromise.andThen((input) => { task.spawn(timerVisual[1]) ; print("input over"); return input }), 
			Promise.delay(timerTime).andThen(() => {
				//print("timer ran out");
				return botInputCollection.newInstance(decisionType).getInput(this, true, args);
			})
		]).finally(() => {doingSomethingVisual[1]()})

		return race;
	}

	public imprison() {
		this.inJail.Set(true);
	}

	public release() {
		return this.inJail.Set(false);
	}

	public currentlyBot(){
		return this.isBot.Get();
	}
}
