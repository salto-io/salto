import { EOL } from 'os'
import { Writable } from 'stream'
import memoryStream from 'memory-streams'
import { Repo, dynamoDbRepo, Pool } from '@salto/persistent-pool'
import argparser, { Parser, DEFAULT_TABLE } from '../../src/cli/argparser'
import { Adapter } from '../../src/types'
import salesforceAdapter from '../../src/adapters/salesforce'
import { CliReturnCode } from '../../src/cli/types'

type MockPool = {
  [P in keyof Pool]: jest.SpyInstance
}

describe('argparser', () => {
  let stdout: Writable
  let stderr: Writable
  let adapters: Record<string, Adapter>
  let repo: (tableName: string) => Promise<Repo>
  let parser: Parser
  let returnCode: CliReturnCode
  let mockPool: MockPool
  let realPool: Pool

  const serviceOpts = {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local',
  }

  const createRealRepo = (): Promise<Repo> => dynamoDbRepo({
    serviceOpts,
    tableName: DEFAULT_TABLE,
    clientId: 'credentials-store-tests',
  })

  beforeEach(async () => {
    stdout = new memoryStream.WritableStream()
    stderr = new memoryStream.WritableStream()
    adapters = { salesforce: salesforceAdapter() }

    await (await (await createRealRepo()).pool('salesforce')).clear()

    repo = async (tableName: string) => {
      if (tableName !== DEFAULT_TABLE) {
        throw new Error(`unexpected tableName: "${tableName}"`)
      }
      const realRepo = await createRealRepo()
      const original = realRepo.pool
      jest.spyOn(realRepo, 'pool').mockImplementation(async (typeName: string) => {
        realPool = await original(typeName)
        mockPool = Object.assign(
          { [Symbol.asyncIterator]: realPool[Symbol.asyncIterator].bind(realPool) },
          ...Object.keys(realPool).map(k => ({ [k]: jest.spyOn(realPool, k as keyof Pool) }))
        )
        return mockPool as unknown as Pool<{}>
      })
      return realRepo
    }

    parser = argparser({ stdout, stderr, adapters, repo })
  })

  describe('no args', () => {
    beforeEach(async () => {
      returnCode = await parser([])
    })

    it('writes usage to stdout', () => {
      expect(stdout.toString()).toMatch(/Usage:/)
    })

    it('returns 1', () => {
      expect(returnCode).toBe(1)
    })
  })

  describe('adapters', () => {
    beforeEach(async () => {
      returnCode = await parser(['adapters'])
    })

    it('writes the list of adapters', () => {
      expect(stdout.toString()).toEqual(`salesforce${EOL}`)
    })

    it('returns 0', () => {
      expect(returnCode).toBe(0)
    })
  })

  describe('register', () => {
    beforeEach(async () => {
      returnCode = await parser(
        'register salesforce my-id --username="user1" --password="pass1"'.split(' ')
      )
    })

    afterEach(async () => {
      await realPool.clear()
    })

    it('calls pool.register correctly', () => {
      expect(mockPool.register).toHaveBeenCalledWith(
        { password: 'pass1', username: 'user1', apiToken: undefined, isSandbox: false },
        'my-id'
      )
    })

    it('returns 0', () => {
      expect(returnCode).toBe(0)
    })
  })

  describe('clear', () => {
    beforeEach(async () => {
      await parser(
        'register salesforce my-id --username="user1" --password="pass1"'.split(' ')
      )
      returnCode = await parser('clear salesforce'.split(' '))
    })

    it('calls pool.clear correctly', () => {
      expect(mockPool.clear).toHaveBeenCalled()
    })

    it('clears the pool', async () => {
      expect(await realPool[Symbol.asyncIterator]().next()).toMatchObject({ done: true })
    })

    it('returns 0', () => {
      expect(returnCode).toBe(0)
    })
  })

  describe('free', () => {
    describe('when the lease does not exist', () => {
      beforeEach(async () => {
        returnCode = await parser('free salesforce my-id'.split(' '))
      })

      it('writes an error message', () => {
        expect(stderr.toString()).toMatch(/not found/)
      })

      it('returns 1', () => {
        expect(returnCode).toBe(1)
      })
    })

    describe('when the lease exists', () => {
      beforeEach(async () => {
        await parser(
          'register salesforce my-id --username="user1" --password="pass1"'.split(' ')
        )
        returnCode = await parser('free salesforce my-id'.split(' '))
      })

      it('calls pool.return correctly', () => {
        expect(mockPool.return).toHaveBeenCalled()
      })

      it('returns the lease', async () => {
        expect((await realPool[Symbol.asyncIterator]().next()).value).toMatchObject({
          status: 'available',
        })
      })

      it('returns 0', () => {
        expect(returnCode).toBe(0)
      })
    })
  })
})
