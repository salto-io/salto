import _ from 'lodash'
import { EventType, Event } from './events'

class EventGate {
  private static events: Event[] = []
  
  static report(event: Event): void {
    this.events.push(event)
  }

  static consume(...filter: EventType[]): Event[] {
    return _.remove(this.events, e => filter.length === 0 || filter.includes(e.type))
  }
}

export default EventGate
