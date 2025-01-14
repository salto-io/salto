/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { isInstanceElement, ReferenceExpression, isReferenceExpression } from '@salto-io/adapter-api'
import Joi from 'joi'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME } from '../fields/constants'
import { OBJECT_SCHEMA_TYPE } from '../../constants'

const { makeArray } = collections.array

const ATTRIBUTES_INCLUDED_IN_AUTO_COMPLETE_SEARCH = 'attributesIncludedInAutoCompleteSearch'
const ATTRIBUTES_DISPLAYED_ON_ISSUE = 'attributesDisplayedOnIssue'

type OBJECT_TYPE_ATTRIBUTE_FILED_NAMES =
  | typeof ATTRIBUTES_INCLUDED_IN_AUTO_COMPLETE_SEARCH
  | typeof ATTRIBUTES_DISPLAYED_ON_ISSUE

type assetObjectFieldConfiguration = {
  objectSchemaId: ReferenceExpression
  attributesIncludedInAutoCompleteSearch?: (string | ReferenceExpression)[]
  attributesDisplayedOnIssue?: (string | ReferenceExpression)[]
}

const ASSETS_OBJECT_FIELD_CONFIGURATION_SCHEME = Joi.object({
  objectSchemaId: Joi.object().required(),
  attributesIncludedInAutoCompleteSearch: Joi.array().items(Joi.alternatives(Joi.object(), Joi.string())),
  attributesDisplayedOnIssue: Joi.array().items(Joi.alternatives(Joi.object(), Joi.string())),
}).unknown(true)

const isAssetsObjectFieldConfiguration = createSchemeGuard<assetObjectFieldConfiguration>(
  ASSETS_OBJECT_FIELD_CONFIGURATION_SCHEME,
  'Received an invalid assets object field configuration',
)

const getObjectTypeAttributeReferences = (
  assetsObjectFieldConfiguration: assetObjectFieldConfiguration,
  objectSchemaToAttributesReferenceByName: Record<string, Record<string, ReferenceExpression>>,
  field: 'attributesIncludedInAutoCompleteSearch' | 'attributesDisplayedOnIssue',
): (ReferenceExpression | string)[] =>
  makeArray(assetsObjectFieldConfiguration[field])
    .filter(_.isString)
    .map(attributeName => {
      const objectSchemaFullName = assetsObjectFieldConfiguration.objectSchemaId.elemID.getFullName()
      const attributeReference = objectSchemaToAttributesReferenceByName[objectSchemaFullName]?.[attributeName]
      return isReferenceExpression(attributeReference) ? attributeReference : attributeName
    })

/* 
This filter is responsible for creating references from the field context of `assetsObjectField`
to `ObjectTypeAttribute` instances. 
We create these references here because the uniqueness of ObjectTypeAttribute is determined by a combination of objectSchema, objectType and the attribute name.
We can describe the relation between the elements as follows:
ObjectSchema -> ObjectType[] -> ObjectTypeAttribute[]
*/
const filter: FilterCreator = ({ config }) => ({
  name: 'assetsObjectFieldConfigurationReferencesFilter',
  onFetch: async elements => {
    if (!config.fetch.enableAssetsObjectFieldConfiguration) {
      return
    }
    const objectSchemaToAttributeReferenceByName = Object.fromEntries(
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === OBJECT_SCHEMA_TYPE)
        .map(instance => [
          instance.elemID.getFullName(),
          _.keyBy(instance.value.attributes, ref => ref.value.value.name), // Transform attributes array to a record keyed by 'name'
        ]),
    )

    const assetObjectFieldContexts = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => instance.value.assetsObjectFieldConfiguration !== undefined)

    assetObjectFieldContexts.forEach(contextInstance => {
      if (!isAssetsObjectFieldConfiguration(contextInstance.value.assetsObjectFieldConfiguration)) {
        return
      }

      const objectTypeAttributeFieldNames: OBJECT_TYPE_ATTRIBUTE_FILED_NAMES[] = [
        ATTRIBUTES_INCLUDED_IN_AUTO_COMPLETE_SEARCH,
        ATTRIBUTES_DISPLAYED_ON_ISSUE,
      ]

      objectTypeAttributeFieldNames.forEach(field => {
        if (_.isEmpty(contextInstance.value.assetsObjectFieldConfiguration[field])) {
          return
        }
        contextInstance.value.assetsObjectFieldConfiguration[field] = getObjectTypeAttributeReferences(
          contextInstance.value.assetsObjectFieldConfiguration,
          objectSchemaToAttributeReferenceByName,
          field,
        )
      })
    })
  },
})
export default filter
