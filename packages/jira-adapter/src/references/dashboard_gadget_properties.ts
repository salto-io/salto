/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc, createSchemeGuard, resolvePath } from '@salto-io/adapter-utils'
import { FILTER_TYPE_NAME, PROJECT_TYPE } from '../constants'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

const FILTER_PREFIX = 'filter-'
const PROJECT_PREFIX = 'project-'

type GadgetValue = {
  key: string
  value: string
}

const GADGET_VALUE_SCHEME = Joi.object({
  key: Joi.string().allow('').required(),
  value: Joi.string().allow('').required(),
}).unknown(true)

const isGadgetObject = createSchemeGuard<GadgetValue>(GADGET_VALUE_SCHEME)

export const gadgetValuesContextFunc: referenceUtils.ContextFunc = async ({ instance, fieldPath }) => {
  if (fieldPath === undefined) {
    return undefined
  }
  const contextObject = resolvePath(instance, fieldPath.createParentID())
  if (!isGadgetObject(contextObject)) {
    return undefined
  }
  const { key, value } = contextObject
  switch (key) {
    case 'ystattype':
    case 'xstattype':
    case 'statistictype':
    case 'statType':
      return FIELD_TYPE_NAME
    case 'filterId':
      return FILTER_TYPE_NAME
    case 'projectOrFilterId':
      return _.startsWith(value, PROJECT_PREFIX) ? PROJECT_TYPE : FILTER_TYPE_NAME
    default:
      return undefined
  }
}

export const gadgetValueSerialize: GetLookupNameFunc = ({ ref, path, element }) => {
  if (path === undefined) {
    return ref.value.value.id
  }
  if (ref.elemID.typeName === PROJECT_TYPE) {
    return PROJECT_PREFIX.concat(ref.value.value.id)
  }
  if (ref.elemID.typeName === FILTER_TYPE_NAME) {
    const contextObject = resolvePath(element, path.createParentID())
    // The first condition is needed for deploy, as contextObject.value is a reference expression
    // The second condition is needed for fetch
    return contextObject?.key === 'projectOrFilterId' ||
      (_.isString(contextObject?.value) && _.startsWith(contextObject?.value, FILTER_PREFIX))
      ? FILTER_PREFIX.concat(ref.value.value.id)
      : ref.value.value.id
  }
  return ref.value.value.id
}

export const gadgetDashboradValueLookup: referenceUtils.LookupFunc = val => {
  if (_.isString(val)) {
    if (val.startsWith(FILTER_PREFIX)) {
      return val.slice(FILTER_PREFIX.length)
    }
    if (val.startsWith(PROJECT_PREFIX)) {
      return val.slice(PROJECT_PREFIX.length)
    }
  }
  return val
}
