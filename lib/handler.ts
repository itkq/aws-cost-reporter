import CostExplorer from 'aws-sdk/clients/costexplorer';
import dateformat from 'dateformat';
import { SlackReporter } from './slack_reporter';
import { CostPerService, TimePeriod } from './cost';

export const Handler = async (_event: any, _context: any) => {
  await Run().catch((e) => {
    console.error(e);
    throw e;
  });
}

type TODO = any;

export const Run = async () => {
  const costexplorer = new CostExplorer({ region: 'us-east-1' }); // cost explorer is only available in us-east-1

  let reporters: TODO[] = [];
  if (process.env.SLACK_WEBHOOK_URL !== undefined) {
    reporters.push(new SlackReporter(process.env.SLACK_WEBHOOK_URL));
  }

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
      const roundedUsd = usd.toFixed(3);
      if (roundedUsd !== '0.000') {
        costsPerService.push({ service: service, usd: Number(roundedUsd) });
      }
    }
  }

  costsPerService.sort((a, b) => b.usd - a.usd);

  const promises = reporters.map((r) => {
    return r.Report(timePeriod, costsPerService)
  })
  
  await Promise.all(promises).catch((e) => {
    throw e;
  })
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
