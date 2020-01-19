import {
  RequestPromise,
} from 'requestretry'

export interface Form extends HubspotObjectAPI {
  update(guid: string, data: {}): RequestPromise
  delete(guid: string): RequestPromise
}

export interface Workflow extends HubspotObjectAPI {
  enroll(workflowId: number, email: string): RequestPromise
  unenroll(workflowId: number, email: string): RequestPromise
  delete(workflowId: string): RequestPromise
}

export interface MarketingEmail extends HubspotObjectAPI {
  update(id: string, data: {}): RequestPromise
  delete(id: string): RequestPromise
}

export interface Contact extends HubspotObjectAPI {
  get(opts?: {}): RequestPromise
}

export interface HubspotObjectAPI {
  getAll(opts?: {}): RequestPromise
  create(data: {}): RequestPromise
}
export default interface Connection {
  forms: Form
  workflows: Workflow
  marketingEmail: MarketingEmail
  contacts: Contact
}
