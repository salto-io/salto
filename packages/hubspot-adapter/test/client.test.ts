import {
  RequestPromise,
} from 'requestretry'
import createClient from './client'
import {
  Form, HubspotMetadata, Workflows, MarketingEmail,
} from '../src/client/types'
import {
  OBJECTS_NAMES,
} from '../src/constants'
import {
  formsMockArray, marketingEmailMockArray, workflowsMockArray, workflowsMockCreate,
  marketingEmailMockCreate, marketingEmailCreateResponse, workflowsCreateResponse,
} from './common/mock_elements'


describe('Test HubSpot client', () => {
  const { connection, client } = createClient()

  const apiKeyDoesntExistErrStr = "This apikey doesn't exist."
  const privilegeErrStr = 'You do not have enough privileges to change the editable property on this form'


  describe('Test getAllInstances', () => {
    describe('wrong type', () => {
      it('should return Unknown HubSpot type error', async () => {
        await expect(client.getAllInstances('wrongType')).rejects
          .toThrow('Unknown HubSpot type: wrongType.')
      })
    })

    describe('valid HubSpot type', () => {
      let mockGetAllInstances: jest.Mock

      describe('wrong apikey', () => {
        beforeEach(() => {
          const getAllFormsResultMock = (): RequestPromise => (
            {
              status: 'error',
              message: apiKeyDoesntExistErrStr,
              correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
              requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
            } as unknown as RequestPromise)

          mockGetAllInstances = jest.fn().mockImplementation(getAllFormsResultMock)
          connection.forms.getAll = mockGetAllInstances
        })

        it('should return error response (FORM type)', async () => {
          await expect(client.getAllInstances(OBJECTS_NAMES.FORM)).rejects
            .toThrow(apiKeyDoesntExistErrStr)
        })
      })

      describe('valid apikey', () => {
        let mockGetAllForms: jest.Mock
        let mockGetAllWorkflows: jest.Mock
        let mockGetAllMarketingEmail: jest.Mock

        beforeEach(() => {
          const getAllFormsResultMock = (): RequestPromise => (
            formsMockArray as RequestPromise)

          const getAllWorkflowsResultMock = (): RequestPromise =>
            Promise.resolve({
              workflows: workflowsMockArray,
            }) as unknown as RequestPromise

          const getAllMarketingEmailResultMock = (): RequestPromise =>
            Promise.resolve({
              objects: marketingEmailMockArray,
            }) as unknown as RequestPromise

          mockGetAllForms = jest.fn().mockImplementation(getAllFormsResultMock)
          mockGetAllWorkflows = jest.fn().mockImplementation(getAllWorkflowsResultMock)
          mockGetAllMarketingEmail = jest.fn().mockImplementation(getAllMarketingEmailResultMock)

          connection.forms.getAll = mockGetAllForms
          connection.workflows.getAll = jest.fn().mockImplementation(mockGetAllWorkflows)
          connection.marketingEmail.getAll = jest.fn().mockImplementation(mockGetAllMarketingEmail)
        })

        it('should success', async () => {
          expect(await client.getAllInstances(OBJECTS_NAMES.FORM)).toHaveLength(2)
          expect(await client.getAllInstances(OBJECTS_NAMES.WORKFLOWS)).toHaveLength(3)
          expect(await client.getAllInstances(OBJECTS_NAMES.MARKETINGEMAIL)).toHaveLength(4)
        })
      })

      afterEach(() => {
        expect(mockGetAllInstances.mock.calls).toHaveLength(1)
        expect(mockGetAllInstances.mock.calls[0]).toHaveLength(0)
      })
    })
  })

  describe('Test createInstance Func', () => {
    describe('wrong HubSpot type', () => {
      it('should return error', async () => {
        await expect(client.createInstance('wrong type', {} as HubspotMetadata)).rejects
          .toThrow('Unknown HubSpot type: wrong type.')
      })
    })

    describe('Valid HubSpot type', () => {
      let mockCreateInstance: jest.Mock

      const formMetadata = {
        name: 'newTestForm',
        submitText: 'Submit',
        cssClass: 'google.com',
        deletable: false,
        captchaEnabled: true,
        cloneable: false,
        unsupportedField: 'bla',
      } as unknown as Form

      const marketingEmailMetadata = marketingEmailMockCreate as unknown as MarketingEmail

      const workflowsMetadata = workflowsMockCreate as unknown as Workflows

      describe('wrong apikey', () => {
        beforeEach(() => {
          const unauthorizedResultMock = (): RequestPromise => (
            {
              status: 'error',
              message: 'This apikey doesnt exist.',
              correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
              requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
            } as unknown as RequestPromise)

          mockCreateInstance = jest.fn().mockImplementation(unauthorizedResultMock)

          connection.forms.create = mockCreateInstance
          connection.workflows.create = mockCreateInstance
          connection.marketingEmail.create = mockCreateInstance
        })

        it('should return error (FORM type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.FORM, formMetadata)).rejects
            .toThrow('This apikey doesnt exist.')
          expect(mockCreateInstance.mock.calls[0][0]).toMatchObject(formMetadata)
        })

        it('should return error (WORKFLOWS type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.WORKFLOWS, workflowsMetadata)).rejects
            .toThrow('This apikey doesnt exist.')
          expect(mockCreateInstance.mock.calls[0][0]).toMatchObject(workflowsMetadata)
        })

        it('should return error (MARKETINGEMAIL type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.MARKETINGEMAIL, marketingEmailMetadata))
            .rejects.toThrow('This apikey doesnt exist.')
          expect(mockCreateInstance.mock.calls[0][0]).toMatchObject(marketingEmailMetadata)
        })
      })

      describe('when instance create success', () => {
        describe('Form instance', () => {
          beforeEach(() => {
            const createFormResultMock = (f: Form): RequestPromise => (
              {
                guid: '3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c',
                name: f.name,
                createdAt: 1435353453,
                captchaEnabled: f.captchaEnabled,
                cloneable: f.cloneable,
                editable: false,
                cssClass: f.cssClass,
                submitText: f.submitText,
                deletable: f.deletable,
              } as unknown as RequestPromise)

            mockCreateInstance = jest.fn().mockImplementation(createFormResultMock)

            connection.forms.create = mockCreateInstance
          })

          it('should return the new Form instance', async () => {
            const resp = await client.createInstance(OBJECTS_NAMES.FORM, formMetadata) as Form

            // Autogenerated fields
            expect(resp.guid).toEqual('3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c')
            expect(resp.createdAt).toEqual(1435353453)
            expect(resp.editable).toBeFalsy()

            // Fields from user (the creator)
            expect(resp.name).toEqual(formMetadata.name)
            expect(resp.captchaEnabled).toEqual(formMetadata.captchaEnabled)
            expect(resp.cloneable).toEqual(formMetadata.cloneable)
            expect(resp.cssClass).toEqual(formMetadata.cssClass)
            expect(resp.submitText).toEqual(formMetadata.submitText)
            expect(resp.deletable).toEqual(formMetadata.deletable)
          })
        })

        describe('Workflow instance', () => {
          beforeEach(() => {
            const createWorkflowResult = (): RequestPromise => (
              workflowsCreateResponse as unknown as RequestPromise)

            mockCreateInstance = jest.fn().mockImplementation(createWorkflowResult)

            connection.workflows.create = mockCreateInstance
          })

          it('should return the new Workflow instance', async () => {
            const resp = await client.createInstance(
              OBJECTS_NAMES.WORKFLOWS,
              workflowsMetadata
            ) as Workflows

            // Autogenerated fields
            expect(resp.id).toEqual(9274658)
            expect(resp.insertedAt).toEqual(1579426531213)
            expect(resp.updatedAt).toEqual(1579426531143)

            // Fields from user (the creator)
            expect(resp.name).toEqual(workflowsMetadata.name)
            expect(resp.type).toEqual(workflowsMetadata.type)
            expect(resp.enabled).toEqual(workflowsMetadata.enabled)
          })
        })

        describe('MarketingEmail instance', () => {
          beforeEach(() => {
            const createMarketingEmailResult = (): RequestPromise => (
              marketingEmailCreateResponse as unknown as RequestPromise)

            mockCreateInstance = jest.fn().mockImplementation(createMarketingEmailResult)

            connection.marketingEmail.create = mockCreateInstance
          })

          it('should return the new marketingEmail instance', async () => {
            const resp = await client.createInstance(
              OBJECTS_NAMES.MARKETINGEMAIL,
              marketingEmailMetadata
            ) as MarketingEmail

            // Autogenerated fields
            expect(resp.id).toEqual(1234566)

            // Fields from user (the creator)
            expect(resp.name).toEqual(marketingEmailMetadata.name)
            expect(resp.abHoursToWait).toEqual(marketingEmailMetadata.abHoursToWait)
            expect(resp.abVariation).toEqual(marketingEmailMetadata.abVariation)
            expect(resp.archived).toEqual(marketingEmailMetadata.archived)
            expect(resp.campaign).toEqual(marketingEmailMetadata.campaign)
            expect(resp.campaignName).toEqual(marketingEmailMetadata.campaignName)
            expect(resp.emailBody).toEqual(marketingEmailMetadata.emailBody)
            expect(resp.isLocalTimezoneSend).toEqual(marketingEmailMetadata.isLocalTimezoneSend)
            expect(resp.feedbackEmailCategory).toEqual(marketingEmailMetadata.feedbackEmailCategory)
            expect(resp.freezeDate).toEqual(marketingEmailMetadata.freezeDate)


            // Default values
            expect(resp.abVariation).toEqual(false)
            expect(resp.abSampleSizeDefault).toBeNull()
            expect(resp.abSamplingDefault).toBeNull()
            expect(resp.domain).toEqual('')
            expect(resp.htmlTitle).toEqual('')
            expect(resp.emailNote).toEqual('')
            expect(resp.isPublished).toEqual(false)
          })
        })
      })

      describe('duplicate name', () => {
        const formAlreadyExiststErrStr = "Form already exists with name 'newTestForm'"
        beforeEach(() => {
          const formAlreadyExistsResultMock = (): RequestPromise => (
            {
              status: 'error',
              message: formAlreadyExiststErrStr,
              correlationId: '49ee8da1-7fb5-4066-b6ff-064c3066eb0f',
              type: 'DUPLICATE_NAME',
              requestId: '1c68e5ab-0729-4b9c-9848-f32cd237e058',
            } as unknown as RequestPromise)

          mockCreateInstance = jest.fn().mockImplementation(formAlreadyExistsResultMock)

          connection.forms.create = mockCreateInstance
          connection.workflows.create = mockCreateInstance
          connection.marketingEmail.create = mockCreateInstance
        })

        it('should return error 409 (FORM type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.FORM, formMetadata)).rejects
            .toThrow(formAlreadyExiststErrStr)
        })

        it('should return error 409 (WORKFLOWS type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.WORKFLOWS, workflowsMetadata)).rejects
            .toThrow(formAlreadyExiststErrStr)
        })

        it('should return error 409 (MarketingEmail type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.MARKETINGEMAIL, marketingEmailMetadata))
            .rejects.toThrow(formAlreadyExiststErrStr)
        })
      })

      describe('wrong value', () => {
        beforeEach(() => {
          formMetadata.editable = false

          const formWrongValueResultMock = (): RequestPromise => (
            {
              status: 'error',
              message: privilegeErrStr,
              correlationId: '03600615-45d5-4b38-bb92-805065b0f8b5',
              requestId: '2b4100f6-b32c-4902-96ab-c94f4fe960d5',
            } as unknown as RequestPromise)

          mockCreateInstance = jest.fn().mockImplementation(formWrongValueResultMock)

          connection.forms.create = mockCreateInstance
        })

        it('should return error', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.FORM, formMetadata)).rejects
            .toThrow(privilegeErrStr)
        })
      })

      afterEach(() => {
        expect(mockCreateInstance.mock.calls).toHaveLength(1)
        expect(mockCreateInstance.mock.calls[0]).toHaveLength(1)
      })
    })
  })

  describe('Test deleteForm', () => {
    let mockDeleteForm: jest.Mock

    const formToDelete = {
      guid: 'guidToDelete',
      name: 'deleteTestForm',
      submitText: 'Submit',
      deletable: true,

    } as Form


    describe('wrong apikey', () => {
      beforeEach(() => {
        const unauthorizedResultMock = (): RequestPromise => (
          {
            status: 'error',
            message: apiKeyDoesntExistErrStr,
            correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
            requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
          } as unknown as RequestPromise)

        mockDeleteForm = jest.fn().mockImplementation(unauthorizedResultMock)
        connection.forms.delete = mockDeleteForm
      })

      it('should return error', async () => {
        await expect(client.deleteForm(formToDelete)).rejects
          .toThrow(apiKeyDoesntExistErrStr)
      })
    })

    describe('When a form is successfully deleted', () => {
      beforeEach(() => {
        const deleteFormResultMock = (): RequestPromise => (
          undefined as unknown as RequestPromise)
        mockDeleteForm = jest.fn().mockImplementation(deleteFormResultMock)
        connection.forms.delete = mockDeleteForm
      })

      it('should return 204 response', async () => {
        const resp = await client.deleteForm(formToDelete)
        expect(resp).toBeUndefined()
      })
    })


    afterEach(() => {
      expect(mockDeleteForm.mock.calls).toHaveLength(1)
      expect(mockDeleteForm.mock.calls[0]).toHaveLength(1)
      expect(mockDeleteForm.mock.calls[0][0]).toEqual('guidToDelete')
    })
  })

  describe('Test updateForm', () => {
    let mockUpdateForm: jest.Mock

    const formToUpdate = {
      guid: 'guidToUpdate',
      name: 'updateTestForm',
      submitText: 'Submit',
      deletable: true,

    } as Form


    describe('wrong apikey', () => {
      beforeEach(() => {
        const unauthorizedResultMock = (): RequestPromise => (
          {
            status: 'error',
            message: apiKeyDoesntExistErrStr,
            correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
            requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
          } as unknown as RequestPromise)

        mockUpdateForm = jest.fn().mockImplementation(unauthorizedResultMock)
        connection.forms.update = mockUpdateForm
      })

      it('should return error', async () => {
        await expect(client.updateForm(formToUpdate)).rejects
          .toThrow(apiKeyDoesntExistErrStr)
      })
    })

    describe('When no form found with guid', () => {
      const noFormFoundErrStr = "No form found with guid 'guidToUpdate'"
      beforeEach(() => {
        const notFoundResult = (): RequestPromise => (
          {
            status: 'error',
            message: noFormFoundErrStr,
            correlationId: '3c40a0ef-0bb8-4606-9133-1ddc3f947e49',
            type: 'NOT_FOUND',
            requestId: '873184b8-2842-4514-ac19-2b5a36413789',
          } as unknown as RequestPromise)

        mockUpdateForm = jest.fn().mockImplementation(notFoundResult)
        connection.forms.update = mockUpdateForm
      })

      it('should return error(404 response)', async () => {
        await expect(client.updateForm(formToUpdate)).rejects
          .toThrow(noFormFoundErrStr)
      })
    })

    describe('When a form is successfully updated', () => {
      beforeEach(() => {
        const updatedFormResult = (): RequestPromise => (
          {
            portalId: 6774238,
            guid: 'guidToUpdate',
            name: 'updateTestForm',
            submitText: 'Submit',
            deletable: true,
            redirect: 'google.com',
          } as unknown as RequestPromise)

        mockUpdateForm = jest.fn().mockImplementation(updatedFormResult)
        connection.forms.update = mockUpdateForm
      })

      it('should return the updated form', async () => {
        const resp = await client.updateForm(formToUpdate)
        expect(resp.name).toEqual(formToUpdate.name)
        expect(resp.guid).toEqual(formToUpdate.guid)
        expect(resp.submitText).toEqual(formToUpdate.submitText)
        expect(resp.deletable).toEqual(formToUpdate.deletable)
        expect(resp.redirect).not.toEqual(formToUpdate.redirect)
        expect(resp.redirect).toEqual('google.com')
      })
    })

    describe('Wrong value', () => {
      beforeEach(() => {
        formToUpdate.editable = false
        const wrongValueResult = (): RequestPromise => (
          {
            status: 'error',
            message: privilegeErrStr,
            correlationId: '00bf4db3-337a-4497-b899-6cc10f1bfde3',
            requestId: '14e208be-e7ac-43ac-b7e4-c242bb6548b5',
          } as unknown as RequestPromise)

        mockUpdateForm = jest.fn().mockImplementation(wrongValueResult)
        connection.forms.update = mockUpdateForm
      })

      it('should return error', async () => {
        await expect(client.updateForm(formToUpdate)).rejects
          .toThrow(privilegeErrStr)
      })
    })

    afterEach(() => {
      expect(mockUpdateForm.mock.calls).toHaveLength(1)
      expect(mockUpdateForm.mock.calls[0]).toHaveLength(2)
      expect(mockUpdateForm.mock.calls[0][0]).toEqual('guidToUpdate')
      expect(mockUpdateForm.mock.calls[0][1]).toMatchObject(formToUpdate)
    })
  })
})
