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
import { BillingMode, CreateTableCommandInput, DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'

import { functions, retry as retryUtil } from '@salto-io/lowerdash'
import { v4 as uuidv4 } from 'uuid'
import {
  InstanceId,
  Pool,
  Repo,
  LeaseWithStatus,
  Lease,
  InstanceNotFoundError,
  InstanceNotLeasedError,
  InstanceIdAlreadyRegistered,
  RetryStrategy,
  RepoOpts,
  LeaseUpdateOpts,
  DEFAULT_LEASE_UPDATE_OPTS,
} from '../../types'
import { Key, dbUtils, dbDocUtils, BatchDeleteOpts, QueryOpts } from './utils'

const { defaultOpts } = functions
const { withRetry, retryStrategies, RetryError } = retryUtil

type ItemList = Key[]

export type DynamoRepoPartialOpts = {
  tableName: string
  listBatchSize: number | undefined
  billingMode: BillingMode
  optimisticLockMaxRetries: number
  leaseRandomizationRange: number | undefined
  batchDelete: BatchDeleteOpts
  query: QueryOpts
}

export type DynamoDbInstances = {
  db: DynamoDBClient
  dbDoc: DynamoDBDocumentClient
}

export type DynamoInstancesOrConfig =
  | DynamoDbInstances
  | {
      serviceOpts: DynamoDBClientConfig
    }

export type DynamoRepoRequiredOpts = RepoOpts & DynamoInstancesOrConfig

export type DynamoRepoOpts = DynamoRepoPartialOpts & DynamoRepoRequiredOpts

// taken from: https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-inference-in-conditional-types
type Unpacked<T> = T extends (infer U)[]
  ? U
  : T extends (...args: unknown[]) => infer U
    ? U
    : T extends PromiseLike<infer U>
      ? U
      : T

const createTableParams = ({
  tableName,
  billingMode,
}: Pick<DynamoRepoOpts, 'tableName' | 'billingMode'>): CreateTableCommandInput & { TableName: string } => ({
  KeySchema: [
    { AttributeName: 'type', KeyType: 'HASH' },
    { AttributeName: 'id', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'type', AttributeType: 'S' },
    { AttributeName: 'id', AttributeType: 'S' },
    { AttributeName: 'leaseExpiresBy', AttributeType: 'S' },
  ],
  LocalSecondaryIndexes: [
    {
      IndexName: 'leaseExpiresBy',
      KeySchema: [
        { AttributeName: 'type', KeyType: 'HASH' },
        { AttributeName: 'leaseExpiresBy', KeyType: 'RANGE' },
      ],
      Projection: {
        ProjectionType: 'INCLUDE',
        NonKeyAttributes: ['version'],
      },
    },
  ],
  BillingMode: billingMode,
  TableName: tableName,
})

type LeaseDoc<T> = {
  id: string
  value: T
  version: number
  leaseExpiresBy: string
  leasingClientId: string
  suspensionReason?: string
}

export const dynamoDbInstances = (opts: DynamoInstancesOrConfig): DynamoDbInstances => {
  if ('serviceOpts' in opts) {
    const db = new DynamoDBClient(opts.serviceOpts)
    const dbDoc = DynamoDBDocumentClient.from(db)
    return { db, dbDoc }
  }
  return { db: opts.db, dbDoc: opts.dbDoc }
}

const NOT_LEASED = new Date(0).toISOString()

export const repo = defaultOpts.withRequired<DynamoRepoPartialOpts, DynamoRepoRequiredOpts, Promise<Repo>>(
  async (opts: DynamoRepoOpts): Promise<Repo> => {
    const { db, dbDoc } = dynamoDbInstances(opts)
    const utils = dbUtils(db)
    const docUtils = dbDocUtils(dbDoc)

    const { clientId } = opts

    const withOptimisticLock = async <TResult>(f: () => Promise<TResult>, retryNumber = 0): Promise<TResult> => {
      try {
        return await f()
      } catch (e) {
        if (e.toString().includes('ConditionalCheckFailedException')) {
          if (retryNumber === opts.optimisticLockMaxRetries) {
            throw e
          }
          return withOptimisticLock(f, retryNumber + 1)
        }
        throw e
      }
    }

    const pool = <T>(typeName: string): Pool<T> => {
      const queryInput = (partialQueryInput: Partial<QueryCommandInput> = {}): QueryCommandInput => ({
        TableName: opts.tableName,
        ConsistentRead: true,
        Select: 'ALL_ATTRIBUTES',
        KeyConditionExpression: '#type = :type',
        ExpressionAttributeValues: {
          ':type': typeName,
        },
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        Limit: opts.listBatchSize,
        ...partialQueryInput,
      })

      const lease = (returnTimeout: number, retryStrategy?: () => RetryStrategy): Promise<Lease<T> | null> =>
        withOptimisticLock(async (): Promise<Lease<T> | null> => {
          const now = Date.now()
          const retry = retryStrategy ?? retryStrategies.none()

          const makeQuery = async (): Promise<ItemList | undefined> => {
            const queryResults = await dbDoc.send(
              new QueryCommand({
                TableName: opts.tableName,
                IndexName: 'leaseExpiresBy',
                ConsistentRead: true,
                Select: 'ALL_PROJECTED_ATTRIBUTES',
                KeyConditionExpression: '#type = :type and leaseExpiresBy <= :now',
                ExpressionAttributeNames: {
                  '#type': 'type',
                },
                ExpressionAttributeValues: {
                  ':type': typeName,
                  ':now': new Date(now).toISOString(),
                },
                Limit: opts.leaseRandomizationRange,
              }),
            )

            const maybeItems = queryResults.Items
            const hasItems = maybeItems !== undefined && maybeItems.length !== 0
            return hasItems ? (maybeItems as ItemList) : undefined
          }

          let items: ItemList
          try {
            items = (await withRetry(makeQuery, {
              strategy: retry,
              description: 'waiting for available lease',
            })) as ItemList
          } catch (e) {
            if (e instanceof RetryError && retryStrategy === undefined) {
              return null
            }
            throw e
          }

          const itemIndex = Math.floor(Math.random() * items.length)
          const { id, version } = items[itemIndex] as Pick<LeaseDoc<T>, 'id' | 'version'>

          const updateResult = await dbDoc.send(
            new UpdateCommand({
              TableName: opts.tableName,
              Key: {
                type: typeName,
                id,
              },
              UpdateExpression:
                'set leaseExpiresBy = :leaseExpiresBy, leasingClientId = :leasingClientId, #version = :newVersion',
              ConditionExpression: '#version = :currentVersion',
              ExpressionAttributeNames: {
                '#version': 'version',
              },
              ExpressionAttributeValues: {
                ':leasingClientId': clientId,
                ':currentVersion': version,
                ':newVersion': version + 1,
                ':leaseExpiresBy': new Date(now + returnTimeout).toISOString(),
              },
              ReturnValues: 'ALL_NEW',
            }),
          )

          return { id, value: (updateResult.Attributes as LeaseDoc<T>).value }
        })

      const updateLease = (
        id: InstanceId,
        updates: Pick<UpdateCommandInput, 'UpdateExpression' | 'ExpressionAttributeValues'>,
        updateOpts?: Partial<LeaseUpdateOpts> & { validateLeased: boolean },
      ): Promise<void> => {
        const { validateClientId, validateLeased } = {
          ...DEFAULT_LEASE_UPDATE_OPTS,
          ...updateOpts,
        }

        return withOptimisticLock(async (): Promise<void> => {
          const item = (
            await dbDoc.send(
              new GetCommand({
                TableName: opts.tableName,
                Key: {
                  type: typeName,
                  id,
                },
              }),
            )
          ).Item as LeaseDoc<T> | undefined

          if (item === undefined) {
            throw new InstanceNotFoundError({ id, typeName })
          }

          if (
            (validateLeased && item.leaseExpiresBy === NOT_LEASED) ||
            (validateClientId && item.leasingClientId !== clientId)
          ) {
            throw new InstanceNotLeasedError({ id, typeName, clientId })
          }

          const { version } = item

          await dbDoc.send(
            new UpdateCommand({
              TableName: opts.tableName,
              Key: {
                type: typeName,
                id,
              },
              UpdateExpression: updates.UpdateExpression,
              ConditionExpression: '#version = :currentVersion',
              ExpressionAttributeNames: {
                '#version': 'version',
              },
              ExpressionAttributeValues: {
                ':currentVersion': version,
                ':newVersion': version + 1,
                ...updates.ExpressionAttributeValues,
              },
            }),
          )
        })
      }

      return {
        async register(value: T, id: InstanceId = uuidv4()): Promise<InstanceId> {
          try {
            await dbDoc.send(
              new PutCommand({
                TableName: opts.tableName,
                Item: {
                  type: typeName,
                  id,
                  version: 0,
                  value,
                  leaseExpiresBy: NOT_LEASED,
                },
                ConditionExpression: 'attribute_not_exists(id)',
              }),
            )
            return id
          } catch (e) {
            if (e.toString().includes('ConditionalCheckFailedException')) {
              throw new InstanceIdAlreadyRegistered({ id, typeName })
            }
            throw e
          }
        },

        async unregister(id: InstanceId): Promise<void> {
          try {
            await dbDoc.send(
              new DeleteCommand({
                TableName: opts.tableName,
                Key: {
                  type: typeName,
                  id,
                },
                ConditionExpression: 'attribute_exists(id)',
              }),
            )
          } catch (e) {
            if (e.toString().includes('ConditionalCheckFailedException')) {
              throw new InstanceNotFoundError({ id, typeName })
            }
            throw e
          }
        },

        async suspend(
          id: InstanceId,
          reason: string,
          timeout: number,
          suspendOpts?: Partial<LeaseUpdateOpts>,
        ): Promise<void> {
          const now = Date.now()
          const leaseExpiresBy = new Date(now + timeout).toISOString()

          return updateLease(
            id,
            {
              UpdateExpression:
                'set #version = :newVersion, leaseExpiresBy = :leaseExpiresBy, suspensionReason = :suspensionReason',
              ExpressionAttributeValues: {
                ':leaseExpiresBy': leaseExpiresBy,
                ':suspensionReason': reason,
              },
            },
            { ...suspendOpts, validateLeased: false },
          )
        },

        async lease(returnTimeout: number): Promise<Lease<T> | null> {
          return lease(returnTimeout)
        },

        async waitForLease(returnTimeout: number, retryStrategy: () => RetryStrategy): Promise<Lease<T>> {
          return lease(returnTimeout, retryStrategy) as Promise<Lease<T>>
        },

        updateTimeout(id: InstanceId, newTimeout: number, extendOpts?: Partial<LeaseUpdateOpts>): Promise<void> {
          const now = Date.now()
          const leaseExpiresBy = new Date(now + newTimeout).toISOString()
          return updateLease(
            id,
            {
              UpdateExpression: 'set #version = :newVersion, leaseExpiresBy = :leaseExpiresBy',
              ExpressionAttributeValues: { ':leaseExpiresBy': leaseExpiresBy },
            },
            { ...extendOpts, validateLeased: true },
          )
        },

        return(id: InstanceId, returnOpts?: Partial<LeaseUpdateOpts>): Promise<void> {
          return updateLease(
            id,
            {
              UpdateExpression:
                'set #version = :newVersion, leaseExpiresBy = :NOT_LEASED remove leasingClientId, supensionReason',
              ExpressionAttributeValues: { ':NOT_LEASED': NOT_LEASED },
            },
            { ...returnOpts, validateLeased: true },
          )
        },

        [Symbol.asyncIterator](): AsyncIterator<LeaseWithStatus<T>> {
          const now = Date.now()

          const toLeaseWithStatus = (d: LeaseDoc<T>): LeaseWithStatus<T> => {
            const leaseExpiresBy = Date.parse(d.leaseExpiresBy)
            const isLeased = leaseExpiresBy > now

            const base = {
              id: d.id,
              value: d.value,
            }

            if (isLeased) {
              const unavailableBase = {
                ...base,
                leaseExpiresBy: new Date(leaseExpiresBy),
                clientId: d.leasingClientId,
              }
              return d.suspensionReason !== undefined
                ? { status: 'suspended', ...unavailableBase, suspensionReason: d.suspensionReason }
                : { status: 'leased', ...unavailableBase }
            }

            return { status: 'available', ...base }
          }

          const iter = docUtils.queryIterator<LeaseDoc<T>>(queryInput(), opts.query)

          return {
            async next(): Promise<IteratorResult<LeaseWithStatus<T>>> {
              const { done, value } = await iter.next()
              return {
                done,
                value: value && toLeaseWithStatus(value),
              } as IteratorResult<LeaseWithStatus<T>>
            },
          }
        },

        async clear(): Promise<void> {
          type QueryResult = { id: InstanceId }
          const batchIter = docUtils.queryBatchIterator<QueryResult>(
            queryInput({
              Select: 'SPECIFIC_ATTRIBUTES',
              ProjectionExpression: 'id',
            }),
            opts.query,
          )

          const keysToDelete: Key[] = []

          let batch: Unpacked<ReturnType<typeof batchIter.next>>

          const nextBatch = async (): Promise<void> => {
            if (!batch || keysToDelete.length === 0) {
              if (batch?.done) {
                return undefined
              }
              batch = await batchIter.next()
              if (batch.value) {
                keysToDelete.push(...batch.value.map(r => ({ type: typeName, id: r.id }) as Key))
              }
              return nextBatch()
            }

            await docUtils.batchDelete(opts.tableName, keysToDelete, opts.batchDelete)
            return nextBatch()
          }

          return nextBatch()
        },
      }
    }

    await utils.ensureTableExists(createTableParams(opts))

    return {
      pool<T>(typeName: string): Promise<Pool<T>> {
        return Promise.resolve(pool<T>(typeName))
      },
    }
  },
  {
    tableName: 'persistent_pool',
    listBatchSize: undefined,
    billingMode: 'PAY_PER_REQUEST',
    optimisticLockMaxRetries: 10,
    leaseRandomizationRange: 10,
    batchDelete: { strategy: retryStrategies.exponentialBackoff() },
    query: { strategy: retryStrategies.intervals({ interval: 250, maxRetries: 10 }) },
  },
)
