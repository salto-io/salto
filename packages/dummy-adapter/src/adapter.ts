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
  FetchResult,
  AdapterOperations,
  DeployResult,
  FetchOptions,
  DeployOptions,
  DeployModifiers,
  getChangeData,
  isInstanceElement,
  FixElementsFunc,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { generateElements, GeneratorParams } from './generator'
import { changeValidator } from './change_validator'

export default class DummyAdapter implements AdapterOperations {
  public constructor(private genParams: GeneratorParams) {}

  /**
   * Fetch configuration elements: objects, types and instances for the given HubSpot account.
   * Account credentials were given in the constructor.
   */
  public async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    return {
      elements: await generateElements(this.genParams, progressReporter),
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    changeGroup.changes
      .map(getChangeData)
      .filter(isInstanceElement)
      .forEach(instance => {
        instance.value = _.omit(instance.value, this.genParams.fieldsToOmitOnDeploy ?? [])
      })

    return {
      appliedChanges: changeGroup.changes,
      errors: [],
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public async validate({ changeGroup }: DeployOptions): Promise<DeployResult> {
    return {
      appliedChanges: changeGroup.changes,
      errors: [],
    }
  }

  public deployModifiers: DeployModifiers = {
    changeValidator: changeValidator(this.genParams),
  }

  fixElements: FixElementsFunc = async elements => {
    const fullInst1 = elements.find(e => e.elemID.getFullName() === 'dummy.Full.instance.FullInst1')
    if (!isInstanceElement(fullInst1)) {
      return { fixedElements: [], errors: [] }
    }

    if (fullInst1.value.strField === undefined) {
      return { fixedElements: [], errors: [] }
    }

    const clonedInstance = fullInst1.clone()
    delete clonedInstance.value.strField

    return {
      fixedElements: [clonedInstance],
      errors: [
        {
          message: 'Fixed instance',
          detailedMessage: 'Removed strField from instance',
          severity: 'Info',
          elemID: fullInst1.elemID,
        },
      ],
    }
  }
}
