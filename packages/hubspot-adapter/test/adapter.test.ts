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
import {
  InstanceElement,
} from '@salto-io/adapter-api'
import HubspotAdapter from '../src/adapter'

import mockAdapter from './mock'
import {
  formsMockArray, workflowsMockArray, marketingEmailMockArray, workflowsCreateResponse,
  workflowsMock, marketingEmailMock, marketingEmailCreateResponse,
  afterFormInstanceValuesMock, contactPropertyMock, contactPropertyCreateResponse,
  contactPropertyMocks, beforeFormInstanceValuesMock,
} from './common/mock_elements'
import HubspotClient from '../src/client/client'
import {
  Form, HubspotMetadata, MarketingEmail, Workflows, ContactProperty,
} from '../src/client/types'
import { Types } from '../src/transformers/transformer'
import {
  OBJECTS_NAMES,
} from '../src/constants'


describe('Hubspot Adapter Operations', () => {
  let adapter: HubspotAdapter
  let client: HubspotClient


  const apikeyDoesntExistErrStr = "This apikey (wrongKey) doesn't exist."

  const marketingEmailInstance = new InstanceElement(
    'marketingEmailInstance',
    Types.hubspotObjects.marketingEmail,
    marketingEmailMock
  )

  const workflowsInstance = new InstanceElement(
    'workflowInstance',
    Types.hubspotObjects.workflows,
    workflowsMock
  )

  const contactPropertyInstance = new InstanceElement(
    'contactPropertyInstance',
    Types.hubspotObjects.contactProperty,
    contactPropertyMock
  )

  beforeEach(() => {
    ({ client, adapter } = mockAdapter({
      adapterParams: {
      },
    }))
  })

  describe('Fetch operation', () => {
    let mockGetAllInstances: jest.Mock

    beforeEach(async () => {
      const getAllResult = (type: string): Promise<HubspotMetadata[]> => {
        if (type === OBJECTS_NAMES.WORKFLOWS) {
          return workflowsMockArray as unknown as Promise<Workflows[]>
        }
        if (type === OBJECTS_NAMES.FORM) {
          return formsMockArray as Promise<Form[]>
        }
        if (type === OBJECTS_NAMES.MARKETINGEMAIL) {
          return marketingEmailMockArray as unknown as Promise<MarketingEmail[]>
        }
        if (type === OBJECTS_NAMES.CONTACT_PROPERTY) {
          return contactPropertyMocks as unknown as Promise<ContactProperty[]>
        }
        return (
          [] as unknown as Promise<HubspotMetadata[]>)
      }

      mockGetAllInstances = jest.fn().mockImplementation(getAllResult)
      client.getAllInstances = mockGetAllInstances
    })

    it('should fetch basic', async () => {
      const { elements } = await adapter.fetch()
      expect(elements).toHaveLength(39)
    })
  })

  describe('Add operation', () => {
    const formInstance = new InstanceElement(
      'formInstance',
      Types.hubspotObjects.form,
      {
        name: 'formInstanceTest',
        method: 'POST',
        cssClass: 'abc',
        followUpId: 'DEPRECATED',
        editable: false,
      }
    )

    let mockCreateInstance: jest.Mock

    describe('When instance name already exists', () => {
      const formAlreadyExistErrStr = "Form already exists with name 'newTestForm'"
      beforeEach(async () => {
        const createAlreadyExistsResult = ():
          Error => { throw new Error(formAlreadyExistErrStr) }
        mockCreateInstance = jest.fn().mockImplementation(createAlreadyExistsResult)
        client.createInstance = mockCreateInstance
      })

      it('should return error (409 response)', async () => {
        await expect(adapter.add(formInstance)).rejects
          .toThrow(formAlreadyExistErrStr)
      })
    })

    describe('Wrong apikey', () => {
      beforeEach(async () => {
        const createErrorResult = ():
          Error => { throw new Error(apikeyDoesntExistErrStr) }
        mockCreateInstance = jest.fn().mockImplementation(createErrorResult)
        client.createInstance = mockCreateInstance
      })

      it('should return error (401 response)', async () => {
        await expect(adapter.add(formInstance)).rejects
          .toThrow(apikeyDoesntExistErrStr)
      })
    })

    describe('When an instance is successfully added', () => {
      describe('Form instance', () => {
        beforeEach(async () => {
          const createResult = (_t: string, f: Form): Promise<Form> =>
            Promise.resolve(
              {
                guid: '12345',
                name: f.name,
                cssClass: f.cssClass,
                editable: f.editable,
                deletable: false,
                createdAt: 1500588456053,
              } as Form
            )
          mockCreateInstance = jest.fn().mockImplementation(createResult)
          client.createInstance = mockCreateInstance
        })

        it('should return the new form', async () => {
          const result = await adapter.add(formInstance)

          // Autogenerated fields
          expect(result.value.guid).toEqual('12345')
          expect(formInstance.value.deletable).toBeUndefined()
          expect(result.value.deletable).toBeFalsy()
          expect(formInstance.value.createdAt).toBeUndefined()
          expect(result.value.createdAt).toEqual(1500588456053)

          // Fields from user (the creator)
          expect(result.value.name).toEqual(formInstance.value.name)
          expect(result.value.cssClass).toEqual(formInstance.value.cssClass)
          expect(result.value.editable).toEqual(formInstance.value.editable)

          // Filtered out unsupported fields
          expect(result.value.method).toBeUndefined()
          expect(result.value.followUpId).toBeUndefined()
        })
      })

      describe('ContactProperty instance', () => {
        beforeEach(async () => {
          const createResult = (): Promise<ContactProperty> =>
            Promise.resolve(
              contactPropertyCreateResponse as unknown as ContactProperty
            )
          mockCreateInstance = jest.fn().mockImplementation(createResult)
          client.createInstance = mockCreateInstance
        })

        it('should return the new ContactProperty', async () => {
          const res = await adapter.add(contactPropertyInstance)

          // Fields from the creation
          expect(res.value.name).toEqual(contactPropertyInstance.value.name)
          expect(res.value.label).toEqual(contactPropertyInstance.value.label)
          expect(res.value.description).toEqual(contactPropertyInstance.value.description)
          expect(res.value.groupName).toEqual(contactPropertyInstance.value.groupName)
          expect(res.value.type).toEqual(contactPropertyInstance.value.type)
          expect(res.value.fieldType).toEqual(contactPropertyInstance.value.fieldType)
          expect(res.value.deleted).toEqual(contactPropertyInstance.value.deleted)
          expect(res.value.formField).toEqual(contactPropertyInstance.value.formField)
          expect(res.value.displayOrder).toEqual(contactPropertyInstance.value.displayOrder)
          expect(res.value.readOnlyValue).toEqual(contactPropertyInstance.value.readOnlyValue)
          expect(res.value.readOnlyDefinition)
            .toEqual(contactPropertyInstance.value.readOnlyDefinition)
          expect(res.value.hidden).toEqual(contactPropertyInstance.value.hidden)
          expect(res.value.mutableDefinitionNotDeletable)
            .toEqual(contactPropertyInstance.value.mutableDefinitionNotDeletable)
          expect(res.value.calculated).toEqual(contactPropertyInstance.value.calculated)
          expect(res.value.externalOptions).toEqual(contactPropertyInstance.value.externalOptions)

          // Options
          expect(res.value.options).toBeDefined()
          expect(res.value.options).toHaveLength(contactPropertyInstance.value.options.length)
          expect(res.value.options[0].label).toEqual(contactPropertyInstance.value.options[0].label)
          expect(res.value.options[0].value).toEqual(contactPropertyInstance.value.options[0].value)
          expect(res.value.options[0].description)
            .toEqual(contactPropertyInstance.value.options[0].description)
          expect(res.value.options[0].hidden)
            .toEqual(contactPropertyInstance.value.options[0].hidden)

          // Filtered out unsupported fields
          expect(res.value.unsupported).toBeUndefined()
        })
      })

      describe('Workflow instance', () => {
        beforeEach(async () => {
          const createResult = (): Promise<Workflows> =>
            Promise.resolve(
              workflowsCreateResponse as unknown as Workflows
            )
          mockCreateInstance = jest.fn().mockImplementation(createResult)
          client.createInstance = mockCreateInstance
        })

        it('should return the new Workflow', async () => {
          const result = await adapter.add(workflowsInstance)

          // Autogenerated fields
          expect(result.value.id).toEqual(workflowsCreateResponse.id)
          expect(result.value.insertedAt).toEqual(workflowsCreateResponse.insertedAt)
          expect(result.value.updatedAt).toEqual(workflowsCreateResponse.updatedAt)


          // Fields from user (the creator)
          expect(result.value.type).toBe(workflowsInstance.value.type)
          expect(result.value.name).toEqual(workflowsInstance.value.name)
          expect(result.value.enabled).toEqual(workflowsInstance.value.enabled)
          expect(result.value.actions).toEqual(workflowsInstance.value.actions)
          expect(result.value.internal).toEqual(workflowsInstance.value.internal)
          expect(result.value.onlyExecOnBizDays).toEqual(workflowsInstance.value.onlyExecOnBizDays)
          expect(result.value.nurtureTimeRange).toEqual(workflowsInstance.value.nurtureTimeRange)
          expect(result.value.listening).toEqual(workflowsInstance.value.listening)
          expect(result.value.allowContactToTriggerMultipleTimes)
            .toEqual(workflowsInstance.value.allowContactToTriggerMultipleTimes)
          expect(result.value.onlyEnrollsManually)
            .toEqual(workflowsInstance.value.onlyEnrollsManually)
          expect(result.value.enrollOnCriteriaUpdate)
            .toEqual(workflowsInstance.value.enrollOnCriteriaUpdate)
          expect(result.value.eventAnchor).toEqual(workflowsInstance.value.eventAnchor)


          // Filtered out unsupported fields
          expect(result.value.description).toBeUndefined()
          expect(result.value.migrationStatus).toBeUndefined()
          expect(result.value.portalId).toBeUndefined()
          expect(result.value.updateSource).toBeUndefined()
        })
      })

      describe('MarketingEmail instance', () => {
        beforeEach(async () => {
          const createResult = (): Promise<MarketingEmail> =>
            Promise.resolve(
              marketingEmailCreateResponse as unknown as MarketingEmail
            )
          mockCreateInstance = jest.fn().mockImplementation(createResult)
          client.createInstance = mockCreateInstance
        })

        it('should return the new MarketingEmail', async () => {
          const result = await adapter.add(marketingEmailInstance)

          // Autogenerated fields
          expect(result.value.id).toEqual(marketingEmailCreateResponse.id)


          // Fields from user (the creator)
          expect(result.value.abHoursToWait).toBe(marketingEmailInstance.value.abHoursToWait)
          expect(result.value.abVariation).toEqual(marketingEmailInstance.value.abVariation)
          expect(result.value.archived).toEqual(marketingEmailInstance.value.archived)
          expect(result.value.author).toEqual(marketingEmailInstance.value.author)
          expect(result.value.campaign).toBe(marketingEmailInstance.value.campaign)
          expect(result.value.campaignName).toEqual(marketingEmailInstance.value.campaignName)
          expect(result.value.emailBody).toEqual(marketingEmailInstance.value.emailBody)
          expect(result.value.campaignName).toEqual(marketingEmailInstance.value.campaignName)
          expect(result.value.clonedFrom).toEqual(marketingEmailInstance.value.clonedFrom)
          expect(result.value.domain).toEqual(marketingEmailInstance.value.domain)
          expect(result.value.name).toEqual(marketingEmailInstance.value.name)


          // Filtered out unsupported fields
          expect(result.value.unsupported).toBeUndefined()
        })
      })
    })

    describe('When trying create form with wrong values', () => {
      const privilegeErrStr = 'You dont have enough privileges to set editable to false on this form'
      beforeEach(async () => {
        formInstance.value.editable = false
        const createWrongValueResult = ():
          Error => {
          throw new Error(privilegeErrStr)
        }
        mockCreateInstance = jest.fn().mockImplementation(createWrongValueResult)
        client.createInstance = mockCreateInstance
      })

      it('should return error (403 response)', async () => {
        await expect(adapter.add(formInstance)).rejects
          .toThrow(privilegeErrStr)
      })
    })

    afterEach(() => {
      expect(mockCreateInstance.mock.calls).toHaveLength(1)
      expect(mockCreateInstance.mock.calls[0]).toHaveLength(2)
    })
  })

  describe('Remove operation', () => {
    const formInstance = new InstanceElement(
      'formInstance',
      Types.hubspotObjects.form,
      {
        name: 'formInstanceTest',
        guid: 'guid',
      }
    )

    let mockDelete: jest.Mock

    describe('When remove fails', () => {
      beforeEach(async () => {
        const deleteErrorResult = ():
          Error => { throw new Error(apikeyDoesntExistErrStr) }
        mockDelete = jest.fn().mockImplementation(deleteErrorResult)
        client.deleteInstance = mockDelete
      })

      it('should return error (401 response)', async () => {
        await expect(adapter.remove(formInstance)).rejects
          .toThrow(apikeyDoesntExistErrStr)
      })
    })

    describe('When remove success', () => {
      beforeEach(async () => {
        const deleteResult = (): Promise<void> =>
          Promise.resolve(undefined)

        mockDelete = jest.fn().mockImplementation(deleteResult)
        client.deleteInstance = mockDelete
      })

      it('should return 204 response (Form type)', async () => {
        const res = await adapter.remove(formInstance)
        expect(res).toBeUndefined()
      })

      it('should return 204 response (Workflow type)', async () => {
        const res = await adapter.remove(workflowsInstance)
        expect(res).toBeUndefined()
      })

      it('should return 204 response (MarketingEmail type)', async () => {
        const res = await adapter.remove(marketingEmailInstance)
        expect(res).toBeUndefined()
      })

      it('should return 204 response (ContactProperty type', async () => {
        const res = await adapter.remove(contactPropertyInstance)
        expect(res).toBeUndefined()
      })
    })
  })

  describe('Update operation', () => {
    let mockUpdate: jest.Mock

    const beforeUpdateInstance = new InstanceElement(
      'formInstance',
      Types.hubspotObjects.form,
      beforeFormInstanceValuesMock,
    )

    const afterUpdateInstance = new InstanceElement(
      'formInstance',
      Types.hubspotObjects.form,
      afterFormInstanceValuesMock,
    )

    describe('When Update success', () => {
      describe('Form type', () => {
        beforeEach(async () => {
          const updateResult = (_t: string, f: Form): Promise<Form> =>
            Promise.resolve(
              {
                portalId: 6774238,
                guid: 'guid',
                name: f.name,
                action: '',
                method: 'POST',
                cssClass: f.cssClass,
                editable: f.editable,
                deletable: false,
                createdAt: 1500588456053,
                redirect: 'google.com',
                submitText: '',
                cloneable: false,
                captchaEnabled: true,
                formFieldGroups: [
                  {
                    fields: [
                      {
                        name: 'g1',
                        label: 'g1',
                        type: 'string',
                        fieldType: 'text',
                        description: '',
                        required: false,
                        hidden: false,
                        displayOrder: 1,
                        defaultValue: '',
                        isSmartField: false,
                        selectedOptions: [],
                        options: [],
                        dependentFieldFilters: [
                          {
                            filters: [
                              {
                                operator: 'EQ',
                                strValue: 'em@salto.io',
                                boolValue: false,
                                numberValue: 0,
                                strValues: [],
                                numberValues: [],
                              },
                            ],
                            dependentFormField: {
                              name: 'date_of_birth',
                              label: 'Date of birth',
                              type: 'string',
                              fieldType: 'text',
                              description: 'desc',
                              groupName: 'contactinformation',
                              displayOrder: -1,
                              required: false,
                              selectedOptions: [],
                              options: [],
                              enabled: true,
                              hidden: false,
                              isSmartField: false,
                              unselectedLabel: 'unselected',
                              placeholder: 'place',
                              dependentFieldFilters: [],
                              labelHidden: false,
                              propertyObjectType: 'CONTACT',
                              metaData: [],
                            },
                            formFieldAction: 'DISPLAY',
                          },
                        ],
                      },
                    ],
                    default: true,
                    isSmartGroup: false,
                  },
                  {
                    fields: [
                      {
                        name: 'value',
                        label: 'Value',
                        type: 'string',
                        fieldType: 'text',
                        description: '',
                        required: false,
                        hidden: false,
                        defaultValue: '',
                        isSmartField: false,
                        displayOrder: 1,
                        selectedOptions: ['val1'],
                        options: [
                          {
                            label: 'opt1',
                            value: 'val1',
                            hidden: true,
                            readOnly: true,
                          },
                        ],
                      },
                    ],
                    default: true,
                    isSmartGroup: false,
                  },
                ],
                ignoreCurrentValues: false,
                inlineMessage: 'inline',
                themeName: 'theme',
                notifyRecipients: '',
              } as unknown as Form
            )

          mockUpdate = jest.fn().mockImplementation(updateResult)
          client.updateInstance = mockUpdate
        })

        it('should return the updated form', async () => {
          const res = await adapter.update(
            beforeUpdateInstance,
            afterUpdateInstance
          ) as InstanceElement

          // Updated fields
          expect(res.value.guid).toEqual(afterUpdateInstance.value.guid)
          expect(res.value.name).toEqual(afterUpdateInstance.value.name)
          expect(res.value.redirect).toEqual(afterUpdateInstance.value.redirect)
          expect(res.value.cssClass).toEqual(afterUpdateInstance.value.cssClass)
          expect(res.value.editable).toEqual(afterUpdateInstance.value.editable)
          expect(res.value.inlineMessage).toEqual(afterUpdateInstance.value.inlineMessage)
          expect(res.value.themeName).toEqual(afterUpdateInstance.value.themeName)

          // Unsupported fields
          expect(res.value.portalId).toBeUndefined()
          expect(res.value.action).toBeUndefined()
          expect(res.value.notifyRecipients).toBeUndefined()
          expect(res.value.submitText).toBeUndefined()
          expect(res.value.method).toBeUndefined()

          // Read-only (autogenerated) fields
          expect(res.value.createdAt).toEqual(beforeUpdateInstance.value.createdAt)
          expect(res.value.deletable).toEqual(false)

          // formFieldGroups
          expect(res.value.formFieldGroups).toBeDefined()
          expect(res.value.formFieldGroups).toHaveLength(2)

          // formFieldGroups[0]
          expect(res.value.formFieldGroups[0].default).toEqual(true)
          expect(res.value.formFieldGroups[0].isSmartGroup).toEqual(false)
          expect(res.value.formFieldGroups[0].richText).toBeUndefined()
          expect(res.value.formFieldGroups[0].fields).toHaveLength(1)
          expect(res.value.formFieldGroups[0].default).toEqual(true)
          expect(res.value.formFieldGroups[0].isSmartGroup).toEqual(false)
          expect(res.value.formFieldGroups[0].fields).toHaveLength(1)

          expect(res.value.formFieldGroups[0].fields[0].contactProperty).toEqual(
            afterUpdateInstance.value.formFieldGroups[0].fields[0].contactProperty
          )
          expect(res.value.formFieldGroups[0].fields[0].description).toBeUndefined()
          expect(res.value.formFieldGroups[0].fields[0].propertyObjectType).toBeUndefined()
          expect(res.value.formFieldGroups[0].fields[0].options).toBeUndefined()

          // dependentFieldFilters
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters).toBeDefined()
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters).toHaveLength(1)

          // dependentFieldFilters[0]
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].filters)
            .toBeDefined()
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].filters)
            .toHaveLength(1)
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].filters[0].operator).toEqual('EQ')
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].filters[0].strValue).toEqual('em@salto.io')
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].formFieldAction).toEqual('DISPLAY')
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].dependentFormField)
            .toBeDefined()
          expect(res.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].dependentFormField)
            .toEqual(
              afterUpdateInstance.value.formFieldGroups[0].fields[0]
                .dependentFieldFilters[0].dependentFormField
            )

          // formFieldGroups[1]
          expect(res.value.formFieldGroups[1].default).toEqual(true)
          expect(res.value.formFieldGroups[1].isSmartGroup).toEqual(false)
          expect(res.value.formFieldGroups[1].richText).toBeUndefined()
          expect(res.value.formFieldGroups[1].fields).toHaveLength(1)
          expect(res.value.formFieldGroups[1].fields[0]).toEqual(
            afterUpdateInstance.value.formFieldGroups[1].fields[0]
          )
        })
      })
    })

    describe('When Instance was not found', () => {
      const noFormFoundErrStr = "No form found with guid 'guid'"
      beforeEach(async () => {
        const notFoundError = ():
          Error => { throw new Error(noFormFoundErrStr) }

        mockUpdate = jest.fn().mockImplementation(notFoundError)
        client.updateInstance = mockUpdate
      })

      it('should return 404 response', async () => {
        await expect(adapter.update(
          beforeUpdateInstance,
          afterUpdateInstance
        )).rejects
          .toThrow(noFormFoundErrStr)
      })
    })

    describe('When Forms have different guids', () => {
      beforeEach(async () => {
        beforeUpdateInstance.value.guid = 'differentGuid'
      })

      it('should return error', async () => {
        await expect(adapter.update(
          beforeUpdateInstance,
          afterUpdateInstance
        )).rejects
          .toThrow("Failed to update element as guid's prev=")
      })
    })
  })
})
