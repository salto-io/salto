/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CORE_ANNOTATIONS, ElemID, ObjectType, BuiltinTypes } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { addBundleFieldToType } from '../../src/transformer'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/add_important_values'
import { LocalFilterOpts } from '../../src/filter'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { entryFormType } from '../../src/autogen/types/standard_types/entryForm'
import { customlistType } from '../../src/autogen/types/standard_types/customlist'
import { emptyQueryParams, fullQueryParams } from '../../src/config/config_creator'
import { bundleType } from '../../src/types/bundle_type'

describe('add important values filter', () => {
  let workflow: ObjectType
  let innerType: ObjectType
  let formType: ObjectType
  let standardCustomRecordType: ObjectType
  let userCustomRecordType: ObjectType
  let types: ObjectType[]

  let defaultOpts: LocalFilterOpts
  let optsWithoutImportantValues: LocalFilterOpts
  let optsWithImportantValues: LocalFilterOpts

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

    types = [workflow, formType, standardCustomRecordType, userCustomRecordType, innerType]

    types.forEach(type => addBundleFieldToType(type, bundleType().type))

    defaultOpts = {
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
    optsWithoutImportantValues = {
      ...defaultOpts,
      config: {
        fetch: {
          include: fullQueryParams(),
          exclude: emptyQueryParams(),
          addImportantValues: false,
        },
      },
    }
    optsWithImportantValues = {
      ...defaultOpts,
      config: {
        fetch: {
          include: fullQueryParams(),
          exclude: emptyQueryParams(),
          addImportantValues: true,
        },
      },
    }
  })
  it('should not add important values when addImportantValues=false', async () => {
    await filterCreator(optsWithoutImportantValues).onFetch?.(types)
    expect(types.some(elem => elem.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] !== undefined)).toBeFalsy()
    expect(types.some(elem => elem.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] !== undefined)).toBeFalsy()
  })
  it('should add important values by default', async () => {
    await filterCreator(defaultOpts).onFetch?.(types)
    expect(types.some(elem => elem.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] !== undefined)).toBeTruthy()
    expect(types.some(elem => elem.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] !== undefined)).toBeTruthy()
  })
  it('should add important values', async () => {
    await filterCreator(optsWithImportantValues).onFetch?.(types)
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

    expect(innerType.fields.scriptid).toBeDefined()
    expect(innerType.fields.isinactive).toBeDefined()
    expect(innerType.annotations).toEqual({})
  })
})
