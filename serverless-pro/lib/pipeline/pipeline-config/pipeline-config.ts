import * as dotenv from 'dotenv';

import {
  EnvironmentConfig,
  Region,
  Stage,
} from '../pipeline-types/pipeline-types';

dotenv.config();

export const environments: Record<Stage, EnvironmentConfig> = {
  // allow developers to spin up a quick branch for a given PR they are working on e.g. pr-124
  // this is done with a npm run develop, not through the pipeline, and uses the values in .env
  [Stage.develop]: {
    env: {
      account:
        process.env.ACCOUNT || (process.env.CDK_DEFAULT_ACCOUNT as string),
      region: process.env.REGION || (process.env.CDK_DEFAULT_REGION as string),
    },
    stateful: {
      bucketName:
        `serverless-pro-lg-${process.env.PR_NUMBER}-bucket`.toLowerCase(),
    },
    stateless: {
      lambdaMemorySize: parseInt(process.env.LAMBDA_MEM_SIZE || '128'),
    },
    stageName: process.env.PR_NUMBER || Stage.develop,
  },
  [Stage.featureDev]: {
    env: {
      account: '11111111111',
      region: Region.dublin,
    },
    stateful: {
      bucketName: 'serverless-pro-lg-feature-dev-bucket',
    },
    stateless: {
      lambdaMemorySize: 128,
    },
    stageName: Stage.featureDev,
  },
  [Stage.staging]: {
    env: {
      account: '22222222222',
      region: Region.dublin,
    },
    stateful: {
      bucketName: 'serverless-pro-lg-staging-bucket',
    },
    stateless: {
      lambdaMemorySize: 1024,
    },
    stageName: Stage.staging,
  },
  [Stage.prod]: {
    env: {
      account: '33333333333',
      region: Region.dublin,
    },
    stateful: {
      bucketName: 'serverless-pro-lg-prod-bucket',
    },
    stateless: {
      lambdaMemorySize: 1024,
    },
    stageName: Stage.prod,
  },
};
