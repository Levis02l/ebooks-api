import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EbooksApiStack } from "../lib/ebooks-api-stack";

const app = new cdk.App();
new EbooksApiStack(app, "EbooksApiStack", { env: { region: "eu-west-1" } });
