/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { retry } from '@salto/lowerdash'
import { dbUtils } from '../../../src/lib/dynamodb/utils'

const { withRetry } = retry

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const testDbUtils = (db: DynamoDB) => {
  const utils = dbUtils(db)

  const deleteTable = async (
    tableName: string,
  ): Promise<void> => {
    try {
      await db.deleteTable({ TableName: tableName }).promise()
    } catch (e) {
      if (e.code === 'ResourceNotFoundException') {
        return undefined
      }

      if (e.code === 'ResourceInUseException') {
        let status: string | undefined
        await withRetry(async () => {
          status = await utils.tableStatus(tableName)
          return [undefined, 'ACTIVE'].includes(status)
        })
        if (status !== undefined) {
          return deleteTable(tableName)
        }
      }

      throw e
    }

    withRetry(async () => !(await utils.tableExists(tableName)))
    return undefined
  }

  return Object.assign(utils, { deleteTable })
}
