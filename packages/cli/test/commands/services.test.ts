import { Workspace, updateLoginConfig, LoginStatus } from 'salto'
import { ObjectType } from 'adapter-api'
import { command } from '../../src/commands/services'
import {
  MockWriteStream, getWorkspaceErrors, mockLoadConfig, mockGetConfigFromUser, mockConfigType,
} from '../mocks'

jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  addAdapter: jest.fn().mockImplementation((
    _workspaceDir: string,
    adapterName: string
  ): Promise<ObjectType> => {
    if (adapterName === 'noAdapter') {
      throw Error('no adapater')
    }
    return Promise.resolve(mockConfigType(adapterName))
  }),
  updateLoginConfig: jest.fn(),
  getLoginStatuses: jest.fn().mockImplementation((
    _workspace: Workspace,
    serviceNames: string[]
  ) => {
    const loginStatuses: Record<string, LoginStatus> = {}
    serviceNames.forEach(serviceName => {
      if (serviceName === 'salesforce') {
        loginStatuses[serviceName] = {
          isLoggedIn: true,
          configType: mockConfigType(serviceName),
        }
      } else {
        loginStatuses[serviceName] = {
          isLoggedIn: false,
          configType: mockConfigType(serviceName),
        }
      }
    })
    return loginStatuses
  }),
  Workspace: {
    load: jest.fn().mockImplementation(config => {
      if (config.baseDir === 'errdir') {
        return {
          hasErrors: () => true,
          errors: {
            strings: () => ['Error', 'Error'],
          },
          getWorkspaceErrors,
          config,
        }
      }
      return {
        hasErrors: () => false,
        config,
      }
    }),
  },
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) => mockLoadConfig(workspaceDir)),
}))

describe('services command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  describe('when workspace fails to load', () => {
    beforeEach(async () => {
      await command('errdir', 'add', cliOutput, mockGetConfigFromUser, 'service').execute()
    })

    it('should print the error', async () => {
      expect(cliOutput.stderr.content).toContain('Error')
    })
  })

  describe('list command', () => {
    describe('when the workspace loads successfully', () => {
      describe('when called with no service name', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetConfigFromUser, undefined).execute()
        })

        it('should load the workspace', () => {
          expect(Workspace.load).toHaveBeenCalled()
        })

        it('should print configured services', () => {
          expect(cliOutput.stdout.content).toContain('The configured services are:')
          expect(cliOutput.stdout.content).toContain('hubspot')
        })
      })

      describe('when called with service that is configured', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetConfigFromUser, 'hubspot').execute()
        })

        it('should load the workspace', async () => {
          expect(Workspace.load).toHaveBeenCalled()
        })

        it('should print configured services', async () => {
          expect(cliOutput.stdout.content).toContain('hubspot is configured in this workspace')
        })
      })

      describe('when called with a service that is not configured', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, mockGetConfigFromUser, 'notConfigured').execute()
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
          await command('', 'add', cliOutput, mockGetConfigFromUser, 'salesforce').execute()
        })

        it('should print already added', async () => {
          expect(cliOutput.stderr.content).toContain('salesforce was already added to this workspace')
        })
      })

      describe('when called with a new service', () => {
        beforeEach(async () => {
          await command('', 'add', cliOutput, mockGetConfigFromUser, 'newAdapter').execute()
        })

        it('should print added', async () => {
          expect(cliOutput.stdout.content).toContain('added to the workspace')
        })

        it('should print it logged in', async () => {
          expect(cliOutput.stdout.content).toContain('Login information succesfully updated')
        })
      })
    })
  })

  describe('login command', () => {
    describe('when the workspace loads successfully', () => {
      describe('when called with already logged in service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, mockGetConfigFromUser, 'salesforce').execute()
        })

        it('should print login override', () => {
          expect(cliOutput.stdout.content).toContain('override')
        })

        it('should get config from user', () => {
          expect(mockGetConfigFromUser).toHaveBeenCalled()
        })

        it('should call update config', () => {
          expect(updateLoginConfig).toHaveBeenCalled()
        })

        it('should print logged in', () => {
          expect(cliOutput.stdout.content).toContain('Login information succesfully updated')
        })
      })

      describe('when called with not configured service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, mockGetConfigFromUser, 'notConfigured').execute()
        })

        it('should print not configured', () => {
          expect(cliOutput.stderr.content).toContain('notConfigured is not configured in this workspace')
        })
      })

      describe('when called with configured but not logged in service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, mockGetConfigFromUser, 'salesforce').execute()
        })

        it('should get config from user', () => {
          expect(mockGetConfigFromUser).toHaveBeenCalled()
        })

        it('should call update config', async () => {
          expect(updateLoginConfig).toHaveBeenCalled()
        })

        it('should print it logged in', async () => {
          expect(cliOutput.stdout.content).toContain('Login information succesfully updated')
        })
      })
    })
  })
})
