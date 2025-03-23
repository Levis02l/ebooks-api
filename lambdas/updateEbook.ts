import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { id } = event.pathParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing id in path." }),
    };
  }

  const updateExpressions: string[] = [];
  const expressionAttributeValues: Record<string, any> = {};
  const expressionAttributeNames: Record<string, any> = {};

  for (const key in body) {
    if (key !== "id") {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = body[key];
      expressionAttributeNames[`#${key}`] = key;
    }
  }

  if (updateExpressions.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No updatable fields provided." }),
    };
  }

  const command = new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: marshall({ id: Number(id) }),
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
    ReturnValues: "ALL_NEW",
  });

  try {
    const updated = await client.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Ebook updated",
        updatedItem: updated.Attributes,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to update ebook", error }),
    };
  }
};
