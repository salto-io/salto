/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { createSchemeGuard, getParent } from '@salto-io/adapter-utils'
import { values, collections } from '@salto-io/lowerdash'
import { isInstanceElement, InstanceElement, ReferenceExpression, isReferenceExpression } from '@salto-io/adapter-api'
import Joi from 'joi'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME } from '../fields/constants'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE } from '../../constants'

const { isDefined } = values
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

const createObjectTypeAttributeReferences = (
  assetsObjectFieldConfiguration: assetObjectFieldConfiguration,
  objectSchemaToAttributesByName: Record<string, Record<string, InstanceElement>>,
  field: 'attributesIncludedInAutoCompleteSearch' | 'attributesDisplayedOnIssue',
): (ReferenceExpression | string)[] =>
  makeArray(assetsObjectFieldConfiguration[field])
    .filter(_.isString)
    .map(attributeName => {
      const objectSchemaFullName = assetsObjectFieldConfiguration.objectSchemaId.elemID.getFullName()
      const attributeInstance = objectSchemaToAttributesByName[objectSchemaFullName]?.[attributeName]
      if (isInstanceElement(attributeInstance)) {
        return new ReferenceExpression(attributeInstance.elemID, attributeInstance)
      }
      return attributeName
    })
    .filter(isDefined)

/* 
This filter is responsible for creating references from the field context of `assetsObjectField`
to `ObjectTypeAttribute` instances. 
We create these references here because the uniqueness of ObjectTypeAttribute is determined by a combination of objectSchema, objectType and the attribute name.
We can describe the relation between the elements as follows:
ObjectSchema -> ObjectType[] -> ObjectTypeAttribute[]
ObjectTypeAttribute has a field called objectType, which is a reference to an ObjectType.
ObjectType's parent is a reference to ObjectSchema.
*/
const filter: FilterCreator = ({ config }) => ({
  name: 'assetsObjectFieldConfigurationReferencesFilter',
  onFetch: async elements => {
    if (!config.fetch.enableAssetsObjectFieldConfiguration) {
      return
    }

    const objectTypeAttributes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE)
      .filter(instance => isReferenceExpression(instance.value.objectType))

    const objectTypeAttributesByObjectType = _.groupBy(objectTypeAttributes, attribute =>
      attribute.value.objectType.elemID.getFullName(),
    )

    const objectSchemaToObjectTypes = _.groupBy(
      elements.filter(isInstanceElement).filter(instance => instance.elemID.typeName === OBJECT_TYPE_TYPE),
      objectType => getParent(objectType).elemID.getFullName(),
    )

    const objectSchemaToAttributesByName = _.mapValues(objectSchemaToObjectTypes, objectTypes =>
      _.keyBy(
        objectTypes
          .flatMap(objectType => objectTypeAttributesByObjectType[objectType.elemID.getFullName()])
          .filter(isInstanceElement),
        attributeInstance => attributeInstance.value.name as string,
      ),
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
        contextInstance.value.assetsObjectFieldConfiguration[field] = createObjectTypeAttributeReferences(
          contextInstance.value.assetsObjectFieldConfiguration,
          objectSchemaToAttributesByName,
          field,
        )
      })
    })
  },
})
export default filter
