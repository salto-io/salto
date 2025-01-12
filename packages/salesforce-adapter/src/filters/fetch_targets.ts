/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element, ElemID, InstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  apiNameSync,
  ensureSafeFilterFetch,
  isCustomObjectSync,
  metadataTypeOrUndefined,
  referenceFieldTargetTypes,
} from './utils'
import { FilterCreator } from '../filter'
import {
  ArtificialTypes,
  CUSTOM_OBJECTS_FIELD,
  CUSTOM_OBJECTS_LOOKUPS_FIELD,
  FETCH_TARGETS,
  METADATA_TYPES_FIELD,
  RECORDS_PATH,
  SALESFORCE,
  SETTINGS_PATH,
} from '../constants'

const { isDefined } = values

const getCustomObjectLookupTypes = (customObject: ObjectType): string[] =>
  _.uniq(Object.values(customObject.fields).flatMap(referenceFieldTargetTypes))

export type SalesforceFetchTargets = {
  [METADATA_TYPES_FIELD]: ReadonlyArray<string>
  [CUSTOM_OBJECTS_FIELD]: ReadonlyArray<string>
  [CUSTOM_OBJECTS_LOOKUPS_FIELD]: Record<string, readonly string[]>
}

const createFetchTargetsValue = (elements: Element[]): SalesforceFetchTargets => {
  const customObjects = elements.filter(isCustomObjectSync)
  const customObjectNames: string[] = []
  const customObjectsLookups: Record<string, string[]> = {}
  customObjects.forEach(customObject => {
    const objectApiName = apiNameSync(customObject)
    if (objectApiName === undefined) {
      return
    }
    customObjectNames.push(objectApiName)
    const customObjectLookupTypes = getCustomObjectLookupTypes(customObject)
    if (customObjectLookupTypes.length > 0) {
      customObjectsLookups[objectApiName] = customObjectLookupTypes
    }
  })
  return {
    [METADATA_TYPES_FIELD]: _.uniq(elements.filter(isObjectType).map(metadataTypeOrUndefined).filter(isDefined)),
    [CUSTOM_OBJECTS_FIELD]: customObjectNames,
    [CUSTOM_OBJECTS_LOOKUPS_FIELD]: customObjectsLookups,
  }
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'fetchTargetsFilter',
  remote: true,
  onFetch: ensureSafeFilterFetch({
    filterName: 'extendFetchTargets',
    warningMessage: 'Error occurred when attempting to populate Fetch Targets',
    config,
    fetchFilterFunc: async elements => {
      if (config.fetchProfile.metadataQuery.isPartialFetch()) {
        return
      }
      elements.push(
        new InstanceElement(
          ElemID.CONFIG_NAME,
          ArtificialTypes.FetchTargets,
          createFetchTargetsValue(elements),
          [SALESFORCE, RECORDS_PATH, SETTINGS_PATH, FETCH_TARGETS],
          {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
      )
    },
  }),
})

export default filterCreator
