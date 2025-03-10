/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, ObjectType, BuiltinTypes } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { addBundleFieldToType } from '../../src/transformer'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { CUSTOM_RECORD_TYPE, IS_LOCKED, METADATA_TYPE, NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/add_important_values'
import { LocalFilterOpts } from '../../src/filter'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { entryFormType } from '../../src/autogen/types/standard_types/entryForm'
import { customlistType } from '../../src/autogen/types/standard_types/customlist'
import { bundleType } from '../../src/types/bundle_type'
import { getTypesToInternalId } from '../../src/data_elements/types'

describe('add important values filter', () => {
  let workflow: ObjectType
  let innerType: ObjectType
  let formType: ObjectType
  let standardCustomRecordType: ObjectType
  let userCustomRecordType: ObjectType
  let lockedCustomRecordType: ObjectType
  let types: ObjectType[]

  let defaultOpts: LocalFilterOpts

  beforeEach(async () => {
    workflow = workflowType().type
    innerType = customlistType().innerTypes.customlist_customvalues_customvalue
    formType = entryFormType().type
    standardCustomRecordType = customrecordtypeType().type
    userCustomRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        scriptid: { refType: BuiltinTypes.SERVICE_ID },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    lockedCustomRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1_locked'),
      fields: {
        scriptid: { refType: BuiltinTypes.SERVICE_ID },
      },
      annotations: {
        [IS_LOCKED]: true,
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })

    types = [workflow, formType, standardCustomRecordType, userCustomRecordType, lockedCustomRecordType, innerType]

    types.forEach(type => addBundleFieldToType(type, bundleType().type))

    defaultOpts = {
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      ...getTypesToInternalId([]),
    }
  })
  it('should add important values', async () => {
    await filterCreator(defaultOpts).onFetch?.(types)
    expect(types.some(elem => elem.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] !== undefined)).toBeTruthy()
    expect(types.some(elem => elem.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] !== undefined)).toBeTruthy()
    expect(workflow.annotations).toEqual({
      _important_values: [
        {
          value: 'name',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'description',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'scriptid',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'isinactive',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'bundle',
          highlighted: true,
          indexed: true,
        },
      ],
    })
    expect(formType.annotations).toEqual({
      _important_values: [
        {
          value: 'name',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'scriptid',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'inactive',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'bundle',
          highlighted: true,
          indexed: true,
        },
      ],
    })
    expect(standardCustomRecordType.annotations).toEqual({
      _important_values: [
        {
          value: 'description',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'scriptid',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'isinactive',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'bundle',
          highlighted: true,
          indexed: true,
        },
      ],
    })
    expect(userCustomRecordType.annotations).toEqual({
      _important_values: [
        {
          value: 'name',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'scriptid',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'isInactive',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'bundle',
          highlighted: true,
          indexed: true,
        },
      ],
      _self_important_values: [
        {
          value: 'description',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'scriptid',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'isinactive',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'bundle',
          highlighted: true,
          indexed: true,
        },
      ],
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
    })

    expect(lockedCustomRecordType.annotations).toEqual({
      _important_values: [
        {
          value: 'name',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'scriptid',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'isInactive',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'bundle',
          highlighted: true,
          indexed: true,
        },
      ],
      _self_important_values: [
        {
          value: 'description',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'scriptid',
          highlighted: true,
          indexed: false,
        },
        {
          value: 'isinactive',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'bundle',
          highlighted: true,
          indexed: true,
        },
        {
          value: 'isLocked',
          highlighted: true,
          indexed: true,
        },
      ],
      [IS_LOCKED]: true,
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
    })

    expect(innerType.fields.scriptid).toBeDefined()
    expect(innerType.fields.isinactive).toBeDefined()
    expect(innerType.annotations).toEqual({})
  })
})
