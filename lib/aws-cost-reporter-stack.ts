import * as cdk from '@aws-cdk/core';
import * as logs from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';
import * as events from '@aws-cdk/aws-events';
import * as eventsTargets from '@aws-cdk/aws-events-targets';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs' ;

export class AwsCostReporterStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    cdk.Tags.of(this).add('Project', 'aws-cost-reporter');

    const slackWebhookUrl = this.fetchContextString('slack_webhook_url');

    const reporterFunc = new NodejsFunction(this, 'reporter-func', {
      entry: 'lib/handler.ts',
      handler: 'Handler',
      timeout: cdk.Duration.minutes(2),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        SLACK_WEBHOOK_URL: slackWebhookUrl,
      },
    });
    reporterFunc.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ce:GetCost*'],
      resources: ['*'],
    }));

    new events.Rule(this, 'launch-reporter-func-daily', {
      schedule: events.Schedule.cron({
        minute: "15",
        hour: "9",
        day: "*",
        month: "*",
        year: "*"
      }),
      targets: [new eventsTargets.LambdaFunction(reporterFunc)],
    });
  }

  fetchContextString(key: string, defaultValue = ''): string {
    const v: string | undefined = this.node.tryGetContext(key);
    if (v === undefined) {
      if (defaultValue.length > 0) {
        return defaultValue;
      } else {
        throw new Error(`Missing context: ${key}`);
      }
    }

    return v;
  }
}
