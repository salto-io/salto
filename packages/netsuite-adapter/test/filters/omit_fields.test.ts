/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import NetsuiteClient from '../../src/client/client'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/omit_fields'
import { FilterOpts } from '../../src/filter'
import { toAnnotationRefTypes } from '../../src/custom_records/custom_record_type'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'

describe('omit fields filter', () => {
  let type: ObjectType
  let innerType: ObjectType
  let instance: InstanceElement
  let defaultOpts: FilterOpts
  beforeEach(async () => {
    innerType = new ObjectType({ elemID: new ElemID(NETSUITE, 'innerType') })
    type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'someType'),
      fields: {
        field1: { refType: BuiltinTypes.BOOLEAN },
        field2: { refType: innerType },
      },
    })
    instance = new InstanceElement('test', type, {
      field1: true,
      field2: { nested1: 'test', nested2: 'test2' },
    })
    defaultOpts = {
      client: {} as NetsuiteClient,
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })
  it('should not omit fields by default', async () => {
    await filterCreator(defaultOpts).onFetch?.([instance])
    expect(instance.value).toEqual({
      field1: true,
      field2: { nested1: 'test', nested2: 'test2' },
    })
  })
  it('should not omit when no rule matches', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: { fieldsToOmit: [{ type: 'notSome.*', fields: ['.*'] }] } },
    }).onFetch?.([instance, type, innerType])
    expect(instance.value).toEqual({
      field1: true,
      field2: { nested1: 'test', nested2: 'test2' },
    })
  })
  it('should omit fields in top level element', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: { fieldsToOmit: [{ type: 'some.*', fields: ['.*2'] }] } },
    }).onFetch?.([instance, type, innerType])
    expect(instance.value).toEqual({ field1: true })
  })
  it('should omit fields in inner type', async () => {
    await filterCreator({
      ...defaultOpts,
      config: { fetch: { fieldsToOmit: [{ type: 'some.*', subtype: 'inner.*', fields: ['.*2'] }] } },
    }).onFetch?.([instance, type, innerType])
    expect(instance.value).toEqual({
      field1: true,
      field2: { nested1: 'test' },
    })
  })
  it('should omit fields in custom record type', async () => {
    const { type: customrecordtype, innerTypes: customrecordInnerTypes } = customrecordtypeType()
    const customRecordObjectType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        custom_custfield1: {
          refType: BuiltinTypes.STRING,
          annotations: {
            scriptid: 'custfield1',
            label: 'Custom Field 1',
            isformula: false,
            ismandatory: false,
            isparent: false,
          },
        },
      },
      annotationRefsOrTypes: toAnnotationRefTypes(customrecordtype),
      annotations: {
        scriptid: 'customrecord1',
        istoplevel: true,
        permissions: {
          permission: [
            {
              permittedlevel: 'VIEW',
              permittedrole: 'ADMINISTRATOR',
            },
          ],
        },
        links: {
          link: [
            {
              linkcategory: 'BASICTRANSACTIONSCUSTOM',
              linklabel: 'Estimating Tool',
              linktasktype: 'LIST',
            },
          ],
        },
        metadataType: 'customrecordtype',
      },
    })
    await filterCreator({
      ...defaultOpts,
      config: {
        fetch: {
          fieldsToOmit: [
            { type: 'customrecordtype', fields: ['links'] },
            { type: 'customrecordtype', subtype: 'customrecordtype_permissions_permission', fields: ['.*level'] },
            { type: 'customrecordcustomfield', fields: ['is.*'] },
          ],
        },
      },
    }).onFetch?.([customrecordtype, customRecordObjectType, ...Object.values(customrecordInnerTypes)])
    expect(customRecordObjectType.annotations).toEqual({
      scriptid: 'customrecord1',
      // used to verify that a field that match 'type' but doesn't match the 'subtype' is not omitted
      istoplevel: true,
      permissions: {
        permission: [
          {
            permittedrole: 'ADMINISTRATOR',
          },
        ],
      },
      metadataType: 'customrecordtype',
    })
    expect(customRecordObjectType.fields.custom_custfield1.annotations).toEqual({
      scriptid: 'custfield1',
      label: 'Custom Field 1',
    })
  })
})
