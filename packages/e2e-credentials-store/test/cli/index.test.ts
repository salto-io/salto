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
import { EOL } from 'os'
import { Writable } from 'stream'
import memoryStream from 'memory-streams'
import {
  dynamoDbRepo, Pool, Lease, InstanceNotLeasedError, Repo,
} from '@salto-io/persistent-pool'
import cli from '../../src/cli'
import { Adapter } from '../../src/types'
import REPO_PARAMS from '../../src/repo_params'

type MockPool = Pool & {
  [P in keyof Pool]: jest.SpyInstance<ReturnType<Pool[P]>, Parameters<Pool[P]>>
}

type MyCreds = {
  username: string
  password: string
}

type MyArgs = {
  username: string
  password: string
}

const myAdapter: Adapter<MyArgs, MyCreds> = {
  name: 'salesforce',
  credentialsOpts: {
    username: {
      type: 'string',
      demand: true,
    },
    password: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    username: args.username,
    password: args.password,
  }),
  validateCredentials: () => Promise.resolve(),
}

const createRealRepo = (): Promise<Repo> => dynamoDbRepo({
  ...REPO_PARAMS,
  serviceOpts: {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local',
  },
  clientId: 'credentials-store-tests',
})

const adapters = { salesforce: myAdapter }

describe('argparser', () => {
  let stdout: Writable
  let stderr: Writable
  let mockPool: MockPool
  let realPool: Pool
  let repo: Repo
  let exitCode: number | undefined
  let createRepo: jest.Mock<Promise<Repo>, [string]>

  const runCli = (commandLine: string): Promise<number> => new Promise(resolve => cli({
    adapters,
    process: {
      stdout,
      stderr,
      exit: resolve as (code: number) => never,
      argv: ['node', 'myscriptname', ...commandLine.split(' ')],
    },
    createRepo,
  }))

  beforeEach(async () => {
    exitCode = undefined
    stdout = new memoryStream.WritableStream()
    stderr = new memoryStream.WritableStream()
    repo = await createRealRepo()
    realPool = await repo.pool(myAdapter.name)
    await realPool.clear()
    mockPool = Object.assign(
      { [Symbol.asyncIterator]: realPool[Symbol.asyncIterator].bind(realPool) },
      ...Object.keys(realPool).map(k => ({ [k]: jest.spyOn(realPool, k as keyof Pool) }))
    )
    jest.spyOn(repo, 'pool').mockImplementation(() => Promise.resolve(mockPool as Pool<{}>))
    createRepo = jest.fn<Promise<Repo>, [string]>(() => Promise.resolve(repo))
  })

  describe('no args', () => {
    beforeEach(async () => {
      (stdout as unknown as { columns: number | undefined }).columns = 80
      exitCode = await runCli('')
    })

    it('writes usage to stderr', () => {
      expect(stderr.toString()).toMatch(/Usage:/)
    })

    it('returns 1', () => {
      expect(exitCode).toBe(1)
    })
  })

  describe('--help', () => {
    beforeEach(async () => {
      exitCode = await runCli('--help')
    })

    it('writes usage to stderr', () => {
      expect(stdout.toString()).toMatch(/Commands:/)
    })

    it('returns 0', () => {
      expect(exitCode).toBe(0)
    })
  })

  describe('adapters', () => {
    beforeEach(async () => {
      exitCode = await runCli('adapters')
    })

    it('writes the list of adapters', () => {
      expect(stdout.toString()).toEqual(`salesforce${EOL}`)
    })

    it('returns 0', () => {
      expect(exitCode).toBe(0)
    })
  })

  describe('register', () => {
    describe('when an invalid adapter name is given', () => {
      beforeEach(async () => {
        exitCode = await runCli('register nosuchadapter')
      })

      it('writes an error message with the list of adapters', () => {
        expect(stderr.toString()).toMatch(/Invalid adapter.*salesforce/)
      })

      it('returns 1', () => {
        expect(exitCode).toBe(1)
      })
    })

    describe('when a valid adapter name is given', () => {
      describe('when the validation succeeds', () => {
        beforeEach(async () => {
          exitCode = await runCli('register salesforce my-id --username="user1" --password="pass1"')
        })

        it('calls pool.register correctly', () => {
          expect(mockPool.register).toHaveBeenCalledWith(
            { password: 'pass1', username: 'user1' },
            'my-id'
          )
        })

        it('returns 0', () => {
          expect(exitCode).toBe(0)
        })
      })

      describe('when the validation failes', () => {
        beforeEach(async () => {
          jest.spyOn(myAdapter, 'validateCredentials')
            .mockImplementationOnce(() => Promise.reject(new Error('not valid')))
          exitCode = await runCli('register salesforce my-id --username="user1" --password="pass1"')
        })

        it('does not calls pool.register', () => {
          expect(mockPool.register).not.toHaveBeenCalled()
        })

        it('prints the validation error', () => {
          expect(stderr.toString()).toContain('not valid')
        })

        it('returns 1', () => {
          expect(exitCode).toBe(1)
        })
      })
    })
  })

  describe('clear', () => {
    beforeEach(async () => {
      await runCli('register salesforce my-id --username="user1" --password="pass1"')
      exitCode = await runCli('clear salesforce')
    })

    it('calls pool.clear correctly', () => {
      expect(mockPool.clear).toHaveBeenCalled()
    })

    it('clears the pool', async () => {
      expect(await realPool[Symbol.asyncIterator]().next()).toMatchObject({ done: true })
    })

    it('returns 0', () => {
      expect(exitCode).toBe(0)
    })
  })

  describe('free', () => {
    describe('when the instance id does not exist', () => {
      beforeEach(async () => {
        exitCode = await runCli('free salesforce my-id')
      })

      it('writes an error message', () => {
        expect(stderr.toString()).toMatch(/not found/)
      })

      it('returns 1', () => {
        expect(exitCode).toBe(1)
      })
    })

    describe('when the instance id exists', () => {
      beforeEach(async () => {
        await runCli(
          'register salesforce my-id --username="user1" --password="pass1"'
        )
        await runCli('lease salesforce')
        exitCode = await runCli('free salesforce my-id')
      })

      it('calls pool.return correctly', async () => {
        expect(mockPool.return).toHaveBeenCalledWith('my-id', { validateClientId: false })
        expect(await mockPool.return.mock.results[0].value).toBeUndefined()
      })

      it('returns the lease', async () => {
        expect((await realPool[Symbol.asyncIterator]().next()).value).toMatchObject({
          status: 'available',
        })
      })

      it('returns 0', () => {
        expect(exitCode).toBe(0)
      })

      describe('when the instance is already free', () => {
        beforeEach(async () => {
          exitCode = await runCli('free salesforce my-id')
          return expect(
            mockPool.return.mock.results[1].value
          ).rejects.toThrow(InstanceNotLeasedError)
        })

        it('returns 0', () => {
          expect(exitCode).toBe(0)
        })
      })
    })

    describe('when the call to the pool fails', () => {
      let error: Error

      beforeEach(async () => {
        error = new Error('testing')
        mockPool.return.mockImplementationOnce(() => Promise.reject(error))
        exitCode = await runCli('free salesforce my-id')
      })

      it('returns 2', () => {
        expect(exitCode).toEqual(2)
      })

      it('prints the error to stderr', () => {
        expect(stderr.toString()).toContain(error.message)
      })
    })
  })

  describe('unregister', () => {
    describe('when the lease does not exist', () => {
      beforeEach(async () => {
        exitCode = await runCli('unregister salesforce my-id')
      })

      it('writes an error message', () => {
        expect(stderr.toString()).toMatch(/not found/)
      })

      it('returns 1', () => {
        expect(exitCode).toBe(1)
      })
    })

    describe('when the lease exists', () => {
      beforeEach(async () => {
        await runCli(
          'register salesforce my-id --username="user1" --password="pass1"'
        )
      })

      describe('when the call to the pool succeeds', () => {
        beforeEach(async () => {
          exitCode = await runCli('unregister salesforce my-id')
        })

        it('calls pool.return correctly', () => {
          expect(mockPool.unregister).toHaveBeenCalledWith('my-id')
        })

        it('returns 0', () => {
          expect(exitCode).toBe(0)
        })
      })

      describe('when the call to the pool fails', () => {
        let error: Error

        beforeEach(async () => {
          error = new Error('testing')
          mockPool.unregister.mockImplementationOnce(() => Promise.reject(error))
          exitCode = await runCli('unregister salesforce my-id')
          return expect(mockPool.unregister.mock.results[0].value).rejects.toThrow(error)
        })

        it('returns 2', () => {
          expect(exitCode).toEqual(2)
        })

        it('prints the error to stderr', () => {
          expect(stderr.toString()).toContain(error.message)
        })
      })
    })
  })

  describe('lease', () => {
    describe('when an available lease does not exist', () => {
      beforeEach(async () => {
        exitCode = await runCli('lease salesforce')
      })

      it('writes an error message', () => {
        expect(stderr.toString()).toMatch(/No lease available/)
      })

      it('returns 1', () => {
        expect(exitCode).toBe(1)
      })
    })

    describe('when an available lease exists', () => {
      beforeEach(async () => {
        await runCli(
          'register salesforce my-id --username="user1" --password="pass1"'
        )
        exitCode = await runCli('lease salesforce 50')
      })

      it('calls pool.return correctly', () => {
        expect(mockPool.lease).toHaveBeenCalledWith(50 * 1000)
      })

      it('outputs the lease as JSON', () => {
        const o = JSON.parse(stdout.toString())
        expect(o.id).toEqual('my-id')
        expect(o.value).toMatchObject({ username: 'user1', password: 'pass1' })
      })

      it('returns 0', () => {
        expect(exitCode).toBe(0)
      })
    })
  })

  describe('list', () => {
    let lease1: Lease<unknown>
    let lease2: Lease<unknown>
    beforeEach(async () => {
      // leased
      expect(await runCli(
        'register salesforce my-id1 --username="user1" --password="pass1"'
      )).toEqual(0)
      lease1 = await realPool.lease(100000) as Lease<unknown>
      expect(lease1).not.toBeNull()

      // suspended
      expect(await runCli(
        'register salesforce my-id2 --username="user2" --password="pass2"'
      )).toEqual(0)
      lease2 = await realPool.lease(100000) as Lease<unknown>
      await realPool.suspend(lease2.id, 'not being nice', 10000)

      // available
      expect(await runCli(
        'register salesforce my-id3 --username="user3" --password="pass3"'
      )).toEqual(0)
    })

    afterEach(async () => {
      await realPool.return(lease1.id)
      await realPool.return(lease2.id)
    })

    describe('default format (pretty)', () => {
      beforeEach(async () => {
        exitCode = await runCli('list salesforce')
      })

      it('returns 0', () => {
        expect(exitCode).toBe(0)
      })

      it('lists the sets of credentials with their status', () => {
        expect(stdout.toString()).toMatch(/my-id.*available/)
        expect(stdout.toString()).toMatch(/my-id.*leased/)
        expect(stdout.toString()).toMatch(/my-id.*suspended.*not being nice/)
      })
    })

    describe('--format=json', () => {
      beforeEach(async () => {
        exitCode = await runCli('list salesforce --format=json')
      })

      it('returns 0', () => {
        expect(exitCode).toBe(0)
      })

      const findEntry = <T>(
        status: string
      ): T => {
        const result = JSON.parse(stdout.toString()).find(
          (x: { status: string }): boolean => x.status === status
        )
        expect(result).toBeDefined()
        return result
      }

      describe('leased entry', () => {
        let entry: { clientId: string; leaseExpiresBy: string }

        beforeEach(() => {
          entry = findEntry('leased')
        })

        it('should have a clientId', () => {
          expect(entry.clientId).toBeDefined()
        })

        it('should have a leaseExpiresBy property', () => {
          expect(entry.leaseExpiresBy).toBeDefined()
        })
      })

      describe('suspended entry', () => {
        let entry: { clientId: string; leaseExpiresBy: string; suspensionReason: string }

        beforeEach(() => {
          entry = findEntry('suspended')
        })

        it('should have a clientId', () => {
          expect(entry.clientId).toBeDefined()
        })

        it('should have a leaseExpiresBy property', () => {
          expect(entry.leaseExpiresBy).toBeDefined()
        })

        it('should have a suspensionReason property', () => {
          expect(entry.suspensionReason).toEqual('not being nice')
        })
      })

      describe('available entry', () => {
        let entry: { }

        beforeEach(() => {
          entry = findEntry('available')
        })

        it('should exist', () => {
          expect(entry).toBeDefined()
        })
      })
    })
  })
})
