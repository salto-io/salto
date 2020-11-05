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
import _ from 'lodash'
import { collections, promises } from '@salto-io/lowerdash'
import { ObjectType, ElemID, InstanceElement, BuiltinTypes, CORE_ANNOTATIONS, createRestriction, DeployResult, getChangeElement, Values, Change, toChange, ChangeGroup } from '@salto-io/adapter-api'
import { MetadataInfo, SaveResult, Package } from 'jsforce'
import JSZip from 'jszip'
import xmlParser from 'fast-xml-parser'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { Types, createInstanceElement, apiName, metadataType } from '../src/transformers/transformer'
import Connection from '../src/client/jsforce'
import mockAdapter from './adapter'
import { createValueSetEntry } from './utils'
import { createElement, removeElement } from '../e2e_test/utils'
import { mockTypes, mockDefaultValues } from './mock_elements'
import { mockDeployResult, mockRunTestFailure } from './connection'

const { makeArray } = collections.array

describe('SalesforceAdapter CRUD', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  const stringType = Types.primitiveDataTypes.Text
  const mockElemID = new ElemID(constants.SALESFORCE, 'Test')
  const instanceName = 'Instance'

  let mockUpsert: jest.Mock
  let mockDelete: jest.Mock
  let mockUpdate: jest.Mock
  let mockDeploy: jest.Mock

  type DeployedPackage = {
    manifest?: Package
    deleteManifest?: Package
    getData: (fileName: string) => Promise<Values>
  }

  const getDeployedPackage = async (zipData: Buffer): Promise<DeployedPackage> => {
    const zip = await JSZip.loadAsync(zipData)
    const files = {
      manifest: zip.files['unpackaged/package.xml'],
      deleteManifest: zip.files['unpackaged/destructiveChanges.xml'],
    }
    return {
      ...(await promises.object.mapValuesAsync(
        files,
        async zipFile => (
          zipFile === undefined
            ? undefined
            : xmlParser.parse(await zipFile.async('string')).Package
        )
      )),
      getData: async fileName => {
        const zipFile = zip.files[`unpackaged/${fileName}`]
        return zipFile === undefined ? undefined : xmlParser.parse(await zipFile.async('string'))
      },
    }
  }

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
        config: {
          dataManagement: {
            includeObjects: ['Test'],
            saltoIDSettings: {
              defaultIdFields: ['Name'],
            },
          },
        },
      },
    }))

    const saveResultMock = (_type: string, objects: MetadataInfo | MetadataInfo[]):
      Promise<SaveResult[]> => Promise.resolve([
      { fullName: (makeArray(objects)[0] || {}).fullName, success: true },
    ])

    mockUpsert = jest.fn().mockImplementation(saveResultMock)
    connection.metadata.upsert = mockUpsert
    mockDelete = jest.fn().mockImplementation(saveResultMock)
    connection.metadata.delete = mockDelete
    mockUpdate = jest.fn().mockImplementation(saveResultMock)
    connection.metadata.update = mockUpdate

    mockDeploy = jest.fn().mockReturnValue(mockDeployResult({}))
    connection.metadata.deploy = mockDeploy
  })

  describe('Add operation', () => {
    describe('for an instance element', () => {
      const instance = new InstanceElement(
        instanceName,
        new ObjectType({
          elemID: mockElemID,
          fields: {
            username: { type: BuiltinTypes.STRING },
            password: { type: BuiltinTypes.STRING },
            token: { type: BuiltinTypes.STRING },
            sandbox: { type: BuiltinTypes.BOOLEAN },
          },
          annotationTypes: {},
          annotations: { [constants.METADATA_TYPE]: 'Flow' },
        }),
        {
          token: 'instanceTest',
        }
      )

      describe('when the request succeeds', () => {
        let result: InstanceElement

        beforeEach(async () => {
          mockDeploy.mockReturnValueOnce(mockDeployResult({
            success: true,
            componentSuccess: [{ fullName: instanceName, componentType: 'Flow' }],
          }))
          result = await createElement(adapter, instance)
        })

        it('Should add new instance', async () => {
          expect(result).toBeInstanceOf(InstanceElement)
          expect(result.elemID).toEqual(instance.elemID)
          expect(result.value[constants.INSTANCE_FULL_NAME_FIELD]).toEqual(instanceName)
          expect(result.value.token).toBeDefined()
          expect(result.value.token).toBe('instanceTest')
          expect(result.value.Token).toBeUndefined()

          expect(mockDeploy).toHaveBeenCalledTimes(1)
          const { manifest } = await getDeployedPackage(mockDeploy.mock.calls[0][0])
          expect(manifest).toBeDefined()
          expect(manifest?.types).toEqual({ name: 'Flow', members: instanceName })
        })
      })

      describe('when the request fails', () => {
        let result: DeployResult

        beforeEach(async () => {
          const newInst = createInstanceElement(mockDefaultValues.Profile, mockTypes.Profile)

          mockDeploy.mockReturnValueOnce(mockDeployResult({
            success: false,
            componentFailure: [{
              fullName: apiName(newInst),
              componentType: metadataType(newInst),
              problem: 'Some error',
            }],
          }))

          result = await adapter.deploy({
            groupID: newInst.elemID.getFullName(),
            changes: [{ action: 'add', data: { after: newInst } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0].message).toContain('Some error')
        })
      })
    })

    describe('for a type element', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          description: {
            type: stringType,
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [constants.LABEL]: 'test label',
            },
          },
          formula: {
            type: stringType,
            annotations: {
              [constants.LABEL]: 'formula field',
              [constants.FORMULA]: 'my formula',
            },
          },
        },
      })

      let result: ObjectType

      beforeEach(async () => {
        mockDeploy.mockReturnValue(mockDeployResult({
          success: true,
          componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
        }))
        result = await createElement(adapter, element)
      })

      it('should add the new element', async () => {
        // Verify object creation
        expect(result).toBeInstanceOf(ObjectType)
        expect(result.annotations[constants.API_NAME]).toBe('Test__c')
        expect(
          result.fields.description.annotations[constants.API_NAME]
        ).toBe('Test__c.description__c')
        expect(result.annotations[constants.METADATA_TYPE]).toBe(constants.CUSTOM_OBJECT)

        expect(mockDeploy).toHaveBeenCalledTimes(1)
        const deployedPackage = await getDeployedPackage(mockDeploy.mock.calls[0][0])
        expect(deployedPackage.manifest?.types).toContainEqual(
          { name: constants.CUSTOM_OBJECT, members: 'Test__c' }
        )
      })
    })

    describe('for a new salesforce type with different field types', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          currency: {
            type: Types.primitiveDataTypes.Currency,
            annotations: {
              [constants.LABEL]: 'Currency description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 18,
            },
          },
          auto: {
            type: Types.primitiveDataTypes.AutoNumber,
            annotations: {
              [constants.LABEL]: 'Autonumber description label',
              [constants.FIELD_ANNOTATIONS.DISPLAY_FORMAT]: 'ZZZ-{0000}',
            },
          },
          date: {
            type: Types.primitiveDataTypes.Date,
            annotations: {
              [constants.LABEL]: 'Date description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Today() + 7',
            },
          },
          time: {
            type: Types.primitiveDataTypes.Time,
            annotations: {
              [constants.LABEL]: 'Time description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'TIMENOW() + 5',
            },
          },
          datetime: {
            type: Types.primitiveDataTypes.DateTime,
            annotations: {
              [constants.LABEL]: 'DateTime description label',
              [constants.DEFAULT_VALUE_FORMULA]: 'Now() + 7',
            },
          },
          email: {
            type: Types.primitiveDataTypes.Email,
            annotations: {
              [constants.LABEL]: 'Email description label',
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
              [constants.FIELD_ANNOTATIONS.CASE_SENSITIVE]: true,
            },
          },
          location: {
            type: Types.compoundDataTypes.Location,
            annotations: {
              [constants.LABEL]: 'Location description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 2,
              [constants.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: true,
            },
          },
          multipicklist: {
            type: Types.primitiveDataTypes.MultiselectPicklist,
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
            type: Types.primitiveDataTypes.Percent,
            annotations: {
              [constants.LABEL]: 'Percent description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 3,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 12,
            },
          },
          phone: {
            type: Types.primitiveDataTypes.Phone,
            annotations: {
              [constants.LABEL]: 'Phone description label',
            },
          },
          longtextarea: {
            type: Types.primitiveDataTypes.LongTextArea,
            annotations: {
              [constants.LABEL]: 'LongTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 5,
            },
          },
          richtextarea: {
            type: Types.primitiveDataTypes.Html,
            annotations: {
              [constants.LABEL]: 'RichTextArea description label',
              [constants.FIELD_ANNOTATIONS.VISIBLE_LINES]: 27,
            },
          },
          textarea: {
            type: Types.primitiveDataTypes.TextArea,
            annotations: {
              [constants.LABEL]: 'TextArea description label',
            },
          },
          encryptedtext: {
            type: Types.primitiveDataTypes.EncryptedText,
            annotations: {
              [constants.LABEL]: 'EncryptedText description label',
              [constants.FIELD_ANNOTATIONS.MASK_TYPE]: 'creditCard',
              [constants.FIELD_ANNOTATIONS.MASK_CHAR]: 'X',
              [constants.FIELD_ANNOTATIONS.LENGTH]: 35,
            },
          },
          url: {
            type: Types.primitiveDataTypes.Url,
            annotations: {
              [constants.LABEL]: 'Url description label',
            },
          },
          picklist: {
            type: Types.primitiveDataTypes.Picklist,
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
            type: Types.primitiveDataTypes.Text,
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
            type: Types.primitiveDataTypes.Number,
            annotations: {
              [constants.LABEL]: 'Number description label',
              [constants.FIELD_ANNOTATIONS.SCALE]: 12,
              [constants.FIELD_ANNOTATIONS.PRECISION]: 8,
              [constants.FIELD_ANNOTATIONS.UNIQUE]: true,
            },
          },
          checkbox: {
            type: Types.primitiveDataTypes.Checkbox,
            annotations: {
              [constants.LABEL]: 'Checkbox description label',
              [constants.FIELD_ANNOTATIONS.DEFAULT_VALUE]: true,
            },
          },
        },
      })

      beforeEach(async () => {
        mockDeploy.mockReturnValue(mockDeployResult({
          success: true,
          componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
        }))
        await createElement(adapter, element)
      })

      it('should create the element correctly', async () => {
        expect(mockDeploy).toHaveBeenCalledTimes(1)
        const deployedPackage = await getDeployedPackage(mockDeploy.mock.calls[0][0])
        expect(deployedPackage.manifest?.types).toContainEqual(
          { name: constants.CUSTOM_OBJECT, members: 'Test__c' }
        )
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
        expect(object.fields[7].valueSet.valueSetDefinition.value
          .map((v: {fullName: string}) => v.fullName).join(';'))
          .toBe('DO;RE;MI;FA;SOL;LA;SI')
        const picklistValueRE = object.fields[7].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'RE')[0]
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
        expect(object.fields[15].valueSet.valueSetDefinition.value
          .map((v: {fullName: string}) => v.fullName).join(';'))
          .toBe('DO;RE;MI;FA;SOL;LA;SI')
        const picklistValueDO = object.fields[15].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'DO')[0]
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
      beforeEach(() => {
        instance = createInstanceElement(mockDefaultValues.ApexClass, mockTypes.ApexClass)
        deployResultParams = {
          success: false,
          componentSuccess: [
            { fullName: apiName(instance), componentType: metadataType(instance) },
          ],
          runTestResult: { failures: [mockRunTestFailure({ message: 'Test failed' })] },
        }
        deployChangeGroup = {
          groupID: instance.elemID.getFullName(),
          changes: [toChange({ after: instance })],
        }
      })
      describe('with rollback on error', () => {
        let result: DeployResult
        beforeEach(async () => {
          mockDeploy.mockReturnValue(mockDeployResult({
            ...deployResultParams,
            rollbackOnError: true,
          }))
          result = await adapter.deploy(deployChangeGroup)
        })
        it('should not apply the instance change', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })
        it('should return the test errors', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0].message).toMatch(/.*Test failed.*/)
        })
      })
      describe('without rollback on error', () => {
        let result: DeployResult
        beforeEach(async () => {
          mockDeploy.mockReturnValue(mockDeployResult({
            ...deployResultParams,
            rollbackOnError: false,
          }))
          result = await adapter.deploy(deployChangeGroup)
        })
        it('should apply the component changes', () => {
          expect(result.appliedChanges).toHaveLength(1)
        })
        it('should return the test errors', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0].message).toMatch(/.*Test failed.*/)
        })
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
              username: { type: BuiltinTypes.STRING },
              password: { type: BuiltinTypes.STRING },
              token: { type: BuiltinTypes.STRING },
              sandbox: { type: BuiltinTypes.BOOLEAN },
              [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
            },
            annotationTypes: {},
            annotations: { [constants.METADATA_TYPE]: 'Flow' },
          }),
          { [constants.INSTANCE_FULL_NAME_FIELD]: instanceName },
        )
      })

      describe('when the remove is successful', () => {
        beforeEach(async () => {
          mockDeploy.mockReturnValue(mockDeployResult(
            { componentSuccess: [{ componentType: 'Flow', fullName: instanceName }] }
          ))
          result = await removeElement(adapter, element)
        })
        it('should call the connection methods correctly', async () => {
          expect(mockDeploy).toHaveBeenCalledTimes(1)
          const { deleteManifest } = await getDeployedPackage(mockDeploy.mock.calls[0][0])
          expect(deleteManifest).toBeDefined()
          expect(deleteManifest?.types).toEqual({ name: 'Flow', members: instanceName })
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
          expect(mockDeploy).not.toHaveBeenCalled()
        })
      })

      describe('when the instance does not exist but the request succeeds', () => {
        beforeEach(async () => {
          mockDeploy.mockReturnValue(mockDeployResult(
            {
              // When calling with ignoreWarnings = true we get these warnings in the
              // componentSuccess list
              componentSuccess: [{
                componentType: 'Flow',
                fullName: 'destructiveChanges.xml',
                problemType: 'Warning',
                problem: `No Flow named: ${instanceName} found`,
              }],
            }
          ))
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
          mockDeploy.mockReturnValue(mockDeployResult(
            {
              success: false,
              componentFailure: [{
                componentType: 'Flow',
                fullName: 'destructiveChanges.xml',
                problemType: 'Warning',
                problem: `No Flow named: ${instanceName} found`,
              }],
            }
          ))
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
          description: { type: stringType },
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
        expect(mockDeploy).toHaveBeenCalledTimes(1)
        const { deleteManifest } = await getDeployedPackage(mockDeploy.mock.calls[0][0])
        expect(deleteManifest?.types).toEqual(
          { name: constants.CUSTOM_OBJECT, members: 'Test__c' }
        )
      })
    })
  })

  describe('Update operation', () => {
    let result: DeployResult
    describe('for an instance element', () => {
      let beforeInstance: InstanceElement
      let afterInstance: InstanceElement

      beforeEach(() => {
        beforeInstance = createInstanceElement(
          mockDefaultValues.Profile,
          mockTypes.Profile,
        )
        afterInstance = createInstanceElement(
          {
            ...mockDefaultValues.Profile,
            description: 'Updated profile description',
          },
          mockTypes.Profile,
        )
      })

      describe('when the request succeeds', () => {
        beforeEach(async () => {
          mockDeploy.mockReturnValueOnce(mockDeployResult({
            success: true,
            componentSuccess: [{
              fullName: mockDefaultValues.Profile.fullName,
              componentType: constants.PROFILE_METADATA_TYPE,
            }],
          }))
          result = await adapter.deploy({
            groupID: afterInstance.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: beforeInstance, after: afterInstance } }],
          })
        })

        it('should return an InstanceElement', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toBeInstanceOf(InstanceElement)
        })

        it('should call the connection methods correctly', async () => {
          expect(mockDeploy).toHaveBeenCalledTimes(1)
          const { manifest } = await getDeployedPackage(mockDeploy.mock.calls[0][0])
          expect(manifest?.types).toEqual({
            name: constants.PROFILE_METADATA_TYPE,
            members: mockDefaultValues.Profile.fullName,
          })
        })
      })

      describe('when the request fails because fullNames are not the same', () => {
        beforeEach(async () => {
          afterInstance = beforeInstance.clone()
          afterInstance.value[constants.INSTANCE_FULL_NAME_FIELD] = 'wrong'
          result = await adapter.deploy({
            groupID: afterInstance.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: beforeInstance, after: afterInstance } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
        })

        it('should return empty applied changes', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })

        it('should not call the connection', () => {
          expect(mockDeploy).not.toHaveBeenCalled()
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
              groupID: oldAssignmentRules.elemID.getFullName(),
              changes: [{
                action: 'modify',
                data: { before: oldAssignmentRules, after: newAssignmentRules },
              }],
            })
          })

          it('should delete on remove metadata objects with field names', async () => {
            expect(mockDeploy).toHaveBeenCalledTimes(1)
            const { deleteManifest } = await getDeployedPackage(mockDeploy.mock.calls[0][0])
            expect(deleteManifest).toBeDefined()
            expect(deleteManifest?.types).toEqual(
              { name: 'AssignmentRule', members: `${instanceName}.Val2` }
            )
          })
        })

        describe('objects names are absolute', () => {
          const customLabelsFieldName = 'labels'
          const mockCustomLabelsObjectType = new ObjectType({
            elemID: mockElemID,
            fields: {
              [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
              [customLabelsFieldName]: {
                type: new ObjectType({
                  elemID: mockElemID,
                  fields: {
                    [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
                  },
                  annotations: {
                    [constants.METADATA_TYPE]: 'CustomLabel',
                  },
                }),
              },
            },
            annotationTypes: {},
            annotations: {
              [constants.METADATA_TYPE]: 'CustomLabels',
            },
          })
          const oldCustomLabels = new InstanceElement(
            instanceName,
            mockCustomLabelsObjectType,
            { [constants.INSTANCE_FULL_NAME_FIELD]: instanceName,
              [customLabelsFieldName]: [
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val2' },
              ] },
          )
          const newCustomLabels = new InstanceElement(
            instanceName,
            mockCustomLabelsObjectType,
            { [constants.INSTANCE_FULL_NAME_FIELD]: instanceName,
              [customLabelsFieldName]: [
                { [constants.INSTANCE_FULL_NAME_FIELD]: 'Val1' },
              ] },
          )

          beforeEach(async () => {
            await adapter.deploy({
              groupID: oldCustomLabels.elemID.getFullName(),
              changes: [{
                action: 'modify',
                data: { before: oldCustomLabels, after: newCustomLabels },
              }],
            })
          })

          it('should call delete on remove metadata objects with object names', async () => {
            expect(mockDeploy).toHaveBeenCalledTimes(1)
            const { deleteManifest } = await getDeployedPackage(mockDeploy.mock.calls[0][0])
            expect(deleteManifest).toBeDefined()
            expect(deleteManifest?.types).toEqual({ name: 'CustomLabel', members: 'Val2' })
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
            groupID: oldElement.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: oldElement, after: newElement } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
        })

        it('should return empty applied changes', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })

        it('should not call the connection', () => {
          expect(mockDeploy).not.toHaveBeenCalled()
        })
      })

      describe('with field add and remove and annotation change', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            description: {
              type: stringType, annotations: { [constants.API_NAME]: 'Test__c.description__c' },
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
              type: stringType,
              annotations: {
                label: 'test2 label',
                [constants.API_NAME]: 'Test__c.address__c',
              },
            },
          },
          annotations: {
            label: 'test2 label',
            [constants.API_NAME]: 'Test__c',
            [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          },
        })

        let changes: Change[]

        beforeEach(async () => {
          mockDeploy.mockReturnValue(mockDeployResult({
            success: true,
            componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
          }))
          changes = [
            { action: 'modify', data: { before: oldElement, after: newElement } },
            { action: 'remove', data: { before: oldElement.fields.description } },
            { action: 'add', data: { after: newElement.fields.address } },
          ]
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes,
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(3)
          expect(result.appliedChanges).toEqual(changes)
        })

        it('should call the connection methods correctly', async () => {
          expect(mockDeploy).toHaveBeenCalledTimes(1)
          const deployedPackage = await getDeployedPackage(mockDeploy.mock.calls[0][0])
          expect(deployedPackage.manifest?.types).toContainEqual(
            { name: constants.CUSTOM_OBJECT, members: 'Test__c' }
          )
          const deployedValues = await deployedPackage.getData('objects/Test__c.object')
          expect(deployedValues).toBeDefined()
          const updatedObj = deployedValues.CustomObject
          expect(updatedObj.label).toEqual('test2 label')
          const newField = updatedObj.fields
          expect(newField.fullName).toEqual('address__c')
          expect(newField.type).toEqual('Text')
          expect(newField.label).toEqual('test2 label')
        })

        it('should not add annotations to the object type', () => {
          const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
          expect(updatedObj).toBeDefined()
          expect(updatedObj.annotations).toEqual(newElement.annotations)
        })
      })

      describe('with field remove add and modify changes', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: {
              type: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Address__c',
                [constants.LABEL]: 'Address',
              },
            },
            banana: {
              type: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Banana__c',
                [constants.LABEL]: 'Banana',
              },
            },
            cat: {
              type: stringType,
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
              type: stringType,
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
          mockDeploy.mockReturnValue(mockDeployResult({
            success: true,
            componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
          }))

          changes = [
            { action: 'remove', data: { before: oldElement.fields.address } },
            { action: 'modify',
              data: {
                before: oldElement.fields.banana,
                after: newElement.fields.banana,
              } },
            { action: 'add', data: { after: newElement.fields.description } },
          ]

          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes,
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(3)
          expect(result.appliedChanges).toEqual(changes)
        })

        it('should call the connection methods correctly', async () => {
          expect(mockDeploy).toHaveBeenCalledTimes(1)
          const deployedPackage = await getDeployedPackage(mockDeploy.mock.calls[0][0])
          expect(deployedPackage.manifest?.types).toContainEqual(
            { name: constants.CUSTOM_OBJECT, members: 'Test__c' }
          )
          const deployedValues = await deployedPackage.getData('objects/Test__c.object')
          expect(deployedValues).toBeDefined()
          const changedObject = deployedValues.CustomObject
          expect(changedObject.fields).toHaveLength(2)
          const [bananaField, descField] = changedObject.fields
          expect(descField.fullName).toBe('Description__c')
          expect(descField.type).toBe('Text')
          expect(descField.length).toBe(80)
          expect(descField.required).toBe(false)
          // Verify the custom field label change
          expect(bananaField.label).toBe('Banana Split')
          // Verify the custom fields deletion
          expect(deployedPackage.deleteManifest?.types).toEqual(
            { name: constants.CUSTOM_FIELD, members: 'Test__c.Address__c' }
          )
        })
      })

      describe('when object annotations change and fields that remain change', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            banana: {
              type: stringType,
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
          mockDeploy.mockReturnValue(mockDeployResult({
            success: true,
            componentSuccess: [{ fullName: 'Test__c', componentType: constants.CUSTOM_OBJECT }],
          }))
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'modify', data: { before: oldElement, after: newElement } },
              { action: 'modify',
                data: { before: oldElement.fields.banana,
                  after: newElement.fields.banana } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(2)
          expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
          expect(getChangeElement(result.appliedChanges[1])).toEqual(newElement.fields.banana)
        })

        it('should deploy changes to the object and fields', async () => {
          expect(mockDeploy).toHaveBeenCalledTimes(1)
          const deployedPackage = await getDeployedPackage(mockDeploy.mock.calls[0][0])
          expect(deployedPackage.manifest?.types).toContainEqual(
            { name: constants.CUSTOM_OBJECT, members: 'Test__c' }
          )
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
            groupID: after.elemID.getFullName(),
            changes: [
              { action: 'modify', data: { before, after } },
            ],
          })
        })
        it('should fail because the type is not deployable', () => {
          expect(result.errors).toHaveLength(1)
        })
        it('should not apply the change', () => {
          expect(result.appliedChanges).toHaveLength(0)
        })
        it('should not call the API', () => {
          expect(mockDeploy).not.toHaveBeenCalled()
        })
      })
    })

    describe('when the request fails', () => {
      const before = new ObjectType({
        elemID: mockElemID,
        fields: {
          one: {
            type: Types.primitiveDataTypes.Text,
            annotations: { [constants.API_NAME]: 'Test__c.one__c' },
          },
          two: {
            type: Types.primitiveDataTypes.Number,
            annotations: { [constants.API_NAME]: 'Test__c.two__c' },
          },
        },
        annotations: {
          [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
          [constants.API_NAME]: 'Test__c',
        },
      })
      beforeEach(async () => {
        mockDeploy.mockReturnValue(mockDeployResult({
          success: false,
          componentFailure: [
            {
              fullName: 'Test__c',
              componentType: constants.CUSTOM_OBJECT,
              problem: 'some error',
              problemType: 'Error',
            },
          ],
        }))

        const after = before.clone()
        after.annotations[constants.LABEL] = 'new label'
        delete after.fields.one

        result = await adapter.deploy({
          groupID: after.elemID.getFullName(),
          changes: [
            { action: 'modify', data: { before, after } },
            { action: 'remove', data: { before: before.fields.one } },
          ],
        })
      })

      it('should not apply changes', () => {
        expect(result.appliedChanges).toHaveLength(0)
      })

      it('should return an error', () => {
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toContain('some error')
      })
    })
  })
})
