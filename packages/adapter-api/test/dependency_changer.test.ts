/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  dependencyChange,
  isDependentAction,
  addReferenceDependency,
  addParentDependency,
  isFieldChangeEntry,
  ChangeEntry,
  isInstanceChangeEntry,
  isObjectTypeChangeEntry,
} from '../src/dependency_changer'
import { Change } from '../src/change'
import { Field, ObjectType, InstanceElement } from '../src/elements'
import { ElemID } from '../src/element_id'

describe('Dependency changer utility functions', () => {
  describe('dependencyChange', () => {
    it('should create a dependency change object', () => {
      expect(dependencyChange('add', 1, 2)).toEqual({
        action: 'add',
        dependency: { source: 1, target: 2 },
      })
    })
  })
  describe('isDependentAction', () => {
    it('should return true for actions that can depend on each other', () => {
      expect(isDependentAction('add', 'add')).toBeTruthy()
      expect(isDependentAction('remove', 'remove')).toBeTruthy()
      expect(isDependentAction('modify', 'add')).toBeTruthy()
      expect(isDependentAction('modify', 'remove')).toBeTruthy()
    })
    it('should return false for actions that cannot depend on each other', () => {
      const possibleActions: Change['action'][] = ['add', 'remove', 'modify']
      possibleActions.forEach(action => expect(isDependentAction(action, 'modify')).toBeFalsy())
      expect(isDependentAction('add', 'remove')).toBeFalsy()
      expect(isDependentAction('remove', 'add')).toBeFalsy()
    })
  })
  describe('addReferenceDependency', () => {
    it('should create dependency from src to target on add', () => {
      expect(addReferenceDependency('add', 1, 2)).toEqual(dependencyChange('add', 1, 2))
    })
    it('should create dependency from target to src on remove', () => {
      expect(addReferenceDependency('remove', 1, 2)).toEqual(dependencyChange('add', 2, 1))
    })
  })
  describe('addParentDependency', () => {
    it('should create dependency from src to target', () => {
      expect(addParentDependency(1, 2)).toEqual(dependencyChange('add', 1, 2))
    })
  })
  describe('change entry filter functions', () => {
    const testType = new ObjectType({ elemID: new ElemID('', 'test') })
    const testField = new Field(testType, 'field', testType)
    const testInst = new InstanceElement('inst', testType)
    const toChangeEntry = <T>(elem: T): ChangeEntry<T> => [1, { action: 'add', data: { after: elem } }]
    describe('isFieldChangeEntry', () => {
      it('should return true for field change entry', () => {
        expect(isFieldChangeEntry(toChangeEntry(testField))).toBeTruthy()
      })
    })
    describe('isInstanceChangeEntry', () => {
      it('should return true for instance change entry', () => {
        expect(isInstanceChangeEntry(toChangeEntry(testInst))).toBeTruthy()
      })
    })
    describe('isObjectTypeChangeEntry', () => {
      it('should return true for object type change entry', () => {
        expect(isObjectTypeChangeEntry(toChangeEntry(testType))).toBeTruthy()
      })
    })
  })
})
