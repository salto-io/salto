import { types } from '@salto/lowerdash'
import { Repo, Pool, LeaseWithStatus } from '../src/index'

const mockFunc = <
  T,
  FN extends types.FunctionPropertyNames<T>,
  F extends T[FN] = T[FN],
  RT extends ReturnType<F> = ReturnType<F>,
  PT extends Parameters<F> = Parameters<F>,
  >(): jest.Mock<RT, PT> => jest.fn<RT, PT>()

export type MockObj<T> = T & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any ? jest.Mock<ReturnType<T[K]>> : never
}

const mockPoolFunc = <
  T,
  FN extends types.FunctionPropertyNames<Pool<T>>,
  F extends Pool<T>[FN] = Pool<T>[FN],
  >(): jest.Mock<ReturnType<F>, Parameters<F>> => mockFunc<Pool<T>, FN>()

export const createMockPool = <T>(): MockObj<Pool<T>> => ({
  [Symbol.asyncIterator]: jest.fn<AsyncIterator<LeaseWithStatus<T>>, []>(),
  register: mockPoolFunc<T, 'register'>(),
  unregister: mockPoolFunc<T, 'unregister'>(),
  lease: mockPoolFunc<T, 'lease'>(),
  waitForLease: mockPoolFunc<T, 'waitForLease'>(),
  updateTimeout: mockPoolFunc<T, 'updateTimeout'>(),
  return: mockPoolFunc<T, 'return'>(),
  clear: mockPoolFunc<T, 'clear'>(),
})

export const createMockRepo = (): Repo => ({
  pool: <T>(): Promise<Pool<T>> => Promise.resolve(createMockPool<T>()),
})
