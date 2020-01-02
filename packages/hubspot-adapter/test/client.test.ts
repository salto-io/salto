import {
  RequestPromise,
} from 'requestretry'
import createClient from './client'
import { Form } from '../src/client/types'


describe('Test HubSpot client', () => {
  const { connection, client } = createClient()


  describe('Test getAllForms', () => {
    let mockGetAllForms: jest.Mock

    describe('wrong apikey', () => {
      beforeEach(() => {
        const getAllFormsResultMock = (): RequestPromise => (
          {
            status: 'error',
            message: "This apikey doesn't exist.",
            correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
            requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
          } as unknown as RequestPromise)

        mockGetAllForms = jest.fn().mockImplementation(getAllFormsResultMock)

        connection.forms.getAll = mockGetAllForms
      })

      it('should return empty array', async () => {
        await expect(client.getAllForms()).rejects
          .toThrow("This apikey doesn't exist.")
      })
    })

    describe('valid apikey', () => {
      beforeEach(() => {
        const getAllFormsResultMock = (): RequestPromise => (
          [
            {
              portalId: 6774238,
              guid: '3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c',
              name: 'formTest1',
              action: '',
              method: 'POST',
              cssClass: 'abc',
            },
            {
              portalId: 6774238,
              guid: '123e11f3-111-418f-92e0-cwwwe2b6999',
              name: 'formTest2',
              action: '',
              method: 'POST',
              cssClass: 'css',
            },
          ] as unknown as RequestPromise)

        mockGetAllForms = jest.fn().mockImplementation(getAllFormsResultMock)

        connection.forms.getAll = mockGetAllForms
      })

      it('should success', async () => {
        const resp = await client.getAllForms()
        expect(resp).toHaveLength(2)
      })
    })

    afterEach(() => {
      expect(mockGetAllForms.mock.calls).toHaveLength(1)
      expect(mockGetAllForms.mock.calls[0]).toHaveLength(0)
    })
  })

  describe('Test createForm', () => {
    let mockCreateForm: jest.Mock

    const formToCreate = {
      name: 'newTestForm',
      submitText: 'Submit',
      deletable: true,

    } as Form


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
      })

      it('should return error', async () => {
        await expect(client.createForm(formToCreate)).rejects
          .toThrow('This apikey doesnt exist.')
      })
    })

    describe('valid apikey', () => {
      beforeEach(() => {
        const createFormResultMock = (): RequestPromise => (
          {
            portalId: 6774238,
            guid: '3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c',
            name: 'newTestForm',
            action: '',
            method: 'POST',
            cssClass: '',
            submitText: 'Submit',
          } as unknown as RequestPromise)

        mockCreateForm = jest.fn().mockImplementation(createFormResultMock)

        connection.forms.create = mockCreateForm
      })

      it('should success', async () => {
        const resp = await client.createForm(formToCreate)
        expect(resp.guid).toEqual('3e2e7ef3-d0d4-418f-92e0-ad40ae2b622c')
      })
    })

    describe('duplicate name', () => {
      beforeEach(() => {
        const formAlreadyExistsResultMock = (): RequestPromise => (
          {
            status: 'error',
            message: "Form already exists with name 'newTestForm'",
            correlationId: '49ee8da1-7fb5-4066-b6ff-064c3066eb0f',
            type: 'DUPLICATE_NAME',
            requestId: '1c68e5ab-0729-4b9c-9848-f32cd237e058',
          } as unknown as RequestPromise)

        mockCreateForm = jest.fn().mockImplementation(formAlreadyExistsResultMock)

        connection.forms.create = mockCreateForm
      })

      it('should return error', async () => {
        await expect(client.createForm(formToCreate)).rejects
          .toThrow("Form already exists with name 'newTestForm'")
      })
    })

    afterEach(() => {
      expect(mockCreateForm.mock.calls).toHaveLength(1)
      expect(mockCreateForm.mock.calls[0]).toHaveLength(1)
      expect(mockCreateForm.mock.calls[0][0]).toMatchObject(formToCreate)

      const object = mockCreateForm.mock.calls[0][0]
      expect(object.name).toBe('newTestForm')
      expect(object.submitText).toBe('Submit')
      expect(object.deletable).toBeTruthy()
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
            message: 'This apikey doesnt exist.',
            correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
            requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
          } as unknown as RequestPromise)

        mockDeleteForm = jest.fn().mockImplementation(unauthorizedResultMock)
        connection.forms.delete = mockDeleteForm
      })

      it('should return error', async () => {
        await expect(client.deleteForm(formToDelete)).rejects
          .toThrow('This apikey doesnt exist.')
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
            message: 'This apikey doesnt exist.',
            correlationId: 'db8f8a2f-d799-4353-8a67-b85df639b3df',
            requestId: '493c8493-861b-4f56-be3b-3f6067238efd',
          } as unknown as RequestPromise)

        mockUpdateForm = jest.fn().mockImplementation(unauthorizedResultMock)
        connection.forms.update = mockUpdateForm
      })

      it('should return error', async () => {
        await expect(client.updateForm(formToUpdate)).rejects
          .toThrow('This apikey doesnt exist.')
      })
    })

    describe('When no form found with guid', () => {
      beforeEach(() => {
        const notFoundResult = (): RequestPromise => (
          {
            status: 'error',
            message: "No form found with guid 'guidToUpdate'",
            correlationId: '3c40a0ef-0bb8-4606-9133-1ddc3f947e49',
            type: 'NOT_FOUND',
            requestId: '873184b8-2842-4514-ac19-2b5a36413789',
          } as unknown as RequestPromise)

        mockUpdateForm = jest.fn().mockImplementation(notFoundResult)
        connection.forms.update = mockUpdateForm
      })

      it('should return error(404 response)', async () => {
        await expect(client.updateForm(formToUpdate)).rejects
          .toThrow("No form found with guid 'guidToUpdate'")
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
        // await expect(client.updateForm(formToUpdate)).rejects
        //   .toThrow("No form found with guid 'guidToUpdate'")
        const resp = await client.updateForm(formToUpdate)
        expect(resp.name).toEqual(formToUpdate.name)
        expect(resp.guid).toEqual(formToUpdate.guid)
        expect(resp.submitText).toEqual(formToUpdate.submitText)
        expect(resp.deletable).toEqual(formToUpdate.deletable)
        expect(resp.redirect).not.toEqual(formToUpdate.redirect)
        expect(resp.redirect).toEqual('google.com')
        expect(resp.portalId).not.toEqual(formToUpdate.portalId)
        expect(resp.portalId).toEqual(6774238)
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
