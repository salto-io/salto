import { DynamoDB } from 'aws-sdk'
import { ServiceConfigurationOptions } from 'aws-sdk/lib/service'
import { functions, retry as retryUtil } from '@salto/lowerdash'
import uuidv4 from 'uuid/v4'
import {
  InstanceId, Pool, Repo, LeaseWithStatus, Lease,
  InstanceNotFoundError, InstanceNotLeasedError, InstanceIdAlreadyRegistered, RetryStrategy,
  RepoOpts,
  LeaseUpdateOpts,
  DEFAULT_LEASE_UPDATE_OPTS,
} from '../../types'
import { dbUtils, dbDocUtils, BatchDeleteOpts, QueryOpts } from './utils'

const { defaultOpts } = functions
const { withRetry, retryStrategies, RetryError } = retryUtil

export type DynamoRepoPartialOpts = {
  tableName: string
  listBatchSize: number | undefined
  billingMode: DynamoDB.BillingMode
  optimisticLockMaxRetries: number
  leaseRandomizationRange: number | undefined
  batchDelete: BatchDeleteOpts
  query: QueryOpts
}

export type DynamoDbInstances = {
  db: DynamoDB
  dbDoc: DynamoDB.DocumentClient
}

export type DynamoInstancesOrConfig = DynamoDbInstances | {
  serviceOpts: ServiceConfigurationOptions
}

export type DynamoRepoRequiredOpts = RepoOpts & DynamoInstancesOrConfig

export type DynamoRepoOpts = DynamoRepoPartialOpts & DynamoRepoRequiredOpts

// taken from: https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-inference-in-conditional-types
type Unpacked<T> =
  T extends (infer U)[] ? U :
  T extends (...args: unknown[]) => infer U ? U :
  T extends PromiseLike<infer U> ? U :
  T;

const createTableParams = (
  { tableName, billingMode }: Pick<DynamoRepoOpts, 'tableName' | 'billingMode'>,
): DynamoDB.Types.CreateTableInput => ({
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
}

export const dynamoDbInstances = (opts: DynamoInstancesOrConfig): DynamoDbInstances => {
  if ('serviceOpts' in opts) {
    const db = new DynamoDB(opts.serviceOpts)
    return { db, dbDoc: new DynamoDB.DocumentClient({ service: db }) }
  }
  return { db: opts.db, dbDoc: opts.dbDoc }
}

const NOT_LEASED = (new Date(0)).toISOString()

export const repo = defaultOpts.withRequired<
  DynamoRepoPartialOpts,
  DynamoRepoRequiredOpts,
  Promise<Repo>
>(async (opts: DynamoRepoOpts): Promise<Repo> => {
  const { db, dbDoc } = dynamoDbInstances(opts)
  const utils = dbUtils(db)
  const docUtils = dbDocUtils(dbDoc)

  const { clientId } = opts

  const withOptimisticLock = async <TResult>(
    f: () => Promise<TResult>,
    retryNumber = 0,
  ): Promise<TResult> => {
    try {
      return await f()
    } catch (e) {
      if (e.code === 'ConditionalCheckFailedException') {
        if (retryNumber === opts.optimisticLockMaxRetries) {
          throw e
        }
        return withOptimisticLock(f, retryNumber + 1)
      }
      throw e
    }
  }

  const pool = <T>(typeName: string): Pool<T> => {
    const queryInput = (
      partialQueryInput: Partial<DynamoDB.DocumentClient.QueryInput> = {},
    ): DynamoDB.DocumentClient.QueryInput => ({
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

    const lease = (
      returnTimeout: number,
      retryStrategy?: () => RetryStrategy,
    ): Promise<Lease<T> | null> => withOptimisticLock(async (): Promise<Lease<T> | null> => {
      const now = Date.now()
      const retry = retryStrategy ?? retryStrategies.none()

      const makeQuery = async (): Promise<DynamoDB.ItemList | undefined> => {
        const queryResults = await dbDoc.query({
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
            ':now': (new Date(now)).toISOString(),
          },
          Limit: opts.leaseRandomizationRange,
        }).promise()

        const maybeItems = queryResults.Items
        const hasItems = maybeItems !== undefined && maybeItems.length !== 0
        return hasItems ? maybeItems as DynamoDB.ItemList : undefined
      }

      let items: DynamoDB.ItemList
      try {
        items = await withRetry(makeQuery, {
          strategy: retry,
          description: 'waiting for available lease',
        }) as DynamoDB.ItemList
      } catch (e) {
        if (e instanceof RetryError && retryStrategy === undefined) {
          return null
        }
        throw e
      }

      const itemIndex = Math.floor(Math.random() * items.length)
      const { id, version } = items[itemIndex] as Pick<LeaseDoc<T>, 'id' | 'version'>

      const updateResult = await dbDoc.update({
        TableName: opts.tableName,
        Key: {
          type: typeName,
          id,
        },
        UpdateExpression: 'set leaseExpiresBy = :leaseExpiresBy, leasingClientId = :leasingClientId, #version = :newVersion',
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
      }).promise()

      return { id, value: (updateResult.Attributes as LeaseDoc<T>).value }
    })

    const updateLease = (
      id: InstanceId,
      updates: {
        UpdateExpression: DynamoDB.UpdateExpression
        ExpressionAttributeValues?: DynamoDB.DocumentClient.ExpressionAttributeValueMap
      },
      updateOpts?: Partial<LeaseUpdateOpts>,
    ): Promise<void> => {
      const { validateClientId } = { ...DEFAULT_LEASE_UPDATE_OPTS, ...updateOpts }

      return withOptimisticLock(async (): Promise<void> => {
        const item = (await dbDoc.get({
          TableName: opts.tableName,
          Key: {
            type: typeName,
            id,
          },
        }).promise()).Item as LeaseDoc<T> | undefined

        if (item === undefined) {
          throw new InstanceNotFoundError({ id, typeName })
        }

        if (item.leaseExpiresBy === NOT_LEASED || (
          validateClientId && item.leasingClientId !== clientId
        )) {
          throw new InstanceNotLeasedError({ id, typeName, clientId })
        }

        const { version } = item

        await dbDoc.update({
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
        }).promise()
      })
    }

    return {
      async register(value: T, id: InstanceId = uuidv4()): Promise<InstanceId> {
        try {
          await dbDoc.put({
            TableName: opts.tableName,
            Item: {
              type: typeName,
              id,
              version: 0,
              value,
              leaseExpiresBy: NOT_LEASED,
            },
            ConditionExpression: 'attribute_not_exists(id)',
          }).promise()
          return id
        } catch (e) {
          if (e.code === 'ConditionalCheckFailedException') {
            throw new InstanceIdAlreadyRegistered({ id, typeName })
          }
          throw e
        }
      },

      async unregister(id: InstanceId): Promise<void> {
        try {
          await dbDoc.delete({
            TableName: opts.tableName,
            Key: {
              type: typeName,
              id,
            },
            ConditionExpression: 'attribute_exists(id)',
          }).promise()
        } catch (e) {
          if (e.code === 'ConditionalCheckFailedException') {
            throw new InstanceNotFoundError({ id, typeName })
          }
          throw e
        }
      },

      async lease(returnTimeout: number): Promise<Lease<T> | null> {
        return lease(returnTimeout)
      },

      async waitForLease(
        returnTimeout: number,
        retryStrategy: () => RetryStrategy,
      ): Promise<Lease<T>> {
        return lease(returnTimeout, retryStrategy) as Promise<Lease<T>>
      },

      updateTimeout(
        id: InstanceId,
        newTimeout: number,
        extendOpts?: Partial<LeaseUpdateOpts>,
      ): Promise<void> {
        const now = Date.now()
        const leaseExpiresBy = new Date(now + newTimeout).toISOString()
        return updateLease(
          id,
          {
            UpdateExpression: 'set #version = :newVersion, leaseExpiresBy = :leaseExpiresBy',
            ExpressionAttributeValues: { ':leaseExpiresBy': leaseExpiresBy },
          },
          extendOpts,
        )
      },

      return(
        id: InstanceId,
        returnOpts?: Partial<LeaseUpdateOpts>,
      ): Promise<void> {
        return updateLease(
          id,
          {
            UpdateExpression: 'set #version = :newVersion, leaseExpiresBy = :NOT_LEASED remove leasingClientId',
            ExpressionAttributeValues: { ':NOT_LEASED': NOT_LEASED },
          },
          returnOpts,
        )
      },

      [Symbol.asyncIterator](): AsyncIterator<LeaseWithStatus<T>> {
        const now = Date.now()

        const toLeaseWithStatus = (d: LeaseDoc<T>): LeaseWithStatus<T> => {
          const leaseExpiresBy = Date.parse(d.leaseExpiresBy)
          const isLeased = leaseExpiresBy > now

          return {
            id: d.id,
            value: d.value,
            ...isLeased ? {
              status: 'leased',
              leaseExpiresBy: new Date(leaseExpiresBy),
              clientId: d.leasingClientId,
            } : {
              status: 'available',
            },
          }
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
        const batchIter = docUtils.queryBatchIterator<QueryResult>(queryInput({
          Select: 'SPECIFIC_ATTRIBUTES',
          ProjectionExpression: 'id',
        }), opts.query)

        const keysToDelete: DynamoDB.Key[] = []

        let batch: Unpacked<ReturnType<typeof batchIter.next>>

        const nextBatch = async (): Promise<void> => {
          if (!batch || keysToDelete.length === 0) {
            if (batch?.done) {
              return undefined
            }
            batch = await batchIter.next()
            if (batch.value) {
              keysToDelete.push(
                ...batch.value.map(r => ({ type: typeName, id: r.id } as DynamoDB.Key))
              )
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
}, {
  tableName: 'persistent_pool',
  listBatchSize: undefined,
  billingMode: 'PAY_PER_REQUEST',
  optimisticLockMaxRetries: 10,
  leaseRandomizationRange: 10,
  batchDelete: { strategy: retryStrategies.exponentialBackoff() },
  query: { strategy: retryStrategies.intervals({ interval: 250, maxRetries: 10 }) },
})
