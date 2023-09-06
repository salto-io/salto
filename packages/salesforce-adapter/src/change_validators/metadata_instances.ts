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
import {
  ChangeValidator,
  getChangeData,
  Element,
  ChangeError, isObjectType,
} from '@salto-io/adapter-api'
import { API_NAME, CUSTOM_FIELD, CUSTOM_OBJECT, METADATA_TYPE } from '../constants'
import { metadataType } from '../transformers/transformer'


const createElementWithNoApiNameError = ({ elemID }: Element): ChangeError => ({
  message: 'Element has no API name',
  detailedMessage: `The Element ${elemID.getFullName()} has no API name`,
  elemID,
  severity: 'Error',
})


const changeValidator: ChangeValidator = async changes => {
  const errors = changes
    .map(getChangeData)
}

export default changeValidator
