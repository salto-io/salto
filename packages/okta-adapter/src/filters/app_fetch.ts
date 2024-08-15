/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import Joi from 'joi'
import { Element, isInstanceElement, isObjectType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { APPLICATION_TYPE_NAME, ORG_SETTING_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { isCustomApp } from '../definitions/fetch/types/application'

const log = logger(module)

type Application = {
  id: string
  name: string
  signOnMode: string
}

const EXPECTED_APP_SCHEMA = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  signOnMode: Joi.string().required(),
}).unknown(true)

export const isAppResponse = createSchemeGuard<Application>(
  EXPECTED_APP_SCHEMA,
  'Received an invalid application response',
)

/**
 * Handle custom apps and set deployment annotations for `features` field.
 */
const filterCreator: FilterCreator = () => ({
  name: 'appFetchFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    const appInstances = instances.filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    // OrgSetting is settings type
    const orgInstance = instances.find(instance => instance.elemID.typeName === ORG_SETTING_TYPE_NAME)
    const subdomain = orgInstance?.value?.subdomain
    if (!_.isString(subdomain)) {
      log.error('Could not create customName field for custom apps because subdomain was missing')
    }
    appInstances.forEach(app => {
      // create customName field for non-custom apps and delete name field as its value is not multienv
      if (_.isString(subdomain) && isCustomApp(app.value, subdomain)) {
        app.value.customName = app.value.name
        delete app.value.name
      }
      // delete `features` array if it is empty as the field is not deployable
      if (_.isEmpty(app.value.features)) {
        delete app.value.features
      }
    })

    // Set deployment annotations for `features` field which cannot be managed through the API
    const appType = elements.filter(isObjectType).find(type => type.elemID.name === APPLICATION_TYPE_NAME)
    if (appType?.fields.features !== undefined) {
      appType.fields.features.annotations[CORE_ANNOTATIONS.CREATABLE] = false
      appType.fields.features.annotations[CORE_ANNOTATIONS.UPDATABLE] = false
      appType.fields.features.annotations[CORE_ANNOTATIONS.DELETABLE] = false
    }
  },
})

export default filterCreator
