import { RoPlayer } from "./roPlayer.class";
import { Players } from "@rbxts/services";
import { Janitor } from "@rbxts/janitor";

export class Bank {
	private static instance: Bank;


	private constructor() {}

	public static getInstance(): Bank {
		if (!Bank.instance) {
			Bank.instance = new Bank();
		}

		return Bank.instance;
	}

    public transferMoney(recipient : RoPlayer, payee : RoPlayer, amount : number) : Promise<void>{
        return new Promise((resolve, reject) => {
            
            if (payee.Money.canAfford(amount) ) {
                //enter sell mode
                return reject(); 
            }

            payee.Money.lose(amount);
            recipient.Money.gain(amount);
            resolve();
        })    
    }
}
