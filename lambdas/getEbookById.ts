import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { id } = event.pathParameters || {};

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing id" }),
    };
  }

  try {
    const command = new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: { id: { N: id } },
    });

    const result = await client.send(command);
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Ebook not found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ data: unmarshall(result.Item) }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error }),
    };
  }
};
