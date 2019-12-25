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
