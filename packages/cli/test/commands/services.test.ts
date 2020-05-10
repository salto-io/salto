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
import { LoginStatus, updateCredentials, Workspace, loadLocalWorkspace, addAdapter } from '@salto-io/core'
import { ObjectType } from '@salto-io/adapter-api'
import { command } from '../../src/commands/services'
import * as mocks from '../mocks'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  addAdapter: jest.fn().mockImplementation((
    _workspace: Workspace,
    adapterName: string
  ): Promise<ObjectType> => {
    if (adapterName === 'noAdapter') {
      throw Error('no adapater')
    }
    return Promise.resolve(mocks.mockConfigType(adapterName))
  }),
  updateCredentials: jest.fn().mockResolvedValue(true),
  getLoginStatuses: jest.fn().mockImplementation((
    _workspace: Workspace,
    serviceNames: string[]
  ) => {
    const loginStatuses: Record<string, LoginStatus> = {}
    serviceNames.forEach(serviceName => {
      if (serviceName === 'salesforce') {
        loginStatuses[serviceName] = {
          isLoggedIn: true,
          configType: mocks.mockConfigType(serviceName),
        }
      } else {
        loginStatuses[serviceName] = {
          isLoggedIn: false,
          configType: mocks.mockConfigType(serviceName),
        }
      }
    })
    return loginStatuses
  }),
  loadLocalWorkspace: jest.fn(),
}))

describe('services command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockGetCredentialsFromUser = mocks.createMockGetCredentialsFromUser({
    username: 'test@test',
    password: 'test',
    token: 'test',
    sandbox: false,
  })
  const currentEnv = 'env'
  const mockLoadWorkspace = loadLocalWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(() => {
    let services = ['salesforce']
    let env = currentEnv
    return {
      services: () => services,
      hasErrors: () => false,
      setCurrentEnv: (newEnv: string) => {
        env = newEnv
        services = ['netsuite']
      },
      currentEnv: () => env,
    }
  })

  beforeEach(() => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  describe('Invalid service command', () => {
    it('invalid command', async () => {
      try {
        await command('', 'errorCommand', cliOutput, mockGetCredentialsFromUser, 'service')
          .execute()
      } catch (error) {
        expect(error.message).toMatch('Unknown service management command')
      }
    })
  })
  describe('list command', () => {
    describe('when the workspace loads successfully', () => {
      describe('when called with no service name', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetCredentialsFromUser, undefined).execute()
        })

        it('should load the workspace', () => {
          expect(mockLoadWorkspace).toHaveBeenCalled()
        })

        it('should print configured services', () => {
          expect(cliOutput.stdout.content).toContain('The configured services are:')
          expect(cliOutput.stdout.content).toContain('salesforce')
        })
      })

      describe('when called with service that is configured', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetCredentialsFromUser, 'salesforce').execute()
        })

        it('should load the workspace', async () => {
          expect(mockLoadWorkspace).toHaveBeenCalled()
        })

        it('should print configured services', async () => {
          expect(cliOutput.stdout.content).toContain('salesforce is configured in this environment')
        })
      })

      describe('when called with a service that is not configured', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetCredentialsFromUser, 'notConfigured').execute()
        })

        it('should print configured services', async () => {
          expect(cliOutput.stdout.content).toContain('notConfigured is not configured in this environment')
        })
      })
      describe('Environment flag', () => {
        beforeEach(async () => {
          mockLoadWorkspace.mockClear()
        })
        it('should use current env when env is not provided', async () => {
          await command('', 'list', cliOutput, mockGetCredentialsFromUser, 'salesforce').execute()
          expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
          expect(cliOutput.stdout.content).toContain('salesforce')
        })
        it('should use provided env', async () => {
          const injectedEnv = 'injected'
          await command(
            '',
            'list',
            cliOutput,
            mockGetCredentialsFromUser,
            undefined,
            injectedEnv,
          ).execute()
          expect(cliOutput.stdout.content).toContain('netsuite')
        })
      })
    })
  })

  describe('add command', () => {
    describe('when the workspace loads successfully', () => {
      describe('when called with already configured service', () => {
        beforeEach(async () => {
          await command('', 'add', cliOutput, mockGetCredentialsFromUser, 'salesforce').execute()
        })

        it('should print already added', async () => {
          expect(cliOutput.stderr.content).toContain('salesforce was already added to this environment')
        })
      })

      describe('when called with a new service', () => {
        beforeEach(async () => {
          await command('', 'add', cliOutput, mockGetCredentialsFromUser, 'newAdapter').execute()
        })

        it('should print added', async () => {
          expect(cliOutput.stdout.content).toContain('added to the environment')
        })

        it('should print please enter credentials', async () => {
          expect(cliOutput.stdout.content).toContain('Please enter your Newadapter credentials:')
        })

        describe('when called with valid credentials', () => {
          beforeEach(async () => {
            await command('', 'add', cliOutput, mockGetCredentialsFromUser, 'newAdapter').execute()
          })
          it('should print login information updated', async () => {
            expect(cliOutput.stdout.content).toContain('Login information successfully updated!')
          })
        })

        describe('when called with invalid credentials', () => {
          beforeEach(async () => {
            (updateCredentials as jest.Mock).mockRejectedValue('Rejected!')
            await command('', 'add', cliOutput, mockGetCredentialsFromUser, 'newAdapter').execute()
          })
          afterEach(() => {
            (updateCredentials as jest.Mock).mockResolvedValue(true)
          })

          it('should print login error', async () => {
            expect(cliOutput.stderr.content).toContain('Could not login to newAdapter')
          })

          it('should print try again text', async () => {
            expect(cliOutput.stderr.content).toContain('To try again run: `salto services login newAdapter`')
          })
        })
        describe('Environment flag', () => {
          const mockAddAdapter = addAdapter as jest.Mock
          beforeEach(async () => {
            mockLoadWorkspace.mockClear()
            mockAddAdapter.mockClear()
          })
          it('should use current env when env is not provided', async () => {
            await command('', 'add', cliOutput, mockGetCredentialsFromUser, 'hubspot').execute()
            expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
            expect(mockAddAdapter.mock.calls[0][0].currentEnv()).toEqual(currentEnv)
          })
          it('should use provided env', async () => {
            await command(
              '',
              'add',
              cliOutput,
              mockGetCredentialsFromUser,
              undefined,
              'injected'
            ).execute()
            expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
            expect(mockAddAdapter.mock.calls[0][0].currentEnv()).toEqual('injected')
          })
        })
      })
    })
  })

  describe('login command', () => {
    describe('when the workspace loads successfully', () => {
      describe('when called with already logged in service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, mockGetCredentialsFromUser, 'salesforce').execute()
        })

        it('should print login override', () => {
          expect(cliOutput.stdout.content).toContain('override')
        })

        it('should get config from user', () => {
          expect(mockGetCredentialsFromUser).toHaveBeenCalled()
        })

        it('should call update config', () => {
          expect(updateCredentials).toHaveBeenCalled()
        })

        it('should print logged in', () => {
          expect(cliOutput.stdout.content).toContain('Login information successfully updated')
        })
      })

      describe('when called with not configured service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, mockGetCredentialsFromUser, 'notConfigured').execute()
        })

        it('should print not configured', () => {
          expect(cliOutput.stderr.content).toContain('notConfigured is not configured in this environment')
        })
      })

      describe('when called with configured but not logged in service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, mockGetCredentialsFromUser, 'salesforce').execute()
        })
        it('should get config from user', () => {
          expect(mockGetCredentialsFromUser).toHaveBeenCalled()
        })

        it('should call update config', async () => {
          expect(updateCredentials).toHaveBeenCalled()
        })

        it('should print it logged in', async () => {
          expect(cliOutput.stdout.content).toContain('Login information successfully updated')
        })
      })
      describe('Environment flag', () => {
        const mockupdateCredentials = updateCredentials as jest.Mock
        beforeEach(async () => {
          mockLoadWorkspace.mockClear()
          mockupdateCredentials.mockClear()
        })
        it('should use current env when env is not provided', async () => {
          await command('', 'login', cliOutput, mockGetCredentialsFromUser, 'salesforce').execute()
          expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
          expect((mockupdateCredentials.mock.calls[0][0] as Workspace).currentEnv())
            .toEqual(currentEnv)
        })
        it('should use provided env', async () => {
          await command(
            '',
            'login',
            cliOutput,
            mockGetCredentialsFromUser,
            'netsuite',
            'injected'
          ).execute()
          expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
          expect((mockupdateCredentials.mock.calls[0][0] as Workspace).currentEnv())
            .toEqual('injected')
        })
      })
    })
  })
})
