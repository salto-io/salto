/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { retry } from '@salto-io/lowerdash'
import { dbUtils } from '../../../src/lib/dynamodb/utils'

const { withRetry } = retry

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const testDbUtils = (db: DynamoDBClient) => {
  const utils = dbUtils(db)

  const deleteTable = async (tableName: string): Promise<void> => {
    try {
      const deleteCommand = new DeleteTableCommand({ TableName: tableName })
      await db.send(deleteCommand)
    } catch (e) {
      if (e.toString().includes('ResourceNotFoundException')) {
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

    await withRetry(async () => !(await utils.tableExists(tableName)))
    return undefined
  }

  return Object.assign(utils, { deleteTable })
}
