/*
*                      Copyright 2023 Salto Labs Ltd.
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
import {
  isCPQRelationship, isCustom, isCustomLabel, isCustomMetadata, isCustomSetting, isObjectType, isParent, isParentField,
  isProcessBuilderIdentifier, isRelationshipField, isSpecialPrefix, isStandardRelationship, isUserField,
} from './grammar'
import {
  createApiName, getField, getObject, parts, canonicalizeProcessBuilderIdentifier, transformToId,
  transformToUserField,
} from './utils'
import { mapCPQField } from './cpq'

export type IdentifierType = 'customField'|'standardField'|'customObject'|'standardObject'|'customLabel'
  |'customSetting'|'customMetadataTypeRecord'|'customMetadataType'|'unknownRelationship'

export type FormulaIdentifierInfo = {
  type: IdentifierType
  instance: string
}

const isImplicitReferenceToParentField = (fieldIdentifier: string): boolean => (
  // Either the field identifier has an explicit parent (e.g. 'Account.Industry') or it implicitly refers to
  // the provided parent object (e.g. 'Name')
  !fieldIdentifier.includes('.')
)

export const parseField = (fieldIdentifier: string, object: string): FormulaIdentifierInfo => {
  const fieldIdentifierWithParent = isImplicitReferenceToParentField(fieldIdentifier)
    ? createApiName(object, fieldIdentifier) : fieldIdentifier

  return {
    type: (isCustom(fieldIdentifierWithParent) ? 'customField' : 'standardField'),
    instance: fieldIdentifierWithParent,
  }
}

export const parseObject = (object: string): FormulaIdentifierInfo => {
  let type: IdentifierType

  if (isCustom(object)) {
    type = 'customObject'
  } else if (isCustomMetadata(object)) {
    type = 'customMetadataType'
  } else if (isStandardRelationship(object)) {
    type = 'standardObject'
  } else {
    type = 'unknownRelationship'
  }

  return {
    type,
    instance: object,
  }
}

export const parseCustomMetadata = (value: string): FormulaIdentifierInfo[] => {
  // 'value' looks like $CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c
  const [, sobject, sobjInstance, fieldName] = parts(value)

  return [
    {
      instance: createApiName(sobject, sobjInstance),
      type: 'customMetadataTypeRecord',
    },
    {
      instance: sobject,
      type: 'customMetadataType',
    },
    parseField(fieldName, sobject),
  ]
}

export const parseCustomLabel = (value: string): FormulaIdentifierInfo[] => (
  [
    {
      type: 'customLabel',
      instance: getField(value),
    },
  ]
)

export const parseCustomSetting = (value: string): FormulaIdentifierInfo[] => {
  const [, object, field] = parts(value)

  return [
    {
      type: 'customSetting',
      instance: object,
    },
    parseField(field, object),
  ]
}

export const parseObjectType = (value: string): FormulaIdentifierInfo[] => {
  // value is e.g. $ObjectType.Center__c.Fields.My_text_field__c
  const [, sobject, , fieldName] = parts(value)

  return [
    parseField(fieldName, sobject),
    parseObject(sobject),
  ]
}

const parseFieldIdentifier = (fieldWithPrefix: string, parentObject: string): FormulaIdentifierInfo[] => {
  const field = _.trimStart(fieldWithPrefix, '$')

  const fieldParent = isImplicitReferenceToParentField(field) ? parentObject : getObject(field)

  return [
    parseField(field, fieldParent),
    parseObject(fieldParent),
  ]
}

const parseRelationship = (variableName: string, originalObject: string): FormulaIdentifierInfo[] => {
  const parseRelationshipElement = (field: string,
    index: number,
    fields: string[],
    lastKnownParent: string): {
      lastKnownParent: string
      identifiers: FormulaIdentifierInfo[]
    } => {
    if (isSpecialPrefix(field) || isProcessBuilderIdentifier(field)) {
      return { lastKnownParent, identifiers: [] }
    }

    let baseObject = (index === 0) ? originalObject : canonicalizeProcessBuilderIdentifier(fields[index - 1])

    if (isParent(baseObject) && lastKnownParent !== '') {
      baseObject = lastKnownParent
    }

    let fieldName = createApiName(baseObject, field)

    const isLastField = (fields.length - 1 === index)

    if (!isLastField) {
      if (isStandardRelationship(fieldName)) {
        fieldName = transformToId(fieldName)
      } else {
        // We assume the field ends with '_r'
        fieldName = fieldName.slice(0, -1).concat('c')
      }
    }

    if (isCPQRelationship(fieldName)) {
      fieldName = mapCPQField(fieldName, originalObject)
    }

    if (isUserField(fieldName)) {
      fieldName = transformToUserField(fieldName)
    }

    let updatedLastKnownParent = lastKnownParent
    if (isParentField(fieldName) && lastKnownParent === '') {
      updatedLastKnownParent = baseObject
    } else if (isParentField(fieldName) && lastKnownParent !== '') {
      fieldName = createApiName(lastKnownParent, getField(fieldName))
    }

    return {
      lastKnownParent: updatedLastKnownParent,
      identifiers: parseFieldIdentifier(fieldName, originalObject),
    }
  }

  let lastKnownParent = ''

  return parts(variableName)
    .flatMap((field, index, fields) => {
      const { lastKnownParent: updatedLastKnownParent, identifiers } = parseRelationshipElement(field,
        index, fields, lastKnownParent)
      lastKnownParent = updatedLastKnownParent
      return identifiers
    })
}

export const parseFormulaIdentifier = (variableName: string, originalObject: string): FormulaIdentifierInfo[] => {
  // this order matters, we have to evaluate object types before anything else because the syntax can be extremely
  // similar to other types

  if (isObjectType(variableName)) {
    return parseObjectType(variableName)
  }
  if (isCustomMetadata(variableName)) {
    return parseCustomMetadata(variableName)
  }
  if (isCustomLabel(variableName)) {
    return parseCustomLabel(variableName)
  }
  if (isCustomSetting(variableName)) {
    return parseCustomSetting(variableName)
  }
  if (isRelationshipField(variableName)) {
    return parseRelationship(variableName, originalObject)
  }
  return parseFieldIdentifier(variableName, originalObject)
}
