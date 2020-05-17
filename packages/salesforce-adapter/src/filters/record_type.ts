/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'
import { Element, ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { findInstances } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { apiName } from '../transformers/transformer'
import { FilterWith } from '../filter'
import { instanceParent, parentApiNameToMetadataTypeInstances, relativeApiName } from './utils'
import { SALESFORCE, BUSINESS_PROCESS_METADATA_TYPE, RECORD_TYPE_METADATA_TYPE } from '../constants'

const log = logger(module)

const BUSINESS_PROCESS = 'businessProcess'

/**
* This filter change RecordType logical references to business process to Salto references
*/
const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const parentToBusinessProcesses = parentApiNameToMetadataTypeInstances(
      elements, BUSINESS_PROCESS_METADATA_TYPE
    )

    wu(findInstances(elements, new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE)))
      .forEach(record => {
        const customObject = instanceParent(record)?.getFullName()
        if (_.isUndefined(customObject)) {
          log.warn('failed to find custom object for record type %s', apiName(record))
          return
        }
        const businessProcess = parentToBusinessProcesses[customObject]
          ?.find(process => relativeApiName(process) === record.value[BUSINESS_PROCESS])
        if (businessProcess) {
          record.value[BUSINESS_PROCESS] = new ReferenceExpression(businessProcess.elemID)
        } else if (record.value[BUSINESS_PROCESS]) {
          log.warn('failed to find business process %s', record.value[BUSINESS_PROCESS])
        }
      })
  },
})

export default filterCreator
