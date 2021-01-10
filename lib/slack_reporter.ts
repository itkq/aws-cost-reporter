import { IncomingWebhook, IncomingWebhookSendArguments } from '@slack/webhook';
import { CostPerService, TimePeriod } from './cost';
import { Logger } from 'tslog';

export class SlackReporter {
  webhook: IncomingWebhook;
  logger: Logger;

  constructor(webhookUrl: string) {
    this.webhook = new IncomingWebhook(webhookUrl);
    this.logger = new Logger();
  }

  async Report(timePeriod: TimePeriod, costsPerService: CostPerService[]) {
    const payload = this.buildWebhookArguments(timePeriod, costsPerService);
    this.logger.debug(payload);
    await this.webhook.send(payload);
  }

  private buildWebhookArguments(period: TimePeriod, costsPerService: CostPerService[]): IncomingWebhookSendArguments {
    const total = costsPerService.map(c => c.usd).reduce((acc, curr) => acc + curr).toFixed(3);
    let blocks: any = []; // TODO
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `AWS Cost (${period.Start} - ${period.End}): ${total} USD`,
      },
    });

    for (const chunk of this.eachSlice(costsPerService, 10)) { // no more than 10 items allowed
      const block = {
        type: 'section',
        fields: chunk.map((c) => {
          return {
            type: 'mrkdwn',
            text: `*${c.service}:* ${c.usd} USD`,
          }
        })
      };
      blocks.push(block);
    }

    return {
      blocks: blocks,
    }
  }

  private eachSlice(arr: Array<any>, n: number): Array<Array<any>> {
    let dup = [...arr]
    let result = [];
    let length = dup.length;

    while (0 < length) {
      result.push(dup.splice(0, n));
      length = dup.length
    }

    return result;
  }
}
