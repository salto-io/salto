import {
  RequestPromise,
} from 'requestretry'
import Connection, {
  Contact, Form,
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
  contacts: {
    get: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
    getAll: jest.fn().mockImplementation((): RequestPromise =>
      ([] as unknown as RequestPromise)),
  } as Contact,
})

export default mockMadKu
