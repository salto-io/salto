/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { DynamoDB } from 'aws-sdk'
import {
  DynamoDbInstances,
} from '../../../src/lib/dynamodb/dynamodb_repo'
import { dbUtils as makeDbUtils } from '../../../src/lib/dynamodb/utils'

describe('dynamoUtils', () => {
  let dynamo: DynamoDbInstances
  let dbUtils: ReturnType<typeof makeDbUtils>

  describe('tableStatus', () => {
    beforeEach(() => {
      ({ dynamo } = global.dynamoEnv.dynalite)
      dbUtils = makeDbUtils(dynamo.db)
    })

    describe('when an unknown exception is thrown', () => {
      let e: Error
      beforeEach(() => {
        jest.spyOn(dynamo.db, 'describeTable').mockImplementation(() => ({
          promise() { e = new Error('testing'); return Promise.reject(e) },
        } as ReturnType<typeof dynamo.db.describeTable>))
      })

      it(
        'throws it',
        () => expect(dbUtils.tableStatus('doesntmatter')).rejects.toEqual(e)
      )
    })
  })

  describe('ensureTableExists', () => {
    beforeEach(() => {
      ({ dynamo } = global.dynamoEnv.dynalite)
    })

    describe('when an unknown exception is thrown', () => {
      let e: Error
      beforeEach(() => {
        jest.spyOn(dynamo.db, 'createTable').mockImplementationOnce(() => ({
          promise() { e = new Error('testing'); return Promise.reject(e) },
        } as ReturnType<typeof dynamo.db.createTable>))
      })

      it(
        'throws it',
        () => expect(dbUtils.ensureTableExists({} as DynamoDB.Types.CreateTableInput))
          .rejects.toEqual(e)
      )
    })
  })
})
