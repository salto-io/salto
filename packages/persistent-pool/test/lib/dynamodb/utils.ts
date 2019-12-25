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
