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
import { LoginStatus, updateLoginConfig, Workspace } from '@salto-io/core'
import { ObjectType } from '@salto-io/adapter-api'
import { CliExitCode } from '../../src/types'
import { command } from '../../src/commands/services'
import * as mocks from '../mocks'
import * as workspace from '../../src/workspace'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  addAdapter: jest.fn().mockImplementation((
    _workspaceDir: string,
    adapterName: string
  ): Promise<ObjectType> => {
    if (adapterName === 'noAdapter') {
      throw Error('no adapater')
    }
    return Promise.resolve(mocks.mockConfigType(adapterName))
  }),
  updateLoginConfig: jest.fn().mockResolvedValue(true),
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
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) =>
    mocks.mockLoadConfig(workspaceDir)),
}))
jest.mock('../../src/workspace')
describe('services command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockGetCredentialsFromUser = mocks.createMockGetCredentialsFromUser({
    username: 'test@test',
    password: 'test',
    token: 'test',
    sandbox: false,
  })
  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(baseDir => {
    if (baseDir === 'errdir') {
      return { workspace: {
        hasErrors: () => true,
        errors: {
          strings: () => ['Error', 'Error'],
        },
        getWorkspaceErrors: mocks.getWorkspaceErrors,
        config: mocks.mockLoadConfig(baseDir),
      },
      errored: true }
    }
    return { workspace: {
      hasErrors: () => false,
      config: mocks.mockLoadConfig(baseDir),
    },
    errored: false }
  })

  beforeEach(() => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  describe('when workspace fails to load', () => {
    let result: number
    beforeEach(async () => {
      result = await command('errdir', 'add', cliOutput, mockGetCredentialsFromUser, 'service')
        .execute()
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
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
          expect(cliOutput.stdout.content).toContain('hubspot')
        })
      })

      describe('when called with service that is configured', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetCredentialsFromUser, 'hubspot').execute()
        })

        it('should load the workspace', async () => {
          expect(mockLoadWorkspace).toHaveBeenCalled()
        })

        it('should print configured services', async () => {
          expect(cliOutput.stdout.content).toContain('hubspot is configured in this workspace')
        })
      })

      describe('when called with a service that is not configured', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetCredentialsFromUser, 'notConfigured').execute()
        })

        it('should print configured services', async () => {
          expect(cliOutput.stdout.content).toContain('notConfigured is not configured in this workspace')
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
          expect(cliOutput.stderr.content).toContain('salesforce was already added to this workspace')
        })
      })

      describe('when called with a new service', () => {
        beforeEach(async () => {
          await command('', 'add', cliOutput, mockGetCredentialsFromUser, 'newAdapter').execute()
        })

        it('should print added', async () => {
          expect(cliOutput.stdout.content).toContain('added to the workspace')
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
            (updateLoginConfig as jest.Mock).mockRejectedValue('Rejected!')
            await command('', 'add', cliOutput, mockGetCredentialsFromUser, 'newAdapter').execute()
          })
          afterEach(() => {
            (updateLoginConfig as jest.Mock).mockResolvedValue(true)
          })

          it('should print login error', async () => {
            expect(cliOutput.stderr.content).toContain('Could not login to newAdapter')
          })

          it('should print try again text', async () => {
            expect(cliOutput.stderr.content).toContain('To try again run: `salto services login newAdapter`')
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
          expect(updateLoginConfig).toHaveBeenCalled()
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
          expect(cliOutput.stderr.content).toContain('notConfigured is not configured in this workspace')
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
          expect(updateLoginConfig).toHaveBeenCalled()
        })

        it('should print it logged in', async () => {
          expect(cliOutput.stdout.content).toContain('Login information successfully updated')
        })
      })
    })
  })
})
