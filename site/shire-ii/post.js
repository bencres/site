// A post: the same season and light as the hill you came from, and its sketch.
import { mount } from '../shared/rive-mount.js';
import { SEASONS, TIMES, when, remembered } from './when.js';

const state = remembered() || when();
document.documentElement.dataset.season = SEASONS[state.season];
document.documentElement.dataset.time = TIMES[state.time];

const sketch = document.getElementById('sketch');
if (sketch) mount(sketch, { src: 'sketches', artboard: sketch.dataset.artboard, fit: 'contain' });
