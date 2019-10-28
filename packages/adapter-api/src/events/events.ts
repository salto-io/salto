export type EventType = ApiEvent.TYPE

export interface Event {
  type: EventType
}

export class ApiEvent implements Event {
  public static TYPE = 'API'
  readonly type: string

  constructor(public readonly apiCall: string, public readonly counter: number) {
    this.type = ApiEvent.TYPE
  }
}
