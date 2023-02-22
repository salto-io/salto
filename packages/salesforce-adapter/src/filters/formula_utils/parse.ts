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
import { logger } from '@salto-io/logging'
import {
  isCPQRelationship, isCustom, isCustomLabel, isCustomMetadata, isCustomSetting, isObjectType, isParent, isParentField,
  isProcessBuilderIdentifier, isRelationshipField, isSpecialPrefix, isStandardRelationship, isUserField,
} from './grammar'
import {
  createApiName, getField, getObject, parts, canonicalizeProcessBuilderIdentifier, transformToId,
  transformToUserField,
} from './utils'
import { mapCPQField } from './cpq'

const log = logger(module)

export type IdentifierType = 'customField'|'standardField'|'customObject'|'standardObject'|'customLabel'
  |'customSetting'|'customMetadataTypeRecord'|'customMetadataType'|'unknownRelationship'

export type FormulaIdentifierInfo = {
  type: IdentifierType
  instance: string
}

export const parseField = (value: string, object?: string): FormulaIdentifierInfo => {
  let actualValue = value
  if (!value.includes('.')) {
    if (object === undefined) {
      log.error('In a formula field, there`s an identifier that seems to implicitly refer to a field in the parent object, but no parent object was passed to the parsing function.This should not happen!')
    } else {
      actualValue = createApiName(object, value)
    }
  }

  return {
    type: (isCustom(actualValue) ? 'customField' : 'standardField'),
    instance: actualValue,
  }
}

export const parseObject = (object: string): FormulaIdentifierInfo => {
  let type: IdentifierType = 'standardObject'

  if (isCustom(object)) {
    type = 'customObject'
  } else if (isCustomMetadata(object)) {
    type = 'customMetadataType'
  } else if (!isStandardRelationship(object)) {
    type = 'unknownRelationship'
  }

  return {
    type,
    instance: object,
  }
}

export const parseCustomMetadata = (value: string): FormulaIdentifierInfo[] => {
  // $CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c
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

export const parseCustomLabel = (value: string): FormulaIdentifierInfo => (
  {
    type: 'customLabel',
    instance: getField(value),
  }
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
  // $ObjectType.Center__c.Fields.My_text_field__c
  const [, sobject, , fieldName] = parts(value)

  return [
    parseField(fieldName, sobject),
    parseObject(sobject),
  ]
}

export const parseFormulaIdentifier = (variableName: string, originalObject: string): FormulaIdentifierInfo[] => {
  const types: FormulaIdentifierInfo[] = []

  const parseFieldIdentifier = (fieldWithPrefix: string, object: string): void => {
    const field = fieldWithPrefix.startsWith('$') ? fieldWithPrefix.substring(1) : fieldWithPrefix

    // i.e Account.Industry
    if (parts(field).length === 2) {
      types.push(parseField(field))
      types.push(parseObject(getObject(field)))
    } else {
      // i.e Name
      types.push(parseField(createApiName(object, field)))
      types.push(parseObject(object))
    }
  }

  // this order matters, we have to evaluate object types before anything else because the syntax can be extremely
  // similar to other types

  if (isObjectType(variableName)) {
    types.push(...parseObjectType(variableName))
  } else if (isCustomMetadata(variableName)) {
    types.push(...parseCustomMetadata(variableName))
  } else if (isCustomLabel(variableName)) {
    types.push(parseCustomLabel(variableName))
  } else if (isCustomSetting(variableName)) {
    types.push(...parseCustomSetting(variableName))
  } else if (isRelationshipField(variableName)) {
    let lastKnownParent = ''

    parts(variableName).forEach((field, index, fields) => {
      if (isSpecialPrefix(field) || isProcessBuilderIdentifier(field)) return

      const isLastField = (fields.length - 1 === index)

      let baseObject
      if (index === 0) {
        baseObject = originalObject
      } else {
        baseObject = fields[index - 1]

        if (isProcessBuilderIdentifier(baseObject)) {
          baseObject = canonicalizeProcessBuilderIdentifier(baseObject)
        }
      }

      if (isParent(baseObject) && lastKnownParent !== '') {
        baseObject = lastKnownParent
      }

      let fieldName = createApiName(baseObject, field)

      if (!isLastField) {
        if (isStandardRelationship(fieldName)) {
          fieldName = transformToId(fieldName)
        } else {
          fieldName = fieldName.slice(0, -1).concat('c')
        }
      }

      if (isCPQRelationship(fieldName)) {
        fieldName = mapCPQField(fieldName, originalObject)
      }

      if (isUserField(fieldName)) {
        fieldName = transformToUserField(fieldName)
      }

      if (isParentField(fieldName) && lastKnownParent === '') {
        lastKnownParent = baseObject
      } else if (isParentField(fieldName) && lastKnownParent !== '') {
        fieldName = createApiName(lastKnownParent, getField(fieldName))
      }

      parseFieldIdentifier(fieldName, originalObject)
    })
  } else {
    parseFieldIdentifier(variableName, originalObject)
  }

  return types
}
