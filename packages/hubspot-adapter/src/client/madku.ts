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
import {
  RequestPromise,
} from 'requestretry'

export interface Form extends HubspotObjectAPI {
  update(guid: string, data: {}): RequestPromise
}

export interface Workflow extends HubspotObjectAPI {
  get(workflowId: number): RequestPromise
  enroll(workflowId: number, email: string): RequestPromise
  unenroll(workflowId: number, email: string): RequestPromise
}

export interface MarketingEmail extends HubspotObjectAPI {
  update(id: string, data: {}): RequestPromise
}

export interface Contact {
  get(opts?: {}): RequestPromise
  getAll(opts?: {}): RequestPromise
  create(data: {}): RequestPromise
}

export interface HubspotObjectAPI {
  getAll(opts?: {}): RequestPromise
  create(data: {}): RequestPromise
  delete(id: string): RequestPromise
  update?(id: string, data: {}): RequestPromise
}

export default interface Connection {
  forms: Form
  workflows: Workflow
  marketingEmail: MarketingEmail
  contacts: Contact
}
