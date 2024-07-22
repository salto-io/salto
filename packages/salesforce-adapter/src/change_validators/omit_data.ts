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
import {
  ChangeValidator,
  ElemID,
  getChangeData,
  ChangeError,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'

const { awu } = collections.asynciterable

const createChangeError = (instanceElemID: ElemID): ChangeError => ({
  elemID: instanceElemID,
  severity: 'Error',
  message:
    "Data instances are not supported when executing a 'validate only' deployment.",
  detailedMessage: `Data instances are not supported when executing a 'validate only' deployment. Therefore, Instance ${instanceElemID.getFullName()} will be omitted from the deployment plan. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058150-data-instances-are-not-supported-in-validation-deployments`,
})

/**
 * Data (CustomObject instances) is deployed although running in Salesforce validation process
 * (salesforce.client.deploy.checkOnly=true)
 */
const createOmitDataValidator: ChangeValidator = async (changes) =>
  awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .map(getChangeData)
    .map((changeInstance) => createChangeError(changeInstance.elemID))
    .toArray()

export default createOmitDataValidator
