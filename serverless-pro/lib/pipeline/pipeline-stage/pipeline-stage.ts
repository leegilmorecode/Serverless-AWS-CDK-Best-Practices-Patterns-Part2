import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { EnvironmentConfig } from '../pipeline-types/pipeline-types';
import { StatefulStack } from '../../app/stateful/stateful-stack';
import { StatelessStack } from '../../app/stateless/stateless-stack';

export class PipelineStage extends cdk.Stage {
  public readonly apiEndpointUrl: cdk.CfnOutput;
  public readonly healthCheckUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: EnvironmentConfig) {
    super(scope, id, props);

    // this is our stage which can be deployed for various envs i.e. feature-dev, staging & prod
    // note: we will pass through the given environment props when adding the stage
    const statefulStack = new StatefulStack(this, 'StatefulStack', {
      bucketName: props.stateful.bucketName,
    });
    const statelessStack = new StatelessStack(this, 'StatelessStack', {
      env: {
        account: props.env.account,
        region: props.env.region,
      },
      table: statefulStack.table,
      bucket: statefulStack.bucket,
      lambdaMemorySize: props.stateless.lambdaMemorySize,
      stageName: props.stageName,
    });

    this.apiEndpointUrl = statelessStack.apiEndpointUrl;
    this.healthCheckUrl = statelessStack.healthCheckUrl;
  }
}
