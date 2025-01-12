/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createMissingInstance, MISSING_ANNOTATION, checkMissingRef } from '../../src/references/missing_references'

describe('missingReferences', () => {
  describe('createMissingInstance', () => {
    it('should create missing instance with the correct elemID, type and annotations', () => {
      const result = createMissingInstance('adapterTest', 'someType', '123456')
      expect(result.elemID.getFullName()).toEqual('adapterTest.someType.instance.missing_123456')
      expect(result.refType.elemID.typeName).toEqual('someType')
      expect(result.annotations[MISSING_ANNOTATION]).toEqual(true)
    })
  })

  describe('checkMissingRef', () => {
    const type = new ObjectType({ elemID: new ElemID('adapter', 'type') })
    type.annotations[MISSING_ANNOTATION] = true
    const instance = new InstanceElement('inst', type, {}, undefined, { [MISSING_ANNOTATION]: true })
    it('should check missing ref annotation', () => {
      expect(checkMissingRef(instance)).toEqual(true)
      expect(checkMissingRef(type)).toEqual(true)
    })
  })
})
