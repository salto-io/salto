/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ActionName } from '@salto-io/adapter-api'

export type DeploymentAnnotation = 'creatable' | 'updatable' | 'deletable'

export const DEPLOYMENT_ANNOTATIONS: Record<string, DeploymentAnnotation> = {
  CREATABLE: 'creatable',
  UPDATABLE: 'updatable',
  DELETABLE: 'deletable',
}

export const OPERATION_TO_ANNOTATION: Record<ActionName, DeploymentAnnotation> = {
  add: DEPLOYMENT_ANNOTATIONS.CREATABLE,
  modify: DEPLOYMENT_ANNOTATIONS.UPDATABLE,
  remove: DEPLOYMENT_ANNOTATIONS.DELETABLE,
}
