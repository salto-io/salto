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
import { isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { EMAIL_DOMAIN_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * When deleting an email domain, Okta marks it as deleted instead of removing it. This can cause a merge bug when
 * recreating the email domain with the same name. This filter discards email domains that were deleted.
 */
const filterCreator: FilterCreator = () => ({
  name: 'omitDeletedEmailDomain',
  onFetch: async elements => {
    const deleted = _.remove(
      elements,
      elem =>
        isInstanceElement(elem) &&
        elem.elemID.typeName === EMAIL_DOMAIN_TYPE_NAME &&
        elem.value.validationStatus === 'DELETED',
    )
    log.trace(
      `The following EmailDomain instances were omitted: ${deleted.map(e => e.elemID.getFullName()).join(', ')}`,
    )
  },
})

export default filterCreator
