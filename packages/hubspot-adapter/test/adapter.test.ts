import {
  InstanceElement,
} from 'adapter-api'
import HubspotAdapter from '../src/adapter'

import mockAdapter from './mock'
import HubspotClient from '../src/client/client'
import {
  Form, HubspotMetadata, MarketingEmail, Workflows,
} from '../src/client/types'
import {
  Types,
} from '../src/transformers/transformer'
import {
  OBJECTS_NAMES,
} from '../src/constants'


describe('Hubspot Adapter Operations', () => {
  let adapter: HubspotAdapter
  let client: HubspotClient


  const apikeyDoesntExistErrStr = "This apikey (wrongKey) doesn't exist."

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
          return [
            {
              id: 12345,
              name: 'workflowTest1',
              type: 'DRIP_DELAY',
              unsupportedField: 'bla',
            },
            {
              id: 54321,
              name: 'workflowTest1',
              type: 'DRIP_DELAY',
              enabled: false,
              contactListIds: {
                enrolled: 1,
                active: 2,
                completed: 3,
                succeeded: 4,

              },
            },
          ] as unknown as Promise<Workflows[]>
        }
        if (type === OBJECTS_NAMES.FORM) {
          return [
            {
              portalId: 6774238,
              guid: '3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c',
              name: 'formTest1',
              action: '',
              method: 'POST',
              cssClass: 'abc',
              followUpId: 'DEPRECATED',
              editable: true,
              createdAt: 1571588456053,
              cloneable: true,
            },
            {
              portalId: 6774238,
              guid: '123e11f3-111-418f-92e0-cwwwe2b6999',
              name: 'formTest2',
              action: '',
              method: 'POST',
              cssClass: 'css',
              followUpId: 'DEPRECATED',
              editable: false,
              createdAt: 1561581451052,
              cloneable: true,
              captchaEnabled: false,
            },
          ] as unknown as Promise<Form[]>
        }
        if (type === OBJECTS_NAMES.MARKETINGEMAIL) {
          return [
            {
              ab: true,
              abHoursToWait: 12,
              abVariation: false,
              abSampleSizeDefault: 'VARIANT',
              abSamplingDefault: 'MASTER',
              abStatus: 'MASTER',
              abSuccessMetric: 'OPENS_BY_DELIVERED',
              abTestId: '1234',
              abTestPercentage: 12345,
              absoluteUrl: 'google.com',
              allEmailCampaignIds: [],
              analyticsPageId: 'email ID',
              archived: 'archived',
              author: 'mail@gmail.com',
              authorEmail: 'mail123@gmail.com',
              authorName: 'userName',
              blogEmailType: 'daily',
              campaign: 'campaignID',
              campaignName: 'campaignName',
              canSpamSettingsId: 'id123',
              clonedFrom: 1234,
              createPage: false,
              created: 12334567,
              currentlyPublished: true,
              domain: 'ynet.com',
              emailBody: 'main email body',
              emailNote: 'email notes',
              emailType: 'AB_EMAIL',
              feedbackEmailCategory: 'CUSTOM',
              feedbackSurveyId: 1234,
              folderId: 999,
              freezeDate: 170456443,
              fromName: 'sender name',
              htmlTitle: 'title',
              id: 111111,
              isGraymailSuppressionEnabled: false,
              isLocalTimezoneSend: false,
              isPublished: true,
              name: 'marketingEmail instance name',
            },
            {
              ab: false,
              abHoursToWait: 4,
              abVariation: false,
              abSampleSizeDefault: 'MASTER',
              abSamplingDefault: 'MASTER',
              abStatus: 'VARIANT',
              abSuccessMetric: 'OPENS_BY_DELIVERED',
              abTestId: '1234',
              abTestPercentage: 12345,
              absoluteUrl: 'google.com',
              allEmailCampaignIds: [],
              analyticsPageId: 'email ID',
              archived: 'archived',
              author: 'mail1@gmail.com',
              authorEmail: 'mail13@gmail.com',
              authorName: 'userNameOther',
              blogEmailType: 'daily',
              campaign: 'campaignID',
              campaignName: 'campaignName',
              canSpamSettingsId: 'id123',
              clonedFrom: 1234,
              createPage: true,
              created: 12334567,
              currentlyPublished: true,
              domain: 'one.com',
              emailBody: 'main body',
              emailNote: 'emails notes',
              emailType: 'ABC_EMAIL',
              feedbackEmailCategory: 'CUSTOM',
              feedbackSurveyId: 1234,
              folderId: 919,
              freezeDate: 170456443,
              fromName: 'sender name',
              htmlTitle: 'title',
              id: 222222,
              isGraymailSuppressionEnabled: true,
              isLocalTimezoneSend: true,
              isPublished: true,
              name: 'marketingEmail instance2 name',
            },
          ] as unknown as Promise<MarketingEmail[]>
        }
        return (
          [] as unknown as Promise<HubspotMetadata[]>)
      }

      mockGetAllInstances = jest.fn().mockImplementation(getAllResult)
      client.getAllInstances = mockGetAllInstances
    })

    it('should fetch basic', async () => {
      const result = await adapter.fetch()
      expect(result).toHaveLength(22)
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

    let mockCreate: jest.Mock

    describe('When form name already exists', () => {
      const formAlreadyExistErrStr = "Form already exists with name 'newTestForm'"
      beforeEach(async () => {
        const createAlreadyExistsResult = ():
          Error => { throw new Error(formAlreadyExistErrStr) }
        mockCreate = jest.fn().mockImplementation(createAlreadyExistsResult)
        client.createForm = mockCreate
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
        mockCreate = jest.fn().mockImplementation(createErrorResult)
        client.createForm = mockCreate
      })

      it('should return error (401 response)', async () => {
        await expect(adapter.add(formInstance)).rejects
          .toThrow(apikeyDoesntExistErrStr)
      })
    })

    describe('When a form is successfully added', () => {
      beforeEach(async () => {
        const createResult = (f: Form): Promise<Form> =>
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
        mockCreate = jest.fn().mockImplementation(createResult)
        client.createForm = mockCreate
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

    describe('When trying create form with wrong values', () => {
      const privilegeErrStr = 'You dont have enough privileges to set editable to false on this form'
      beforeEach(async () => {
        formInstance.value.editable = false
        const createWrongValueResult = ():
          Error => {
          throw new Error(privilegeErrStr)
        }
        mockCreate = jest.fn().mockImplementation(createWrongValueResult)
        client.createForm = mockCreate
      })

      it('should return error (403 response)', async () => {
        await expect(adapter.add(formInstance)).rejects
          .toThrow(privilegeErrStr)
      })
    })

    afterEach(() => {
      expect(mockCreate.mock.calls).toHaveLength(1)
      expect(mockCreate.mock.calls[0]).toHaveLength(1)

      const object = mockCreate.mock.calls[0][0]
      expect(object.name).toBe('formInstanceTest')
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
        client.deleteForm = mockDelete
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
        client.deleteForm = mockDelete
      })

      it('should return 204 response', async () => {
        const res = await adapter.remove(formInstance)
        expect(res).toBeUndefined()
      })
    })
  })

  describe('Update operation', () => {
    let mockUpdate: jest.Mock

    const beforeUpdateInstance = new InstanceElement(
      'formInstance',
      Types.hubspotObjects.form,
      {
        name: 'beforeUpdateInstance',
        guid: 'guid',
        cssClass: 'abc',
        followUpId: 'DEPRECATED',
        editable: true,
        cloneable: true,
        captchaEnabled: false,
        createdAt: 1500588456053,
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
                defaultValue: '',
                isSmartField: false,
                selectedOptions: [],
                options: [],
              },
            ],
            default: true,
            isSmartGroup: false,
          },
        ],
      }
    )

    const afterUpdateInstance = new InstanceElement(
      'formInstance',
      Types.hubspotObjects.form,
      {
        name: 'afterUpdateInstance',
        guid: 'guid',
        followUpId: 'DEPRECATED',
        editable: true,
        cloneable: true,
        captchaEnabled: false,
        redirect: 'google.com',
        createdAt: 9999999999999,
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
                defaultValue: '',
                isSmartField: false,
                selectedOptions: [],
                options: [],
              },
            ],
            default: true,
            isSmartGroup: false,
          },
          {
            fields: [
              {
                name: 'state',
                label: 'State/Region',
                type: 'string',
                fieldType: 'text',
                description: '',
                required: false,
                hidden: false,
                defaultValue: '',
                isSmartField: false,
                selectedOptions: [],
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
      }
    )

    describe('When Update success', () => {
      beforeEach(async () => {
        const updateResult = (f: Form): Promise<Form> =>
          Promise.resolve(
            {
              portalId: 6774238,
              guid: f.guid,
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
                      name: 'state',
                      label: 'State/Region',
                      type: 'string',
                      fieldType: 'text',
                      description: '',
                      groupName: 'contactinformation',
                      displayOrder: -1,
                      required: false,
                      selectedOptions: [],
                      options: [
                        {
                          label: 'opt1',
                          value: 'val1',
                          hidden: true,
                          readOnly: true,
                          description: '',
                        },
                      ],
                      validation: {
                        name: '',
                        message: '',
                        data: '',
                        useDefaultBlockList: false,
                        blockedEmailAddresses: [],
                      },
                      enabled: true,
                      hidden: false,
                      defaultValue: '',
                      isSmartField: false,
                      unselectedLabel: '',
                      placeholder: '',
                      dependentFieldFilters: [],
                      labelHidden: false,
                      propertyObjectType: 'CONTACT',
                      metaData: [],
                    },
                  ],
                  default: true,
                  isSmartGroup: false,
                  richText: {
                    content: '',
                  },
                },
                {
                  fields: [
                    {
                      name: 'g1',
                      label: 'g1',
                      type: 'string',
                      fieldType: 'text',
                      description: '',
                      groupName: 'contactinformation',
                      displayOrder: 1,
                      required: false,
                      selectedOptions: [],
                      options: [],
                      validation: {},
                      enabled: true,
                      hidden: false,
                      defaultValue: '',
                      isSmartField: false,
                      unselectedLabel: '',
                      placeholder: '',
                      dependentFieldFilters: [],
                      labelHidden: false,
                      propertyObjectType: 'CONTACT',
                      metaData: [],

                    },
                  ],
                  isSmartGroup: false,
                  default: true,
                },
              ],
              ignoreCurrentValues: false,
              inlineMessage: '',
              notifyRecipients: '',
            } as unknown as Form
          )

        mockUpdate = jest.fn().mockImplementation(updateResult)
        client.updateForm = mockUpdate
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

        // Unsupported fields
        expect(res.value.portalId).toBeUndefined()
        expect(res.value.action).toBeUndefined()
        expect(res.value.inlineMessage).toBeUndefined()
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
        expect(res.value.formFieldGroups[0].fields[0].name).toEqual('state')
        expect(res.value.formFieldGroups[0].fields[0].label).toEqual('State/Region')
        expect(res.value.formFieldGroups[0].fields[0].type).toEqual('string')
        expect(res.value.formFieldGroups[0].fields[0].description).toBeUndefined()
        expect(res.value.formFieldGroups[0].fields[0].propertyObjectType).toBeUndefined()
        expect(res.value.formFieldGroups[0].fields[0].options).toHaveLength(1)
        expect(res.value.formFieldGroups[0].fields[0].options[0].label).toEqual('opt1')
        expect(res.value.formFieldGroups[0].fields[0].options[0].hidden).toEqual(true)
        expect(res.value.formFieldGroups[0].fields[0].options[0].description).toBeUndefined()


        // formFieldGroups[1]
        expect(res.value.formFieldGroups[1].default).toEqual(true)
        expect(res.value.formFieldGroups[1].isSmartGroup).toEqual(false)
        expect(res.value.formFieldGroups[1].richText).toBeUndefined()
        expect(res.value.formFieldGroups[1].fields).toHaveLength(1)
        expect(res.value.formFieldGroups[1].default).toEqual(true)
        expect(res.value.formFieldGroups[1].isSmartGroup).toEqual(false)
        expect(res.value.formFieldGroups[1].richText).toBeUndefined()
        expect(res.value.formFieldGroups[1].fields).toHaveLength(1)
        expect(res.value.formFieldGroups[1].fields[0].name).toEqual('g1')
        expect(res.value.formFieldGroups[1].fields[0].label).toEqual('g1')
        expect(res.value.formFieldGroups[1].fields[0].type).toEqual('string')
        expect(res.value.formFieldGroups[1].fields[0].description).toBeUndefined()
        expect(res.value.formFieldGroups[1].fields[0].propertyObjectType).toBeUndefined()
        expect(res.value.formFieldGroups[1].fields[0].options).toBeUndefined()
      })
    })

    describe('When Form not found', () => {
      const noFormFoundErrStr = "No form found with guid 'guid'"
      beforeEach(async () => {
        const notFoundError = ():
          Error => { throw new Error(noFormFoundErrStr) }

        mockUpdate = jest.fn().mockImplementation(notFoundError)
        client.updateForm = mockUpdate
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
