import { DynamoEnvironment } from './types'

declare global {
  module NodeJS {
    interface Global {
      dynamoEnv: {
        real?: DynamoEnvironment,
        dynalite: DynamoEnvironment,
      }
    }
  }
}
