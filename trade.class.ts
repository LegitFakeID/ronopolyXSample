import { Mediator } from './mediator.class';
import { Colleague } from './colleague.class';
import { Card } from './card/card.class';

export class Trade implements Mediator {
    private colleagues : Colleague[];
    private cards : [Card[], Card[]];
    private money : [number, number];

    constructor() {
        this.colleagues = [];
        this.cards = [[], []];
        this.money = [0, 0];
    }

    register(colleague : Colleague): void {
        this.colleagues.push(colleague);
    }

    update(tradeWindow : Colleague, data : [Card[], number]): void {
        //find the colleague that sent the data
        for (let i = 0; i < this.colleagues.size(); i++) {
            const colleague = this.colleagues[i];
            if (colleague === tradeWindow) {
                this.cards[i] = data[0];
                this.money[i] = data[1];
            }
        }

        //loop over all colleagues and update them
        for (let i = 0; i < this.colleagues.size(); i++) {
            const colleague = this.colleagues[i];
            colleague.update(this.cards, this.money);
        }

    }
}