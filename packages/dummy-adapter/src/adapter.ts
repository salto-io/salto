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
  FetchResult, AdapterOperations, DeployResult, FetchOptions,
  DeployOptions, DeployModifiers,
} from '@salto-io/adapter-api'
import { generateElements, GeneratorParams } from './generator'
import { changeValidator } from './change_validator'

export default class DummyAdapter implements AdapterOperations {
  public constructor(private genParams: GeneratorParams) {
  }

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


  public deployModifiers: DeployModifiers =
  {
    changeValidator: changeValidator(this.genParams),
  }
}
