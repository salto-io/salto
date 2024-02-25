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

import {
  BuiltinTypes,
  Change,
  cloneDeepWithoutRefs,
  createRefToElmWithValue,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isListType,
  isObjectType,
  ObjectType,
  Value,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { TransformFuncArgs, transformValues, WALK_NEXT_STEP, WalkOnFunc, walkOnValue } from '@salto-io/adapter-utils'
import { parse, j2xParser } from 'fast-xml-parser'
import { decode, encode } from 'he'
import { collections, strings } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { DATASET, REAL_VALUE_KEY, SCRIPT_ID, SOAP_SCRIPT_ID, WORKBOOK } from '../constants'
import { LocalFilterCreator } from '../filter'
import { ATTRIBUTE_PREFIX, CDATA_TAG_NAME } from '../client/constants'
import { parsedWorkbookType, workbookDefinitionFields } from '../type_parsers/analytics_parsers/parsed_workbook'
import { datasetDefinitionFields, parsedDatasetType } from '../type_parsers/analytics_parsers/parsed_dataset'
import { TypeAndInnerTypes } from '../types/object_types'
import {
  CHART_IDS,
  DATA_VIEW_IDS,
  DEFAULT_VALUE,
  DEFAULT_XML_TYPE,
  DEFINITION,
  DO_NOT_ADD,
  EmptyObject,
  EXPRESSION_VALUE_VALUE_REGEX,
  FALSE,
  FIELD_DEFINITION,
  FIELD_TYPE,
  fieldsToOmitFromDefinition,
  fieldsToOmitFromOriginal,
  FieldWithType,
  ITEM,
  NAME,
  OriginalWorkbookArrays,
  PIVOT_IDS,
  ROOT,
  StringToStringRecord,
  TRANSLATION_SCRIPT_ID,
  TRUE,
  TValuesToIgnore,
  TYPE,
  XML_TYPE,
  xmlType,
} from '../type_parsers/analytics_parsers/analytics_constants'
import { captureServiceIdInfo } from '../service_id_info'
import { workbookType } from '../autogen/types/standard_types/workbook'
import { datasetType } from '../autogen/types/standard_types/dataset'

const log = logger(module)
const { awu } = collections.asynciterable

const isNotAtrophiedScriptIdField = (name: string, val: Value): boolean =>
  name.endsWith(SOAP_SCRIPT_ID) ? !_.isEqual(val, { [TYPE]: xmlType.null }) : true

const fetchTransformFunc = async ({ value, field, path }: TransformFuncArgs, type: ObjectType): Promise<Value> => {
  const fieldType = path?.isTopLevel() ? type : await field?.getType()
  if (fieldType === undefined && path !== undefined && isNotAtrophiedScriptIdField(path.getFullName(), value)) {
    log.debug('unexpected path in analytics type. Path: %s', path?.getFullName())
  }
  if (
    fieldType?.elemID.isEqual(BuiltinTypes.UNKNOWN.elemID) &&
    !(_.isPlainObject(value) && value[TYPE] === xmlType.null) &&
    path !== undefined &&
    !EXPRESSION_VALUE_VALUE_REGEX.test(path.getFullName())
  ) {
    log.debug('Found a value with an unkown type. path: %s, value: %o', path?.getFullName(), value)
  }
  if (_.isPlainObject(value)) {
    if (value[TYPE] === xmlType.null) {
      return undefined
    }
    if (value[TYPE] === xmlType.array) {
      return collections.array.makeArray(value[ITEM])
    }
    if (value[TYPE] === xmlType.boolean) {
      return value[REAL_VALUE_KEY]
    }
    if (value[TYPE] === xmlType.string) {
      return String(value[REAL_VALUE_KEY])
    }
    if (FIELD_DEFINITION in value) {
      if (!isObjectType(fieldType) || !fieldType.annotations[XML_TYPE]) {
        log.debug('unexpected _T_ field in analytic instance. Path: %s', path?.getFullName())
        return {
          [FIELD_TYPE]: value[FIELD_DEFINITION],
          ..._.omit(value, FIELD_DEFINITION),
        }
      }
      return TValuesToIgnore.has(value[FIELD_DEFINITION])
        ? _.omit(value, FIELD_DEFINITION)
        : {
            [value[FIELD_DEFINITION]]: _.omit(value, FIELD_DEFINITION),
          }
    }
    return value
  }
  if (fieldType?.elemID.isEqual(BuiltinTypes.STRING.elemID)) {
    return String(value)
  }
  return value
}

const createAnalyticsInstance = async (instance: InstanceElement, analyticsType: ObjectType): Promise<void> => {
  const definitionValues = _.omit(
    parse(instance.value[DEFINITION], {
      attributeNamePrefix: ATTRIBUTE_PREFIX,
      ignoreAttributes: false,
      tagValueProcessor: val => decode(val),
    })[ROOT],
    fieldsToOmitFromDefinition,
  )

  const updatedValues = await transformValues({
    values: definitionValues,
    type: analyticsType,
    transformFunc: args => fetchTransformFunc(args, analyticsType),
    strict: false,
    pathID: instance.elemID,
  })

  if (updatedValues !== undefined) {
    instance.value = {
      ..._.omit(instance.value, fieldsToOmitFromOriginal),
      ...updatedValues,
    }
  }
}

const createEmptyObjectOfType = async (fieldType: ObjectType, key: string): Promise<EmptyObject> => {
  if (DEFAULT_VALUE in fieldType.fields[key].annotations) {
    return fieldType.fields[key].annotations[DEFAULT_VALUE]
  }
  const keyType = await fieldType.fields[key].getType()

  if (isListType(keyType)) {
    return {
      [TYPE]: xmlType.array,
    }
  }

  return {
    [TYPE]: xmlType.null,
  }
}

const handleTypeField = (value: Value): FieldWithType => {
  if (Array.isArray(value)) {
    return {
      [TYPE]: xmlType.array,
      [ITEM]: value,
    }
  }
  if (_.isBoolean(value)) {
    return {
      [TYPE]: xmlType.boolean,
      [REAL_VALUE_KEY]: value ? TRUE : FALSE,
    }
  }
  if (_.isString(value) && strings.isNumberStr(value)) {
    return {
      [TYPE]: xmlType.string,
      [REAL_VALUE_KEY]: value,
    }
  }
  return value
}

const handleFieldDefinition = (value: Value): Value => {
  if (_.isPlainObject(value)) {
    const innerKeys = Object.keys(value)
    if (innerKeys.includes(FIELD_TYPE)) {
      value[FIELD_DEFINITION] = value[FIELD_TYPE]
      delete value[FIELD_TYPE]
    } else if (innerKeys.includes(FIELD_DEFINITION) && !TValuesToIgnore.has(value[FIELD_DEFINITION])) {
      // We assume that we have exactly 2 keys because the only option for an object
      // to include the FIELD_DEFINITION key is if we added it in addMissingFields and we do so in 2 options:
      // 1. The field DEFAULT_XML_TYPE exists
      // 2. The field DEFAULT_XML_TYPE does not exist (not in the TValuesToIgnore) and there is only one other key
      if (innerKeys.length !== 2) {
        log.warn('The number of keys in an object with FIELD_DEFINITION is not 2')
        return value
      }
      const otherKey = innerKeys.filter(innerKey => innerKey !== FIELD_DEFINITION)[0]
      return {
        [FIELD_DEFINITION]: value[FIELD_DEFINITION],
        ...value[otherKey],
      }
    }
  }
  return value
}

const matchToXmlObjectForm = (instance: InstanceElement, definitionValues: Values): void => {
  const deployWalkFunc: WalkOnFunc = ({ value }) => {
    if (_.isPlainObject(value)) {
      const keys = Object.keys(value)

      keys.forEach(key => {
        value[key] = handleFieldDefinition(value[key])
      })

      // to prevent endless recursion in children arrays
      if (!(TYPE in value)) {
        keys.forEach(key => {
          value[key] = handleTypeField(value[key])
        })
      }
    } else if (Array.isArray(value)) {
      value.forEach((_val, index) => {
        value[index] = handleFieldDefinition(value[index])
        value[index] = handleTypeField(value[index])
      })
    }
    return WALK_NEXT_STEP.RECURSE
  }

  walkOnValue({
    elemId: instance.elemID,
    value: definitionValues,
    func: deployWalkFunc,
  })
}

const addMissingFields = async (
  instance: InstanceElement,
  definitionValues: Values,
  analyticsType: ObjectType,
): Promise<void> => {
  const deployTransformFunc = async ({ value, field, path }: TransformFuncArgs): Promise<Value> => {
    const fieldType = path?.isTopLevel() ? analyticsType : await field?.getType()
    if (isObjectType(fieldType) && _.isPlainObject(value) && !(TYPE in value)) {
      if (
        fieldType.annotations[XML_TYPE] &&
        Object.keys(value).length === 1 &&
        fieldType.annotations[DEFAULT_XML_TYPE] === undefined
      ) {
        const [key] = Object.keys(value)
        value[FIELD_DEFINITION] = key
      } else {
        if (fieldType.annotations[DEFAULT_XML_TYPE] !== undefined) {
          value[FIELD_DEFINITION] = fieldType.annotations[DEFAULT_XML_TYPE]
        }
        await awu(Object.keys(fieldType.fields))
          .filter(key => !(key in value) && fieldType.fields[key].annotations[DO_NOT_ADD] !== true)
          .forEach(async key => {
            value[key] = await createEmptyObjectOfType(fieldType, key)
          })
      }
    }
    return value
  }

  await transformValues({
    values: definitionValues,
    type: analyticsType,
    transformFunc: deployTransformFunc,
    strict: false,
    pathID: instance.elemID,
  })
}

const createOriginalArray = (arrName: string, value: Values): StringToStringRecord[] =>
  collections.array
    .makeArray(value.Workbook?.[arrName])
    .filter(_.isString)
    .flatMap((val: string) => ({ [SCRIPT_ID]: val }))

const createOriginalArrays = (value: Values): OriginalWorkbookArrays => ({
  pivots: {
    pivot: createOriginalArray(PIVOT_IDS, value),
  },
  charts: {
    chart: createOriginalArray(CHART_IDS, value),
  },
  tables: {
    table: createOriginalArray(DATA_VIEW_IDS, value),
  },
})

const createDefinitionName = (instance: InstanceElement, definitionValues: Values): void => {
  const name = instance.value[NAME]?.[REAL_VALUE_KEY]
  const capture = _.isString(name) ? captureServiceIdInfo(name) : []
  definitionValues[NAME] =
    capture.length === 1
      ? {
          [TRANSLATION_SCRIPT_ID]: capture[0].serviceId,
        }
      : instance.value[NAME]
}

const returnToOriginalShape = async (instance: InstanceElement): Promise<Values> => {
  const analyticsType = await instance.getType()

  const arrays = analyticsType.elemID.typeName === WORKBOOK ? createOriginalArrays(instance.value) : []

  const definitionValues =
    analyticsType.elemID.typeName === WORKBOOK
      ? _.pick(instance.value, Object.values(workbookDefinitionFields))
      : _.pick(instance.value, Object.values(datasetDefinitionFields))

  const updatedDefinitionValues = cloneDeepWithoutRefs(definitionValues)

  await addMissingFields(instance, updatedDefinitionValues, analyticsType)

  matchToXmlObjectForm(instance, updatedDefinitionValues)

  createDefinitionName(instance, updatedDefinitionValues)

  // eslint-disable-next-line new-cap
  const xmlString = new j2xParser({
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    format: true,
    ignoreAttributes: false,
    cdataTagName: CDATA_TAG_NAME,
    tagValueProcessor: val => encode(val.toString()),
  }).parse({ [ROOT]: updatedDefinitionValues })

  return {
    ..._.omit(instance.value, Object.keys(definitionValues)),
    [DEFINITION]: xmlString,
    ...arrays,
  }
}

const changeType = async (
  { type: analyticType, innerTypes }: TypeAndInnerTypes,
  elements: Element[],
): Promise<void> => {
  _.remove(elements, e => _.isEqual(e.path, analyticType.path))
  elements.push(analyticType)
  elements.push(...Object.values(innerTypes))

  const analyticInstances = elements
    .filter(isInstanceElement)
    .filter(elem => elem.elemID.typeName === analyticType.elemID.name)
  await awu(analyticInstances).forEach(async instance => {
    instance.refType = createRefToElmWithValue(analyticType)
    await createAnalyticsInstance(instance, analyticType)
  })
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'parseAnalytics',
  onFetch: async elements => {
    await changeType(parsedWorkbookType(), elements)
    await changeType(parsedDatasetType(), elements)
  },

  preDeploy: async (changes: Change[]) => {
    const instanceElemsFromAdditionOrModification = changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
    const originalTypeMap: Record<string, ObjectType> = {
      [DATASET]: datasetType().type,
      [WORKBOOK]: workbookType().type,
    }
    await awu(instanceElemsFromAdditionOrModification)
      .filter(instance => instance.elemID.typeName === DATASET || instance.elemID.typeName === WORKBOOK)
      .forEach(async instance => {
        instance.value = await returnToOriginalShape(instance)
        instance.refType = createRefToElmWithValue(originalTypeMap[instance.elemID.typeName])
      })
  },
})

export default filterCreator
