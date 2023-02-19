import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { Aspects, CustomResource } from 'aws-cdk-lib';

import { AwsSolutionsChecks } from 'cdk-nag';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export interface StatelessStackProps extends cdk.StackProps {
  env: {
    account: string;
    region: string;
  };
  table: dynamodb.Table;
  bucket: s3.Bucket;
  stageName: string;
  lambdaMemorySize: number;
}

export class StatelessStack extends cdk.Stack {
  public readonly apiEndpointUrl: cdk.CfnOutput;
  public readonly healthCheckUrl: cdk.CfnOutput;
  private readonly ordersApi: apigw.RestApi;

  constructor(scope: Construct, id: string, props: StatelessStackProps) {
    super(scope, id, props);

    const { table, bucket } = props;

    // create the rest api
    this.ordersApi = new apigw.RestApi(this, 'Api', {
      description: `Serverless Pro API ${props.stageName}`,
      deploy: true,
      endpointTypes: [apigw.EndpointType.REGIONAL],
      cloudWatchRole: true,
      deployOptions: {
        stageName: props.stageName,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
      },
    });

    // create the rest api resources
    const orders: apigw.Resource = this.ordersApi.root.addResource('orders');
    const healthCheck: apigw.Resource =
      this.ordersApi.root.addResource('health-checks');

    const order: apigw.Resource = orders.addResource('{id}');

    // create the lambdas
    const createOrderLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'CreateOrderLambda', {
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: path.join(
          __dirname,
          'src/handlers/create-order/create-order.ts'
        ),
        memorySize: props.lambdaMemorySize, // this is from props per env
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: ['aws-sdk'],
        },
        environment: {
          TABLE_NAME: table.tableName,
          BUCKET_NAME: bucket.bucketName,
        },
      });

    const getOrderLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'GetOrderLambda', {
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: path.join(__dirname, 'src/handlers/get-order/get-order.ts'),
        memorySize: props.lambdaMemorySize, // this is from props per env
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: ['aws-sdk'],
        },
        environment: {
          TABLE_NAME: table.tableName,
          BUCKET_NAME: bucket.bucketName,
        },
      });

    const healthCheckLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'HealthCheckLambda', {
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: path.join(
          __dirname,
          'src/handlers/health-check/health-check.ts'
        ),
        memorySize: props.lambdaMemorySize, // this is from props per env
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: ['aws-sdk'],
        },
      });

    const populateOrdersHandler: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'PopulateTableLambda', {
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: path.join(
          __dirname,
          'src/handlers/populate-table-cr/populate-table-cr.ts'
        ),
        memorySize: props.lambdaMemorySize, // this is from props per env
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: ['aws-sdk'],
        },
      });

    // hook up the lambda functions to the api
    orders.addMethod(
      'POST',
      new apigw.LambdaIntegration(createOrderLambda, {
        proxy: true,
      })
    );

    order.addMethod(
      'GET',
      new apigw.LambdaIntegration(getOrderLambda, {
        proxy: true,
      })
    );

    healthCheck.addMethod(
      'GET',
      new apigw.LambdaIntegration(healthCheckLambda, {
        proxy: true,
      })
    );

    const provider: cr.Provider = new cr.Provider(
      this,
      'PopulateTableConfigCustomResource',
      {
        onEventHandler: populateOrdersHandler, // this lambda will be called on cfn deploy
        logRetention: logs.RetentionDays.ONE_DAY,
        providerFunctionName: `populate-orders-${props.stageName}-cr-lambda`,
      }
    );

    // use the custom resource provider
    new CustomResource(this, 'DbTableConfigCustomResource', {
      serviceToken: provider.serviceToken,
      properties: {
        tableName: props.table.tableName,
      },
    });

    // grant the relevant lambdas access to our dynamodb database
    table.grantReadData(getOrderLambda);
    table.grantReadWriteData(createOrderLambda);
    table.grantWriteData(populateOrdersHandler);

    // grant the create order lambda access to the s3 bucket
    bucket.grantWrite(createOrderLambda);

    this.apiEndpointUrl = new cdk.CfnOutput(this, 'ApiEndpointOutput', {
      value: this.ordersApi.url,
      exportName: `api-endpoint-${props.stageName}`,
    });

    this.healthCheckUrl = new cdk.CfnOutput(this, 'healthCheckUrlOutput', {
      value: `${this.ordersApi.url}health-checks`,
      exportName: `healthcheck-endpoint-${props.stageName}`,
    });

    // cdk nag check and suppressions
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: false }));
    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-COG4',
          reason: `Rule suppression for 'The REST API stage is not associated with AWS WAFv2 web ACL'`,
        },
        {
          id: 'AwsSolutions-APIG3',
          reason: `Rule suppression for 'The REST API stage is not associated with AWS WAFv2 web ACL'`,
        },
        {
          id: 'AwsSolutions-APIG2',
          reason: `Rule suppression for 'The REST API does not have request validation enabled'`,
        },
        {
          id: 'AwsSolutions-IAM4',
          reason: `Rule suppression for 'The IAM user, role, or group uses AWS managed policies'`,
        },
        {
          id: 'AwsSolutions-APIG4',
          reason: `Rule suppression for 'The API does not implement authorization.'`,
        },
        {
          id: 'AwsSolutions-APIG1',
          reason: `Rule suppression for 'The API does not have access logging enabled'`,
        },
        {
          id: 'AwsSolutions-L1',
          reason: `Rule suppression for 'The non-container Lambda function is not configured to use the latest runtime version'`,
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: `Rule suppression for 'The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission'`,
        },
      ],
      true
    );
  }
}
