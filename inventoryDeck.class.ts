import { ActionCard } from "./card/actionCard/actionCard.class";
import { HoldCard } from "./card/actionCard/holdCard/holdCard.class";
import { GameCard } from "./card/propertyCard/gameCard.class";
import { RoPlayer } from "./roPlayer.class";
import { Players } from "@rbxts/services";
import { PropertyCard } from "./card/propertyCard/propertyCard.class"
import { Remotes } from 'shared/Events';
import { ServerSyncValue } from "shared/Util/synchronisedValues";

export class InventoryDeck {
	private propertyCards = [] as PropertyCard[];
	private holdCards = [] as HoldCard[];
	private updateClientCardsEvent = Remotes.Server.Get("updateClientCards")

	private isBot: ServerSyncValue<boolean>;
	private userId: ServerSyncValue<string>;

	constructor(isBot: ServerSyncValue<boolean>, userId: ServerSyncValue<string>) {
		this.isBot = isBot;
		this.userId = userId;
	}

	public updateClientCards(cardType: "property" | "hold", cards: PropertyCard[] | HoldCard[]) {
		if (this.isBot.Get()) {
			return;
		}

		const serializedCards = [] as string[];
		//loop over all cards and call .serialize() on them
		//then push the serialized string to serializedCards
		for (const card of cards) {
			serializedCards.push(card.serialize());
		}

		//fire the event to update the client with the new serialized cards
		this.updateClientCardsEvent.SendToPlayer(Players.GetPlayerByUserId(tonumber(this.userId.Get())!)!, cardType, serializedCards);
	}
	
	public addCard(card: HoldCard | PropertyCard): void {
		if (card instanceof PropertyCard) {
			this.propertyCards.push(card);

			this.updateClientCards("property", this.propertyCards);
		} else if (card instanceof HoldCard) {
			this.holdCards.push(card);

			this.updateClientCards("hold", this.holdCards);
		}
	}

	public getProperties() {
		return this.propertyCards;
	}

	public getHoldCards() {
		return this.holdCards;
	}

	public runPlayCardsWithCircumstance(player: RoPlayer): Promise<void> {
		return new Promise<void>((resolve, reject, cancel) => {
			//checkk for cards that accept this circumstance and then return play them else resolve
			resolve();
		});
	}

	public getAllCards() {
		return [...this.propertyCards, ...this.holdCards];
	}


	public removeCard(card: PropertyCard | HoldCard) {
		if (card instanceof PropertyCard) {
			this.propertyCards = this.propertyCards.filter((c) => c !== card);

			this.updateClientCards("property", this.propertyCards);
		} else if (card instanceof HoldCard) {
			this.holdCards = this.holdCards.filter((c) => c !== card);

			this.updateClientCards("hold", this.holdCards);
		}
	}
}
