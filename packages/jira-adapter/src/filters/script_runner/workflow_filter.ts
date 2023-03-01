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

import { resolveChangeElement, restoreChangeElement, restoreValues, walkOnValue } from '@salto-io/adapter-utils'
import { isInstanceElement, Element, isInstanceChange, isAdditionOrModificationChange, getChangeData, Change, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { decodeDcFields, encodeDcFields } from './workflow_dc'
import { decodeCloudFields, encodeCloudFields } from './workflow_cloud'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

// This filter is used to encode/decode the fields of the workflow transitions for scriptRunner
// There are different decodings for cloud and dc, and the filter encodes back before deploy
const filter: FilterCreator = ({ client, config }) => {
  const originalChanges: Record<string, Change<InstanceElement>> = {}
  return {
    name: 'scriptRunnerWorkflowDcFilter',
    onFetch: async (elements: Element[]) => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(instance => {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
            value: instance.value.transitions,
            func: client.isDataCenter
              ? decodeDcFields
              : decodeCloudFields })
        })
    },
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
        .map(async change => {
          const instance = getChangeData(change)
          originalChanges[instance.elemID.getFullName()] = _.cloneDeep(change)
          instance.value.transitions = getChangeData(
            await resolveChangeElement(change, getLookUpName)
          ).value.transitions
          return instance
        })
        .forEach(instance => {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
            value: instance.value.transitions,
            func: client.isDataCenter
              ? encodeDcFields
              : encodeCloudFields })
        })
    },
    onDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
        .map(getChangeData)
        .forEach(instance => {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
            value: instance.value.transitions,
            func: client.isDataCenter
              ? decodeDcFields
              : decodeCloudFields })
        })
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(async change => {
          const instance = getChangeData(change)
          instance.value.transitions = (getChangeData(
            await restoreChangeElement(
              change,
              originalChanges,
              getLookUpName,
              (source, targetElement, lookUpNameFunc) => restoreValues(
                source,
                targetElement,
                lookUpNameFunc,
              )
            )
          ) as InstanceElement).value.transitions
        })
    },
  }
}

export default filter
