import { $named, $object, $number, $string } from './schema'
import * as Database from './db'

const $Widget = $named(
  'Widget',
  $object({
    color: $string,
    weight: $number,
  })
)

const q = Database.table($Widget).get((widgets) =>
  widgets
    .where((widget) =>
      widget.color.equals('blue').or(widget.weight.greaterThan(7))
    )
    .orderBy('asc', (widget) => widget.weight)
)

q.then((widgets) => console.log(widgets))
