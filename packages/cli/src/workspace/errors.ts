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
import { SaltoError } from '@salto-io/adapter-api'
import { validator, errors as wsErrors } from '@salto-io/workspace'
import _ from 'lodash'

const { isUnresolvedRefError } = validator

export const groupRelatedErrors = (
  errors: ReadonlyArray<SaltoError>,
): ReadonlyArray<SaltoError> => {
  const [unresolvedRefs, otherErrors] = _.partition(errors, isUnresolvedRefError)
  const groupedErrors = wsErrors.groupUnresolvedRefsByTarget(unresolvedRefs)
  return [...groupedErrors, ...otherErrors]
}
