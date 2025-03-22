import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { ebooks } from "../seed/ebooks";
import * as apig from "aws-cdk-lib/aws-apigateway";

export class EbooksApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ebooksTable = new dynamodb.Table(this, "EbooksTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "category", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Ebooks",
    });

    new custom.AwsCustomResource(this, "EbooksInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [ebooksTable.tableName]: generateBatch(ebooks),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("EbooksInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [ebooksTable.tableArn],
      }),
    });

    const getAllEbooksFn = new lambdanode.NodejsFunction(this, "GetAllEbooksFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/getAllEbooks.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: ebooksTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const addEbookFn = new lambdanode.NodejsFunction(this, "AddEbookFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/addEbook.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: ebooksTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const getEbooksByCategoryFn = new lambdanode.NodejsFunction(this, "GetEbooksByCategoryFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/getEbooksByCategory.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: ebooksTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const updateEbookFn = new lambdanode.NodejsFunction(this, "UpdateEbookFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/updateEbook.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: ebooksTable.tableName,
        REGION: "eu-west-1",
      },
    });

    ebooksTable.grantReadData(getAllEbooksFn);
    ebooksTable.grantReadData(getEbooksByCategoryFn);
    ebooksTable.grantWriteData(addEbookFn);
    ebooksTable.grantReadWriteData(updateEbookFn);

    const api = new apig.RestApi(this, "EbooksAPI", {
      description: "Ebooks REST API",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const ebooksEndpoint = api.root.addResource("ebooks");

    ebooksEndpoint.addMethod("GET", new apig.LambdaIntegration(getAllEbooksFn, { proxy: true }));
    ebooksEndpoint.addMethod("POST", new apig.LambdaIntegration(addEbookFn, { proxy: true }));

    const categoryEndpoint = ebooksEndpoint.addResource("{category}");
    categoryEndpoint.addMethod("GET", new apig.LambdaIntegration(getEbooksByCategoryFn, { proxy: true }));

    const ebookByIdEndpoint = categoryEndpoint.addResource("{id}");
    ebookByIdEndpoint.addMethod("PUT", new apig.LambdaIntegration(updateEbookFn, { proxy: true }));
  }
}
