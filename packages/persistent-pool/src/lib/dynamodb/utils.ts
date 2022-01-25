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
import { retry } from '@salto-io/lowerdash'

const { withRetry } = retry

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const dbUtils = (db: DynamoDB) => {
  const tableStatus = async (tableName: string): Promise<string | undefined> => {
    try {
      const description = await db.describeTable({ TableName: tableName }).promise()
      return description && description.Table && description.Table.TableStatus
    } catch (e) {
      if (e.code === 'ResourceNotFoundException') {
        return undefined
      }
      throw e
    }
  }

  const tableExists = async (
    tableName: string,
  ): Promise<boolean> => await tableStatus(tableName) === 'ACTIVE'

  const ensureTableExists = async (
    tableParams: DynamoDB.Types.CreateTableInput,
    waitOpts?: retry.RetryOpts,
  ): Promise<void> => {
    try {
      await db.createTable(tableParams).promise()
    } catch (e) {
      if (e.code !== 'ResourceInUseException') throw e
    }
    await withRetry(() => tableExists(tableParams.TableName), waitOpts)
  }
  return {
    tableStatus,
    tableExists,
    ensureTableExists,
  }
}

export type QueryOpts = Omit<retry.RetryOpts, 'description'>
export type BatchDeleteOpts = Omit<retry.RetryOpts, 'description'>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const dbDocUtils = (dbDoc: DynamoDB.DocumentClient) => {
  const queryBatchIterator = <TReturn extends {} = DynamoDB.AttributeMap>(
    input: DynamoDB.DocumentClient.QueryInput,
    opts?: QueryOpts,
  ): AsyncIterator<TReturn[], void> => {
    let done = false
    let items: TReturn[]
    let startKey: DynamoDB.Key | undefined

    return {
      next: async () => {
        if (done) {
          return { done: true, value: undefined }
        }

        await withRetry(async (): Promise<boolean> => {
          const queryResults = await dbDoc.query({
            ...input,
            ExclusiveStartKey: startKey,
          }).promise()

          startKey = queryResults.LastEvaluatedKey

          done = startKey === undefined
          items = queryResults.Items as TReturn[]

          return done || Boolean(items?.length)
        }, { ...opts, description: 'query' })

        return (items && items.length !== 0)
          ? { done: false, value: items }
          : { done: true, value: undefined }
      },
    }
  }

  const queryIterator = <TReturn extends {} = DynamoDB.AttributeMap>(
    input: DynamoDB.DocumentClient.QueryInput,
    opts?: QueryOpts,
  ): AsyncIterator<TReturn, void> => {
    const batchIter = queryBatchIterator<TReturn>(input, opts)
    let batch: IteratorResult<TReturn[]>

    return {
      async next(): Promise<IteratorResult<TReturn>> {
        if (!batch || (!batch.done && batch.value.length === 0)) {
          batch = await batchIter.next()
          return this.next()
        }

        return batch.done
          ? { done: true, value: undefined }
          : { done: false, value: batch.value.shift() as TReturn }
      },
    }
  }

  const MAX_ITEMS_PER_BATCH_WRITE = 25

  const batchDelete = async (
    tableName: string,
    keysToDelete: DynamoDB.Key[],
    opts: BatchDeleteOpts,
  ): Promise<void> => {
    await withRetry(async () => {
      const keysToSend = keysToDelete.splice(0, MAX_ITEMS_PER_BATCH_WRITE)

      const deleteResult = await dbDoc.batchWrite({
        RequestItems: {
          [tableName]: keysToSend.map(r => ({ DeleteRequest: { Key: r } })),
        },
      }).promise()

      const unprocessed = (deleteResult.UnprocessedItems?.[tableName] ?? [])
        .map(r => (r.DeleteRequest as DynamoDB.DeleteRequest).Key)

      keysToDelete.push(...unprocessed)

      return keysToDelete.length === 0
    }, { ...opts, description: 'batchDelete' })
  }

  return {
    queryBatchIterator,
    queryIterator,
    batchDelete,
  }
}
