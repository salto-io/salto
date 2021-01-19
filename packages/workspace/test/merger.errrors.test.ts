/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { DuplicateAnnotationError } from '../src/merger'
import {
  ConflictingFieldTypesError, DuplicateAnnotationFieldDefinitionError,
  DuplicateAnnotationTypeError, ConflictingSettingError,
} from '../src/merger/internal/object_types'
import { DuplicateInstanceKeyError } from '../src/merger/internal/instances'
import { MultiplePrimitiveTypesUnsupportedError } from '../src/merger/internal/primitives'
import { DuplicateVariableNameError } from '../src/merger/internal/variables'
import { serialize, deserialize } from '../src/merger/internal/errors'

describe('merge errors', () => {
  describe('serialization', () => {
    const elemID = new ElemID('dummy', 'test')
    it('DuplicateAnnotationError', async () => {
      const mergeError = new DuplicateAnnotationError({
        elemID,
        key: 'test',
        existingValue: 'data1',
        newValue: 'data2',
      })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
    it('DuplicateInstanceKeyError', async () => {
      const mergeError = new DuplicateInstanceKeyError({
        elemID,
        key: 'test',
        existingValue: 'data1',
        newValue: 'data2',
      })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
    it('DuplicateAnnotationFieldDefinitionError', async () => {
      const mergeError = new DuplicateAnnotationFieldDefinitionError({
        elemID,
        annotationKey: 'test',
      })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
    it('ConflictingFieldTypesError', async () => {
      const mergeError = new ConflictingFieldTypesError({
        elemID,
        definedTypes: ['test1', 'test2'],
      })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
    it('ConflictingSettingError', async () => {
      const mergeError = new ConflictingSettingError({ elemID })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
    it('DuplicateAnnotationTypeError', async () => {
      const mergeError = new DuplicateAnnotationTypeError({
        elemID,
        key: 'test',
      })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
    it('MultiplePrimitiveTypesUnsupportedError', async () => {
      const mergeError = new MultiplePrimitiveTypesUnsupportedError({
        elemID,
        duplicates: [BuiltinTypes.BOOLEAN, BuiltinTypes.NUMBER],
      })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
    it('DuplicateVariableNameError', async () => {
      const mergeError = new DuplicateVariableNameError({ elemID })
      expect((await deserialize(serialize([mergeError]))).map(s => s.toString()))
        .toEqual([mergeError.toString()])
    })
  })
})
