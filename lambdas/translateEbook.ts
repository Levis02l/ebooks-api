import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { id } = event.pathParameters || {};
  const language = event.queryStringParameters?.language || "zh";

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing id." }),
    };
  }

  try {
    const getCommand = new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: { id: { N: id } },
    });

    const result = await ddbClient.send(getCommand);
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Ebook not found." }),
      };
    }

    const ebook = unmarshall(result.Item);
    const translatedKey = `description_${language}`;

    if (ebook[translatedKey]) {
      return {
        statusCode: 200,
        body: JSON.stringify({ translated: ebook[translatedKey] }),
      };
    }

    const translateResult = await translateClient.send(
      new TranslateTextCommand({
        Text: ebook.description,
        SourceLanguageCode: "en",
        TargetLanguageCode: language,
      })
    );

    const translatedText = translateResult.TranslatedText;

    await ddbClient.send(
      new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ id: ebook.id }),
        UpdateExpression: "SET #desc = :desc",
        ExpressionAttributeNames: { "#desc": translatedKey },
        ExpressionAttributeValues: marshall({ ":desc": translatedText }),
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ translated: translatedText }),
    };
  } catch (error) {
    console.error("Translation error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error }),
    };
  }
};
