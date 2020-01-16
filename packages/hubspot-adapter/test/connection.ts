import {
  RequestPromise,
} from 'requestretry'
import Connection, {
  Contact, Form, Workflow,
} from '../src/client/madku'

const mockMadKu: () => Connection = () => ({
  forms: {
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
    delete: jest.fn().mockImplementation((): RequestPromise =>
      (undefined as unknown as RequestPromise)),
    update: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
    create: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
  } as Form,
  workflows: {
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ({ workflows: [] } as unknown as RequestPromise)),
    enroll: jest.fn().mockImplementation((): RequestPromise =>
      (undefined as unknown as RequestPromise)),
    unenroll: jest.fn().mockImplementation((): RequestPromise =>
      ({} as unknown as RequestPromise)),
  } as Workflow,
  contacts: {
    get: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
  } as Contact,
})

export default mockMadKu
