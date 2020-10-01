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
import { ObjectType, ElemID, InstanceElement, BuiltinTypes, CORE_ANNOTATIONS, createRestriction, DeployResult, getChangeElement } from '@salto-io/adapter-api'
import { MetadataInfo, SaveResult, DeployResult as JSForceDeployResult, DeployMessage, Package } from 'jsforce'
import JSZip from 'jszip'
import xmlParser from 'fast-xml-parser'
import SalesforceAdapter from '../src/adapter'
import * as constants from '../src/constants'
import { Types, createInstanceElement } from '../src/transformers/transformer'
import Connection from '../src/client/jsforce'
import mockAdapter from './adapter'
import { createValueSetEntry } from './utils'
import { createElement, removeElement } from '../e2e_test/utils'
import { mockTypes, mockDefaultValues } from './mock_elements'

const { makeArray } = collections.array

describe('SalesforceAdapter CRUD', () => {
  let connection: Connection
  let adapter: SalesforceAdapter

  const stringType = Types.primitiveDataTypes.Text
  const mockElemID = new ElemID(constants.SALESFORCE, 'Test')
  const instanceName = 'Instance'

  const getDeployMessage = (params: Partial<DeployMessage>): DeployMessage => ({
    changed: false,
    columnNumber: 0,
    componentType: '',
    created: false,
    createdDate: '',
    deleted: false,
    fileName: '',
    fullName: '',
    id: '',
    lineNumber: 0,
    problem: '',
    problemType: '',
    success: false,
    ...params,
  })

  type GetDeployResultParams = {
    success?: boolean
    componentSuccess?: Partial<DeployMessage>[]
    componentFailure?: Partial<DeployMessage>[]
  }
  const getDeployResult = ({
    success = true, componentSuccess = [], componentFailure = [],
  }: GetDeployResultParams): Promise<JSForceDeployResult> =>
    Promise.resolve({
      id: '',
      checkOnly: false,
      completedDate: '',
      createdDate: '',
      done: true,
      details: [{
        componentFailures: componentFailure.map(getDeployMessage),
        componentSuccesses: componentSuccess.map(getDeployMessage),
      }],
      lastModifiedDate: '',
      numberComponentErrors: componentFailure.length,
      numberComponentsDeployed: componentSuccess.length,
      numberComponentsTotal: componentFailure.length + componentSuccess.length,
      numberTestErrors: 0,
      numberTestsCompleted: 0,
      numberTestsTotal: 0,
      startDate: '',
      status: success ? 'Done' : 'Failed',
      success,
    })

  const deployTypeNames = [
    'AssignmentRules',
    'ApexClass',
    'UnsupportedType',
  ]

  let mockUpsert: jest.Mock
  let mockDelete: jest.Mock
  let mockUpdate: jest.Mock
  let mockDeploy: jest.Mock

  const mockDeployResultOnce = (params: GetDeployResultParams): void => {
    mockDeploy.mockReturnValueOnce({
      complete: () => Promise.resolve(getDeployResult(params)),
    })
  }

  type DeployManifests = {
    manifest?: Package
    deleteManifest?: Package
  }
  const getDeployedManifests = async (zipData: Buffer): Promise<DeployManifests> => {
    const zip = await JSZip.loadAsync(zipData)
    const files = {
      manifest: zip.files['unpackaged/package.xml'],
      deleteManifest: zip.files['unpackaged/destructiveChanges.xml'],
    }
    return promises.object.mapValuesAsync(
      files,
      async zipFile => (
        zipFile === undefined
          ? undefined
          : xmlParser.parse(await zipFile.async('string')).Package
      )
    )
  }

  beforeEach(() => {
    ({ connection, adapter } = mockAdapter({
      adapterParams: {
        filterCreators: [],
        metadataToDeploy: deployTypeNames,
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

    mockDeploy = jest.fn().mockImplementation(() => ({
      complete: () => Promise.resolve(getDeployResult({ success: true })),
    }))
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
          mockDeployResultOnce({
            success: true,
            componentSuccess: [{ fullName: instanceName, componentType: 'Flow' }],
          })
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
          const { manifest } = await getDeployedManifests(mockDeploy.mock.calls[0][0])
          expect(manifest).toBeDefined()
          expect(manifest?.types).toEqual({ name: 'Flow', members: instanceName })
        })
      })

      describe('when the request fails', () => {
        let result: DeployResult

        beforeEach(async () => {
          mockDeployResultOnce({
            success: false,
            componentFailure: [{
              fullName: instanceName,
              componentType: 'Flow',
              problem: 'Failed to add Test__c',
            }],
          })

          const newInst = new InstanceElement(
            instanceName,
            new ObjectType({
              elemID: mockElemID,
              fields: {},
              annotationTypes: {},
              annotations: {},
            }),
            {},
          )

          result = await adapter.deploy({
            groupID: newInst.elemID.getFullName(),
            changes: [{ action: 'add', data: { after: newInst } }],
          })
        })

        it('should return an error', () => {
          expect(result.errors).toHaveLength(1)
          expect(result.errors[0].message).toContain('Failed to add Test__c')
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
        result = await createElement(adapter, element)
      })

      it('should add the new element', () => {
        // Verify object creation
        expect(result).toBeInstanceOf(ObjectType)
        expect(result.annotations[constants.API_NAME]).toBe('Test__c')
        expect(
          result.fields.description.annotations[constants.API_NAME]
        ).toBe('Test__c.description__c')
        expect(result.annotations[constants.METADATA_TYPE]).toBe(constants.CUSTOM_OBJECT)

        expect(mockUpsert.mock.calls.length).toBe(1)
        expect(mockUpsert.mock.calls[0][1]).toHaveLength(1)
        const object = mockUpsert.mock.calls[0][1][0]
        expect(object.fullName).toBe('Test__c')
        expect(object.fields.length).toBe(2)
        const [descriptionField, formulaField] = object.fields
        expect(descriptionField.fullName).toBe('description__c')
        expect(descriptionField.type).toBe('Text')
        expect(descriptionField.length).toBe(80)
        expect(descriptionField.required).toBe(false)
        expect(descriptionField.label).toBe('test label')
        expect(formulaField.fullName).toBe('formula__c')
        expect(formulaField.type).toBe('Text')
        expect(formulaField).not.toHaveProperty('required')
        expect(formulaField.label).toBe('formula field')
        expect(formulaField.formula).toBe('my formula')
      })
    })

    describe('for a new salesforce type with a picklist field', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        fields: {
          state: {
            type: Types.primitiveDataTypes.Picklist,
            annotations: {
              [CORE_ANNOTATIONS.REQUIRED]: false,
              label: 'test label',
              [constants.FIELD_ANNOTATIONS.VALUE_SET]: [
                createValueSetEntry('NEW', true),
                createValueSetEntry('OLD'),
              ],
            },
          },
        },
      })

      let result: ObjectType

      beforeEach(async () => {
        result = await createElement(adapter, element)
      })

      it('should create the type correctly', () => {
        expect(mockUpsert.mock.calls.length).toBe(1)
        const object = mockUpsert.mock.calls[0][1][0]
        expect(object.fields.length).toBe(1)
        expect(object.fields[0].fullName).toBe('state__c')
        expect(object.fields[0].type).toBe('Picklist')
        expect(object.fields[0].valueSet.valueSetDefinition.value
          .map((v: {fullName: string}) => v.fullName).join(';'))
          .toBe('NEW;OLD')
        const picklistValueNew = object.fields[0].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'NEW')[0]
        expect(picklistValueNew).toBeDefined()
        expect(picklistValueNew.default).toEqual(true)
        const picklistValueOld = object.fields[0].valueSet.valueSetDefinition.value.filter((val: {fullName: string}) => val.fullName === 'OLD')[0]
        expect(picklistValueOld).toBeDefined()
        expect(picklistValueOld.default).toEqual(false)
      })

      it('should return the created element', () => {
        expect(result).toMatchObject({
          ...element,
          fields: _.mapValues(element.fields, f => _.omit(f, 'parent')),
        })
        expect(result.annotations).toBeDefined()
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
        await createElement(adapter, element)
      })

      it('should create the element correctly', () => {
        expect(mockUpsert.mock.calls.length).toBe(1)
        expect(mockUpsert.mock.calls[0][1]).toHaveLength(1)
        const object = mockUpsert.mock.calls[0][1][0]
        expect(object.fields.length).toBe(19)
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
  })

  describe('Remove operation', () => {
    describe('when the request succeeds', () => {
      beforeEach(() => {
        mockDelete = jest.fn().mockImplementationOnce(async () => ([{ success: true }]))
        connection.metadata.delete = mockDelete
      })

      describe('for an instance element', () => {
        const element = new InstanceElement(
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

        beforeEach(async () => {
          await removeElement(adapter, element)
        })

        it('should call the connection methods correctly', async () => {
          expect(mockDeploy).toHaveBeenCalledTimes(1)
          const { deleteManifest } = await getDeployedManifests(mockDeploy.mock.calls[0][0])
          expect(deleteManifest).toBeDefined()
          expect(deleteManifest?.types).toEqual({ name: 'Flow', members: instanceName })
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
          },
        })

        beforeEach(async () => {
          await removeElement(adapter, element)
        })

        it('should call the connection methods correctly', () => {
          expect(mockDelete.mock.calls.length).toBe(1)
          const fullName = mockDelete.mock.calls[0][1][0]
          expect(fullName).toBe('Test__c')
        })
      })
    })

    describe('when the request fails', () => {
      const element = new ObjectType({
        elemID: mockElemID,
        annotations: {
          [constants.API_NAME]: 'Test__c',
        },
      })

      let result: DeployResult

      beforeEach(async () => {
        mockDelete = jest.fn().mockImplementationOnce(async () => ([{
          success: false,
          fullName: 'Test__c',
          errors: [
            { message: 'Failed to remove Test__c' },
          ],
        }]))

        connection.metadata.delete = mockDelete

        result = await adapter.deploy({
          groupID: element.elemID.getFullName(),
          changes: [{ action: 'remove', data: { before: element } }],
        })
      })

      it('should return an error', () => {
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toEqual(new Error('Failed to remove Test__c'))
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
          mockDeployResultOnce({
            success: true,
            componentSuccess: [{
              fullName: mockDefaultValues.Profile.fullName,
              componentType: constants.PROFILE_METADATA_TYPE,
            }],
          })
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
          const { manifest } = await getDeployedManifests(mockDeploy.mock.calls[0][0])
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
          expect(mockUpdate.mock.calls.length).toBe(0)
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
            const { deleteManifest } = await getDeployedManifests(mockDeploy.mock.calls[0][0])
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
            const { deleteManifest } = await getDeployedManifests(mockDeploy.mock.calls[0][0])
            expect(deleteManifest).toBeDefined()
            expect(deleteManifest?.types).toEqual({
              name: 'CustomLabel',
              members: 'Val2',
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
          expect(mockUpdate.mock.calls.length).toBe(0)
        })
      })

      describe('when the change requires removing the old type', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            description: { type: stringType },
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
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
          },
        })

        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'modify', data: { before: oldElement, after: newElement } },
              { action: 'remove', data: { before: oldElement.fields.description } },
              { action: 'add', data: { after: newElement.fields.address } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
        })

        it('should call the connection methods correctly', () => {
          expect(mockUpsert.mock.calls.length).toBe(1)
          expect(mockDelete.mock.calls.length).toBe(1)
          expect(mockUpdate.mock.calls.length).toBe(1)
        })

        it('should not add annotations to the object type', () => {
          const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
          expect(updatedObj).toBeDefined()
          expect(updatedObj.annotations).toEqual(newElement.annotations)
        })
      })

      describe('when the new object\'s change is only new fields', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: { type: stringType },
            banana: { type: stringType },
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        const newElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            ...oldElement.fields,
            description: { type: stringType },
            apple: { type: stringType },
          },
          annotations: oldElement.annotations,
        })

        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'add', data: { after: newElement.fields.description } },
              { action: 'add', data: { after: newElement.fields.apple } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(1)
          const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
          expect(Object.keys(updatedObj.fields)).toEqual(Object.keys(newElement.fields))
        })

        it('should call the connection methods correctly', () => {
          expect(mockUpsert.mock.calls.length).toBe(1)
          expect(mockDelete.mock.calls.length).toBe(0)
          expect(mockUpdate.mock.calls.length).toBe(0)
          // Verify the custom fields creation
          const fields = mockUpsert.mock.calls[0][1]
          expect(fields.length).toBe(2)
          expect(fields[0].fullName).toBe('Test__c.description__c')
          expect(fields[0].type).toBe('Text')
          expect(fields[0].length).toBe(80)
          expect(fields[0].required).toBe(false)
          expect(fields[1].fullName).toBe('Test__c.apple__c')
        })
      })

      describe('when the only change in the new object is that some fields no longer appear', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: {
              type: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Address__c',
              },
            },
            banana: {
              type: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Banana__c',
              },
            },
            description: {
              type: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Description__c',
              },
            },
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })


        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'remove', data: { before: oldElement.fields.address } },
              { action: 'remove', data: { before: oldElement.fields.banana } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(1)
          const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
          expect(Object.keys(updatedObj.fields)).toEqual(
            Object.keys(_.omit(oldElement.fields, ['address', 'banana']))
          )
        })

        it('should only delete fields', () => {
          expect(mockUpsert.mock.calls.length).toBe(0)
          expect(mockUpdate.mock.calls.length).toBe(0)
          expect(mockDelete.mock.calls.length).toBe(1)

          const fields = mockDelete.mock.calls[0][1]
          expect(fields.length).toBe(2)
          expect(fields[0]).toBe('Test__c.Address__c')
          expect(fields[1]).toBe('Test__c.Banana__c')
        })
      })

      describe('when there are new fields and deleted fields', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: {
              type: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Address__c',
              },
            },
            banana: {
              type: stringType,
              annotations: {
                [constants.API_NAME]: 'Test__c.Banana__c',
              },
            },
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        const newElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            ..._.pick(oldElement.fields, 'banana'),
            description: { type: stringType },
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'remove', data: { before: oldElement.fields.address } },
              { action: 'add', data: { after: newElement.fields.description } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(1)
          const updatedObj = getChangeElement(result.appliedChanges[0]) as ObjectType
          expect(Object.keys(updatedObj.fields)).toEqual(Object.keys(newElement.fields))
        })

        it('should only call delete and upsert', () => {
          expect(mockUpsert).toHaveBeenCalled()
          expect(mockDelete).toHaveBeenCalled()
          expect(mockUpdate).not.toHaveBeenCalled()
        })

        it('should call the connection.upsert method correctly', () => {
          // Verify the custom fields creation
          const addedFields = mockUpsert.mock.calls[0][1]
          expect(addedFields.length).toBe(1)
          const field = addedFields[0]
          expect(field.fullName).toBe('Test__c.description__c')
          expect(field.type).toBe('Text')
          expect(field.length).toBe(80)
          expect(field.required).toBe(false)
        })

        it('should call the connection.delete method correctly', () => {
          // Verify the custom fields deletion
          const deletedFields = mockDelete.mock.calls[0][1]
          expect(deletedFields.length).toBe(1)
          expect(deletedFields[0]).toBe('Test__c.Address__c')
        })
      })

      describe('when the annotation values are changed', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            description: { type: stringType },
          },
          annotations: {
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        const newElement = new ObjectType({
          elemID: mockElemID,
          fields: oldElement.fields,
          annotations: {
            label: 'test2 label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'modify', data: { before: oldElement, after: newElement } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
        })

        it('should only call update', () => {
          expect(mockUpsert.mock.calls.length).toBe(0)
          expect(mockDelete.mock.calls.length).toBe(0)
          expect(mockUpdate.mock.calls.length).toBe(1)
        })

        it('should call the update method correctly', () => {
          const objectSentForUpdate = mockUpdate.mock.calls[0][1][0]
          expect(objectSentForUpdate.fullName).toBe('Test__c')
          expect(objectSentForUpdate.label).toBe('test2 label')
        })
      })

      describe('when the annotation values of the remaining fields of the object have changed', () => {
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
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'remove', data: { before: oldElement.fields.address } },
              { action: 'modify',
                data: {
                  before: oldElement.fields.banana,
                  after: newElement.fields.banana,
                } },
              { action: 'add', data: { after: newElement.fields.description } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
        })

        it('should call delete, upsert and update', () => {
          expect(mockUpsert).toHaveBeenCalled()
          expect(mockDelete).toHaveBeenCalled()
          expect(mockUpdate).toHaveBeenCalled()
        })

        it('should call the connection methods correctly', () => {
          const addedFields = mockUpsert.mock.calls[0][1]
          expect(addedFields.length).toBe(1)
          const field = addedFields[0]
          expect(field.fullName).toBe('Test__c.Description__c')
          expect(field.type).toBe('Text')
          expect(field.length).toBe(80)
          expect(field.required).toBe(false)
          // Verify the custom field label change
          const changedObject = mockUpdate.mock.calls[0][1]
          expect(changedObject[0].label).toBe('Banana Split')
          // Verify the custom fields deletion
          const deletedFields = mockDelete.mock.calls[0][1]
          expect(deletedFields.length).toBe(1)
          expect(deletedFields[0]).toBe('Test__c.Address__c')
        })
      })

      describe('when the remaining fields did not change', () => {
        const oldElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: { type: stringType },
            banana: { type: stringType },
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        const newElement = new ObjectType({
          elemID: mockElemID,
          fields: {
            address: oldElement.fields.address.clone({ [constants.API_NAME]: 'Test__c.Address__c' }),
            banana: oldElement.fields.banana.clone({ [constants.API_NAME]: 'Test__c.Banana__c' }),
          },
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
          result = await adapter.deploy({
            groupID: oldElement.elemID.getFullName(),
            changes: [
              { action: 'modify', data: { before: oldElement, after: newElement } },
            ],
          })
        })

        it('should return change applied to the element', () => {
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
        })

        it('should not call delete, upsert or update', () => {
          expect(mockUpsert).not.toHaveBeenCalled()
          expect(mockDelete).not.toHaveBeenCalled()
          expect(mockUpdate).not.toHaveBeenCalled()
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
            [CORE_ANNOTATIONS.REQUIRED]: false,
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
            [CORE_ANNOTATIONS.REQUIRED]: false,
            label: 'test2 label',
            [constants.API_NAME]: 'Test__c',
          },
        })

        beforeEach(async () => {
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
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeElement(result.appliedChanges[0])).toEqual(newElement)
        })

        it('should call update twice', () => {
          expect(mockUpsert.mock.calls.length).toBe(0)
          expect(mockDelete.mock.calls.length).toBe(0)
          expect(mockUpdate.mock.calls.length).toBe(2)
        })

        it('should call update correctly the first time for the custom field update', () => {
          // Verify the custom field update
          const updatedFields = mockUpdate.mock.calls[0][1]
          expect(updatedFields.length).toBe(1)
          const field = updatedFields[0]
          expect(field.fullName).toBe('Test__c.Banana__c')
          expect(field.type).toBe('Text')
          expect(field.label).toBe('Banana Split')
          expect(field.length).toBe(80)
          expect(field.required).toBe(false)
        })

        it('should call update correctly the second time for the object update', () => {
          const updatedObject = mockUpdate.mock.calls[1][1][0]
          expect(updatedObject.fullName).toBe('Test__c')
          expect(updatedObject.label).toBe('test2 label')
          expect(updatedObject.fields).toBeUndefined()
        })
      })
    })
  })
})
