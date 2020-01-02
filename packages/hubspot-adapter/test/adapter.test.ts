import {
  ElemID,
  InstanceElement, ObjectType,
} from 'adapter-api'
import HubspotAdapter from '../src/adapter'

import mockAdapter from './mock'
import HubspotClient from '../src/client/client'
import { FormObjectType } from '../src/client/types'

const mockElemID = new ElemID('hubspot', 'test')

describe('Hubspot Adapter Operations', () => {
  let adapter: HubspotAdapter
  let client: HubspotClient


  beforeEach(() => {
    ({ client, adapter } = mockAdapter({
      adapterParams: {
      },
    }))
  })

  describe('Fetch operation', () => {
    let mockGetAllForms: jest.Mock

    beforeEach(async () => {
      const getAllResult = (): Promise<FormObjectType[]> => Promise.resolve([
        { guid: '12345' },
        { guid: '11111' },
      ] as FormObjectType[])

      mockGetAllForms = jest.fn().mockImplementation(getAllResult)
      client.getAllForms = mockGetAllForms
    })

    it('should fetch basic', async () => {
      const result = await adapter.fetch()
      expect(result).toHaveLength(2)
    })
  })

  describe('Add operation', () => {
    const formInstance = new InstanceElement(
      'formInstance',
      new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {},
      }),
      {
        name: 'formInstanceTest',
      }
    )

    let mockCreate: jest.Mock

    describe('When form name already exists', () => {
      beforeEach(async () => {
        const createAlreadyExistsResult = (_f: FormObjectType):
          Error => { throw new Error("Form already exists with name 'newTestForm'") }
        mockCreate = jest.fn().mockImplementation(createAlreadyExistsResult)
        client.createForm = mockCreate
      })

      it('should return error (409 response)', async () => {
        await expect(adapter.add(formInstance)).rejects
          .toThrow("Form already exists with name 'newTestForm'")
      })
    })

    describe('Wrong apikey', () => {
      beforeEach(async () => {
        const createErrorResult = (_f: FormObjectType):
          Error => { throw new Error("This apikey (wrongKey) doesn't exist.") }
        mockCreate = jest.fn().mockImplementation(createErrorResult)
        client.createForm = mockCreate
      })

      it('should return error (401 response)', async () => {
        await expect(adapter.add(formInstance)).rejects
          .toThrow("This apikey (wrongKey) doesn't exist.")
      })
    })

    describe('When a form is successfully added', () => {
      beforeEach(async () => {
        const createResult = (_f: FormObjectType): Promise<FormObjectType> =>
          Promise.resolve({ guid: '12345' } as FormObjectType)
        mockCreate = jest.fn().mockImplementation(createResult)
        client.createForm = mockCreate
      })

      it('should return the new form', async () => {
        const result = await adapter.add(formInstance) as InstanceElement
        expect(result.value.guid).toBe('12345')
        expect(result.value.name).toBe('formInstanceTest')
      })
    })

    afterEach(() => {
      expect(mockCreate.mock.calls).toHaveLength(1)
      expect(mockCreate.mock.calls[0]).toHaveLength(1)
      // expect(mockCreate.mock.calls[0][0]).toMatchObject(formInstance)

      const object = mockCreate.mock.calls[0][0]
      expect(object.name).toBe('formInstanceTest')
    })
  })

  describe('Remove operation', () => {
    const formInstance = new InstanceElement(
      'formInstance',
      new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {},
      }),
      {
        name: 'formInstanceTest',
        guid: 'guid',
      }
    )

    let mockDelete: jest.Mock

    describe('When remove fails', () => {
      beforeEach(async () => {
        const deleteErrorResult = (_f: FormObjectType):
          Error => { throw new Error("This apikey (wrongKey) doesn't exist.") }
        mockDelete = jest.fn().mockImplementation(deleteErrorResult)
        client.deleteForm = mockDelete
      })

      it('should return error (401 response)', async () => {
        await expect(adapter.remove(formInstance)).rejects
          .toThrow("This apikey (wrongKey) doesn't exist.")
      })
    })

    describe('When remove success', () => {
      beforeEach(async () => {
        const deleteResult = (_f: FormObjectType): Promise<void> =>
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
      new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {},
      }),
      {
        name: 'beforeUpdateInstance',
        guid: 'guid',
      }
    )

    const afterUpdateInstance = new InstanceElement(
      'formInstance',
      new ObjectType({
        elemID: mockElemID,
        fields: {
        },
        annotationTypes: {},
        annotations: {},
      }),
      {
        name: 'afterUpdateInstance',
        guid: 'guid',
      }
    )

    describe('When Update success', () => {
      beforeEach(async () => {
        const updateResult = (f: FormObjectType): Promise<FormObjectType> =>
          Promise.resolve({ guid: f.guid } as FormObjectType)

        mockUpdate = jest.fn().mockImplementation(updateResult)
        client.updateForm = mockUpdate
      })

      it('should return 204 response', async () => {
        const res = await adapter.update(
          beforeUpdateInstance,
          afterUpdateInstance,
          []
        ) as InstanceElement
        expect(res).toBe(afterUpdateInstance)
      })
    })

    describe('When Form not found', () => {
      beforeEach(async () => {
        const notFoundError = (_f: FormObjectType):
          Error => { throw new Error("No form found with guid 'guid'") }

        mockUpdate = jest.fn().mockImplementation(notFoundError)
        client.updateForm = mockUpdate
      })

      it('should return 204 response', async () => {
        await expect(adapter.update(
          beforeUpdateInstance,
          afterUpdateInstance,
          []
        )).rejects
          .toThrow("No form found with guid 'guid'")
      })
    })
  })
})
