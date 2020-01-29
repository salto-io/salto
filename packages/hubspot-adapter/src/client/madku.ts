import {
  RequestPromise,
} from 'requestretry'

export interface Form extends HubspotObjectAPI {
  update(guid: string, data: {}): RequestPromise
}

export interface Workflow extends HubspotObjectAPI {
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
