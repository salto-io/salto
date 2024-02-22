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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import {
  AdditionChange,
  Field,
  InstanceElement,
  ModificationChange,
  ObjectType,
  Values,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isObjectType,
  isObjectTypeChange,
} from '@salto-io/adapter-api'
import { customrecordtypeType } from '../autogen/types/standard_types/customrecordtype'
import { INACTIVE_FIELDS } from '../constants'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType, isDataObjectType } from '../types'

const log = logger(module)

const ORIGINAL_NAME = 'originalName'

const FIELDS_TO_ALIGN = [
  { from: INACTIVE_FIELDS.isinactive, to: INACTIVE_FIELDS.isInactive },
  { from: INACTIVE_FIELDS.inactive, to: INACTIVE_FIELDS.isInactive },
]

const CUSTOM_RECORD_TYPE_ANNOTATIONS_TO_ALIGN = [
  { from: customrecordtypeType().type.fields.isinactive.name, to: INACTIVE_FIELDS.isInactive },
]

const runFuncOnFieldType =
  (func: (fieldType: ObjectType, value: Values) => void): TransformFuncSync =>
  ({ field, value }) => {
    const fieldType = field?.getTypeSync()
    if (isObjectType(fieldType) && _.isPlainObject(value)) {
      func(fieldType, value)
    }
    return value
  }

const runFuncOnCustomRecordTypeNestedAnnotations = (
  type: ObjectType,
  func: (fieldType: ObjectType, values: Values) => void,
): void => {
  Object.entries(type.annotationRefTypes).forEach(([anno, annoRefType]) => {
    const annoType = annoRefType.getResolvedValueSync()
    if (isObjectType(annoType) && _.isPlainObject(type.annotations[anno])) {
      func(annoType, type.annotations[anno])
      transformValuesSync({
        values: type.annotations[anno],
        type: annoType,
        strict: false,
        pathID: type.elemID.createNestedID('attr', anno),
        transformFunc: runFuncOnFieldType(func),
      })
    }
  })
}

const runFuncOnInstance = (instance: InstanceElement, func: (fieldType: ObjectType, values: Values) => void): void => {
  const type = instance.getTypeSync()
  func(type, instance.value)
  transformValuesSync({
    values: instance.value,
    type,
    strict: false,
    pathID: instance.elemID,
    transformFunc: runFuncOnFieldType(func),
  })
}

const alignFieldNamesInType = (type: ObjectType): void => {
  FIELDS_TO_ALIGN.forEach(field => {
    if (type.fields[field.from] === undefined) {
      return
    }
    if (type.fields[field.to] !== undefined) {
      log.warn('cannot align field %s in type %s - field %s already exist', field.from, type.elemID.name, field.to)
      return
    }
    const { refType, annotations } = type.fields[field.from]
    const newAnnotations = { ...annotations, [ORIGINAL_NAME]: field.from }
    type.fields[field.to] = new Field(type, field.to, refType, newAnnotations)
    delete type.fields[field.from]
  })
}

const alignFieldNamesInValue = (type: ObjectType, value: Values): void => {
  Object.values(type.fields).forEach(field => {
    if (field.annotations[ORIGINAL_NAME] !== undefined) {
      value[field.name] = value[field.annotations[ORIGINAL_NAME]]
      delete value[field.annotations[ORIGINAL_NAME]]
    }
  })
}

const restoreFieldNamesInValue = (type: ObjectType, value: Values): void => {
  Object.values(type.fields).forEach(field => {
    const originalName = field.annotations[ORIGINAL_NAME]
    if (originalName === undefined) {
      return
    }
    if (type.fields[originalName] === undefined) {
      const annotations = _.omit(field.annotations, ORIGINAL_NAME)
      type.fields[originalName] = new Field(type, originalName, field.refType, annotations)
    }
    value[originalName] = value[field.name]
    delete value[field.name]
  })
}

const alignFieldNamesInCustomRecordType = (type: ObjectType): void => {
  CUSTOM_RECORD_TYPE_ANNOTATIONS_TO_ALIGN.forEach(anno => {
    if (type.annotationRefTypes[anno.from] !== undefined) {
      type.annotationRefTypes[anno.to] = type.annotationRefTypes[anno.from]
      delete type.annotationRefTypes[anno.from]
    }
    if (type.annotations[anno.from] !== undefined) {
      type.annotations[anno.to] = type.annotations[anno.from]
      delete type.annotations[anno.from]
    }
  })
  runFuncOnCustomRecordTypeNestedAnnotations(type, alignFieldNamesInValue)
}

const alignFieldNamesInInstance = (instance: InstanceElement): void =>
  runFuncOnInstance(instance, alignFieldNamesInValue)

const restoreFieldNamesInCustomRecordType = (type: ObjectType): void => {
  CUSTOM_RECORD_TYPE_ANNOTATIONS_TO_ALIGN.forEach(anno => {
    if (type.annotationRefTypes[anno.to] !== undefined) {
      type.annotationRefTypes[anno.from] = type.annotationRefTypes[anno.to]
      delete type.annotationRefTypes[anno.to]
    }
    if (type.annotations[anno.to] !== undefined) {
      type.annotations[anno.from] = type.annotations[anno.to]
      delete type.annotations[anno.to]
    }
  })
  runFuncOnCustomRecordTypeNestedAnnotations(type, restoreFieldNamesInValue)
}

const restoreFieldNamesInInstance = (instance: InstanceElement): void =>
  runFuncOnInstance(instance, restoreFieldNamesInValue)

const restoreFieldNamesInInstanceChange = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
): void => {
  const type = change.data.after.getTypeSync()
  if (isCustomRecordType(type)) {
    return
  }
  const changeData = isDataObjectType(type)
    ? // in data instances we should transform also the before
      Object.values(change.data)
    : [change.data.after]

  changeData.forEach(restoreFieldNamesInInstance)
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'alignFieldNames',
  onFetch: async elements => {
    const [customRecordTypes, types] = _.partition(elements.filter(isObjectType), isCustomRecordType)

    types.forEach(alignFieldNamesInType)
    customRecordTypes.forEach(alignFieldNamesInCustomRecordType)

    elements
      .filter(isInstanceElement)
      // custom record instances don't have field names to align ATM
      .filter(instance => !isCustomRecordType(instance.getTypeSync()))
      .forEach(alignFieldNamesInInstance)
  },
  preDeploy: async changes => {
    changes.filter(isAdditionOrModificationChange).filter(isInstanceChange).forEach(restoreFieldNamesInInstanceChange)

    changes
      .filter(isAdditionOrModificationChange)
      .filter(isObjectTypeChange)
      .filter(change => isCustomRecordType(change.data.after))
      .forEach(change => restoreFieldNamesInCustomRecordType(change.data.after))
  },
})

export default filterCreator
