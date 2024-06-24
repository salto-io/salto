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
import {
  AdapterFailureInstallResult,
  AdapterSuccessInstallResult,
  ElemID,
  InstanceElement,
  isAdapterSuccessInstallResult,
  ObjectType,
} from '@salto-io/adapter-api'
import * as cli from '@salto-io/suitecloud-cli'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import Bottleneck from 'bottleneck'
import { adapter } from '../src/adapter_creator'
import SdfClient from '../src/client/sdf_client'
import NetsuiteAdapter from '../src/adapter'
import { mockGetElemIdFunc } from './utils'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { EnvType } from '../src/client/suiteapp_client/types'
import { SdfCredentials } from '../src/client/credentials'
import { emptyQueryParams, fullQueryParams, fullFetchConfig } from '../src/config/config_creator'

jest.mock('../src/client/sdf_client')
jest.mock('../src/client/suiteapp_client/suiteapp_client')
jest.mock('../src/adapter')
jest.mock('@salto-io/suitecloud-cli')

const mockDownload = cli.SdkDownloadService.download as jest.Mock
mockDownload.mockResolvedValue({ success: true, installedVersion: '123' })

describe('NetsuiteAdapter creator', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
  })

  const credentials = new InstanceElement(ElemID.CONFIG_NAME, adapter.authenticationMethods.basic.credentialsType, {
    accountId: 'foo-a',
    tokenId: 'bar',
    tokenSecret: 'secret',
    suiteAppTokenId: '',
    suiteAppTokenSecret: '',
  })

  const sdfConcurrencyLimit = 2
  const fetchTypeTimeoutInMinutes = 1
  const maxItemsInImportObjectsRequest = 3
  const clientConfig = {
    fetchAllTypesAtOnce: false,
    fetchTypeTimeoutInMinutes,
    maxItemsInImportObjectsRequest,
    sdfConcurrencyLimit,
    notExistInClient: ['not exist in client'],
  }
  const config = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
    fetch: fullFetchConfig(),
    skipList: {},
    typesToSkip: ['test1'],
    filePathRegexSkipList: ['^/Templates.*'],
    client: clientConfig,
  })

  describe('validateCredentials', () => {
    const accountId = 'testAccountId'
    const suiteAppClientValidateMock = jest.spyOn(SuiteAppClient, 'validateCredentials')
    const netsuiteValidateMock = jest.spyOn(SdfClient, 'validateCredentials').mockResolvedValue({ accountId })

    beforeEach(() => {
      jest.mock('@salto-io/suitecloud-cli', () => undefined, { virtual: true })
      suiteAppClientValidateMock.mockClear()
      netsuiteValidateMock.mockClear()
    })

    it('Should call validateCredentials with the correct credentials', async () => {
      await adapter.validateCredentials(credentials)
      expect(netsuiteValidateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'FOO_A',
          tokenId: 'bar',
          tokenSecret: 'secret',
        }),
      )
      expect(suiteAppClientValidateMock).not.toHaveBeenCalledWith()
    })

    it('Should return accountInfo that only contains accountId', async () => {
      const accountInfo = await adapter.validateCredentials(credentials)
      expect(accountInfo).toEqual({ accountId })
    })

    describe('When SuiteApp credentials were passed', () => {
      const cred = credentials.clone()
      cred.value = {
        ...cred.value,
        suiteAppTokenId: 'aaa',
        suiteAppTokenSecret: 'bbb',
        suiteAppActivationKey: 'ccc',
      }

      it('Should call validateCredentials of SuiteAppClient when SuiteApp credentials were passed', async () => {
        suiteAppClientValidateMock.mockResolvedValueOnce({
          time: new Date(),
          appVersion: [1, 2, 3],
        })

        await adapter.validateCredentials(cred)
        expect(netsuiteValidateMock).toHaveBeenCalledWith({ ...cred.value, accountId: 'FOO_A' })
        expect(suiteAppClientValidateMock).toHaveBeenCalledWith({ ...cred.value, accountId: 'FOO_A' })
      })

      describe('AccountInfo values', () => {
        describe('When systemInformation does not contain envType', () => {
          it('Should return accountInfo that only contains accountId', async () => {
            suiteAppClientValidateMock.mockResolvedValueOnce({
              time: new Date(),
              appVersion: [1, 2, 3],
            })

            const accountInfo = await adapter.validateCredentials(cred)
            expect(accountInfo).toEqual({ accountId })
          })
        })

        describe('When systemInformation contains envType === PRODUCTION', () => {
          it('Should return accountInfo with accountType = PRODUCTION and isProduction = true', async () => {
            suiteAppClientValidateMock.mockResolvedValueOnce({
              time: new Date(),
              appVersion: [1, 2, 3],
              envType: EnvType.PRODUCTION,
            })

            const accountInfo = await adapter.validateCredentials(cred)
            expect(accountInfo).toEqual({ accountId, accountType: 'PRODUCTION', isProduction: true })
          })

          it('Should return accountInfo with accountType = TEST and isProduction = false when identifying TSTDRV account', async () => {
            suiteAppClientValidateMock.mockResolvedValueOnce({
              time: new Date(),
              appVersion: [1, 2, 3],
              envType: EnvType.PRODUCTION,
            })
            const testAccountId = 'TSTDRV1234567'
            netsuiteValidateMock.mockResolvedValueOnce({ accountId: testAccountId })
            const accountInfo = await adapter.validateCredentials(cred)
            expect(accountInfo).toEqual({ accountId: testAccountId, accountType: 'TEST', isProduction: false })
          })

          it('Should return accountInfo with accountType = TEST and isProduction = false when identifying TD account', async () => {
            suiteAppClientValidateMock.mockResolvedValueOnce({
              time: new Date(),
              appVersion: [1, 2, 3],
              envType: EnvType.PRODUCTION,
            })
            const testAccountId = 'TD1234567'
            netsuiteValidateMock.mockResolvedValueOnce({ accountId: testAccountId })
            const accountInfo = await adapter.validateCredentials(cred)
            expect(accountInfo).toEqual({ accountId: testAccountId, accountType: 'TEST', isProduction: false })
          })
        })

        describe('When systemInformation contains envType !== PRODUCTION', () => {
          const envTypes = [
            { accountType: 'BETA', envType: EnvType.BETA },
            { accountType: 'INTERNAL', envType: EnvType.INTERNAL },
            { accountType: 'SANDBOX', envType: EnvType.SANDBOX },
          ]
          test.each(envTypes)(
            'Should return accountInfo with accountType = $accountType and isProduction = false',
            async ({ accountType, envType }) => {
              suiteAppClientValidateMock.mockResolvedValueOnce({
                time: new Date(),
                appVersion: [1, 2, 3],
                envType,
              })

              const accountInfo = await adapter.validateCredentials(cred)
              expect(accountInfo).toEqual({ accountId, accountType, isProduction: false })
            },
          )
        })
      })
    })

    it('SDF validation failure should throw SDF error', async () => {
      suiteAppClientValidateMock.mockResolvedValue({
        time: new Date(),
        appVersion: [1, 2, 3],
      })
      netsuiteValidateMock.mockRejectedValue(new Error(''))

      const cred = credentials.clone()
      cred.value = {
        ...cred.value,
        suiteAppTokenId: 'aaa',
        suiteAppTokenSecret: 'bbb',
        suiteAppActivationKey: 'ccc',
      }

      await expect(adapter.validateCredentials(cred)).rejects.toThrow('SDF Authentication failed.')
    })

    it('SuiteApp validation failure should throw SuiteApp error', async () => {
      suiteAppClientValidateMock.mockRejectedValue(new Error(''))

      const cred = credentials.clone()
      cred.value = {
        ...cred.value,
        suiteAppTokenId: 'aaa',
        suiteAppTokenSecret: 'bbb',
        suiteAppActivationKey: 'ccc',
      }

      await expect(adapter.validateCredentials(cred)).rejects.toThrow('SuiteApp Authentication failed.')
    })

    it('should throw when receiving invalid accountId', async () => {
      const cred = credentials.clone()
      cred.value = {
        ...cred.value,
        accountId: ' account-id',
      }
      await expect(adapter.validateCredentials(cred)).rejects.toThrow(/received an invalid accountId value.*/g)
    })
  })

  describe('client creation', () => {
    it('should create the client correctly', () => {
      jest.spyOn(SdfClient.prototype, 'getCredentials').mockReturnValue({ accountId: 'someId' } as SdfCredentials)
      adapter.operations({
        credentials,
        config,
        elementsSource: buildElementsSourceFromElements([]),
      })
      expect(SdfClient).toHaveBeenCalledWith({
        credentials: {
          accountId: 'FOO_A',
          tokenId: 'bar',
          tokenSecret: 'secret',
          suiteAppTokenId: undefined,
          suiteAppTokenSecret: undefined,
        },
        config: clientConfig,
        globalLimiter: expect.any(Bottleneck),
        instanceLimiter: expect.any(Function),
      })
    })
  })

  describe('suiteapp client creation', () => {
    it('should not create the client if credentials were not passed', () => {
      adapter.operations({
        credentials,
        config,
        elementsSource: buildElementsSourceFromElements([]),
      })
      expect(SuiteAppClient).not.toHaveBeenCalled()
    })

    it('should throw when missing activation key', () => {
      const cred = credentials.clone()
      cred.value = {
        ...cred.value,
        suiteAppTokenId: 'aaa',
        suiteAppTokenSecret: 'bbb',
        suiteAppActivationKey: '',
      }

      expect(() =>
        adapter.operations({
          credentials: cred,
          config,
          elementsSource: buildElementsSourceFromElements([]),
        }),
      ).toThrow('Missing SuiteApp login creds')
    })

    it('should create the client if credentials were passed', () => {
      const cred = credentials.clone()
      cred.value = {
        ...cred.value,
        suiteAppTokenId: 'aaa',
        suiteAppTokenSecret: 'bbb',
        suiteAppActivationKey: 'ccc',
      }

      adapter.operations({
        credentials: cred,
        config,
        elementsSource: buildElementsSourceFromElements([]),
      })
      expect(SuiteAppClient).toHaveBeenCalledWith({
        credentials: { ...cred.value, accountId: 'FOO_A' },
        globalLimiter: expect.any(Bottleneck),
        instanceLimiter: expect.any(Function),
      })
    })

    it('should pass the config to client if passed', () => {
      const cred = credentials.clone()
      cred.value = {
        ...cred.value,
        suiteAppTokenId: 'aaa',
        suiteAppTokenSecret: 'bbb',
        suiteAppActivationKey: 'ccc',
      }

      const configuration = config.clone()
      configuration.value = {
        ...config.value,
        suiteAppClient: {
          suiteAppConcurrencyLimit: 5,
          httpTimeoutLimitInMinutes: 20,
        },
      }

      adapter.operations({
        credentials: cred,
        config: configuration,
        elementsSource: buildElementsSourceFromElements([]),
      })
      expect(SuiteAppClient).toHaveBeenCalledWith({
        credentials: { ...cred.value, accountId: 'FOO_A' },
        config: {
          suiteAppConcurrencyLimit: 5,
          httpTimeoutLimitInMinutes: 20,
        },
        globalLimiter: expect.any(Bottleneck),
        instanceLimiter: expect.any(Function),
      })
    })
  })

  describe('adapter creation', () => {
    const elementsSource = buildElementsSourceFromElements([])

    it('should create the adapter correctly', () => {
      adapter.operations({
        credentials,
        config,
        getElemIdFunc: mockGetElemIdFunc,
        elementsSource,
      })
      expect(NetsuiteAdapter).toHaveBeenCalledWith({
        client: expect.any(Object),
        config: {
          fetch: fullFetchConfig(),
          skipList: {},
          typesToSkip: ['test1'],
          filePathRegexSkipList: ['^/Templates.*'],
          client: clientConfig,
        },
        elementsSource,
        getElemIdFunc: mockGetElemIdFunc,
      })
    })

    describe('validateConfig', () => {
      it('should override FETCH_ALL_TYPES_AT_ONCE if received FETCH_TARGET', () => {
        const conf = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          client: {
            fetchAllTypesAtOnce: true,
          },
          fetchTarget: {
            filePaths: ['aaa'],
          },
        })

        adapter.operations({
          credentials,
          config: conf,
          getElemIdFunc: mockGetElemIdFunc,
          elementsSource,
        })
        expect(NetsuiteAdapter).toHaveBeenCalledWith({
          client: expect.any(Object),
          config: {
            fetch: fullFetchConfig(),
            client: {
              fetchAllTypesAtOnce: false,
            },
            fetchTarget: expect.any(Object),
          },
          elementsSource,
          getElemIdFunc: mockGetElemIdFunc,
        })
      })

      it('should create the adapter correctly when not having config', () => {
        adapter.operations({
          credentials,
          getElemIdFunc: mockGetElemIdFunc,
          elementsSource,
        })
        expect(NetsuiteAdapter).toHaveBeenCalledWith({
          client: expect.any(Object),
          config: { fetch: fullFetchConfig() },
          elementsSource,
          getElemIdFunc: mockGetElemIdFunc,
        })
      })

      it('should throw an error when creating the adapter with an invalid regex for FILE_PATHS_REGEX_SKIP_LIST', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          filePathRegexSkipList: ['\\'],
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })

      it('should throw an error when fetchTarget is invalid', () => {
        expect(() =>
          adapter.operations({
            credentials,
            config: new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
              fetch: fullFetchConfig(),
              fetchTarget: {
                types: ['type1', 'type2'],
              },
            }),
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow('fetchTarget.types should be an object')
        expect(() =>
          adapter.operations({
            credentials,
            config: new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
              fetch: fullFetchConfig(),
              fetchTarget: {
                customRecords: ['customrecord1', 'customrecord2'],
              },
            }),
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow('fetchTarget.customRecords should be an object')
        expect(() =>
          adapter.operations({
            credentials,
            config: new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
              fetch: fullFetchConfig(),
              fetchTarget: {
                types: {
                  type1: 'id',
                },
              },
            }),
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow('fetchTarget.types.type1 should be a list of strings')
        expect(() =>
          adapter.operations({
            credentials,
            config: new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
              fetch: fullFetchConfig(),
              fetchTarget: {
                customRecords: {
                  customrecord1: 'id',
                },
              },
            }),
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow('fetchTarget.customRecords.customrecord1 should be a list of strings')
      })

      it('should throw an error when include is invalid', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: {
            include: {
              types: 'supposed to be an array',
            },
            exclude: emptyQueryParams(),
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })

      it('should throw an error when exclude is invalid', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: {
            include: fullQueryParams(),
            exclude: {
              types: [{ name: ['should be a string'] }],
            },
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })

      it('should throw an error when fieldsToOmit is invalid', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: {
            include: fullQueryParams(),
            exclude: emptyQueryParams(),
            fieldsToOmit: [
              {
                type: 'a',
              },
            ],
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })
    })

    describe('deploy params', () => {
      it('should throw an error when deployReferencedElements is invalid', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          deploy: {
            deployReferencedElements: 'should be a boolean',
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })

      it('should throw an error when warnOnStaleWorkspaceData is invalid', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          deploy: {
            warnOnStaleWorkspaceData: 'should be a boolean',
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })
      it("should throw an error when 'validate' is invalid", () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          deploy: {
            validate: 'should be a boolean',
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })
      describe('additionalDependencies', () => {
        it('should not throw', () => {
          const validConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                include: {
                  features: ['feature1'],
                  objects: ['object1'],
                  files: ['file1'],
                },
                exclude: {
                  features: ['feature2'],
                  objects: ['object2'],
                  files: ['fil2'],
                },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: validConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).not.toThrow()
        })
        it('should throw an error when additionalDependencies is invalid', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: 'should be an object',
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })
        it('should throw an error when additionalDependencies.include is invalid', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                include: { features: ['should be list of strings', 1] },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })
        it('should throw an error when files in additionalDependencies is invalid', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                include: { files: ['should be list of strings', 1] },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })
        it('should throw an error when additionalDependencies.exclude is invalid', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                exclude: { objects: ['should be list of strings', 1] },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })
        it('should throw an error when additionalDependencies has conflicting features', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                include: { features: ['feature'] },
                exclude: { features: ['feature'] },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })
        it('should throw an error when additionalDependencies has conflicting features (with required)', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                include: { features: ['feature:required'] },
                exclude: { features: ['feature'] },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })
        it('should throw an error when additionalDependencies has conflicting objects', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                include: { objects: ['script_id'] },
                exclude: { objects: ['script_id'] },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })

        it('should throw an Error when additionalDependencies has conflicting files', () => {
          const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
            fetch: fullFetchConfig(),
            deploy: {
              additionalDependencies: {
                include: { files: ['/Folder/filePath'] },
                exclude: { files: ['/Folder/filePath'] },
              },
            },
          })
          expect(() =>
            adapter.operations({
              credentials,
              config: invalidConfig,
              getElemIdFunc: mockGetElemIdFunc,
              elementsSource: buildElementsSourceFromElements([]),
            }),
          ).toThrow()
        })
      })
    })

    describe('installedSuiteApps', () => {
      it('should throw an error when installedSuiteApps is not a list', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          client: {
            installedSuiteApps: 2,
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })

      it('should throw an error when installedSuiteApps has an item that is not a string', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          client: {
            installedSuiteApps: ['a.b.c', 2],
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })

      it('should throw an error when installedSuiteApps has an item that is not a valid id', () => {
        const invalidConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          client: {
            installedSuiteApps: ['a', 'a.b.c'],
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: invalidConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).toThrow()
      })

      it('should not throw an error when installedSuiteApps is valid', () => {
        const validConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, {
          fetch: fullFetchConfig(),
          client: {
            installedSuiteApps: ['a.b.c', 'b.c.d'],
          },
        })
        expect(() =>
          adapter.operations({
            credentials,
            config: validConfig,
            getElemIdFunc: mockGetElemIdFunc,
            elementsSource: buildElementsSourceFromElements([]),
          }),
        ).not.toThrow()
      })
    })
  })

  describe('install', () => {
    it('should have an install functions', () => {
      expect(adapter.install).toBeDefined()
    })
    it('when installation succeeds', async () => {
      if (adapter.install) {
        const res = await adapter.install()
        expect(isAdapterSuccessInstallResult(res)).toBe(true)
        expect((res as AdapterSuccessInstallResult).installedVersion).toEqual('123')
        expect(mockDownload).toHaveBeenCalled()
      }
    })
    it('when installation fails with an expection', async () => {
      mockDownload.mockImplementationOnce(() => {
        throw new Error('FAILED')
      })
      if (adapter.install) {
        const res = await adapter.install()
        expect(isAdapterSuccessInstallResult(res)).toBe(false)
        expect((res as AdapterFailureInstallResult).errors).toEqual(['FAILED'])
      }
    })
    it('when installation fails with sdf errors in return value', async () => {
      mockDownload.mockImplementationOnce(() => ({ errors: ['FAILED'], success: false }))
      if (adapter.install) {
        const res = await adapter.install()
        expect(isAdapterSuccessInstallResult(res)).toBe(false)
        expect((res as AdapterFailureInstallResult).errors).toEqual(['FAILED'])
      }
    })
  })
})
