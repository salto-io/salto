/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ATTRIBUTE_PREFIX } from '../../src/client/constants'
import { translationcollectionType } from '../../src/autogen/types/standard_types/translationcollection'
import filterCreator from '../../src/filters/translation_converter'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('translation_converter filter', () => {
  const translationcollection = translationcollectionType().type

  describe('onFetch', () => {
    it('should add nameTranslate to type', async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.([translationcollection])
      expect(translationcollection.fields.nameTranslate).toBeDefined()
    })

    it('should split name if it is an object', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: {
          '#text': 'name',
          translate: 'T',
        },
      })
      await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
      expect(instance.value).toEqual({ name: 'name', nameTranslate: true })
    })

    it('should do nothing if name is a string', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: 'name',
      })
      await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
      expect(instance.value).toEqual({ name: 'name' })
    })

    it('should transform value in customRecordType', async () => {
      const customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        fields: {
          custom_field: {
            refType: BuiltinTypes.STRING,
            annotations: {
              label: {
                '#text': 'label',
                translate: true,
              },
            },
          },
        },
        annotations: {
          name: {
            '#text': 'Custom Record',
            translate: true,
          },
          metadataType: 'customrecordtype',
        },
      })
      await filterCreator({} as LocalFilterOpts).onFetch?.([customRecordType])
      expect(customRecordType.annotations).toEqual({
        name: 'Custom Record',
        nameTranslate: true,
        metadataType: 'customrecordtype',
      })
      expect(customRecordType.fields.custom_field.annotations).toEqual({ label: 'label', labelTranslate: true })
    })
  })

  describe('preDeploy', () => {
    it('should combine name and translate', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: 'name',
        nameTranslate: true,
      })
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        name: {
          '#text': 'name',
          [`${ATTRIBUTE_PREFIX}translate`]: 'T',
        },
      })
    })

    it('should do nothing if nameTranslate is undefined', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: 'name',
      })
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({ name: 'name' })
    })

    it('should transform value in customRecordType', async () => {
      const customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: {
          name: 'Custom Record',
          nameTranslate: true,
          metadataType: 'customrecordtype',
        },
      })
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: customRecordType })])
      expect(customRecordType.annotations).toEqual({
        name: {
          '#text': 'Custom Record',
          [`${ATTRIBUTE_PREFIX}translate`]: 'T',
        },
        metadataType: 'customrecordtype',
      })
    })

    it('should transform value in customRecordType field', async () => {
      const customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        fields: {
          custom_field: {
            refType: BuiltinTypes.STRING,
            annotations: {
              label: 'label',
              labelTranslate: true,
            },
          },
        },
        annotations: {
          metadataType: 'customrecordtype',
        },
      })
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: customRecordType })])
      expect(customRecordType.fields.custom_field.annotations).toEqual({
        label: {
          '#text': 'label',
          [`${ATTRIBUTE_PREFIX}translate`]: 'T',
        },
      })
    })
  })
})
