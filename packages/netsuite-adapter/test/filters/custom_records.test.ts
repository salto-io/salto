/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/custom_records'
import { LocalFilterOpts } from '../../src/filter'

describe('fix custom record objects filter', () => {
  let type: ObjectType
  let instance: InstanceElement
  describe('onFetch', () => {
    beforeEach(async () => {
      type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'custrecord'),
        fields: {
          scriptid: { refType: BuiltinTypes.SERVICE_ID },
          internalId: { refType: BuiltinTypes.STRING },
          custom_field: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          metadataType: 'customrecordtype',
        },
      })
      instance = new InstanceElement('record1', type, {
        recType: { internalId: '1' },
        owner: { internalId: '1' },
        translationsList: {
          customRecordTranslations: {
            lang: 'english',
          },
        },
      })
      await filterCreator({} as LocalFilterOpts).onFetch?.([type, instance])
    })
    it('should remove fields from type', () => {
      expect(Object.keys(type.fields)).toEqual(['scriptid', 'internalId', 'custom_field'])
    })
  })
  describe('preDeploy', () => {
    beforeEach(async () => {
      type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'custrecord'),
        annotations: {
          metadataType: 'customrecordtype',
        },
      })
      instance = new InstanceElement('record1', type, { internalId: '2' })
      await filterCreator({} as LocalFilterOpts).preDeploy?.([toChange({ after: instance })])
    })
    it('should add fields to type', () => {
      expect(Object.keys(type.fields)).toEqual(['parent', 'recType'])
    })
    it('should add recordType to instance', () => {
      expect(instance.value.recType).toEqual(new ReferenceExpression(type.elemID, type))
    })
  })
})
