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
import {
  ChangeValidator,
  getChangeData,
  isModificationChange,
  isInstanceChange,
  getAllChangeData,
} from '@salto-io/adapter-api'
import { DOMAIN_TYPE_NAME } from '../constants'

export const domainModificationValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === DOMAIN_TYPE_NAME)
    .map(getAllChangeData)
    .filter(([before, after]) => !_.isEqual(_.omit(before.value, 'brandId'), _.omit(after.value, 'brandId')))
    .map(([instance]) => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot modify any domain fields except its brand',
      detailedMessage: `Domain ${instance.value.domain} can only modify its brand.`,
    }))
