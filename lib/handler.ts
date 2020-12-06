import CostExplorer from 'aws-sdk/clients/costexplorer';
import { IncomingWebhook, IncomingWebhookSendArguments } from '@slack/webhook';
import dateformat from 'dateformat';

export const Handler = async (_event: any, _context: any) => {
  await Run().catch((e) => {
    console.error(e);
    throw e;
  });
}

interface TimePeriod {
  Start: string;
  End: string;
}

interface CostPerService {
  service: string;
  usd: number;
}

export const Run = async () => {
  const costexplorer = new CostExplorer({ region: 'us-east-1' }); // cost explorer is only available in us-east-1
  const webhookUrl = envFetch('SLACK_WEBHOOK_URL')
  const webhook = new IncomingWebhook(webhookUrl);

  const timePeriod = getDayBeforeTimePeriod();
  const resp = await costexplorer.getCostAndUsage({
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    GroupBy: [{
      Type: 'DIMENSION',
      Key: 'SERVICE',
    }],
    TimePeriod: timePeriod,
  }).promise();

  let costsPerService: CostPerService[] = [];

  for (const item of resp.ResultsByTime!) {
    for (const group of item.Groups!) {
      const service = group.Keys![0];
      const usd = Number(group.Metrics!.UnblendedCost.Amount!);
      costsPerService.push({ service: service, usd: usd });
    }
  }

  costsPerService.sort((a, b) => b.usd - a.usd);
  const payload = buildWebhookArguments(timePeriod, costsPerService);
  await webhook.send(payload);
}

const buildWebhookArguments = (period: TimePeriod, costsPerService: CostPerService[]): IncomingWebhookSendArguments => {
  let blocks: any = []; // TODO
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `AWS Cost (${period.Start} - ${period.End})`,
    },
  });

  for (const chunk of EachSlice(costsPerService, 10)) { // no more than 10 items allowed
    const block = {
      type: 'section',
      fields: chunk.map((c) => {
        return {
          type: 'mrkdwn',
          text: `*${c.service}:* ${c.usd.toFixed(3)} USD`,
        }
      })
    };
    blocks.push(block);
  }

  return {
    blocks: blocks,
  }
}

const getDayBeforeTimePeriod = (): TimePeriod => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    Start: dateformat(start, "yyyy-mm-dd"),
    End: dateformat(end, "yyyy-mm-dd"),
  }
}

const envFetch = (key: string, defaultValue = ''): string => {
  const v = process.env[key];
  if (v === undefined) {
    if (defaultValue.length === 0) {
      throw new Error(`Environment variable ${key} is required`);
    } else {
      return defaultValue;
    }
  }

  return v;
}

const EachSlice = (arr: Array<any>, n: number): Array<Array<any>> => {
  let dup = [...arr]
  let result = [];
  let length = dup.length;

  while (0 < length) {
    result.push(dup.splice(0, n));
    length = dup.length
  }

  return result;
}

