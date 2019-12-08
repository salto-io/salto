import { DynamoDbInstances } from '../../../../src/lib/dynamodb/dynamodb_repo'

export type DynamoEnvironment = {
  dynamo: DynamoDbInstances
  tableName: string
  serviceOpts: Record<string, unknown>
}
