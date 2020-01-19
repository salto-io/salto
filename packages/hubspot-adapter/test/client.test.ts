import {
  RequestPromise,
} from 'requestretry'
import createClient from './client'
import {
  Form, HubspotMetadata,
} from '../src/client/types'
import {
  OBJECTS_NAMES,
} from '../src/constants'
import {
  formsMockArray, marketingEmailMockArray, workflowsMockArray,
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

          connection.forms.getAll = mockGetAllForms
          connection.workflows.getAll = getAllWorkflowsResultMock
          connection.marketingEmail.getAll = getAllMarketingEmailResultMock
        })

        it('should success', async () => {
          expect(await client.getAllInstances(OBJECTS_NAMES.FORM)).toHaveLength(2)
          expect(await client.getAllInstances(OBJECTS_NAMES.WORKFLOWS)).toHaveLength(2)
          expect(await client.getAllInstances(OBJECTS_NAMES.MARKETINGEMAIL)).toHaveLength(3)
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
      let mockCreateForm: jest.Mock

      const formToCreate = {
        name: 'newTestForm',
        submitText: 'Submit',
        cssClass: 'google.com',
        deletable: false,
        captchaEnabled: true,
        cloneable: false,
        unsupportedField: 'bla',
      } as unknown as Form

      describe('wrong apikey', () => {
        beforeEach(() => {
          const unauthorizedResultMock = (): RequestPromise => (
            {
              status: 'error',
              message: 'This apikey doesnt exist.',
              correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
              requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
            } as unknown as RequestPromise)

          mockCreateForm = jest.fn().mockImplementation(unauthorizedResultMock)

          connection.forms.create = mockCreateForm
          connection.workflows.create = mockCreateForm
          connection.marketingEmail.create = mockCreateForm
        })

        it('should return error (FORM type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.FORM, formToCreate)).rejects
            .toThrow('This apikey doesnt exist.')
        })

        it('should return error (WORKFLOWS type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.WORKFLOWS, formToCreate)).rejects
            .toThrow('This apikey doesnt exist.')
        })

        it('should return error (MARKETINGEMAIL type)', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.MARKETINGEMAIL, formToCreate)).rejects
            .toThrow('This apikey doesnt exist.')
        })
      })

      describe('valid apikey', () => {
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

          mockCreateForm = jest.fn().mockImplementation(createFormResultMock)

          connection.forms.create = mockCreateForm
        })

        it('should success', async () => {
          const resp = await client.createInstance(OBJECTS_NAMES.FORM, formToCreate) as Form

          // Autogenerated fields
          expect(resp.guid).toEqual('3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c')
          expect(resp.createdAt).toEqual(1435353453)
          expect(resp.editable).toBeFalsy()

          // Fields from user (the creator)
          expect(resp.name).toEqual(formToCreate.name)
          expect(resp.captchaEnabled).toEqual(formToCreate.captchaEnabled)
          expect(resp.cloneable).toEqual(formToCreate.cloneable)
          expect(resp.cssClass).toEqual(formToCreate.cssClass)
          expect(resp.submitText).toEqual(formToCreate.submitText)
          expect(resp.deletable).toEqual(formToCreate.deletable)
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

          mockCreateForm = jest.fn().mockImplementation(formAlreadyExistsResultMock)

          connection.forms.create = mockCreateForm
        })

        it('should return error', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.FORM, formToCreate)).rejects
            .toThrow(formAlreadyExiststErrStr)
        })
      })

      describe('wrong value', () => {
        beforeEach(() => {
          formToCreate.editable = false

          const formWrongValueResultMock = (): RequestPromise => (
            {
              status: 'error',
              message: privilegeErrStr,
              correlationId: '03600615-45d5-4b38-bb92-805065b0f8b5',
              requestId: '2b4100f6-b32c-4902-96ab-c94f4fe960d5',
            } as unknown as RequestPromise)

          mockCreateForm = jest.fn().mockImplementation(formWrongValueResultMock)

          connection.forms.create = mockCreateForm
        })

        it('should return error', async () => {
          await expect(client.createInstance(OBJECTS_NAMES.FORM, formToCreate)).rejects
            .toThrow(privilegeErrStr)
        })
      })

      afterEach(() => {
        expect(mockCreateForm.mock.calls).toHaveLength(1)
        expect(mockCreateForm.mock.calls[0]).toHaveLength(1)
        expect(mockCreateForm.mock.calls[0][0]).toMatchObject(formToCreate)

        const object = mockCreateForm.mock.calls[0][0]
        expect(object.name).toBe('newTestForm')
        expect(object.submitText).toBe('Submit')
        expect(object.deletable).toBeFalsy()
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
