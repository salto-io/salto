import { Workspace, loginAdapter } from 'salto'
import { ObjectType, InstanceElement } from 'adapter-api'
import { command } from '../../src/commands/services'
import { MockWriteStream, getWorkspaceErrors, mockLoadConfig } from '../mocks'

jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  addAdapter: jest.fn().mockImplementation((
    _workspaceDir: string,
    adapterName: string
  ): Promise<boolean> => {
    if (adapterName === 'noAdapter') {
      return Promise.resolve(false)
    }
    return Promise.resolve(true)
  }),
  loginAdapter: jest.fn().mockImplementation((
    _workspace: Workspace,
    _fillCofig: (configType: ObjectType) => Promise<InstanceElement>,
    adapterName: string,
    _force: boolean
  ): Promise<boolean> => {
    if (adapterName === 'hubspot') {
      return Promise.resolve(false)
    }
    return Promise.resolve(true)
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
      await command('errdir', 'add', cliOutput, 'service').execute()
    })

    it('should print the error', async () => {
      expect(cliOutput.stderr.content).toContain('Error')
    })
  })

  describe('list command', () => {
    describe('when the workspace loads successfully', () => {
      describe('when called with no service name', () => {
        beforeEach(async () => {
          await command('', 'list', cliOutput, undefined).execute()
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
          await command('', 'list', cliOutput, 'hubspot').execute()
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
          await command('', 'list', cliOutput, 'notConfigured').execute()
        })

        it('should load the workspace', async () => {
          expect(Workspace.load).toHaveBeenCalled()
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
          await command('', 'add', cliOutput, 'hubspot').execute()
        })

        it('should print already added', async () => {
          expect(cliOutput.stderr.content).toContain('hubspot was already added to this workspace')
        })
      })

      describe('when called with a new service', () => {
        beforeEach(async () => {
          await command('', 'add', cliOutput, 'newAdapter').execute()
        })

        it('should print added', async () => {
          expect(cliOutput.stdout.content).toContain('added to the workspace')
        })

        it('should log it in', async () => {
          expect(loginAdapter).toHaveBeenCalled()
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
          await command('', 'login', cliOutput, 'hubspot').execute()
        })

        it('should fail login once', () => {
          expect(loginAdapter).toHaveReturnedWith(Promise.resolve(false))
        })

        it('should print login override', () => {
          expect(cliOutput.stdout.content).toContain('override')
        })

        it('should call login with force', () => {
          expect(loginAdapter).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 'hubspot', true)
        })

        it('should print logged in', () => {
          expect(cliOutput.stdout.content).toContain('Login information succesfully updated')
        })
      })

      describe('when called with not configured service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, 'notConfigured').execute()
        })

        it('should print not configured', () => {
          expect(cliOutput.stderr.content).toContain('notConfigured is not configured in this workspace')
        })
      })

      describe('when called with configured but not logged in service', () => {
        beforeEach(async () => {
          await command('', 'login', cliOutput, 'newAdapter').execute()
        })

        it('should log it in', async () => {
          expect(loginAdapter).toHaveBeenCalled()
        })

        it('shoudl print it logged in', async () => {
          expect(cliOutput.stdout.content).toContain('Login information succesfully updated')
        })
      })
    })
  })
})
