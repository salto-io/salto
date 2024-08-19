/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/remove_unsupported_types'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'

describe('remove_unsupported_types', () => {
  let filterOpts: LocalFilterOpts
  let elements: TypeElement[]
  const sdfType = customrecordtypeType().type
  const supportedSoapType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'subsidiary'),
    annotations: { source: 'soap' },
  })
  const additionlaSupportedSoapType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'salesOrder'),
    annotations: { source: 'soap' },
  })
  const unsupportedSoapType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'someType'),
    annotations: { source: 'soap' },
  })
  const sdfSoapType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'CustomRecordType'),
    annotations: { source: 'soap' },
  })
  const customRecordType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'custrecord'),
    annotations: {
      source: 'soap',
      metadataType: 'customrecordtype',
    },
  })

  beforeEach(async () => {
    elements = [
      sdfType,
      supportedSoapType,
      additionlaSupportedSoapType,
      unsupportedSoapType,
      sdfSoapType,
      customRecordType,
    ]
    filterOpts = {
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })

  it('should remove the unsupported types', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(elements.map(e => e.elemID.name)).toEqual(['customrecordtype', 'custrecord', 'subsidiary', 'salesOrder'])
  })

  it('should not add custom record types that are field types but not in elements (partial fetch)', async () => {
    elements = [
      new ObjectType({
        elemID: customRecordType.elemID,
        annotations: {
          source: 'soap',
          metadataType: 'customrecordtype',
        },
        fields: {
          custom_field: {
            refType: new ObjectType({
              elemID: new ElemID(NETSUITE, 'customrecord123'),
              annotations: { metadataType: 'customrecordtype' },
            }),
          },
        },
      }),
    ]
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(elements.map(e => e.elemID.name)).toEqual(['custrecord'])
  })
})
