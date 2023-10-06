import { RoPlayer } from "./roPlayer.class";
import { Players } from "@rbxts/services";
import { Janitor } from "@rbxts/janitor";
import { Board } from "./board.class";
import { Remotes } from "shared/Events";

const WAIT_TIME_FOR_PLAYERS = 10;
const ALL_PLAYERS_RETRY_DELAY = 0.5;

export class GameHandler {
	private static instance: GameHandler;
	private players = new Array<RoPlayer>();
	private joinData = {} as Map<string, unknown>;
	private TargetGameSize = 0;
	private InitialBotCount = 0;
	private board : Board;
	private RoplayersRequested = Remotes.Server.Get("requestRoplayers");
    private sendRoplayers = Remotes.Server.Get("sendRoplayers");
	private gameStarted = false;
	private gameRunning = false;
	private turnIndex = 0;
	private direction: 1 | -1 = -1; 
	 

	private constructor() {this.board = Board.getInstance()}

	public static getInstance(): GameHandler {
		if (!GameHandler.instance) {
			GameHandler.instance = new GameHandler();
			GameHandler.instance.connectPlayerToClientEvents()
		}
	
		return GameHandler.instance;
	}

	private connectPlayerToClientEvents() {
		this.RoplayersRequested.Connect((player: Player) => {
			while (!this.gameStarted) {
				task.wait();
			}
			this.sendRoplayers.SendToPlayer(player, this.players.map((player) => player.roPlayerID));
		});
	}

	public Start() {
		//print("GameHandler.Start()");

		this.board.Start();

		const PlayerAddedJanitor = new Janitor();

		Players.GetPlayers().forEach((player) => {
			this.AddPlayer(player);
		});

		PlayerAddedJanitor.Add(
			Players.PlayerAdded.Connect((player) => {
				this.AddPlayer(player);
			}),
		);

		const AllPlayersInGame = Promise.promisify(() => {
			if (Players.GetPlayers().size() === this.TargetGameSize - this.InitialBotCount) {
				return true;
			} else {
				error("Not all players in game");
			}
		});

		Promise.try(() => {
			while (this.joinData.isEmpty()) {
				task.wait();
			}
			//print("Join data received");
			return this.joinData;
		})
			.andThen((joinData) => {
				this.InitialBotCount = joinData.get("Bots") as number;
				this.TargetGameSize = joinData.get("Players") as number + this.InitialBotCount;
			})
			.andThen(() => {
				this.CreateBots(this.InitialBotCount);
				return Promise.retryWithDelay(
					AllPlayersInGame,
					math.ceil(WAIT_TIME_FOR_PLAYERS / ALL_PLAYERS_RETRY_DELAY),
					ALL_PLAYERS_RETRY_DELAY,
				);
			})
			.finally(() => {
				PlayerAddedJanitor.Destroy();
				this.CreateBots(this.TargetGameSize - (Players.GetPlayers().size() + this.InitialBotCount));
				Players.PlayerAdded.Connect((player) => {
					this.PossessBot(player);
				});
				Players.PlayerRemoving.Connect((player) => {
					this.BotifyPlayer(player);
				});

				this.setTeams();

				return;
			})
			.finallyCall(() => this.startGame());
	}

	private getRoplayerFromUserId(userId: string) : RoPlayer | undefined{
		return this.players.find((player) => player.getPlayerID() === userId);
	}
	
	private getAllPermanentBots() : Array<RoPlayer> {
		return this.players.filter((player) => player.currentlyBot() && player.getPlayerID() === "");
	}

	private setTeams() {
		const teamSize = this.joinData.get("teamSize") as number;
		const teams = this.joinData.get("teams") as Array<Array<string>>;
		const noTeams = ((this.joinData.get("Players") as number) + (this.joinData.get("Bots") as number))/ teamSize;
		const bots = this.getAllPermanentBots();
		let teamIndex = 0;


		for (let i = 0; i < noTeams; i++) {
			if (i < teams.size() && teams[i].size() === teamSize) { //player team
				//assign all players
				for (const playerId of teams[i]) {
					const roplayer = this.getRoplayerFromUserId(playerId) as RoPlayer;
					roplayer.setTeam(teamIndex);
				}
				
			} else if (i < teams.size() && teams[i].size() < teamSize) { //mix team
				//asign to current players
				for (const playerId of teams[i]) {
					const roplayer = this.getRoplayerFromUserId(playerId) as RoPlayer;
					roplayer.setTeam(teamIndex);
				}

				//assign remaining as bots
				const noBots = teamSize - teams[i].size()
				for (let j = 0; j < noBots; j++) {
					const bot = bots.pop() as RoPlayer;
					bot.setTeam(teamIndex);
				}
			} else { //bot team
				//assign all bots
				for (let j = 0; j < teamSize; j++) {
					const bot = bots.pop() as RoPlayer;
					bot.setTeam(teamIndex);
				}
			}

			teamIndex++;
		}
	}

	private startGame() {
		print("Game Started");
		print("Players: " + this.players.size());
		print("Bots: " + this.InitialBotCount);
		print("Total: " + this.TargetGameSize);
		print(this.players);

		this.gameStarted = true;
		this.gameRunning = true;

		while (this.gameRunning ){
			print("Starting Turn");
			this.RecursiveTurn();
		}
	}

	private RecursiveTurn() {
		const player = this.getCurrentPlayer();
		
		player.onTurn.Set(true);

		player.Money.gain(100);

		player
			.runTurn()
			.finally(() => this.checkForContinuation())
			.finally(() => {
				print("Turn Ended");
				player.onTurn.Set(false);
				this.AdvanceToNextPlayer();
			}).await();
			

	}

	private CreateBots(InitialBotCount: number) {
		for (let i = 0; i < InitialBotCount; i++) {
			const bot = new RoPlayer();
			this.players.push(bot);
		}
	}

	private getPossesableBot(playerId: string) {
		for (const RoPlayer of this.players) {
			if (RoPlayer.isBotPastPlayer(playerId)) {
				return RoPlayer;
			}
		}
		for (const RoPlayer of this.players) {
			if (RoPlayer.isVacantBot()) {
				return RoPlayer;
			}
		}
	}

	private PossessBot(player: Player) {
		const bot = this.getPossesableBot(tostring(player.UserId));
		if (bot) {
			bot.rePossess(player);
		} else {
			//kick the player from the game
			player.Kick("No slots available! Did you attempt to join twice?");
		}
	}

	private getOwnedBot(playerId: string) {
		for (const RoPlayer of this.players) {
			if (RoPlayer.isBotPastPlayer(playerId)) {
				return RoPlayer;
			}
		}
	}

	private BotifyPlayer(player: Player) {
		const bot = this.getOwnedBot(tostring(player.UserId));
		if (bot) {
			bot.botify();
		}
	}

	private AddPlayer(player: Player) {
		print("Player Added");
		if (this.joinData.isEmpty()) {
			if (player.GetJoinData() && player.GetJoinData().TeleportData !== undefined) {
				this.joinData = player.GetJoinData().TeleportData as Map<string, unknown>;
			} else {
				this.joinData = new Map<string, unknown>();
				this.joinData.set("Players", 1);
				this.joinData.set("Bots", 3);
				this.joinData.set("teamSize", 1);
				this.joinData.set("teams", [["-1"]]);
			}
		}
		const roPlayer = new RoPlayer(player);
		this.players.push(roPlayer);
	}

	public GetPlayerCount() {}

	private AdvanceToNextPlayer() {
		this.turnIndex += this.direction;

		if (this.turnIndex >= this.players.size()) {
			this.turnIndex = 0;
		}

		if (this.turnIndex < 0) {
			this.turnIndex = this.players.size()-1;
		}
	}

	public getCurrentPlayer(): RoPlayer {
		return this.players[this.turnIndex];
	}

	public reverseOrder() {
		this.direction *= -1;
	}

	private checkForContinuation() {
		return new Promise<void>((resolve, reject) => {
			resolve();
		});
	}
}
