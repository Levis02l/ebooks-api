import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { ebooks } from "../seed/ebooks";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";

export class EbooksApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ebooksTable = new dynamodb.Table(this, "EbooksTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Ebooks",
    });

    ebooksTable.addGlobalSecondaryIndex({
      indexName: "category-index",
      partitionKey: { name: "category", type: dynamodb.AttributeType.STRING },
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

    const getEbookByIdFn = new lambdanode.NodejsFunction(this, "GetEbookByIdFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/getEbookById.ts`,
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
        CATEGORY_INDEX: "category-index",
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

    const translateEbookFn = new lambdanode.NodejsFunction(this, "TranslateEbookFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/translateEbook.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: ebooksTable.tableName,
        REGION: "eu-west-1",
      },
    });

    translateEbookFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["translate:TranslateText"],
        resources: ["*"],
      })
    );

    ebooksTable.grantReadWriteData(getAllEbooksFn);
    ebooksTable.grantReadWriteData(addEbookFn);
    ebooksTable.grantReadWriteData(getEbookByIdFn);
    ebooksTable.grantReadWriteData(updateEbookFn);
    ebooksTable.grantReadWriteData(translateEbookFn);
    ebooksTable.grantReadWriteData(getEbooksByCategoryFn);

    const api = new apig.RestApi(this, "EbooksAPI", {
      description: "Ebooks REST API",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date", "x-api-key"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const apiKey = api.addApiKey("EbooksApiKey", {
      apiKeyName: "ebooks-api-key",
      description: "API Key for protected endpoints",
    });

    const usagePlan = api.addUsagePlan("EbooksUsagePlan", {
      name: "EbooksUsagePlan",
      throttle: {
        rateLimit: 10,
        burstLimit: 2,
      },
      quota: {
        limit: 1000,
        period: apig.Period.MONTH,
      },
    });

    usagePlan.addApiKey(apiKey);

    const ebooksEndpoint = api.root.addResource("ebooks");

    ebooksEndpoint.addMethod("GET", new apig.LambdaIntegration(getAllEbooksFn));

    const postMethod = ebooksEndpoint.addMethod("POST", new apig.LambdaIntegration(addEbookFn), {
      apiKeyRequired: true,
    });

    const ebookByIdEndpoint = ebooksEndpoint.addResource("{id}");
    ebookByIdEndpoint.addMethod("GET", new apig.LambdaIntegration(getEbookByIdFn));

    const putMethod = ebookByIdEndpoint.addMethod("PUT", new apig.LambdaIntegration(updateEbookFn), {
      apiKeyRequired: true,
    });

    usagePlan.addApiStage({
      stage: api.deploymentStage,
      throttle: [
        {
          method: postMethod,
          throttle: { rateLimit: 5, burstLimit: 2 },
        },
        {
          method: putMethod,
          throttle: { rateLimit: 5, burstLimit: 2 },
        },
      ],
    });

    ebookByIdEndpoint
      .addResource("translation")
      .addMethod("GET", new apig.LambdaIntegration(translateEbookFn));

    const categoryEndpoint = ebooksEndpoint
      .addResource("category")
      .addResource("{category}");

    categoryEndpoint.addMethod("GET", new apig.LambdaIntegration(getEbooksByCategoryFn));
  }
}
