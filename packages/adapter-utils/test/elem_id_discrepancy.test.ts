/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ServiceIds } from '@salto-io/adapter-api'
import { getElemIdFuncWrapper } from '../src/elem_id_discrepancy'

const mockLogWarn = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn((...args) => mockLogWarn(...args)),
  }),
}))

describe('getElemIdFuncWrapper', () => {
  const tempServiceName = 'default'
  const tempServiceIds = {}
  let elemName = ''
  const func = (serviceName: string, _serviceIds: ServiceIds, _name: string): ElemID =>
    new ElemID(serviceName, elemName)

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  it('should add to map in case the elemId is different then the name', () => {
    const wrapper = getElemIdFuncWrapper(func)
    elemName = 'other test'
    wrapper.getElemIdFunc(tempServiceName, tempServiceIds, 'test')
    wrapper.logIdsFunc()
    expect(mockLogWarn).toHaveBeenCalledWith(
      'The following elements have differences between current elemId and calculated elemId:\n' +
        'current id: other test --- calculated id: test',
    )
  })
  it('should not add to map if the elemId is similar to the name', () => {
    const wrapper = getElemIdFuncWrapper(func)
    elemName = 'test'
    wrapper.getElemIdFunc(tempServiceName, tempServiceIds, 'test')
    wrapper.logIdsFunc()
    expect(mockLogWarn).toHaveBeenCalledTimes(0)
  })
  it('should remove from map if name turns out to be similar as elemId', () => {
    const wrapper = getElemIdFuncWrapper(func)
    elemName = 'other test'
    wrapper.getElemIdFunc(tempServiceName, tempServiceIds, 'test')
    wrapper.logIdsFunc()
    expect(mockLogWarn).toHaveBeenCalledWith(
      'The following elements have differences between current elemId and calculated elemId:\n' +
        'current id: other test --- calculated id: test',
    )
    elemName = 'test'
    wrapper.getElemIdFunc(tempServiceName, tempServiceIds, 'test')
    expect(mockLogWarn).toHaveBeenCalledTimes(1)
  })
})
