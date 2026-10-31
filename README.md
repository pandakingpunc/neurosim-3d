# NeuroSim 3D · Interactive Brain & Neuron Firing Simulator

Watch thousands of spiking neurons fire inside a 3D human brain. Stimulate a region, click a spot on the cortex, or switch the whole brain into deep sleep, caffeine, a seizure or anaesthesia and see how activity spreads through the network. Runs in the browser, built with React, TypeScript, three.js (React Three Fiber), Vite and Tailwind. English by default, with a Turkish mode (EN | TR toggle in the header).

**Live demo:** https://pandakingpunc.github.io/neurosim-3d/

## What you can do

- **Explore the brain in 3D:** drag to rotate, scroll to zoom. Seven regions (frontal, parietal, temporal and occipital lobes, limbic system, cerebellum, brainstem) each have their own colour, label and description.
- **Stimulate:** click a neuron for a local stimulus, use ⚡ next to a region, or press **S** to stimulate the whole brain.
- **Mental states:** six presets (resting, focus, deep sleep, caffeine, seizure, anaesthesia) set the neuron parameters in one click.
- **Tune the dynamics:** excitability, synaptic strength, firing threshold, membrane leak, share of inhibitory neurons and refractory period.
- **Rebuild the network:** 400 to 5,000 neurons, 2 to 12 connections per neuron, and a new random wiring on demand.
- **Read the activity:** live spikes per second, active neurons, an EEG-like activity trace and a per-region activity bar.
- **Change the view:** show or hide synapses, signal pulses, the brain shell, labels and individual regions (double-click a region dot to show only that region).

## The model

- Each neuron is a **leaky integrate-and-fire** unit. Its potential decays by the leak each step, sums incoming synaptic input and fires when it crosses the threshold. After a spike it resets and stays refractory for a few steps.
- Neurons fire **spontaneously** with a small probability per step. Brainstem neurons fire three times as often and act as a pacemaker that keeps the cortex active.
- **Synapses** connect each neuron to its k nearest neighbours, plus a few long-range connections (three per brainstem neuron). A spike reaches its target after a delay of 1 to 7 steps that grows with distance, and is drawn as a pulse travelling along the synapse.
- A chosen share of neurons is **inhibitory** (GABAergic): their spikes lower the target's potential instead of raising it.
- At speed 1× the simulation runs 60 steps per second of real time, independent of the screen's refresh rate.

### Simplifications

- This is an educational model, not a biophysical one. Potentials are in model units, not millivolts.
- Neuron counts and region proportions are not to scale. The real cerebellum holds about 80 % of the brain's neurons; here it gets 12 % so the cortex stays visible.
- The thalamus is grouped with the limbic system as one deep region.

## Fixes over the first version

The first version was generated with Claude Fable 5.1 (high effort) through the Anthropic API. It was then reviewed, tested and fixed with [Claude Code](https://claude.com/claude-code). These issues were found and fixed:

- **Most signal pulses were never drawn.** On 1-step synapses (most of them) a pulse was removed in the same step it was created. Pulses now advance before new spikes are emitted.
- **Speed depended on the monitor.** The simulation advanced a fixed number of steps per frame, so it ran 2.4× faster on a 144 Hz screen, and "spikes per second" was really "spikes in the last 60 frames". Both now use real time.
- **Neurons outside the brain shell.** The shell's inner (medial) faces were flattened at the midline but the neurons were not, so neurons of one hemisphere spilled into the other. Both now use the same shape.
- **Region activity bars** were not normalised by region size, so the largest lobe always looked most active. Reset did not clear them either.
- **Clicking a hidden region** still stimulated its invisible neurons.
- **Region labels covered the side panels**, and unmounting them raised a React 19 error.
- **Mobile:** both side panels opened at once and covered the brain. They now start closed and close each other.
- **Keyboard shortcuts** fired with Ctrl/Cmd held (Ctrl+S stimulated the brain) and repeated while Space was held.
- **Content:** the threshold was labelled in mV although it is a model unit, and the cerebellum text said "more than half" of the neurons (it is about 80 %).

## Run

```bash
npm install
npm run dev
```

To build:

```bash
npm run build
```

This produces a single self-contained `dist/index.html` that you can open directly in a browser.

## Controls

| Input | Action |
| --- | --- |
| Drag / scroll | Rotate / zoom |
| Click a neuron | Local stimulus |
| Space | Pause / resume |
| S | Stimulate the whole brain |
| R | Reset the simulation |

Add `?lang=tr` or `?lang=en` to the URL to open in a given language. The choice is remembered in the browser.

## Türkçe

NeuroSim 3D, tarayıcıda çalışan interaktif bir insan beyni ve nöron ateşleme simülatörüdür. Binlerce nöronun 3D beyin içinde ateşlenmesini izler; bir bölgeyi ya da korteksteki bir noktayı uyarır, beyni derin uyku, kafein, nöbet veya anestezi moduna alıp aktivitenin ağda nasıl yayıldığını görürsün. Arayüz varsayılan olarak İngilizcedir; sağ üstteki EN | TR düğmesiyle Türkçeye geçebilirsin. Seçimin tarayıcıda hatırlanır.

## Author

Mustafa Karatüm · ORCID [0009-0006-7053-2872](https://orcid.org/0009-0006-7053-2872)

Citation metadata is in [CITATION.cff](CITATION.cff).

## License

[MIT](LICENSE) © 2026 Mustafa Karatüm
