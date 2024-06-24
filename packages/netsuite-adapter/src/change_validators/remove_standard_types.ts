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
import { isRemovalChange, getChangeData } from '@salto-io/adapter-api'
import { isStandardTypeName } from '../autogen/types'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: "Can't remove elements without the Salto SuiteApp configured",
      detailedMessage: `Removal of ${isStandardTypeName(elemID.typeName) ? 'standard' : 'custom record'} type ${elemID.idType}s is only supported. Contact us to configure Salto SuiteApp`,
    }))

export default changeValidator
