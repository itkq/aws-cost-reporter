#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsCostReporterStack } from '../lib/aws-cost-reporter-stack';

const app = new cdk.App();
new AwsCostReporterStack(app, 'AwsCostReporterStack');
