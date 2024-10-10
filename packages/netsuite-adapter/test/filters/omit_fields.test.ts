/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/omit_fields'
import { LocalFilterOpts } from '../../src/filter'
import { toAnnotationRefTypes } from '../../src/custom_records/custom_record_type'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { emptyQueryParams, fullQueryParams, fullFetchConfig } from '../../src/config/config_creator'
import { getTypesToInternalId } from '../../src/data_elements/types'

describe('omit fields filter', () => {
  let type: ObjectType
  let innerType: ObjectType
  let instance: InstanceElement
  let defaultOpts: LocalFilterOpts
  let customRecordObjectType: ObjectType
  const { type: customrecordtype, innerTypes: customrecordInnerTypes } = customrecordtypeType()
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
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      ...getTypesToInternalId([]),
    }
    customRecordObjectType = new ObjectType({
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
  })

  describe('omit fields onFetch', () => {
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
        config: {
          fetch: {
            include: fullQueryParams(),
            exclude: emptyQueryParams(),
            fieldsToOmit: [{ type: 'notSome.*', fields: ['.*'] }],
          },
        },
      }).onFetch?.([instance, type, innerType])
      expect(instance.value).toEqual({
        field1: true,
        field2: { nested1: 'test', nested2: 'test2' },
      })
    })
    it('should omit fields in top level element', async () => {
      await filterCreator({
        ...defaultOpts,
        config: {
          fetch: {
            include: fullQueryParams(),
            exclude: emptyQueryParams(),
            fieldsToOmit: [{ type: 'some.*', fields: ['.*2'] }],
          },
        },
      }).onFetch?.([instance, type, innerType])
      expect(instance.value).toEqual({ field1: true })
    })
    it('should omit fields in inner type', async () => {
      await filterCreator({
        ...defaultOpts,
        config: {
          fetch: {
            include: fullQueryParams(),
            exclude: emptyQueryParams(),
            fieldsToOmit: [{ type: 'some.*', subtype: 'inner.*', fields: ['.*2'] }],
          },
        },
      }).onFetch?.([instance, type, innerType])
      expect(instance.value).toEqual({
        field1: true,
        field2: { nested1: 'test' },
      })
    })
    it('should omit fields in custom record type', async () => {
      await filterCreator({
        ...defaultOpts,
        config: {
          fetch: {
            include: fullQueryParams(),
            exclude: emptyQueryParams(),
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
  describe('omit fields preDeploy tests', () => {
    it('should not omit by default', async () => {
      await filterCreator(defaultOpts).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        field1: true,
        field2: { nested1: 'test', nested2: 'test2' },
      })
    })

    it("should not omit if rule doesn't match", async () => {
      await filterCreator({
        ...defaultOpts,
        config: {
          fetch: fullFetchConfig(),
          deploy: { fieldsToOmit: [{ type: 'notSome.*', fields: ['.*'] }] },
        },
      }).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        field1: true,
        field2: { nested1: 'test', nested2: 'test2' },
      })
    })

    it('should omit field from top level element', async () => {
      await filterCreator({
        ...defaultOpts,
        elementsSource: buildElementsSourceFromElements([instance, type, innerType]),
        config: {
          fetch: fullFetchConfig(),
          deploy: { fieldsToOmit: [{ type: 'some.*', fields: ['.*2'] }] },
        },
      }).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({ field1: true })
    })

    it('should omit field from inner type', async () => {
      await filterCreator({
        ...defaultOpts,
        elementsSource: buildElementsSourceFromElements([instance, type, innerType]),
        config: {
          fetch: fullFetchConfig(),
          deploy: { fieldsToOmit: [{ type: 'some.*', subtype: 'inner.*', fields: ['.*2'] }] },
        },
      }).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        field1: true,
        field2: { nested1: 'test' },
      })
    })

    it('should omit fields from custom record type', async () => {
      await filterCreator({
        ...defaultOpts,
        elementsSource: buildElementsSourceFromElements([
          customrecordtype,
          ...Object.values(customrecordInnerTypes),
          customRecordObjectType,
        ]),
        config: {
          deploy: {
            fieldsToOmit: [
              { type: 'customrecordtype', fields: ['links'] },
              { type: 'customrecordtype', subtype: 'customrecordtype_permissions_permission', fields: ['.*level'] },
              { type: 'customrecordcustomfield', fields: ['is.*'] },
            ],
          },
          fetch: fullFetchConfig(),
        },
      }).preDeploy?.([toChange({ after: customRecordObjectType })])
      expect(customRecordObjectType.annotations).toEqual({
        scriptid: 'customrecord1',
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
    })
  })
})
