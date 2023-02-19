import * as AWS from 'aws-sdk';

import {
  CdkCustomResourceEvent,
  CdkCustomResourceHandler,
  CdkCustomResourceResponse,
} from 'aws-lambda';

import { v4 as uuid } from 'uuid';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const physicalResourceId = 'OrdersConfigData';

async function seedData(tableName: string): Promise<void> {
  const params: AWS.DynamoDB.DocumentClient.BatchWriteItemInput = {
    RequestItems: {
      [tableName]: [
        {
          PutRequest: {
            Item: {
              id: '59b8a675-9bb7-46c7-955d-2566edfba8ea',
              storeCode: 'NEW',
              storeName: 'Newcastle',
              type: 'Stores',
            },
          },
        },
        {
          PutRequest: {
            Item: {
              id: '4e02e8f2-c0fe-493e-b259-1047254ad969',
              storeCode: 'LON',
              storeName: 'London',
              type: 'Stores',
            },
          },
        },
        {
          PutRequest: {
            Item: {
              id: 'f5de2a0a-5a1d-4842-b38d-34e0fe420d33',
              storeCode: 'MAN',
              storeName: 'Manchester',
              type: 'Stores',
            },
          },
        },
      ],
    },
  };

  // batchwrite (upsert) the orders to the table
  const { UnprocessedItems }: AWS.DynamoDB.DocumentClient.BatchWriteItemOutput =
    await dynamoDb.batchWrite(params).promise();

  if (Object.entries(UnprocessedItems as object).length) {
    throw new Error(
      `The following were unprocesssed - ${JSON.stringify(UnprocessedItems)}`
    );
  }
}

export const handler: CdkCustomResourceHandler = async (
  event: CdkCustomResourceEvent
): Promise<CdkCustomResourceResponse> => {
  try {
    const correlationId = uuid();
    const method = 'populate-orders.handler';
    const prefix = `${correlationId} - ${method}`;

    let response: CdkCustomResourceResponse;

    console.log(`${prefix} - started`);
    console.log(`${prefix} - event request: ${JSON.stringify(event)}`);

    const { ResourceProperties } = event;
    const { tableName } = ResourceProperties;

    if (!tableName) throw new Error(`table name not supplied`);

    switch (event.RequestType) {
      case 'Create':
        await seedData(tableName); // seed the data

        response = {
          Status: 'SUCCESS',
          Reason: '',
          LogicalResourceId: event.LogicalResourceId,
          PhysicalResourceId: physicalResourceId,
          RequestId: event.RequestId,
          StackId: event.StackId,
        };
        break;
      case 'Update':
        await seedData(tableName); // reseed the data
        response = {
          Status: 'SUCCESS',
          Reason: '',
          LogicalResourceId: event.LogicalResourceId,
          PhysicalResourceId: physicalResourceId,
          RequestId: event.RequestId,
          StackId: event.StackId,
        };
        break;
      case 'Delete':
        // we do nothing as the table will be removed
        response = {
          Status: 'SUCCESS',
          Reason: '',
          LogicalResourceId: event.LogicalResourceId,
          PhysicalResourceId: physicalResourceId,
          RequestId: event.RequestId,
          StackId: event.StackId,
        };
        break;
      default:
        throw new Error(`${prefix} - event request type not found`);
    }

    console.log(`${prefix} - response: ${JSON.stringify(response)}`);

    return response;
  } catch (error) {
    console.log(error);
    return {
      Status: 'FAILED',
      Reason: JSON.stringify(error),
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: physicalResourceId,
      RequestId: event.RequestId,
      StackId: event.StackId,
    };
  }
};
