/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { PROFILE_METADATA_TYPE, SALESFORCE } from '../../src/constants'
import changeValidator from '../../src/change_validators/recordTypeVisibility_no_default'

const createChangesWithElements = (instances: InstanceElement[]): Change[] => {
  const changes = instances.map(instance => toChange({ after: instance }))
  return changes
}

const createRecordTypeVisibilitiesFields = (
  visibility1: boolean,
  default1: boolean,
  visibility2: boolean,
  default2: boolean,
): Object => {
  return {
    section1: {
      internal1: { visible: visibility1, default: default1 },
      internal2: { visible: visibility2, default: default2 },
    },
  }
}

const createInstance = (name: string, reordTypeVisibilitiesFields: Object, typeName?: string): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(SALESFORCE, typeName ?? PROFILE_METADATA_TYPE) }), {
    recordTypeVisibilities: reordTypeVisibilitiesFields,
  })

describe('recordTypeVisibility no default change validator', () => {
  describe('when no default is true and no visible is true', () => {
    it('should have no errors', async () => {
      const changes = createChangesWithElements([
        createInstance('admin', createRecordTypeVisibilitiesFields(false, false, false, false)),
      ])
      const errs = await changeValidator(changes)
      expect(errs).toHaveLength(0)
    })
  })
  describe('when there is no default that is true but there is visible that is true', () => {
    it('should have an error', async () => {
      const changes = createChangesWithElements([
        createInstance('admin', createRecordTypeVisibilitiesFields(false, false, true, false)),
      ])
      const errs = await changeValidator(changes)
      expect(errs).toHaveLength(1)
      expect(errs[0].severity).toEqual('Error')
    })
  })
  describe('when there is default true but no visible that is true', () => {
    it('should have an error', async () => {
      const changes = createChangesWithElements([
        createInstance('admin', createRecordTypeVisibilitiesFields(false, false, false, true)),
      ])
      const errs = await changeValidator(changes)
      expect(errs).toHaveLength(1)
      expect(errs[0].severity).toEqual('Error')
    })
  })
  describe('when there is default that is true and is visible', () => {
    it('should have no errors', async () => {
      const changes = createChangesWithElements([
        createInstance('admin', createRecordTypeVisibilitiesFields(false, false, true, true)),
      ])
      const errs = await changeValidator(changes)
      expect(errs).toHaveLength(0)
    })
  })
  describe('when metadata type is not supported by the CV', () => {
    it('should return no errors', async () => {
      const changes = createChangesWithElements([
        createInstance('admin', createRecordTypeVisibilitiesFields(false, false, false, true), 'diffType'),
      ])
      const errs = await changeValidator(changes)
      expect(errs).toHaveLength(0)
    })
  })
})
