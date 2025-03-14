/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Stream } from 'stream'
import { collections, promises } from '@salto-io/lowerdash'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRestriction,
  DeployResult,
  getChangeData,
  Values,
  Change,
  toChange,
  ChangeGroup,
  isAdditionOrModificationChange,
  isServiceId,
  INSTANCE_ANNOTATIONS,
  ReferenceExpression,
  isInstanceElement,
  SeverityLevel,
  isSaltoElementError,
} from '@salto-io/adapter-api'
import { MockInterface, stepManager } from '@salto-io/test-utils'
import { Package, DeployResultLocator, DeployResult as JSForceDeployResult } from '@salto-io/jsforce'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import {
  Types,
  createInstanceElement,
  apiName,
  metadataType,
  createMetadataObjectType,
} from '../src/transformers/transformer'
import Connection from '../src/client/jsforce'
import { CustomObject } from '../src/client/types'
import mockAdapter from './adapter'
import {
  createValueSetEntry,
  createCustomObjectType,
  nullProgressReporter,
  MockDeployProgressReporter,
  createMockProgressReporter,
} from './utils'
// eslint-disable-next-line no-restricted-imports
import { createElement, removeElement } from '../e2e_test/utils'
import { mockTypes, mockDefaultValues } from './mock_elements'
import { mockDeployResult, mockRunTestFailure, mockDeployResultComplete, mockRetrieveResult } from './connection'
import { GLOBAL_VALUE_SET } from '../src/filters/global_value_sets'
import { apiNameSync, metadataTypeSync } from '../src/filters/utils'
import { SalesforceArtifacts, INSTANCE_FULL_NAME_FIELD, ProgressReporterSuffix } from '../src/constants'
import { SalesforceClient } from '../index'

const NEW_ID = 'new_id'
const { makeArray } = collections.array

describe('SalesforceAdapter CRUD', () => {
  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  let progressReporter: MockDeployProgressReporter
  let client: SalesforceClient

  const stringType = Types.primitiveDataTypes.Text
  const mockElemID = new ElemID(constants.SALESFORCE, 'Test')
  const instanceName = 'Instance'

  const xmlParser = new XMLParser()

  type DeployedPackage = {
    manifest?: Package
    deleteManifest?: Package
    getData: (fileName: string) => Promise<Values>
  }

  const streamToBuffer = async (stream: Stream): Promise<Buffer> => {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      stream.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      stream.on('error', reject)
    })
  }

  const getDeployedPackage = async (zipData: Buffer | string | Stream): Promise<DeployedPackage> => {
    const zip = await JSZip.loadAsync(zipData instanceof Stream ? streamToBuffer(zipData) : zipData)
    const files = {
      manifest: zip.files['unpackaged/package.xml'],
      deleteManifest: zip.files['unpackaged/destructiveChangesPost.xml'],
    }
    return {
      ...(await promises.object.mapValuesAsync(files, async zipFile =>
        zipFile === undefined ? undefined : xmlParser.parse(await zipFile.async('string')).Package,
      )),
      getData: async fileName => {
        const zipFile = zip.files[`unpackaged/${fileName}`]
        return zipFile === undefined ? undefined : xmlParser.parse(await zipFile.async('string'))
      },
    }
  }

  beforeEach(async () => {
    ;({ connection, adapter, client } = mockAdapter({
      adapterParams: {
        config: {
          fetch: {
            data: {
              includeObjects: ['Test'],
              saltoIDSettings: {
                defaultIdFields: ['Name'],
              },
            },
          },
        },
      },
    }))
    progressReporter = await createMockProgressReporter(client)

    connection.metadata.upsert.mockImplementation(async (_type, objects) =>
      makeArray(objects).map(({ fullName }) => ({
        fullName,
        created: true,
        success: true,
      })),
    )
    connection.metadata.delete.mockImplementation(async (_type, fullNames) =>
      makeArray(fullNames).map(fullName => ({ fullName, success: true })),
    )
    connection.metadata.update.mockImplementation(async (_type, objects) =>
      makeArray(objects).map(({ fullName }) => ({ fullName, success: true })),
    )

    connection.metadata.deploy.mockReturnValue(mockDeployResult({}))
  })

  describe('Add operation', () => {
    describe('for an instance element', () => {
      const instance = new InstanceElement(
        instanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            username: { refType: BuiltinTypes.STRING },
            password: { refType: BuiltinTypes.STRING },
            token: { refType: BuiltinTypes.STRING },
            sandbox: { refType: BuiltinTypes.BOOLEAN },
          },
          annotationRefsOrTypes: {},
          annotations: { [constants.METADATA_TYPE]: 'Flow' },
        }),
        {
          token: 'instanceTest',
        },
      )

      describe('when the request succeeds', () => {
        let result: InstanceElement

        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValueOnce(
            mockDeployResult({
              success: true,
              componentSuccess: [{ fullName: instanceName, componentType: 'Flow', id: NEW_ID }],
            }),
          )
          result = await createElement(adapter, instance)
        })
        describe('when the shouldPopulateInternalIdAfterDeploy feature is enabled', () => {
          describe('when the deployed instance has internalId', () => {
            beforeEach(async () => {
              ;({ connection, adapter, client } = mockAdapter({
                adapterParams: {
                  config: {
                    fetch: {
                      optionalFeatures: { shouldPopulateInternalIdAfterDeploy: true },
                      data: {
                        includeObjects: ['Test'],
                        saltoIDSettings: {
                          defaultIdFields: ['Name'],
                        },
                      },
                    },
                  },
                },
              }))
              connection.metadata.deploy.mockReturnValueOnce(
                mockDeployResult({
                  success: true,
                  componentSuccess: [{ fullName: instanceName, componentType: 'Flow', id: NEW_ID }],
                }),
              )
              result = await createElement(adapter, instance)
            })
            it('Should add new instance with internal id', async () => {
              expect(result).toBeInstanceOf(InstanceElement)
              expect(result.elemID).toEqual(instance.elemID)
              expect(result.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(instanceName)
              expect(result.value.token).toBeDefined()
              expect(result.value.token).toBe('instanceTest')
              expect(result.value.Token).toBeUndefined()

              expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
              const { manifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
              expect(manifest).toBeDefined()
              expect(manifest?.types).toEqual({
                name: 'Flow',
                members: instanceName,
              })
              expect(result.value[constants.INTERNAL_ID_FIELD]).toBeDefined()
            })
          })
          describe('when the deployed instance does not have internalId', () => {
            beforeEach(async () => {
              ;({ connection, adapter, client } = mockAdapter({
                adapterParams: {
                  config: {
                    fetch: {
                      optionalFeatures: { shouldPopulateInternalIdAfterDeploy: true },
                      data: {
                        includeObjects: ['Test'],
                        saltoIDSettings: {
                          defaultIdFields: ['Name'],
                        },
                      },
                    },
                  },
                },
              }))
              connection.metadata.deploy.mockReturnValueOnce(
                mockDeployResult({
                  success: true,
                  componentSuccess: [{ fullName: instanceName, componentType: 'Flow', id: undefined }],
                }),
              )
              result = await createElement(adapter, instance)
            })
            it('Should not set the internalId on the deployed instance', async () => {
              expect(result).toBeInstanceOf(InstanceElement)
              expect(result.elemID).toEqual(instance.elemID)
              expect(result.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(instanceName)
              expect(result.value.token).toBeDefined()
              expect(result.value.token).toBe('instanceTest')
              expect(result.value.Token).toBeUndefined()

              expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
              const { manifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
              expect(manifest).toBeDefined()
              expect(manifest?.types).toEqual({
                name: 'Flow',
                members: instanceName,
              })
              expect(result.value[constants.INTERNAL_ID_FIELD]).not.toBeDefined()
            })
          })
        })
        describe('when the shouldPopulateInternalIdAfterDeploy feature is disabled', () => {
          beforeEach(async () => {
            ;({ connection, adapter, client } = mockAdapter({
              adapterParams: {
                config: {
                  fetch: {
                    optionalFeatures: { shouldPopulateInternalIdAfterDeploy: false },
                    data: {
                      includeObjects: ['Test'],
                      saltoIDSettings: {
                        defaultIdFields: ['Name'],
                      },
                    },
                  },
                },
              },
            }))
            connection.metadata.deploy.mockReturnValueOnce(
              mockDeployResult({
                success: true,
                componentSuccess: [{ fullName: instanceName, componentType: 'Flow', id: NEW_ID }],
              }),
            )
            result = await createElement(adapter, instance)
          })
          it('Should add new instance without internal id', async () => {
            expect(result).toBeInstanceOf(InstanceElement)
            expect(result.elemID).toEqual(instance.elemID)
            expect(result.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(instanceName)
            expect(result.value.token).toBeDefined()
            expect(result.value.token).toBe('instanceTest')
            expect(result.value.Token).toBeUndefined()

            expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
            const { manifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
            expect(manifest).toBeDefined()
            expect(manifest?.types).toEqual({
              name: 'Flow',
              members: instanceName,
            })
            expect(result.value[constants.INTERNAL_ID_FIELD]).toBeUndefined()
          })
        })
      })

      describe('when the request fails', () => {
        let result: DeployResult
        let profileInstance: InstanceElement
        let businessProcessInstance: InstanceElement
        let workflowFieldUpdate: InstanceElement

        beforeEach(async () => {
          profileInstance = createInstanceElement(mockDefaultValues.Profile, mockTypes.Profile)
          businessProcessInstance = createInstanceElement(
            mockDefaultValues.BusinessProcess,
            mockTypes.BusinessProcess,
            undefined,
            {
              [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
                mockTypes.TestCustomObject__c.elemID,
                mockTypes.TestCustomObject__c,
              ),
            },
          )
          workflowFieldUpdate = createInstanceElement(
            {
              ...mockDefaultValues.WorkflowFieldUpdate,
              [INSTANCE_FULL_NAME_FIELD]: 'TestCustomObject__c.TestWorkflowFieldUpdate',
            },
            mockTypes.WorkflowFieldUpdate,
          )

          connection.metadata.deploy.mockReturnValueOnce(
            mockDeployResult({
              success: false,
              componentFailure: [
                // valid response
                {
                  fullName: apiNameSync(profileInstance),
                  componentType: metadataTypeSync(profileInstance),
                  problem: 'Some profile error',
                },
                // SALTO-4861
                // Subtype failure
                {
                  componentType: 'BusinessProcess',
                  fullName: 'TestCustomObject__c.TestBusinessProposal',
                  problem: 'Picklist value: Follow Up Meeting not found',
                },
                // SALTO-4860
                // WorkflowFieldUpdate failure
                {
                  componentType: 'WorkflowFieldUpdate',
                  fullName: 'TestCustomObject__c.TestWorkflowFieldUpdate',
                  problem: 'Some workflow field update error',
                },
              ],
            }),
          )

          result = await adapter.deploy({
            changeGroup: {
              groupID: profileInstance.elemID.getFullName(),
              changes: [
                { action: 'add', data: { after: profileInstance } },
                { action: 'add', data: { after: businessProcessInstance } },
                { action: 'add', data: { after: workflowFieldUpdate } },
              ],
            },
            progressReporter: nullProgressReporter,
          })
        })

        it('should return errors', () => {
          expect(result.errors).toHaveLength(3)

          expect(result.errors[0].message).toContain('Some profile error')
          expect(result.errors[0].detailedMessage).toContain('Some profile error')
          expect(isSaltoElementError(result.errors[0])).toBeTruthy()
          if (isSaltoElementError(result.errors[0])) {
            expect(result.errors[0].elemID).toEqual(profileInstance.elemID)
          }
          expect(result.errors[0].severity).toEqual('Error' as SeverityLevel)

          // BusinessProposal will not have a correct ElemID, should point to its parent (Account)
          expect(result.errors[1].message).toContain('Picklist value: Follow Up Meeting not found')
          expect(result.errors[1].detailedMessage).toContain('Picklist value: Follow Up Meeting not found')
          expect(isSaltoElementError(result.errors[1])).toBeTruthy()
          if (isSaltoElementError(result.errors[1])) {
            expect(result.errors[1].elemID).not.toEqual(businessProcessInstance.elemID)
          }

          expect(result.errors[1].severity).toEqual('Error' as SeverityLevel)

          expect(result.errors[2]).toEqual({
            message: expect.stringContaining('Some workflow field update error'),
            detailedMessage: expect.stringContaining('Some workflow field update error'),
            severity: 'Error',
            elemID: workflowFieldUpdate.elemID,
          })
        })
      })

      describe('when the request fails with mappable problem', () => {
        let result: DeployResult
        beforeEach(async () => {
          const newInst = createInstanceElement(mockDefaultValues.Profile, mockTypes.Profile)
          connection.metadata.deploy.mockReturnValueOnce(
            mockDeployResult({
              success: false,
              componentFailure: [
                {
                  fullName: await apiName(newInst),
                  componentType: await metadataType(newInst),
                  problem: constants.SALESFORCE_DEPLOY_ERROR_MESSAGES.SCHEDULABLE_CLASS,
                },
              ],
            }),
          )

          result = await adapter.deploy({
            changeGroup: {
              groupID: newInst.elemID.getFullName(),
              changes: [{ action: 'add', data: { after: newInst } }],
            },
            progressReporter: nullProgressReporter,
          })
        })

        it('should return an error with user friendly message', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0].message).toContain(constants.SALESFORCE_DEPLOY_ERROR_MESSAGES.SCHEDULABLE_CLASS)
          expect(result.errors[0].detailedMessage).toContain(
            constants.SALESFORCE_DEPLOY_ERROR_MESSAGES.SCHEDULABLE_CLASS,
          )
        })
      })

      describe('when performing a check-only deployment', () => {
        let result: DeployResult
        beforeEach(() => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              success: true,
              componentSuccess: [{ fullName: instanceName, componentType: 'Flow' }],
              checkOnly: true,
            }),
          )
        })
        describe('when attempting to deploy non CustomObjects', () => {
          describe('when quick deploy is disable', () => {
            beforeEach(async () => {
              result = await adapter.validate({
                changeGroup: {
                  groupID: instance.elemID.getFullName(),
                  changes: [{ action: 'add', data: { after: instance } }],
                },
                progressReporter: nullProgressReporter,
              })
            })
            it('should return applied changes', () => {
              expect(result.appliedChanges).toHaveLength(1)
              if (result.extraProperties?.groups !== undefined) {
                expect(result.extraProperties?.groups[0].requestId).toBeUndefined()
              }
            })
          })
          describe('when quick deploy is enabled', () => {
            beforeEach(async () => {
              connection.metadata.deploy.mockReturnValue(
                mockDeployResult({
                  checkOnly: true,
                  componentSuccess: [{ fullName: instanceName, componentType: 'Flow' }],
                  testCompleted: 1,
                }),
              )
              result = await adapter.validate({
                changeGroup: {
                  groupID: instance.elemID.getFullName(),
                  changes: [{ action: 'add', data: { after: instance } }],
                },
                progressReporter: nullProgressReporter,
              })
            })
            it('should return applied changes', () => {
              expect(result.appliedChanges).toHaveLength(1)
              if (result.extraProperties?.groups !== undefined) {
                expect(result.extraProperties?.groups[0].requestId).toBeDefined()
              }
            })
          })
        })
        describe('when attempting to deploy CustomObjects', () => {
          beforeEach(async () => {
            const customObjectInstance = new InstanceElement(
              'TestCustomObject',
              createCustomObjectType('TestCustomObject', {}),
            )
            result = await adapter.validate({
              changeGroup: {
                groupID: instance.elemID.getFullName(),
                changes: [{ action: 'add', data: { after: customObjectInstance } }],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should return error', () => {
            expect(result.errors).toHaveLength(1)
            expect(result.appliedChanges).toBeEmpty()
          })
        })
      })

      describe('when performing a check-only deployment with old config', () => {
        let result: DeployResult
        beforeEach(() => {
          ;({ connection, adapter } = mockAdapter({
            adapterParams: {
              config: {
                client: {
                  deploy: {
                    checkOnly: true,
                  },
                },
                fetch: {
                  data: {
                    includeObjects: ['Test'],
                    saltoIDSettings: {
                      defaultIdFields: ['Name'],
                    },
                  },
                },
              },
            },
          }))
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              success: true,
              componentSuccess: [{ fullName: instanceName, componentType: 'Flow' }],
              checkOnly: true,
            }),
          )
        })

        describe('when attempting to deploy non CustomObjects', () => {
          beforeEach(async () => {
            result = await adapter.deploy({
              changeGroup: {
                groupID: instance.elemID.getFullName(),
                changes: [{ action: 'add', data: { after: instance } }],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should not return applied changes', () => {
            expect(result.appliedChanges).toBeEmpty()
          })
        })
        describe('when attempting to deploy CustomObjects', () => {
          beforeEach(async () => {
            const customObjectInstance = new InstanceElement(
              'TestCustomObject',
              createCustomObjectType('TestCustomObject', {}),
            )
            result = await adapter.deploy({
              changeGroup: {
                groupID: instance.elemID.getFullName(),
                changes: [{ action: 'add', data: { after: customObjectInstance } }],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should return error', () => {
            expect(result.errors).toHaveLength(1)
            expect(result.appliedChanges).toBeEmpty()
          })
        })
      })

      describe('when preforming quick deploy', () => {
        const POLLING_INTERVAL = 10

        let result: DeployResult
        describe('when the received hash is corresponding with the calculated hash', () => {
          beforeEach(async () => {
            ;({ connection, adapter } = mockAdapter({
              adapterParams: {
                config: {
                  client: {
                    polling: {
                      interval: POLLING_INTERVAL,
                    },
                    deploy: {
                      quickDeployParams: {
                        requestId: '1',
                        hash: 'acbcfff7a7d7b6542e5a9fd681a31aaa',
                      },
                    },
                  },
                },
              },
            }))
            connection.metadata.deployRecentValidation.mockReturnValue(
              mockDeployResult(
                {
                  success: true,
                  componentSuccess: [{ fullName: instanceName, componentType: 'Flow' }],
                  checkOnly: true,
                },
                POLLING_INTERVAL * 2,
              ),
            )
            result = await adapter.deploy({
              changeGroup: {
                groupID: instance.elemID.getFullName(),
                changes: [{ action: 'add', data: { after: instance } }],
              },
              progressReporter,
            })
          })
          it('should deploy', () => {
            expect(result.errors).toBeEmpty()
            expect(result.appliedChanges).toHaveLength(1)
            expect(progressReporter.getReportedMessages()).toSatisfyAny(
              message =>
                message.endsWith(ProgressReporterSuffix.QuickDeploy) &&
                message.includes('Waiting on another deploy') &&
                message.includes('Elapsed Time:') &&
                message.includes('View deployments [in Salesforce](https://url.com/lightning/setup/DeployStatus/home)'),
            )
          })
          it('should report the deployment asyncTaskId', () => {
            expect(progressReporter.getReportedAsyncTaskIds()).toHaveLength(1)
          })
        })

        describe('when the received hash is not corresponding with the calculated hash', () => {
          beforeEach(async () => {
            ;({ connection, adapter } = mockAdapter({
              adapterParams: {
                config: {
                  client: {
                    deploy: {
                      quickDeployParams: {
                        requestId: '1',
                        hash: '1',
                      },
                    },
                  },
                },
              },
            }))
            connection.metadata.deployRecentValidation.mockReturnValue(mockDeployResult({}))
            result = await adapter.deploy({
              changeGroup: {
                groupID: instance.elemID.getFullName(),
                changes: [{ action: 'add', data: { after: instance } }],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should not deploy', () => {
            expect(result.appliedChanges).toBeEmpty()
          })
        })
        describe('when the quick deploy fails in SF', () => {
          beforeEach(async () => {
            ;({ connection, adapter } = mockAdapter({
              adapterParams: {
                config: {
                  client: {
                    polling: {
                      interval: POLLING_INTERVAL,
                    },
                    deploy: {
                      quickDeployParams: {
                        requestId: '1',
                        hash: 'acbcfff7a7d7b6542e5a9fd681a31aaa',
                      },
                    },
                  },
                },
              },
            }))
            connection.metadata.deployRecentValidation.mockImplementation(() => {
              throw new Error('INVALID_TOKEN')
            })
            connection.metadata.deploy.mockReturnValue(
              mockDeployResult(
                {
                  success: true,
                  componentSuccess: [{ fullName: instanceName, componentType: 'Flow' }],
                  checkOnly: true,
                },
                POLLING_INTERVAL * 2,
              ),
            )
            const { errors } = await adapter.deploy({
              changeGroup: {
                groupID: instance.elemID.getFullName(),
                changes: [{ action: 'add', data: { after: instance } }],
              },
              progressReporter,
            })
            expect(errors).toBeEmpty()
          })
          it('should fallback to the regular deploy', () => {
            expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
            expect(progressReporter.getReportedMessages()).toSatisfyAny(message =>
              message.endsWith(ProgressReporterSuffix.QuickDeployFailed),
            )
          })
        })
      })
    })

    describe('for a type element', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          description: {
            refType: stringType,
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          formula: {
            refType: stringType,
            annotations: {
              [constants.LABEL]: 'formula field',
              [constants.FORMULA]: 'my formula',
            },
          },
        },
      })

      let result: ObjectType

      beforeEach(async () => {
        connection.metadata.deploy.mockReturnValue(
          mockDeployResult({
            success: true,
            componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
          }),
        )
        result = await createElement(adapter, element)
      })

      it('should add the new element', async () => {
        // Verify object creation
        expect(result).toBeInstanceOf(ObjectType)
        expect(result.annotations[constants.API_NAME]).toBe('Test__c')
        expect(isServiceId((await result.getAnnotationTypes())[constants.API_NAME])).toEqual(true)
        expect(result.annotations[constants.METADATA_TYPE]).toBe(constants.CUSTOM_OBJECT)
        expect(isServiceId((await result.getAnnotationTypes())[constants.METADATA_TYPE])).toEqual(true)
        const objAnnotations = result.annotations as CustomObject
        expect(objAnnotations.label).toEqual('Test')
        expect(result.annotationRefTypes.label.elemID).toEqual(BuiltinTypes.STRING.elemID)
        expect(result.fields.description.annotations[constants.API_NAME]).toBe('Test__c.description__c')
        expect(result.fields.description.annotations[constants.LABEL]).toEqual('description')

        expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
        const deployedPackage = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
        expect(deployedPackage.manifest?.types).toContainEqual({
          name: constants.CUSTOM_OBJECT,
          members: 'Test__c',
        })
      })
    })

    describe('for a new salesforce type with different field types', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          currency: {
            refType: Types.primitiveDataTypes.Currency,
            annotations: {
              [constants.LABEL]: 'Currency description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
            },
          },
          auto: {
            refType: Types.primitiveDataTypes.AutoNumber,
            annotations: {
              [constants.LABEL]: 'Autonumber description label',
              [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'ZZZ-{0000}',
            },
          },
          date: {
            refType: Types.primitiveDataTypes.Date,
            annotations: {
              [constants.LABEL]: 'Date description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Today() + 7',
            },
          },
          time: {
            refType: Types.primitiveDataTypes.Time,
            annotations: {
              [constants.LABEL]: 'Time description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'TIMENOW() + 5',
            },
          },
          datetime: {
            refType: Types.primitiveDataTypes.DateTime,
            annotations: {
              [constants.LABEL]: 'DateTime description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Now() + 7',
            },
          },
          email: {
            refType: Types.primitiveDataTypes.Email,
            annotations: {
              [constants.LABEL]: 'Email description label',
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
            },
          },
          location: {
            refType: Types.compoundDataTypes.Location,
            annotations: {
              [constants.LABEL]: 'Location description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 2,
              [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: true,
            },
          },
          multipicklist: {
            refType: Types.primitiveDataTypes.MultiselectPicklist,
            annotations: {
              [constants.LABEL]: 'Multipicklist description label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                createValueSetEntry('DO'),
                createValueSetEntry('RE', true),
                createValueSetEntry('MI'),
                createValueSetEntry('FA'),
                createValueSetEntry('SOL'),
                createValueSetEntry('LA'),
                createValueSetEntry('SI'),
              ],
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 4,
            },
          },
          percent: {
            refType: Types.primitiveDataTypes.Percent,
            annotations: {
              [constants.LABEL]: 'Percent description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 12,
            },
          },
          phone: {
            refType: Types.primitiveDataTypes.Phone,
            annotations: {
              [constants.LABEL]: 'Phone description label',
            },
          },
          longtextarea: {
            refType: Types.primitiveDataTypes.LongTextArea,
            annotations: {
              [constants.LABEL]: 'LongTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
            },
          },
          richtextarea: {
            refType: Types.primitiveDataTypes.Html,
            annotations: {
              [constants.LABEL]: 'RichTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
            },
          },
          textarea: {
            refType: Types.primitiveDataTypes.TextArea,
            annotations: {
              [constants.LABEL]: 'TextArea description label',
            },
          },
          encryptedtext: {
            refType: Types.primitiveDataTypes.EncryptedText,
            annotations: {
              [constants.LABEL]: 'EncryptedText description label',
              [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'creditCard',
              [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
              [constants.FIELD_ANNOTATIONS.LENGTH]: 35,
            },
          },
          url: {
            refType: Types.primitiveDataTypes.Url,
            annotations: {
              [constants.LABEL]: 'Url description label',
            },
          },
          picklist: {
            refType: Types.primitiveDataTypes.Picklist,
            annotations: {
              [constants.LABEL]: 'Picklist description label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                createValueSetEntry('DO', true),
                createValueSetEntry('RE'),
                createValueSetEntry('MI'),
                createValueSetEntry('FA'),
                createValueSetEntry('SOL'),
                createValueSetEntry('LA'),
                createValueSetEntry('SI'),
              ],
            },
          },
          text: {
            refType: Types.primitiveDataTypes.Text,
            annotations: {
              [constants.LABEL]: 'Text description label',
              [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
                values: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'],
              }),
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
              [constants.FIELD_ANNOTATIONS.LENGTH]: 90,
            },
          },
          number: {
            refType: Types.primitiveDataTypes.Number,
            annotations: {
              [constants.LABEL]: 'Number description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 12,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 8,
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
            },
          },
          checkbox: {
            refType: Types.primitiveDataTypes.Checkbox,
            annotations: {
              [constants.LABEL]: 'Checkbox description label',
              [constants.FIELD_ANNOTATIONS.DEFAULT_VALUE]: true,
            },
          },
        },
      })

      beforeEach(async () => {
        connection.metadata.deploy.mockReturnValue(
          mockDeployResult({
            success: true,
            componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
          }),
        )
        await createElement(adapter, element)
      })

      it('should create the element correctly', async () => {
        expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
        const deployedPackage = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
        expect(deployedPackage.manifest?.types).toContainEqual({
          name: constants.CUSTOM_OBJECT,
          members: 'Test__c',
        })
        const deployedValues = await deployedPackage.getData('objects/Test__c.object')
        expect(deployedValues).toBeDefined()
        const object = deployedValues.CustomObject
        expect(object.fields).toHaveLength(19)
        // Currency
        expect(object.fields[0].fullName).toBe('currency__c')
        expect(object.fields[0].type).toBe('Currency')
        expect(object.fields[0].label).toBe('Currency description label')
        expect(object.fields[0].scale).toBe(3)
        expect(object.fields[0].precision).toBe(18)
        // Autonumber
        expect(object.fields[1].fullName).toBe('auto__c')
        expect(object.fields[1].type).toBe('AutoNumber')
        expect(object.fields[1].label).toBe('Autonumber description label')
        expect(object.fields[1].displayFormat).toBe('ZZZ-{0000}')
        // Date
        expect(object.fields[2].fullName).toBe('date__c')
        expect(object.fields[2].type).toBe('Date')
        expect(object.fields[2].label).toBe('Date description label')
        expect(object.fields[2].defaultValue).toBe('Today() + 7')
        // Time
        expect(object.fields[3].fullName).toBe('time__c')
        expect(object.fields[3].type).toBe('Time')
        expect(object.fields[3].label).toBe('Time description label')
        expect(object.fields[3].defaultValue).toBe('TIMENOW() + 5')
        // Datetime
        expect(object.fields[4].fullName).toBe('datetime__c')
        expect(object.fields[4].type).toBe('DateTime')
        expect(object.fields[4].label).toBe('DateTime description label')
        expect(object.fields[4].defaultValue).toBe('Now() + 7')
        // Email
        expect(object.fields[5].fullName).toBe('email__c')
        expect(object.fields[5].type).toBe('Email')
        expect(object.fields[5].label).toBe('Email description label')
        expect(object.fields[5].unique).toBe(true)
        // Location
        expect(object.fields[6].fullName).toBe('location__c')
        expect(object.fields[6].type).toBe('Location')
        expect(object.fields[6].label).toBe('Location description label')
        expect(object.fields[6].displayLocationInDecimal).toBe(true)
        expect(object.fields[6].scale).toBe(2)
        // Multipicklist
        expect(object.fields[7].fullName).toBe('multipicklist__c')
        expect(object.fields[7].type).toBe('MultiselectPicklist')
        expect(object.fields[7].label).toBe('Multipicklist description label')
        expect(object.fields[7].visibleLines).toBe(4)
        expect(
          object.fields[7].valueSet.valueSetDefinition.value.map((v: { fullName: string }) => v.fullName).join(';'),
        ).toBe('DO;RE;MI;FA;SOL;LA;SI')
        const picklistValueRE = object.fields[7].valueSet.valueSetDefinition.value.filter(
          (val: { fullName: string }) => val.fullName === 'RE',
        )[0]
        expect(picklistValueRE).toBeDefined()
        expect(picklistValueRE.default).toEqual(true)
        // Percent
        expect(object.fields[8].fullName).toBe('percent__c')
        expect(object.fields[8].type).toBe('Percent')
        expect(object.fields[8].label).toBe('Percent description label')
        expect(object.fields[8].scale).toBe(3)
        expect(object.fields[8].precision).toBe(12)
        // Phone
        expect(object.fields[9].fullName).toBe('phone__c')
        expect(object.fields[9].type).toBe('Phone')
        expect(object.fields[9].label).toBe('Phone description label')
        // Longtextarea
        expect(object.fields[10].fullName).toBe('longtextarea__c')
        expect(object.fields[10].type).toBe('LongTextArea')
        expect(object.fields[10].label).toBe('LongTextArea description label')
        expect(object.fields[10].visibleLines).toBe(5)
        expect(object.fields[11].length).toBe(32768)
        // Richtextarea
        expect(object.fields[11].fullName).toBe('richtextarea__c')
        expect(object.fields[11].type).toBe('Html')
        expect(object.fields[11].label).toBe('RichTextArea description label')
        expect(object.fields[11].visibleLines).toBe(27)
        expect(object.fields[11].length).toBe(32768)
        // Textarea
        expect(object.fields[12].fullName).toBe('textarea__c')
        expect(object.fields[12].type).toBe('TextArea')
        expect(object.fields[12].label).toBe('TextArea description label')
        // EncryptedText
        expect(object.fields[13].fullName).toBe('encryptedtext__c')
        expect(object.fields[13].type).toBe('EncryptedText')
        expect(object.fields[13].label).toBe('EncryptedText description label')
        expect(object.fields[13].maskChar).toBe('X')
        expect(object.fields[13].maskType).toBe('creditCard')
        expect(object.fields[13].length).toBe(35)
        // Url
        expect(object.fields[14].fullName).toBe('url__c')
        expect(object.fields[14].type).toBe('Url')
        expect(object.fields[14].label).toBe('Url description label')
        // Picklist
        expect(object.fields[15].fullName).toBe('picklist__c')
        expect(object.fields[15].type).toBe('Picklist')
        expect(object.fields[15].label).toBe('Picklist description label')
        expect(
          object.fields[15].valueSet.valueSetDefinition.value.map((v: { fullName: string }) => v.fullName).join(';'),
        ).toBe('DO;RE;MI;FA;SOL;LA;SI')
        const picklistValueDO = object.fields[15].valueSet.valueSetDefinition.value.filter(
          (val: { fullName: string }) => val.fullName === 'DO',
        )[0]
        expect(picklistValueDO).toBeDefined()
        expect(picklistValueDO.default).toEqual(true)
        // Text
        expect(object.fields[16].fullName).toBe('text__c')
        expect(object.fields[16].type).toBe('Text')
        expect(object.fields[16].label).toBe('Text description label')
        expect(object.fields[16].unique).toBe(true)
        expect(object.fields[16].caseSensitive).toBe(true)
        expect(object.fields[16].length).toBe(90)
        // Number
        expect(object.fields[17].fullName).toBe('number__c')
        expect(object.fields[17].type).toBe('Number')
        expect(object.fields[17].label).toBe('Number description label')
        expect(object.fields[17].unique).toBe(true)
        expect(object.fields[17].scale).toBe(12)
        expect(object.fields[17].precision).toBe(8)
        // Checkbox
        expect(object.fields[18].fullName).toBe('checkbox__c')
        expect(object.fields[18].type).toBe('Checkbox')
        expect(object.fields[18].label).toBe('Checkbox description label')
        expect(object.fields[18].defaultValue).toBe(true)
      })
    })

    describe('when apex tests fail', () => {
      let instance: InstanceElement
      let deployResultParams: Parameters<typeof mockDeployResult>[0]
      let deployChangeGroup: ChangeGroup
      beforeEach(async () => {
        instance = createInstanceElement(mockDefaultValues.ApexClass, mockTypes.ApexClass)
        deployResultParams = {
          success: false,
          componentSuccess: [
            {
              fullName: await apiName(instance),
              componentType: await metadataType(instance),
            },
          ],
          runTestResult: {
            failures: [mockRunTestFailure({ message: 'Test failed' })],
          },
        }
        deployChangeGroup = {
          groupID: instance.elemID.getFullName(),
          changes: [toChange({ after: instance })],
        }
      })
      describe('with rollback on error', () => {
        let result: DeployResult
        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              ...deployResultParams,
              rollbackOnError: true,
            }),
          )
          result = await adapter.deploy({
            changeGroup: deployChangeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('should not apply the instance change', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })
        it('should return the test errors', () => {
          expect(result.errors).toEqual([
            expect.objectContaining({
              message: expect.stringContaining('Test failed'),
              detailedMessage: expect.stringContaining('Test failed'), // ??
            }),
            expect.objectContaining({
              elemID: instance.elemID,
              message: expect.stringContaining('rollbackOnError'),
              detailedMessage: expect.stringContaining('rollbackOnError'),
              severity: 'Warning',
            }),
          ])
        })
      })
      describe('without rollback on error', () => {
        let result: DeployResult
        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              ...deployResultParams,
              rollbackOnError: false,
            }),
          )
          result = await adapter.deploy({
            changeGroup: deployChangeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('should apply the component changes', () => {
          expect(result.appliedChanges).toHaveLength(1)
        })
        it('should return the test errors', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0].message).toMatch(/.*Test failed.*/)
          expect(result.errors[0].detailedMessage).toMatch(/.*Test failed.*/)
        })
      })
    })

    describe('when one component fails and others succeed', () => {
      let successElement: InstanceElement
      let failureElement: InstanceElement
      let deployChangeGroup: ChangeGroup
      beforeEach(() => {
        successElement = createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'SuccessElement',
          },
          mockTypes.ApexClass,
        )
        failureElement = createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'FailureElement',
          },
          mockTypes.ApexClass,
        )

        deployChangeGroup = {
          groupID: 'ChangeGroup',
          changes: [toChange({ after: failureElement }), toChange({ after: successElement })],
        }
      })
      describe('with rollback on error', () => {
        let result: DeployResult
        beforeEach(async () => {
          const deployResultParams = {
            success: false,
            componentSuccess: [
              {
                fullName: apiNameSync(successElement),
                componentType: metadataTypeSync(successElement),
              },
            ],
            componentFailure: [
              {
                fullName: apiNameSync(failureElement),
                componentType: metadataTypeSync(failureElement),
                problem: 'Failed to deploy',
              },
            ],
          }
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              ...deployResultParams,
              rollbackOnError: true,
            }),
          )
          result = await adapter.deploy({
            changeGroup: deployChangeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('should return the test errors', () => {
          expect(result.errors).toEqual([
            expect.objectContaining({
              elemID: failureElement.elemID,
              message: expect.stringContaining('Failed to deploy'),
              detailedMessage: expect.stringContaining('Failed to deploy'),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: successElement.elemID,
              message: expect.stringContaining('rollbackOnError'),
              detailedMessage: expect.stringContaining('rollbackOnError'),
              severity: 'Warning',
            }),
          ])
        })
        it('should have no applied changes', () => {
          expect(result.appliedChanges).toBeEmpty()
        })
      })
      describe('when the successful element has a problem', () => {
        let result: DeployResult
        beforeEach(async () => {
          const deployResultParams = {
            success: false,
            componentSuccess: [
              {
                fullName: apiNameSync(successElement),
                componentType: metadataTypeSync(successElement),
                problem: 'Something happened',
                problemType: 'Info',
              },
            ],
            componentFailure: [
              {
                fullName: apiNameSync(failureElement),
                componentType: metadataTypeSync(failureElement),
                problem: 'Failed to deploy',
              },
            ],
          }
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              ...deployResultParams,
              rollbackOnError: true,
            }),
          )
          result = await adapter.deploy({
            changeGroup: deployChangeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('Should return the problem from successful components', () => {
          expect(result.errors).toIncludeAllMembers([
            {
              elemID: successElement.elemID,
              severity: 'Info',
              message: 'Something happened',
              detailedMessage: 'Something happened',
            },
          ])
        })
      })
    })

    describe('when all components succeed', () => {
      let element: InstanceElement
      let deployChangeGroup: ChangeGroup
      beforeEach(() => {
        element = createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'SuccessElement',
          },
          mockTypes.ApexClass,
        )

        deployChangeGroup = {
          groupID: 'ChangeGroup',
          changes: [toChange({ after: element })],
        }
      })
      describe('when the element has a warning', () => {
        let result: DeployResult
        beforeEach(async () => {
          const deployResultParams = {
            success: false,
            componentSuccess: [
              {
                fullName: apiNameSync(element),
                componentType: metadataTypeSync(element),
                problem: 'Something happened',
                problemType: 'Warning',
              },
            ],
          }
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              ...deployResultParams,
              rollbackOnError: true,
            }),
          )
          result = await adapter.deploy({
            changeGroup: deployChangeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('Should return the problem from successful component', () => {
          expect(result.errors).toEqual([
            {
              elemID: element.elemID,
              severity: 'Warning',
              message: 'Something happened',
              detailedMessage: 'Something happened',
            },
          ])
        })
      })
    })

    describe('when the deploy gets canceled', () => {
      let element: InstanceElement
      let deployChangeGroup: ChangeGroup
      let result: DeployResult
      beforeEach(async () => {})
      beforeEach(async () => {
        element = createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'SuccessElement',
          },
          mockTypes.ApexClass,
        )

        deployChangeGroup = {
          groupID: 'ChangeGroup',
          changes: [toChange({ after: element })],
        }
        const deployResultParams = {
          success: false,
          canceled: true,
        }
        connection.metadata.deploy.mockReturnValue(
          mockDeployResult({
            ...deployResultParams,
            rollbackOnError: true,
          }),
        )
        result = await adapter.deploy({
          changeGroup: deployChangeGroup,
          progressReporter: nullProgressReporter,
        })
      })
      it('Should return the correct error and no applied changes', () => {
        expect(result.errors).toEqual([
          {
            severity: 'Error',
            message: 'Deployment was canceled.',
            detailedMessage: 'Deployment was canceled.',
          },
        ])
        expect(result.appliedChanges).toBeEmpty()
      })
    })
  })

  describe('Remove operation', () => {
    let result: DeployResult
    describe('for an instance element', () => {
      let element: InstanceElement
      beforeEach(() => {
        element = new InstanceElement(
          instanceName,
          new ObjectType({
            elemID: mockElemID,
            fields: {
              username: { refType: BuiltinTypes.STRING },
              password: { refType: BuiltinTypes.STRING },
              token: { refType: BuiltinTypes.STRING },
              sandbox: { refType: BuiltinTypes.BOOLEAN },
              [constants.INSTANCE_FULL_NAME_FIELD]: {
                refType: BuiltinTypes.SERVICE_ID,
              },
            },
            annotationRefsOrTypes: {},
            annotations: { [constants.METADATA_TYPE]: 'Flow' },
          }),
          { [constants.INSTANCE_FULL_NAME_FIELD]: instanceName },
        )
      })

      describe('when the remove is successful', () => {
        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              componentSuccess: [{ componentType: 'Flow', fullName: instanceName }],
            }),
          )
          result = await removeElement(adapter, element)
        })
        it('should call the connection methods correctly', async () => {
          expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
          const { deleteManifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
          expect(deleteManifest).toBeDefined()
          expect(deleteManifest?.types).toEqual({
            name: 'Flow',
            members: instanceName,
          })
        })
        it('should return the applied remove change', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(result.appliedChanges).toContainEqual(toChange({ before: element }))
        })
      })

      describe('when the instance has no api name', () => {
        beforeEach(async () => {
          delete element.value.fullName
          result = await removeElement(adapter, element, false)
        })
        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
        })
        it('should not apply the change', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })
        it('should not make the API call since it is empty', () => {
          expect(connection.metadata.deploy).not.toHaveBeenCalled()
        })
      })

      describe('when the instance does not exist but the request succeeds', () => {
        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              // When calling with ignoreWarnings = true we get these warnings in the
              // componentSuccess list
              componentSuccess: [
                {
                  componentType: 'Flow',
                  fullName: 'destructiveChangesPost.xml',
                  problemType: 'Warning',
                  problem: `No Flow named: ${instanceName} found`,
                },
              ],
            }),
          )
          result = await removeElement(adapter, element, false)
        })
        it('should filter out the un found delete error', () => {
          expect(result.errors).toHaveLength(0)
        })
        it('should return the applied remove change', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(result.appliedChanges).toContainEqual(toChange({ before: element }))
        })
      })
      describe('when the instance does not exist and the request fails', () => {
        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              success: false,
              componentFailure: [
                {
                  componentType: 'Flow',
                  fullName: 'destructiveChangesPost.xml',
                  problemType: 'Warning',
                  problem: `No Flow named: ${instanceName} found`,
                },
              ],
            }),
          )
          result = await removeElement(adapter, element, false)
        })
        it('should filter out the un found delete error', () => {
          expect(result.errors).toHaveLength(0)
        })
        it('should not apply the remove change', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })
      })
    })

    describe('for a type element', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          description: { refType: stringType },
        },
        annotations: {
          [constants.API_NAME]: 'Test__c',
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        },
      })

      beforeEach(async () => {
        await removeElement(adapter, element)
      })

      it('should call the connection methods correctly', async () => {
        expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
        const { deleteManifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
        expect(deleteManifest?.types).toEqual({
          name: constants.CUSTOM_OBJECT,
          members: 'Test__c',
        })
      })
    })
  })

  describe('Update operation', () => {
    let result: DeployResult
    describe('for an instance element', () => {
      describe('when the internal ID of the Element changes', () => {
        describe('when new id from salesforce is defined', () => {
          beforeEach(async () => {
            const DEPLOYMENT_ID = 'testDeploymentId'
            const beforeInstanceNoProfile = createInstanceElement(mockDefaultValues.ApexPage, mockTypes.ApexPage)
            const afterInstanceNoProfile = createInstanceElement(
              {
                ...mockDefaultValues.ApexPage,
                description: 'Updated ApexPage description',
              },
              mockTypes.ApexPage,
            )
            connection.metadata.deploy.mockReturnValueOnce(
              mockDeployResult({
                id: DEPLOYMENT_ID,
                success: true,
                componentSuccess: [
                  {
                    fullName: mockDefaultValues.ApexPage.fullName,
                    componentType: constants.APEX_PAGE_METADATA_TYPE,
                    id: NEW_ID,
                  },
                ],
                retrieveResult: await mockRetrieveResult({}),
              }),
            )
            result = await adapter.deploy({
              changeGroup: {
                groupID: afterInstanceNoProfile.elemID.getFullName(),
                changes: [
                  {
                    action: 'modify',
                    data: { before: beforeInstanceNoProfile, after: afterInstanceNoProfile },
                  },
                ],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should update internal id for non profile instances', async () => {
            const deployedInstance = getChangeData(result.appliedChanges[0]) as InstanceElement
            expect(deployedInstance).toBeInstanceOf(InstanceElement)
            expect(deployedInstance.value[constants.INTERNAL_ID_FIELD]).toEqual(NEW_ID)
          })
        })
        describe('when new id from salesforce is undefined', () => {
          let beforeInstanceNoProfile: InstanceElement
          beforeEach(async () => {
            const DEPLOYMENT_ID = 'testDeploymentId'
            beforeInstanceNoProfile = createInstanceElement(mockDefaultValues.ApexPage, mockTypes.ApexPage)
            const afterInstanceNoProfile = createInstanceElement(
              {
                ...mockDefaultValues.ApexPage,
                description: 'Updated ApexPage description',
              },
              mockTypes.ApexPage,
            )
            connection.metadata.deploy.mockReturnValueOnce(
              mockDeployResult({
                id: DEPLOYMENT_ID,
                success: true,
                componentSuccess: [
                  {
                    fullName: mockDefaultValues.ApexPage.fullName,
                    componentType: constants.APEX_PAGE_METADATA_TYPE,
                    id: undefined,
                  },
                ],
                retrieveResult: await mockRetrieveResult({}),
              }),
            )
            result = await adapter.deploy({
              changeGroup: {
                groupID: afterInstanceNoProfile.elemID.getFullName(),
                changes: [
                  {
                    action: 'modify',
                    data: { before: beforeInstanceNoProfile, after: afterInstanceNoProfile },
                  },
                ],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should not update internal id', async () => {
            const deployedInstance = getChangeData(result.appliedChanges[0]) as InstanceElement
            expect(deployedInstance).toBeInstanceOf(InstanceElement)
            expect(deployedInstance.value[constants.INTERNAL_ID_FIELD]).toEqual(
              beforeInstanceNoProfile.value[constants.INTERNAL_ID_FIELD],
            )
          })
        })
      })
      describe('for general instance element', () => {
        let beforeInstance: InstanceElement
        let afterInstance: InstanceElement

        beforeEach(() => {
          beforeInstance = createInstanceElement(mockDefaultValues.Profile, mockTypes.Profile)
          afterInstance = createInstanceElement(
            {
              ...mockDefaultValues.Profile,
              description: 'Updated profile description',
            },
            mockTypes.Profile,
          )
        })

        describe('when the request succeeds', () => {
          const DEPLOYMENT_ID = 'testDeploymentId'
          beforeEach(async () => {
            connection.metadata.deploy.mockReturnValueOnce(
              mockDeployResult({
                id: DEPLOYMENT_ID,
                success: true,
                componentSuccess: [
                  {
                    fullName: mockDefaultValues.Profile.fullName,
                    componentType: constants.PROFILE_METADATA_TYPE,
                  },
                ],
                retrieveResult: await mockRetrieveResult({}),
              }),
            )
            result = await adapter.deploy({
              changeGroup: {
                groupID: afterInstance.elemID.getFullName(),
                changes: [
                  {
                    action: 'modify',
                    data: { before: beforeInstance, after: afterInstance },
                  },
                ],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should return an InstanceElement', () => {
            expect(result.appliedChanges).toHaveLength(1)
            expect(getChangeData(result.appliedChanges[0])).toBeInstanceOf(InstanceElement)
          })

          it('should call the connection methods correctly', async () => {
            expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
            const { manifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
            expect(manifest?.types).toEqual({
              name: constants.PROFILE_METADATA_TYPE,
              members: mockDefaultValues.Profile.fullName,
            })
          })
          it('should return deployment URL containing the deployment ID in the extra properties', async () => {
            const receivedUrl = (result.extraProperties?.groups ?? [])[0].url
            expect(receivedUrl).toContain(DEPLOYMENT_ID)
          })
          it('should return correct artifacts', () => {
            const groups = result.extraProperties?.groups ?? []
            expect(groups).toHaveLength(1)
            const artifactNames = makeArray(groups[0].artifacts).map(artifact => artifact.name)
            expect(artifactNames).toIncludeSameMembers([
              SalesforceArtifacts.DeployPackageXml,
              SalesforceArtifacts.PostDeployRetrieveZip,
            ])
          })
        })

        describe('when the result from Salesforce contains codeCoverageWarnings', () => {
          beforeEach(async () => {
            connection.metadata.deploy.mockReturnValueOnce(
              mockDeployResult({
                id: 'DeploymentWithCodeCoverageWarnings',
                success: true,
                componentSuccess: [
                  {
                    fullName: mockDefaultValues.Profile.fullName,
                    componentType: constants.PROFILE_METADATA_TYPE,
                  },
                ],
                runTestResult: {
                  codeCoverageWarnings: [
                    {
                      id: '1',
                      message: 'Code Coverage Went Down',
                    },
                  ],
                },
              }),
            )
            result = await adapter.deploy({
              changeGroup: {
                groupID: afterInstance.elemID.getFullName(),
                changes: [
                  {
                    action: 'modify',
                    data: { before: beforeInstance, after: afterInstance },
                  },
                ],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should produce a deploy error', () => {
            expect(result.errors).toHaveLength(1)
          })
        })

        describe('when the DeployResult contains errorMessage', () => {
          beforeEach(async () => {
            connection.metadata.deploy.mockReturnValue(
              mockDeployResult({
                id: 'DeploymentWithErrorMessageErrors',
                success: false,
                errorMessage: 'UNKNOWN_EXCEPTION: An unexpected error occurred',
                componentSuccess: [
                  {
                    fullName: mockDefaultValues.Profile.fullName,
                    componentType: constants.PROFILE_METADATA_TYPE,
                  },
                ],
              }),
            )
            result = await adapter.deploy({
              changeGroup: {
                groupID: afterInstance.elemID.getFullName(),
                changes: [
                  {
                    action: 'modify',
                    data: { before: beforeInstance, after: afterInstance },
                  },
                ],
              },
              progressReporter: nullProgressReporter,
            })
          })
          it('should produce a deploy error', () => {
            expect(result.errors).toEqual([
              expect.objectContaining({
                message: expect.stringContaining('UNKNOWN_EXCEPTION'),
                detailedMessage: expect.stringContaining('UNKNOWN_EXCEPTION'),
              }),
              expect.objectContaining({
                elemID: afterInstance.elemID,
                message: expect.stringContaining('rollbackOnError'),
                detailedMessage: expect.stringContaining('rollbackOnError'),
              }),
            ])
          })
        })

        describe('when the request fails because fullNames are not the same', () => {
          beforeEach(async () => {
            afterInstance = beforeInstance.clone()
            afterInstance.value[constants.INSTANCE_FULL_NAME_FIELD] = 'wrong'
            result = await adapter.deploy({
              changeGroup: {
                groupID: afterInstance.elemID.getFullName(),
                changes: [
                  {
                    action: 'modify',
                    data: { before: beforeInstance, after: afterInstance },
                  },
                ],
              },
              progressReporter: nullProgressReporter,
            })
          })

          it('should return an error', () => {
            expect(result.errors).toHaveLength(1)
          })

          it('should return empty applied changes', () => {
            expect(result.appliedChanges).toHaveLength(0)
          })

          it('should not call the connection', () => {
            expect(connection.metadata.deploy).not.toHaveBeenCalled()
          })
        })

        describe('delete metadata objects inside of instances upon update', () => {
          describe('objects names are nested', () => {
            const assignmentRuleFieldName = 'assignmentRule'
            const oldAssignmentRules = createInstanceElement(
              {
                [constants.INSTANCE_FULL_NAME_FIELD]: instanceName,
                [assignmentRuleFieldName]: [
                  { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
                  { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val2' },
                ],
              },
              mockTypes.AssignmentRules,
            )

            beforeEach(async () => {
              const newAssignmentRules = oldAssignmentRules.clone()
              // Remove one of the rules
              newAssignmentRules.value[assignmentRuleFieldName].pop()
              await adapter.deploy({
                changeGroup: {
                  groupID: oldAssignmentRules.elemID.getFullName(),
                  changes: [
                    {
                      action: 'modify',
                      data: {
                        before: oldAssignmentRules,
                        after: newAssignmentRules,
                      },
                    },
                  ],
                },
                progressReporter: nullProgressReporter,
              })
            })

            it('should delete on remove metadata objects with field names', async () => {
              expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
              const { deleteManifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
              expect(deleteManifest).toBeDefined()
              expect(deleteManifest?.types).toEqual({
                name: 'AssignmentRule',
                members: `${instanceName}.Val2`,
              })
            })
          })

          describe('objects names are absolute', () => {
            const customLabelsFieldName = 'labels'
            const mockCustomLabelsObjectType = new ObjectType({
              elemID: mockElemID,
              fields: {
                [constants.INSTANCE_FULL_NAME_FIELD]: {
                  refType: BuiltinTypes.SERVICE_ID,
                },
                [customLabelsFieldName]: {
                  refType: new ObjectType({
                    elemID: mockElemID,
                    fields: {
                      [constants.INSTANCE_FULL_NAME_FIELD]: {
                        refType: BuiltinTypes.SERVICE_ID,
                      },
                    },
                    annotations: {
                      [constants.METADATA_TYPE]: 'CustomLabel',
                    },
                  }),
                },
              },
              annotationRefsOrTypes: {},
              annotations: {
                [constants.METADATA_TYPE]: 'CustomLabels',
              },
            })
            const oldCustomLabels = new InstanceElement(instanceName, mockCustomLabelsObjectType, {
              [constants.INSTANCE_FULL_NAME_FIELD]: instanceName,
              [customLabelsFieldName]: [
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val2' },
              ],
            })
            const newCustomLabels = new InstanceElement(instanceName, mockCustomLabelsObjectType, {
              [constants.INSTANCE_FULL_NAME_FIELD]: instanceName,
              [customLabelsFieldName]: [{ [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' }],
            })

            beforeEach(async () => {
              await adapter.deploy({
                changeGroup: {
                  groupID: oldCustomLabels.elemID.getFullName(),
                  changes: [
                    {
                      action: 'modify',
                      data: { before: oldCustomLabels, after: newCustomLabels },
                    },
                  ],
                },
                progressReporter: nullProgressReporter,
              })
            })

            it('should call delete on remove metadata objects with object names', async () => {
              expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
              const { deleteManifest } = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
              expect(deleteManifest).toBeDefined()
              expect(deleteManifest?.types).toEqual({
                name: 'CustomLabel',
                members: 'Val2',
              })
            })
          })
        })
      })
    })

    describe('for a type element', () => {
      describe('when the request fails because fullNames are not the same', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          annotations: {
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          const newElement = oldElement.clone()
          newElement.annotations[constants.API_NAME] = 'Test2__c'
          result = await adapter.deploy({
            changeGroup: {
              groupID: oldElement.elemID.getFullName(),
              changes: [
                {
                  action: 'modify',
                  data: { before: oldElement, after: newElement },
                },
              ],
            },
            progressReporter: nullProgressReporter,
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
        })

        it('should return empty applied changes', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })

        it('should not call the connection', () => {
          expect(connection.metadata.deploy).not.toHaveBeenCalled()
        })
      })

      describe('with field add and remove and annotation change', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            description: {
              refType: stringType,
              annotations: { [constants.API_NAME]: 'Test__c.description__c' },
            },
            unchanged: {
              refType: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.unchanged__c',
              },
            },
          },
          annotations: {
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          },
        })

        const newElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: {
              refType: stringType,
              annotations: {
                label: 'test2 label',
                [constants.API_NAME]: 'Test__c.address__c',
              },
            },
            unchanged: oldElement.fields.unchanged,
          },
          annotations: {
            label: 'test2 label',
            [constants.API_NAME]: 'Test__c',
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          },
        })

        let changes: Change[]

        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              success: true,
              componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
            }),
          )
          changes = [
            {
              action: 'modify',
              data: { before: oldElement, after: newElement },
            },
            {
              action: 'remove',
              data: { before: oldElement.fields.description },
            },
            { action: 'add', data: { after: newElement.fields.address } },
          ]
          result = await adapter.deploy({
            changeGroup: {
              groupID: oldElement.elemID.getFullName(),
              changes,
            },
            progressReporter: nullProgressReporter,
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(3)
          expect(result.appliedChanges).toEqual(changes)
        })

        it('should call the connection methods correctly', async () => {
          expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
          const deployedPackage = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
          expect(deployedPackage.manifest?.types).toContainEqual({
            name: constants.CUSTOM_OBJECT,
            members: 'Test__c',
          })
          const deployedValues = await deployedPackage.getData('objects/Test__c.object')
          expect(deployedValues).toBeDefined()
          const updatedObj = deployedValues.CustomObject
          expect(updatedObj.label).toEqual('test2 label')
          // It should not deploy all fields when the sharingModel is not ControlledByParent
          expect(Array.isArray(updatedObj.fields)).toBeFalsy()
          const newField = updatedObj.fields
          expect(newField.fullName).toEqual('address__c')
          expect(newField.type).toEqual('Text')
          expect(newField.label).toEqual('test2 label')
        })

        it('should not add annotations to the object type', () => {
          const updatedObj = getChangeData(result.appliedChanges[0]) as ObjectType
          expect(updatedObj).toBeDefined()
          expect(updatedObj.annotations).toEqual(newElement.annotations)
        })
      })

      describe('with field remove add and modify changes', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: {
              refType: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Address__c',
                [constants.LABEL]: 'Address',
              },
            },
            banana: {
              refType: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Banana__c',
                [constants.LABEL]: 'Banana',
              },
            },
            cat: {
              refType: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Cat__c',
                [constants.LABEL]: 'Cat',
              },
            },
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          },
        })

        const newElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            banana: oldElement.fields.banana.clone({
              [constants.API_NAME]: 'Test__c.Banana__c',
              [constants.LABEL]: 'Banana Split',
            }),
            cat: oldElement.fields.cat,
            description: {
              refType: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Description__c',
                [constants.LABEL]: 'Description',
              },
            },
          },
          annotations: _.clone(oldElement.annotations),
        })

        let changes: Change[]

        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              success: true,
              componentSuccess: [
                {
                  fullName: 'Test__c.Address__c',
                  componentType: constants.CUSTOM_FIELD,
                },
                {
                  fullName: 'Test__c.Banana__c',
                  componentType: constants.CUSTOM_FIELD,
                },
                {
                  fullName: 'Test__c.Description__c',
                  componentType: constants.CUSTOM_FIELD,
                },
              ],
            }),
          )

          changes = [
            { action: 'remove', data: { before: oldElement.fields.address } },
            {
              action: 'modify',
              data: {
                before: oldElement.fields.banana,
                after: newElement.fields.banana,
              },
            },
            { action: 'add', data: { after: newElement.fields.description } },
          ]

          result = await adapter.deploy({
            changeGroup: {
              groupID: oldElement.elemID.getFullName(),
              changes,
            },
            progressReporter: nullProgressReporter,
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(3)
          expect(result.appliedChanges).toEqual(changes)
        })

        describe('deploy request', () => {
          let deployedPackage: DeployedPackage
          beforeAll(async () => {
            expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
            deployedPackage = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
          })
          describe('package manifest', () => {
            it('should contain the new and modified fields', async () => {
              expect(deployedPackage.manifest?.types).toContainEqual({
                name: constants.CUSTOM_FIELD,
                members: await Promise.all(
                  changes
                    .filter(isAdditionOrModificationChange)
                    .map(getChangeData)
                    .map(field => apiName(field)),
                ),
              })
            })
            it('should contain the deleted field in the delete manifest', () => {
              expect(deployedPackage.deleteManifest?.types).toEqual({
                name: constants.CUSTOM_FIELD,
                members: 'Test__c.Address__c',
              })
            })
            it('should not contain the custom object', () => {
              expect(deployedPackage.manifest?.types).not.toContainEqual({
                name: constants.CUSTOM_OBJECT,
                members: 'Test__c',
              })
            })
          })
          describe('custom object values', () => {
            let deployedObject: Values
            beforeAll(async () => {
              const deployedValues = await deployedPackage.getData('objects/Test__c.object')
              deployedObject = deployedValues?.CustomObject
              expect(deployedObject).toBeDefined()
            })
            it('should contain added and modified fields', () => {
              expect(deployedObject.fields).toHaveLength(2)
              const [bananaField, descField] = deployedObject.fields
              expect(descField.fullName).toBe('Description__c')
              expect(descField.type).toBe('Text')
              expect(descField.length).toBe(80)
              expect(descField.required).toBe(false)
              // Verify the custom field label change
              expect(bananaField.label).toBe('Banana Split')
            })
            it('should not contain object annotations', () => {
              expect(deployedObject).not.toHaveProperty('label')
            })
          })
        })
      })

      describe('when object annotations change and fields that remain change', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            banana: {
              refType: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Banana__c',
              },
            },
          },
          annotations: {
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        const newElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            banana: oldElement.fields.banana.clone({
              [constants.LABEL]: 'Banana Split',
              [constants.API_NAME]: 'Test__c.Banana__c',
            }),
          },
          annotations: {
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
            label: 'test2 label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              success: true,
              componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
            }),
          )
          result = await adapter.deploy({
            changeGroup: {
              groupID: oldElement.elemID.getFullName(),
              changes: [
                {
                  action: 'modify',
                  data: { before: oldElement, after: newElement },
                },
                {
                  action: 'modify',
                  data: {
                    before: oldElement.fields.banana,
                    after: newElement.fields.banana,
                  },
                },
              ],
            },
            progressReporter: nullProgressReporter,
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(2)
          expect(getChangeData(result.appliedChanges[0])).toEqual(newElement)
          expect(getChangeData(result.appliedChanges[1])).toEqual(newElement.fields.banana)
        })

        it('should deploy changes to the object and fields', async () => {
          expect(connection.metadata.deploy).toHaveBeenCalledTimes(1)
          const deployedPackage = await getDeployedPackage(connection.metadata.deploy.mock.calls[0][0])
          expect(deployedPackage.manifest?.types).toEqual({
            name: constants.CUSTOM_OBJECT,
            members: 'Test__c',
          })
          const deployedValues = await deployedPackage.getData('objects/Test__c.object')
          expect(deployedValues).toBeDefined()
          const updatedObject = deployedValues.CustomObject
          expect(updatedObject.label).toBe('test2 label')

          const field = updatedObject.fields
          expect(field.fullName).toBe('Banana__c')
          expect(field.type).toBe('Text')
          expect(field.label).toBe('Banana Split')
          expect(field.length).toBe(80)
          expect(field.required).toBe(false)
        })
      })

      describe('when the type is not a custom object', () => {
        beforeEach(async () => {
          const before = mockTypes.Layout.clone()
          const after = mockTypes.Layout.clone()
          after.annotations[constants.LABEL] = 'test'
          result = await adapter.deploy({
            changeGroup: {
              groupID: after.elemID.getFullName(),
              changes: [{ action: 'modify', data: { before, after } }],
            },
            progressReporter: nullProgressReporter,
          })
        })
        it('should fail because the type is not deployable', () => {
          expect(result.errors).toHaveLength(1)
        })
        it('should not apply the change', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })
        it('should not call the API', () => {
          expect(connection.metadata.deploy).not.toHaveBeenCalled()
        })
      })

      describe('when there is a failure in a CustomObject or CustomField', () => {
        let elementUnderTest: ObjectType
        beforeEach(async () => {
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              componentFailure: [
                {
                  changed: false,
                  columnNumber: 15684,
                  componentType: 'CustomField',
                  created: false,
                  createdDate: '2024-02-01T15:34:58.000Z',
                  deleted: false,
                  fileName: 'unpackaged/objects/Account.object',
                  fullName: 'Account.GVSField__c',
                  lineNumber: 1,
                  problem: 'The global picklist cannot be resolved',
                  problemType: 'Error',
                  success: false,
                },
                {
                  changed: false,
                  componentType: 'CustomObject',
                  created: false,
                  createdDate: '2024-02-01T15:35:00.000Z',
                  deleted: false,
                  fileName: 'unpackaged/objects/Account.object',
                  fullName: 'Account',
                  problem: 'AccountRecordPage does not exist or is not a valid override for action View.',
                  problemType: 'Error',
                  success: false,
                },
              ],
            }),
          )
          elementUnderTest = createCustomObjectType('Account', {
            fields: {
              GVSField__c: {
                refType: stringType,
                annotations: {
                  [constants.API_NAME]: 'Account.GVSField__c',
                },
              },
            },
          })
          result = await adapter.deploy({
            changeGroup: {
              groupID: elementUnderTest.elemID.getFullName(),
              changes: [toChange({ after: elementUnderTest })],
            },
            progressReporter: nullProgressReporter,
          })
        })
        it('should map errors to the deployed element (SALTO-5375)', () => {
          expect(result.errors).toHaveLength(2)
          expect(result.errors).toSatisfyAll(error => error.elemID !== undefined)
          expect(result.errors[0]).toSatisfy(error => error.elemID.isEqual(elementUnderTest.fields.GVSField__c.elemID))
          expect(result.errors[1]).toSatisfy(error => error.elemID.isEqual(elementUnderTest.elemID))
        })
      })
    })

    describe('when the request fails', () => {
      const before = new ObjectType({
        elemID: mockElemID,
        fields: {
          one: {
            refType: Types.primitiveDataTypes.Text,
            annotations: { [constants.API_NAME]: 'Test__c.one__c' },
          },
          two: {
            refType: Types.primitiveDataTypes.Number,
            annotations: { [constants.API_NAME]: 'Test__c.two__c' },
          },
        },
        annotations: {
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.API_NAME]: 'Test__c',
        },
      })
      beforeEach(async () => {
        connection.metadata.deploy.mockReturnValue(
          mockDeployResult({
            success: false,
            componentFailure: [
              {
                fullName: 'Test__c',
                componentType: constants.CUSTOM_OBJECT,
                problem: 'some error',
                problemType: 'Error',
              },
            ],
          }),
        )

        const after = before.clone()
        after.annotations[constants.LABEL] = 'new label'
        delete after.fields.one

        result = await adapter.deploy({
          changeGroup: {
            groupID: after.elemID.getFullName(),
            changes: [
              { action: 'modify', data: { before, after } },
              { action: 'remove', data: { before: before.fields.one } },
            ],
          },
          progressReporter: nullProgressReporter,
        })
      })

      it('should not apply changes', () => {
        expect(result.appliedChanges).toHaveLength(0)
      })

      it('should return an error', () => {
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toContain('some error')
        expect(result.errors[0].detailedMessage).toContain('some error')
      })
    })

    describe('when deploying two groups concurrently', () => {
      let resultValidationRule: DeployResult
      let resultProfile: DeployResult
      beforeEach(async () => {
        const steps = stepManager(['firstDeploy', 'secondDeploy'])
        const deployId = _.uniqueId()

        connection.metadata.deploy
          .mockReturnValueOnce({
            complete: async () => {
              steps.resolveStep('firstDeploy')
              await steps.waitStep('secondDeploy')
              return mockDeployResultComplete({
                id: deployId,
                componentSuccess: [
                  {
                    fullName: 'Test__c.Valid',
                    componentType: 'ValidationRule',
                  },
                ],
              })
            },
            check: async () => {
              steps.resolveStep('firstDeploy')
              await steps.waitStep('secondDeploy')
              return mockDeployResultComplete({
                id: deployId,
                componentSuccess: [
                  {
                    fullName: 'Test__c.Valid',
                    componentType: 'ValidationRule',
                  },
                ],
              })
            },
          } as unknown as DeployResultLocator<JSForceDeployResult>)
          .mockReturnValueOnce({
            complete: async () => {
              steps.resolveStep('secondDeploy')
              return mockDeployResultComplete({
                id: deployId,
                componentSuccess: [
                  {
                    fullName: 'TestAddProfileInstance__c',
                    componentType: 'Profile',
                  },
                ],
              })
            },
            check: async () => {
              steps.resolveStep('secondDeploy')
              return mockDeployResultComplete({
                id: deployId,
                componentSuccess: [
                  {
                    fullName: 'TestAddProfileInstance__c',
                    componentType: 'Profile',
                  },
                ],
              })
            },
          } as unknown as DeployResultLocator<JSForceDeployResult>)

        // Testing a validation rule specifically because it goes through a filter
        // that has stateful preDeploy/onDeploy (preDeploy stores context that onDeploy uses)
        const testObject = createCustomObjectType('Test__c', {})
        const testValidationRule = createInstanceElement(
          {
            fullName: 'Test__c.Valid',
            active: true,
            errorConditionFormula: 'One__c > 10',
            errorDisplayField: 'One__c',
            errorMessage: 'one is not bigger than 10',
          },
          createMetadataObjectType({
            annotations: { metadataType: 'ValidationRule' },
          }),
          undefined,
          {
            [INSTANCE_ANNOTATIONS.PARENT]: [new ReferenceExpression(testObject.elemID, testObject)],
          },
        )
        const testProfile = createInstanceElement(mockDefaultValues.Profile, mockTypes.Profile)
        const validationRulePromise = adapter.deploy({
          changeGroup: {
            groupID: testValidationRule.elemID.getFullName(),
            changes: [toChange({ after: testValidationRule })],
          },
          progressReporter: nullProgressReporter,
        })
        await steps.waitStep('firstDeploy')
        const profilePromise = adapter.deploy({
          changeGroup: {
            groupID: testProfile.elemID.getFullName(),
            changes: [toChange({ after: testProfile })],
          },
          progressReporter: nullProgressReporter,
        })

        resultValidationRule = await validationRulePromise
        resultProfile = await profilePromise
      })

      it('should return applied changes for both groups', () => {
        expect(resultValidationRule.appliedChanges).toHaveLength(1)
        expect(resultProfile.appliedChanges).toHaveLength(1)
      })
    })

    describe('when deploying a GlobalValueSet', () => {
      const changesToFullNames = (changes: ReadonlyArray<Change>): string[] =>
        changes
          .map(getChangeData)
          .filter(isInstanceElement)
          .map(inst => inst.value.fullName)
      const createChangeGroup = (valueSetNames: string[]): ChangeGroup => ({
        groupID: 'metadata',
        changes: valueSetNames.map(fullName =>
          toChange({
            before: createInstanceElement({ fullName, customValue: [{ fullName: 'a' }] }, mockTypes.GlobalValueSet),
            after: createInstanceElement({ fullName, customValue: [{ fullName: 'b' }] }, mockTypes.GlobalValueSet),
          }),
        ),
      })
      describe('when instance fullName has __gvs suffix and result has __gvs suffix', () => {
        let changeGroup: ChangeGroup
        beforeEach(async () => {
          changeGroup = createChangeGroup(['MyValueSet__gvs'])
          connection.metadata.deploy.mockReturnValue(
            mockDeployResult({
              componentSuccess: [
                {
                  fullName: 'MyValueSet__gvs',
                  componentType: GLOBAL_VALUE_SET,
                },
              ],
            }),
          )
          result = await adapter.deploy({
            changeGroup,
            progressReporter: nullProgressReporter,
          })
        })
        it('should apply the change', () => {
          expect(changesToFullNames(result.appliedChanges)).toEqual(changesToFullNames(changeGroup.changes))
        })
      })
      describe('when instance fullName does not have a __gvs suffix', () => {
        let changeGroup: ChangeGroup
        beforeEach(async () => {
          changeGroup = createChangeGroup(['MyValueSet'])
        })
        describe('when result returns without __gvs suffix', () => {
          beforeEach(async () => {
            connection.metadata.deploy.mockReturnValue(
              mockDeployResult({
                componentSuccess: [{ fullName: 'MyValueSet', componentType: GLOBAL_VALUE_SET }],
              }),
            )
            result = await adapter.deploy({
              changeGroup,
              progressReporter: nullProgressReporter,
            })
          })
          it('should apply the change', () => {
            expect(changesToFullNames(result.appliedChanges)).toEqual(changesToFullNames(changeGroup.changes))
          })
        })
        describe('when result returns with __gvs suffix', () => {
          beforeEach(async () => {
            connection.metadata.deploy.mockReturnValue(
              mockDeployResult({
                componentSuccess: [
                  {
                    fullName: 'MyValueSet__gvs',
                    componentType: GLOBAL_VALUE_SET,
                  },
                ],
              }),
            )
            result = await adapter.deploy({
              changeGroup,
              progressReporter: nullProgressReporter,
            })
          })
          it('should apply the change', () => {
            expect(changesToFullNames(result.appliedChanges)).toEqual(changesToFullNames(changeGroup.changes))
          })
        })
      })
    })
  })
})
