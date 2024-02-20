/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// eslint-disable-next-line no-restricted-imports
import BaseDynaliteEnvironment from 'jest-dynalite/dist/environment'
import { dynamoDbInstances, repo } from '../../../../src/lib/dynamodb/dynamodb_repo'
import randomString from '../../../utils/random_string'
import { testDbUtils as makeTestDbUtils } from '../utils'
import { DynamoEnvironment } from './types'

export default class Environment extends BaseDynaliteEnvironment {
  static dynaliteEnv(): DynamoEnvironment {
    const serviceOpts = {
      endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
      sslEnabled: false,
      region: 'local',
    }

    return {
      tableName: repo.DEFAULT_OPTS.tableName,
      dynamo: dynamoDbInstances({ serviceOpts }),
      serviceOpts,
    }
  }

  static realDynamoEnv(): DynamoEnvironment {
    const workerId = process.env.JEST_WORKER_ID
    const serviceOpts = {
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-west-1',
    }

    return {
      tableName: `test_${repo.DEFAULT_OPTS.tableName}_${workerId}_${randomString()}`,
      dynamo: dynamoDbInstances({ serviceOpts }),
      serviceOpts,
    }
  }

  async setup(): Promise<void> {
    await super.setup()
    this.global.dynamoEnv = {
      real: process.env.REAL_DYNAMODB ? Environment.realDynamoEnv() : undefined,
      dynalite: Environment.dynaliteEnv(),
    }
  }

  async teardown(): Promise<void> {
    await super.teardown()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const realEnv = this.global.dynamoEnv.real
    if (realEnv) {
      const { dynamo, tableName } = realEnv
      await makeTestDbUtils(dynamo.db).deleteTable(tableName)
    }
    delete this.global.dynamoEnv
  }
}
