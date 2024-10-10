/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  InstanceElement,
  Element,
  ObjectType,
  ElemID,
  Field,
  BuiltinTypes,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { fileType } from '../../src/types/file_cabinet_types'
import NetsuiteClient from '../../src/client/client'
import serviceUrls from '../../src/filters/service_urls'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { INTERNAL_ID, NETSUITE } from '../../src/constants'
import { getTypesToInternalId } from '../../src/data_elements/types'

describe('serviceUrls', () => {
  describe('onFetch', () => {
    const isSuiteAppConfiguredMock = jest.fn()
    const client = {
      isSuiteAppConfigured: isSuiteAppConfiguredMock,
      url: 'https://accountid.app.netsuite.com',
    } as unknown as NetsuiteClient

    let elements: Element[]

    beforeEach(() => {
      jest.resetAllMocks()
      isSuiteAppConfiguredMock.mockReturnValue(true)
      elements = [new InstanceElement('A', fileType(), { path: '/path/A', [INTERNAL_ID]: '1' })]
    })

    it('should set the right url', async () => {
      await serviceUrls({
        client,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
        ...getTypesToInternalId([]),
      }).onFetch?.(elements)
      expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
        'https://accountid.app.netsuite.com/app/common/media/mediaitem.nl?id=1',
      )
    })
    it('should do nothing if Salto SuiteApp is not configured', async () => {
      isSuiteAppConfiguredMock.mockReturnValue(false)
      await serviceUrls({
        client,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
        ...getTypesToInternalId([]),
      }).onFetch?.(elements)
      expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
    })
  })
  describe('preDeploy', () => {
    let type: ObjectType
    let instance: InstanceElement
    let field: Field
    beforeEach(() => {
      type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'someType'),
        annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'serviceUrl' },
      })
      instance = new InstanceElement('instance', type, {}, undefined, { [CORE_ANNOTATIONS.SERVICE_URL]: 'serviceUrl' })
      field = new Field(type, 'field', BuiltinTypes.STRING, { [CORE_ANNOTATIONS.SERVICE_URL]: 'serviceUrl' })
    })
    it('should remove _service_url from annotations', async () => {
      await serviceUrls({
        client: {} as unknown as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
        ...getTypesToInternalId([]),
      }).preDeploy?.([toChange({ after: instance }), toChange({ after: field }), toChange({ after: type })])
      expect(type.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
      expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
      expect(field.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
    })
  })
})
