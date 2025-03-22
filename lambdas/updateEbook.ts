import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const client = new DynamoDBClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { category, id } = event.pathParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  // Check if required parameters exist
  if (!category || !id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing category or id in path parameters." }),
    };
  }

  // Optional: Validate that body has required fields
  if (!body.category || !body.id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing category or id in body." }),
    };
  }

  // Validate that the category and id in path match those in the body
  if (body.category !== category || Number(body.id) !== Number(id)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Mismatch between path parameters and body fields (category and id).",
        expected: { category, id: Number(id) },
        received: { category: body.category, id: body.id },
      }),
    };
  }

  // Prepare update expression
  const updateExpressions: string[] = [];
  const expressionAttributeValues: Record<string, any> = {};
  const expressionAttributeNames: Record<string, any> = {};

  for (const key in body) {
    if (key !== "category" && key !== "id") {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = body[key];
      expressionAttributeNames[`#${key}`] = key;
    }
  }

  if (updateExpressions.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No updatable fields provided in request body." }),
    };
  }

  const command = new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: marshall({ category, id: Number(id) }),
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
    ReturnValues: "ALL_NEW",
  });

  try {
    const result = await client.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Ebook updated successfully",
        updatedItem: result.Attributes,
      }),
    };
  } catch (error) {
    console.error("Error updating ebook:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error }),
    };
  }
};
