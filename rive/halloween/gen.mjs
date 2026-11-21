// Halloween · Mordor, painted by the same hand as Shire II with the Shire swapped for
// Gorgoroth. Two takes made one: the Hill is tower.mjs (Barad-dûr over the ash plain,
// the Eye at its top following the visitor, Orodruin smoking, the orc camp, Nazgûl);
// the Gate is lair.mjs (Torech Ungol: Shelob's webbed tunnel mouth, her eyes in the
// dark, Gollum behind his boulder). Each file's header lists its artboard's inputs.
import { Ids, document } from '../lib/ink.mjs';
import { paintHill } from './tower.mjs';
import { paintGate } from './lair.mjs';

export default function () {
  const ids = new Ids(10);
  return document(paintHill(ids), paintGate(ids));
}
