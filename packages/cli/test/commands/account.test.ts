/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AdapterAuthentication, BuiltinTypes, ElemID, ObjectType } from '@salto-io/adapter-api'
import { addAdapter, installAdapter, LoginStatus, updateCredentials, verifyCredentials } from '@salto-io/core'
import { loadLocalWorkspace } from '@salto-io/local-workspace'
import { Workspace } from '@salto-io/workspace'
import { MockWorkspace, mockWorkspace } from '@salto-io/e2e-test-utils'
import { getPrivateAdaptersNames } from '../../src/formatter'
import {
  accountAddDef,
  accountLoginDef,
  addAction,
  createConfigFromLoginParameters,
  listAction,
  loginAction,
} from '../../src/commands/account'
import { processOauthCredentials } from '../../src/cli_oauth_authenticator'
import * as mocks from '../mocks'
import * as callbacks from '../../src/callbacks'
import { CliExitCode, TelemetryEventNames, CliError } from '../../src/types'
import { buildEventName } from '../../src/telemetry'

jest.mock('../../src/cli_oauth_authenticator', () => ({
  processOauthCredentials: jest.fn().mockResolvedValue({
    fields: {
      instanceUrl: 'someInstanceUrl',
      accessToken: 'accessToken',
    },
  }),
}))
jest.mock('@salto-io/core', () => {
  const actual = jest.requireActual('@salto-io/core')
  return {
    ...actual,
    getAdaptersCredentialsTypes: jest
      .fn()
      .mockImplementation((serviceNames: string[]): Record<string, AdapterAuthentication> => {
        if (serviceNames[0] === 'noAdapter') {
          throw new Error('no adapter')
        }
        return {
          newAdapter: mocks.mockCredentialsType('newAdapter'),
          netsuite: mocks.mockCredentialsType('netsuite'),
          '': mocks.mockCredentialsType(''),
          oauthAdapter: mocks.mockOauthCredentialsType('oauthAdapter', { url: '', oauthRequiredFields: [''] }),
        }
      }),
    addAdapter: jest
      .fn()
      .mockImplementation((_workspace: Workspace, adapterName: string): Promise<AdapterAuthentication> => {
        if (adapterName === 'noAdapter') {
          throw new Error('no adapter')
        }
        return Promise.resolve(mocks.mockAdapterAuthentication(mocks.mockConfigType(adapterName)))
      }),
    verifyCredentials: jest.fn().mockResolvedValue({ success: true, accountId: '1' }),
    updateCredentials: jest.fn().mockResolvedValue(true),
    getLoginStatuses: jest.fn().mockImplementation((_workspace: Workspace, accountNames: string[]) => {
      const loginStatuses: Record<string, LoginStatus> = {}
      accountNames.forEach(accountName => {
        if (accountName === 'salesforce') {
          loginStatuses[accountName] = {
            isLoggedIn: true,
            configTypeOptions: mocks.mockAdapterAuthentication(mocks.mockConfigType(accountName)),
          }
        } else if (accountName === 'oauthAdapter') {
          loginStatuses[accountName] = {
            isLoggedIn: true,
            configTypeOptions: mocks.mockOauthCredentialsType(accountName, { url: '', oauthRequiredFields: [''] }),
          }
        } else {
          loginStatuses[accountName] = {
            isLoggedIn: false,
            configTypeOptions: mocks.mockAdapterAuthentication(mocks.mockConfigType(accountName)),
          }
        }
      })
      return loginStatuses
    }),
    installAdapter: jest.fn(),
  }
})
jest.mock('@salto-io/local-workspace', () => {
  const actual = jest.requireActual('@salto-io/local-workspace')
  return {
    ...actual,
    loadLocalWorkspace: jest.fn().mockImplementation(actual.loadLocalWorkspace),
  }
})
jest.mock('@salto-io/adapter-creators', () => {
  const actual = jest.requireActual('@salto-io/adapter-creators')
  return {
    ...actual,
    getSupportedServiceAdapterNames: jest.fn().mockReturnValue(['salesforce', 'newAdapter', 'workato', 'netsuite']),
  }
})

// this test also covers the deprecated 'service' acronym because they both use accountAddDef etc.
describe('account command group', () => {
  let cliArgs: mocks.MockCliArgs
  let output: mocks.MockCliOutput
  let workspace: MockWorkspace
  const mockGetCredentialsFromUser = mocks.createMockGetCredentialsFromUser({
    username: 'test@test',
    password: 'test',
    token: 'test',
    sandbox: false,
  })
  const mockGetOAuthCredentialsFromUser = mocks.createMockGetCredentialsFromUser({
    port: 8888,
    consumerKey: 'test',
  })

  beforeEach(() => {
    cliArgs = mocks.mockCliArgs()
    output = cliArgs.output
    workspace = mockWorkspace({ accounts: ['salesforce', 'netsuite', 'oauthAdapter'] })
  })
  describe('list command', () => {
    let cliCommandArgs: mocks.MockCommandArgs
    beforeEach(() => {
      cliCommandArgs = mocks.mockCliCommandArgs('list', cliArgs)
    })
    describe('when the workspace loads successfully', () => {
      describe('When Environment option not used', () => {
        beforeEach(async () => {
          await listAction({
            ...cliCommandArgs,
            input: {},
            workspace,
          })
        })
        it('should not print private services', () => {
          expect(output.stdout.content).toContain('Additional supported services are:')
          expect(
            !getPrivateAdaptersNames().some(privateName =>
              output.stdout.content.split('Additional supported services are:')[1].includes(privateName),
            ),
          ).toBeTruthy()
        })
        it('should print configured services under configured services', () => {
          expect(output.stdout.content).toContain('The configured accounts are:')
          expect(output.stdout.content.split('Additional supported services are:')[0]).toContain('salesforce')
        })
        it('should print other services under additional services', () => {
          expect(output.stdout.content).toContain('Additional supported services are:')
          expect(
            !['workato', 'newAdapter'].some(
              serviceName =>
                !output.stdout.content.split('Additional supported services are:')[1].includes(serviceName),
            ),
          ).toBeTruthy()
        })
        it('should use current env', () => {
          expect(workspace.setCurrentEnv).not.toHaveBeenCalled()
        })
      })

      describe('When Environment option used', () => {
        it('should use provided env', async () => {
          await listAction({
            ...cliCommandArgs,
            input: {
              env: mocks.withEnvironmentParam,
            },
            workspace,
          })
          expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
        })
      })
    })
  })

  describe('add command', () => {
    let cliCommandArgs: mocks.MockCommandArgs
    const installAdapterMock = installAdapter as jest.Mock
    beforeEach(() => {
      cliCommandArgs = mocks.mockCliCommandArgs('add', cliArgs)
      installAdapterMock.mockReset()
    })
    beforeAll(() => {
      jest
        .spyOn(callbacks, 'getCredentialsFromUser')
        .mockImplementation((obj: ObjectType) => Promise.resolve(mockGetCredentialsFromUser(obj)))
    })

    describe('when calling account add via the commander wrapper', () => {
      const { action } = accountAddDef
      let telemetry: mocks.MockTelemetry

      beforeEach(() => {
        cliArgs = mocks.mockCliArgs()
        telemetry = cliArgs.telemetry

        const loadWorkspace = loadLocalWorkspace as jest.MockedFunction<typeof loadLocalWorkspace>
        loadWorkspace.mockResolvedValue(mockWorkspace({ uid: 'test' }))
      })

      describe('when using correct parameters', () => {
        beforeEach(async () => {
          await action({
            ...cliArgs,
            workspacePath: '.',
            commanderInput: ['newAdapter', { login: false }],
          })
        })

        it('should send success telemetry with adapter tags', () => {
          const eventTypes: (keyof TelemetryEventNames)[] = ['start', 'success']
          eventTypes.forEach(eventType => {
            const eventName = buildEventName('add', eventType)
            expect(telemetry.sendCountEvent).toHaveBeenCalledWith(
              eventName,
              1,
              expect.objectContaining({ 'adapter-newAdapter': true }),
            )
          })
        })
      })

      describe('when using unknown service type', () => {
        it('should send telemetry without any adapter tags', async () => {
          await expect(
            action({
              ...cliArgs,
              workspacePath: '.',
              commanderInput: ['unknownAdapter', { login: false }],
            }),
          ).rejects.toThrow(new CliError(CliExitCode.UserInputError))

          const eventTypes: (keyof TelemetryEventNames)[] = ['start', 'failure']
          eventTypes.forEach(eventType => {
            const eventName = buildEventName('add', eventType)
            expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventName, 1, { workspaceID: 'test' })
          })
        })
      })
      describe('when failing to add the service', () => {
        it('should send telemetry with any adapter tags', async () => {
          installAdapterMock.mockRejectedValueOnce(new Error('Failed to install Adapter!'))

          await expect(
            action({
              ...cliArgs,
              workspacePath: '.',
              commanderInput: ['unknownAdapter', { login: false }],
            }),
          ).rejects.toThrow(new CliError(CliExitCode.AppError))

          const eventTypes: (keyof TelemetryEventNames)[] = ['start', 'failure']
          eventTypes.forEach(eventType => {
            const eventName = buildEventName('add', eventType)
            expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventName, 1, { workspaceID: 'test' })
          })
        })
      })
    })

    describe('when the workspace loads successfully', () => {
      describe('when called with already configured account', () => {
        beforeEach(async () => {
          await addAction({
            ...cliCommandArgs,
            input: {
              serviceType: 'salesforce',
              authType: 'basic',
              login: true,
            },
            workspace,
          })
        })

        it('should print already added', () => {
          expect(output.stderr.content).toContain('salesforce was already added to this environment')
        })
      })

      describe('When called with invalid accountName', () => {
        let theAccountName: string
        describe('When account name contains special characters', () => {
          beforeEach(async () => {
            theAccountName = 'falsd;l;l;l'
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'salesforce',
                accountName: theAccountName,
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          it('should throw error', async () => {
            expect(output.stderr.content).toContain(`The account name: "${theAccountName}" is invalid.`)
          })
        })
        describe('When account name starts with a digit', () => {
          beforeEach(async () => {
            theAccountName = '1new'
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'salesforce',
                accountName: theAccountName,
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          it('should throw error', async () => {
            expect(output.stderr.content).toMatch(`The account name: "${theAccountName}" is invalid.`)
          })
        })
        describe('When called with empty accountName', () => {
          beforeEach(async () => {
            theAccountName = ''
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'salesforce',
                accountName: theAccountName,
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          it('should throw error', () => {
            expect(output.stderr.content).toContain('empty string')
          })
        })
        describe('When called with var as accountName', () => {
          beforeEach(async () => {
            theAccountName = 'var'
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'salesforce',
                accountName: theAccountName,
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          it('should throw error', () => {
            expect(output.stderr.content).toContain('may not be "var"')
          })
        })
        describe('When called with accountName too long', () => {
          beforeEach(async () => {
            theAccountName =
              'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz'
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'salesforce',
                accountName: theAccountName,
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          it('should throw error', () => {
            expect(output.stderr.content).toContain(`The account name: "${theAccountName}" is invalid.`)
          })
        })
      })

      describe('when called with a new service', () => {
        describe('when called with valid login parameters', () => {
          let exitCode: number
          beforeEach(async () => {
            exitCode = await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'basic',
                login: true,
                loginParameters: ['username=testUser', 'password="testPass\\"w==ord"', 'token=testToken', 'sandbox=y'],
              },
              workspace,
            })
          })
          it('should succeed when called with valid parameters', async () => {
            expect(exitCode).toEqual(CliExitCode.Success)
          })
        })
        describe('when called with invalid login parameters', () => {
          it('should fail when called with missing parameter', async () => {
            const exitCode = await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'basic',
                login: true,
                loginParameters: ['username=testUser', 'password=testPassword', 'token=testToken'],
              },
              workspace,
            })
            expect(exitCode).toEqual(CliExitCode.AppError)
          })
          it('should fail when called with malformed parameter', async () => {
            const exitCode = await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'basic',
                login: true,
                loginParameters: ['username=testUser', 'password=testPassword', 'testToken', 'sandbox=y'],
              },
              workspace,
            })
            expect(exitCode).toEqual(CliExitCode.AppError)
          })
        })
        describe('when called with valid credentials', () => {
          beforeEach(async () => {
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          it('should print login information updated', () => {
            expect(output.stdout.content).toContain('Login information successfully updated!')
          })

          it('should print added', () => {
            expect(output.stdout.content).toContain('added to the environment')
          })

          it('should print please enter credentials', () => {
            expect(output.stdout.content).toContain('Please enter your Newadapter credentials:')
          })

          it('should invoke the adapter install method', () => {
            expect(installAdapter).toHaveBeenCalled()
          })
        })

        it('should throw an error if the adapter failed to install', async () => {
          installAdapterMock.mockRejectedValueOnce(new Error('Failed to install Adapter!'))
          await expect(
            addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'basic',
                login: true,
              },
              workspace,
            }),
          ).rejects.toThrow()
        })

        describe('when add called with unsupported auth type', () => {
          beforeEach(async () => {
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'oauth',
                login: true,
              },
              workspace,
            })
          })

          it('fails with no such auth type error', () => {
            expect(output.stderr.content).toContain(
              'Error: Could not login to newAdapter: Adapter does not support authentication of type oauth',
            )
          })
        })

        describe('when called with invalid credentials', () => {
          beforeEach(async () => {
            ;(verifyCredentials as jest.Mock).mockRejectedValue(new Error('Rejected!'))
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          afterEach(() => {
            ;(verifyCredentials as jest.Mock).mockResolvedValue({ success: true, accountId: '1' })
          })

          it('should print login error', () => {
            expect(output.stderr.content).toContain('Could not login to newAdapter')
          })

          it('should print try again text', () => {
            expect(output.stderr.content).toContain('To try again run: `salto account add newAdapter`')
          })

          it('should not print login information updated', () => {
            expect(output.stdout.content).not.toContain('Login information successfully updated!')
          })

          it('should not print added', () => {
            expect(output.stdout.content).not.toContain('added to the environment')
          })
        })

        describe('no-login flag', () => {
          beforeEach(async () => {
            await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'newAdapter',
                authType: 'basic',
                login: false,
              },
              workspace,
            })
          })
          it('should add without login', () => {
            expect(output.stdout.content).toContain('added to the environment')
            expect(output.stdout.content).not.toContain('Please enter your Newadapter credentials:')
          })
          it('should invoke the adapter install method', () => {
            expect(installAdapter).toHaveBeenCalled()
          })
        })

        describe('Environment flag', () => {
          const mockAddAdapter = addAdapter as jest.Mock
          beforeEach(async () => {
            mockAddAdapter.mockClear()
          })
          it('should use current env when env is not provided', async () => {
            await addAction({
              ...cliCommandArgs,
              input: {
                login: true,
                serviceType: 'netsuite',
                authType: 'basic',
              },
              workspace,
            })
            expect(workspace.setCurrentEnv).not.toHaveBeenCalled()
          })
          it('should use provided env', async () => {
            await addAction({
              ...cliCommandArgs,
              input: {
                login: true,
                serviceType: 'netsuite',
                authType: 'basic',
                env: mocks.withEnvironmentParam,
              },
              workspace,
            })
            expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
          })
        })
      })

      describe('when called with a new adapter that does not exist', () => {
        describe('with login', () => {
          let errCode: CliExitCode
          beforeEach(async () => {
            errCode = await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'noAdapter',
                authType: 'basic',
                login: true,
              },
              workspace,
            })
          })
          it('should return user input error', async () => {
            expect(errCode).toBe(CliExitCode.UserInputError)
          })
          it('should not print private accounts', async () => {
            expect(
              getPrivateAdaptersNames().some(privateName => output.stdout.content.includes(privateName)),
            ).toBeFalsy()
          })
        })
        describe('without login', () => {
          let errCode: CliExitCode
          beforeEach(async () => {
            errCode = await addAction({
              ...cliCommandArgs,
              input: {
                serviceType: 'noAdapter',
                authType: 'basic',
                login: false,
              },
              workspace,
            })
          })
          it('should return user input error', async () => {
            expect(errCode).toBe(CliExitCode.UserInputError)
          })
          it('should not print private accounts', async () => {
            expect(
              getPrivateAdaptersNames().some(privateName => output.stdout.content.includes(privateName)),
            ).toBeFalsy()
          })
        })
      })
    })
  })

  describe('createConfigFromLoginParameters() helper', () => {
    describe('when login parameters are marked required', () => {
      const credentialsType = new ObjectType({
        elemID: new ElemID('MockAdapterName'),
        fields: {
          username: {
            refType: BuiltinTypes.STRING,
            annotations: {},
          },
          token: {
            refType: BuiltinTypes.STRING,
            annotations: {
              _required: true,
            },
          },
        },
      })

      it('should work when the required param is present', async () => {
        const loginParameters = ['token=token456']
        const getLoginInput = createConfigFromLoginParameters(loginParameters)
        const newConfig = await getLoginInput(credentialsType)
        expect(newConfig.value.token).toEqual('token456')
      })

      it('should throw when the required param is missing - with other matches', async () => {
        const loginParameters = ['username=user123']
        const getLoginInput = createConfigFromLoginParameters(loginParameters)
        await expect(getLoginInput(credentialsType)).rejects.toThrow()
      })

      it('should throw when the required param is missing - with no other matches', async () => {
        const loginParameters = ['password=password789']
        const getLoginInput = createConfigFromLoginParameters(loginParameters)
        await expect(getLoginInput(credentialsType)).rejects.toThrow()
      })
    })
  })

  describe('login command', () => {
    let cliCommandArgs: mocks.MockCommandArgs
    beforeEach(() => {
      cliCommandArgs = mocks.mockCliCommandArgs('login', cliArgs)
    })
    beforeAll(() => {
      jest
        .spyOn(callbacks, 'getCredentialsFromUser')
        .mockImplementation((obj: ObjectType) => Promise.resolve(mockGetCredentialsFromUser(obj)))
    })

    describe('when calling login via the commander wrapper', () => {
      const { action } = accountLoginDef
      let telemetry: mocks.MockTelemetry

      beforeEach(() => {
        cliArgs = mocks.mockCliArgs()
        telemetry = cliArgs.telemetry

        const loadWorkspace = loadLocalWorkspace as jest.MockedFunction<typeof loadLocalWorkspace>
        loadWorkspace.mockResolvedValue(mockWorkspace({ uid: 'test' }))
      })

      describe('when using correct parameters', () => {
        beforeEach(async () => {
          await action({
            ...cliArgs,
            workspacePath: '.',
            commanderInput: [
              'salesforce',
              {
                authType: 'basic',
                loginParameters: ['username=testUser', 'password=testPassword', 'token=testToken', 'sandbox=y'],
              },
            ],
          })
        })

        it('should send success telemetry with adapter tags', () => {
          const eventTypes: (keyof TelemetryEventNames)[] = ['start', 'success']
          eventTypes.forEach(eventType => {
            const eventName = buildEventName('login', eventType)
            expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventName, 1, {
              workspaceID: 'test',
              'adapter-salesforce': true,
            })
          })
        })
      })

      describe('when specifying an unknown account', () => {
        it('should send telemetry without any adapter tags', async () => {
          await expect(
            action({
              ...cliArgs,
              workspacePath: '.',
              commanderInput: ['unknownAdapter', {}],
            }),
          ).rejects.toThrow(new CliError(CliExitCode.UserInputError))

          const eventTypes: (keyof TelemetryEventNames)[] = ['start', 'failure']
          eventTypes.forEach(eventType => {
            const eventName = buildEventName('login', eventType)
            expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventName, 1, { workspaceID: 'test' })
          })
        })
      })
      describe('when login params are incorrect', () => {
        it('should send telemetry with any adapter tags', async () => {
          await expect(
            action({
              ...cliArgs,
              workspacePath: '.',
              commanderInput: ['unknownAdapter', { loginParameters: ['badParam=X'] }],
            }),
          ).rejects.toThrow(new CliError(CliExitCode.AppError))

          const eventTypes: (keyof TelemetryEventNames)[] = ['start', 'failure']
          eventTypes.forEach(eventType => {
            const eventName = buildEventName('login', eventType)
            expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventName, 1, { workspaceID: 'test' })
          })
        })
      })
    })

    describe('when the workspace loads successfully', () => {
      describe('when called with already logged in account', () => {
        beforeEach(async () => {
          await loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'salesforce',
              authType: 'basic',
            },
            workspace,
          })
        })
        it('should print login override', () => {
          expect(output.stdout.content).toContain('override')
        })

        it('should get config from user', () => {
          expect(mockGetCredentialsFromUser).toHaveBeenCalled()
        })

        it('should call update config', () => {
          expect(updateCredentials).toHaveBeenCalled()
        })

        it('should print logged in', () => {
          expect(output.stdout.content).toContain('Login information successfully updated')
        })
      })

      describe('when called with not configured account', () => {
        beforeEach(async () => {
          await loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'notConfigured',
              authType: 'basic',
            },
            workspace,
          })
        })

        it('should print not configured', () => {
          expect(output.stderr.content).toContain('notConfigured is not configured in this environment')
        })
      })

      describe('when login called with unsupported auth type', () => {
        beforeEach(async () => {
          jest
            .spyOn(callbacks, 'getCredentialsFromUser')
            .mockImplementation((obj: ObjectType) => Promise.resolve(mockGetOAuthCredentialsFromUser(obj)))
          await loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'salesforce',
              authType: 'oauth',
            },
            workspace,
          })
        })

        it('fails with no such auth type error', () => {
          expect(output.stderr.content).toContain(
            'Error: Could not login to salesforce: Adapter does not support authentication of type oauth',
          )
        })
      })

      describe('when called with oauth credentials', () => {
        beforeEach(async () => {
          jest
            .spyOn(callbacks, 'getCredentialsFromUser')
            .mockImplementation((obj: ObjectType) => Promise.resolve(mockGetOAuthCredentialsFromUser(obj)))
          await loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'oauthAdapter',
              authType: 'oauth',
            },
            workspace,
          })
        })
        it('should process oauth credentials', () => {
          expect(processOauthCredentials).toHaveBeenCalled()
        })
        it('should get config from user', () => {
          expect(mockGetOAuthCredentialsFromUser).toHaveBeenCalled()
        })

        it('should call update config', () => {
          expect(updateCredentials).toHaveBeenCalled()
        })

        it('should print it logged in', () => {
          expect(output.stdout.content).toContain('Login information successfully updated')
        })
      })
      describe('when called with configured but not logged in account', () => {
        beforeEach(async () => {
          await loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'salesforce',
              authType: 'basic',
            },
            workspace,
          })
        })
        it('should get config from user', () => {
          expect(mockGetCredentialsFromUser).toHaveBeenCalled()
        })

        it('should call update config', () => {
          expect(updateCredentials).toHaveBeenCalled()
        })

        it('should print it logged in', () => {
          expect(output.stdout.content).toContain('Login information successfully updated')
        })
      })
      describe('Environment flag', () => {
        it('should use current env when env is not provided', async () => {
          await loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'salesforce',
              authType: 'basic',
            },
            workspace,
          })
          expect(workspace.setCurrentEnv).not.toHaveBeenCalled()
        })
        it('should use provided env', async () => {
          await loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'netsuite',
              authType: 'basic',
              env: mocks.withEnvironmentParam,
            },
            workspace,
          })
          expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
        })
      })
      describe('when called with login parameters', () => {
        const doLogin = async ({ token = 'token=testToken', sandbox = true }): Promise<CliExitCode> =>
          loginAction({
            ...cliCommandArgs,
            input: {
              accountName: 'salesforce',
              authType: 'basic',
              loginParameters: ['username=testUser', 'password=testPassword', token, sandbox ? 'sandbox=y' : ''],
            },
            workspace,
          })
        it('should succeed when called with valid parameters', async () => {
          const exitCode = await doLogin({})
          expect(exitCode).toEqual(CliExitCode.Success)
        })
        it('should fail when called with missing parameter', async () => {
          const exitCode = await doLogin({ sandbox: false })
          expect(exitCode).toEqual(CliExitCode.AppError)
        })
        it('should fail when called with malformed parameter', async () => {
          const exitCode = await doLogin({ token: 'testToken' })
          expect(exitCode).toEqual(CliExitCode.AppError)
        })
        it('should not ask for credentials', async () => {
          await doLogin({})
          // In case the message will change a bit, we check for a specific basic word
          expect(output.stdout.content).not.toContain('credentials')
        })
      })
    })
  })
})
