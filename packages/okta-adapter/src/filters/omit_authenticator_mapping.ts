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
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PROFILE_MAPPING_TYPE_NAME } from '../constants'

const log = logger(module)

const OKTA_AUTHENTICATOR_APP_NAME = 'Okta_Authenticator'

const isMappingToAuthenticatorApp = (instance: InstanceElement): boolean => {
  const { source, target } = instance.value
  return (
    (source?.name === OKTA_AUTHENTICATOR_APP_NAME && source?.type === 'appuser') ||
    (target?.name === OKTA_AUTHENTICATOR_APP_NAME && target?.type === 'appuser')
  )
}

/**
 * Omit profile mapping instances that maps to Okta_Authenticator application,
 * Okta_Authenticator is an internal Okta app and its mapping cannot be managed
 */
const filterCreator: FilterCreator = () => ({
  name: 'omitAuthenticatorMappingFilter',
  onFetch: async (elements: Element[]) => {
    const instancesToOmit = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROFILE_MAPPING_TYPE_NAME)
      .filter(isMappingToAuthenticatorApp)
    _.pullAll(elements, instancesToOmit)
    log.trace(
      `The following ProfileMapping instances were omitted: ${instancesToOmit.map(inst => inst.elemID.name).join(', ')}`,
    )
  },
})

export default filterCreator
