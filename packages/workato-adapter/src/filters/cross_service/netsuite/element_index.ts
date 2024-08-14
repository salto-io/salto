/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, ElemID, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'

export type NetsuiteIndex = {
  scriptId: Record<string, ElemID>
  type: Record<string, Readonly<ObjectType>>
}

const METADATA_TYPE_ANNOTATION = 'metadataType'
const CUSTOM_RECORD_TYPE = 'customrecordtype'
const CUSTOM_FIELD_PREFIX = 'custom_'

export const indexNetsuiteByTypeAndScriptId = (elements: ReadonlyArray<Readonly<Element>>): NetsuiteIndex => {
  const indexInstancesByScriptId = (): Record<string, ElemID> => {
    const toScriptId = (element: Readonly<Element>): string | undefined =>
      isInstanceElement(element) ? element.value.scriptid : element.annotations.scriptid
    const instances = elements.filter(isInstanceElement)

    const instanceIndex = _.mapValues(
      _.keyBy(
        instances.filter(e => toScriptId(e) !== undefined),
        e => toScriptId(e) as string,
      ),
      e => e.elemID,
    )

    const customRecordTypes = elements
      .filter(isObjectType)
      .filter(element => element.annotations[METADATA_TYPE_ANNOTATION] === CUSTOM_RECORD_TYPE)
    const customRecordTypeIndex = Object.fromEntries(
      customRecordTypes.filter(e => toScriptId(e) !== undefined).map(type => [toScriptId(type), type.elemID]),
    )
    const customRecordTypeNestedFieldIndex = Object.fromEntries(
      customRecordTypes.flatMap(type =>
        Object.values(type.fields)
          .filter(field => field.name.startsWith(CUSTOM_FIELD_PREFIX) && toScriptId(field) !== undefined)
          .map(field => [toScriptId(field), field.elemID]),
      ),
    )

    return {
      ...instanceIndex,
      ...customRecordTypeIndex,
      ...customRecordTypeNestedFieldIndex,
    }
  }

  const indexTypesAndFields = (): Record<string, Readonly<ObjectType>> => {
    const types = elements.filter(isObjectType)
    return _.keyBy(
      // We can use the elem id (and not an apiName / scriptId annotation)
      // as long as we don't support renaming type elem ids
      types,
      e => e.elemID.name.toLowerCase(),
    )
  }

  return {
    scriptId: indexInstancesByScriptId(),
    type: indexTypesAndFields(),
  }
}
