# NeuroSim 3D · Interactive Brain & Neuron Firing Simulator

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23837032.svg)](https://doi.org/10.5281/zenodo.23837032)

Watch thousands of spiking neurons fire inside a 3D human brain. Stimulate a region, click a spot on the cortex, or switch the whole brain into deep sleep, caffeine, a seizure or anaesthesia and see how activity spreads through the network. Record a single neuron like a patch-clamp electrode, let the synapses learn with STDP, cut out a piece of cortex and listen to the spikes. Runs in the browser, built with React, TypeScript, three.js (React Three Fiber), Vite and Tailwind. English by default, with a Turkish mode (EN | TR toggle in the header).

**Live demo:** https://pandakingpunc.github.io/neurosim-3d/

## What you can do

- **Explore the brain in 3D:** drag to rotate, scroll to zoom. Seven regions (frontal, parietal, temporal and occipital lobes, limbic system, cerebellum, brainstem) each have their own colour, label and description.
- **Three click tools** (bottom bar, or keys **1 2 3**):
  - ⚡ **Stimulate:** a local stimulus that spreads outward from the clicked point. Use ⚡ next to a region, or press **S** to stimulate the whole brain.
  - 🔬 **Probe:** record one neuron. A live oscilloscope shows its membrane potential, its spikes and its moving threshold, plus its region, type (excitatory or inhibitory), inputs, outputs and learned input weight. Inject current into it with one button. Its synapses light up in cyan in 3D.
  - ✂ **Lesion:** silence the neurons around the clicked point, like a small stroke, and watch how activity reroutes. **Heal all** brings them back.
- **Learn (STDP):** switch on synaptic learning and stimulate the same spot a few times. Synapses that carry the signal outward get stronger and glow white; the ones pointing back weaken. Unused changes fade over about a minute, or clear them with **Forget learning**.
- **Listen:** press **M** or 🔈 to hear the spikes as clicks, like an electrophysiology amplifier. The probed neuron has its own deeper click.
- **Mental states:** six presets (resting, focus, deep sleep, caffeine, seizure, anaesthesia) set the neuron parameters in one click.
- **Tune the dynamics:** excitability, synaptic strength, firing threshold, membrane leak, share of inhibitory neurons and refractory period.
- **Rebuild the network:** 400 to 5,000 neurons, 2 to 12 connections per neuron, and a new random wiring on demand.
- **Read the activity:** live spikes per second, active neurons, an EEG-like activity trace, a spike raster (one row per neuron, sorted by region) and a per-region activity bar.
- **Change the view:** show or hide synapses, signal pulses, the brain shell, labels and individual regions (double-click a region dot to show only that region).

## The model

- Each neuron is a **leaky integrate-and-fire** unit. Its potential decays by the leak each step, sums incoming synaptic input and fires when it crosses the threshold. After a spike it resets and stays refractory for a few steps.
- **Spike-frequency adaptation:** each spike raises the neuron's threshold for a while, and the extra threshold decays with a time constant of 30 to 60 steps. Awake states keep it at zero (acetylcholine suppresses these currents in the waking brain). In deep sleep it is strong: bursts of activity (up states) sweep the cortex as travelling waves until the neurons tire, then the network falls silent (down states) and recovers. In the seizure preset, fast and strong adaptation breaks the runaway firing into rhythmic hypersynchronous bursts.
- **STDP (optional):** when a signal arrives up to 20 steps before its target fires, the synapse is strengthened; when it arrives after the target has fired, it is weakened. Both changes shrink exponentially with the time gap (time constant 6 steps). Weights stay between 0 and 3× and slowly relax back to 1 (forgetting). Depression is slightly stronger than potentiation and only excitatory synapses learn, so the network stays stable in every preset.
- **Local stimulus:** neurons at the centre of a click fire first and the outer shell 1 to 3 steps later, like activity spreading from an electrode. With STDP on, repeated stimulation therefore strengthens outward connections and weakens inward ones.
- **Lesions:** lesioned neurons never fire and ignore their input. Their synapses disappear from the view.
- Neurons fire **spontaneously** with a small probability per step. Brainstem neurons fire three times as often and act as a pacemaker that keeps the cortex active.
- **Synapses** connect each neuron to its k nearest neighbours, plus a few long-range connections (three per brainstem neuron). A spike reaches its target after a delay of 1 to 7 steps that grows with distance, and is drawn as a pulse travelling along the synapse.
- A chosen share of neurons is **inhibitory** (GABAergic): their spikes lower the target's potential instead of raising it.
- At speed 1× the simulation runs 60 steps per second of real time, independent of the screen's refresh rate.

### Simplifications

- This is an educational model, not a biophysical one. Potentials are in model units, not millivolts.
- Neuron counts and region proportions are not to scale. The real cerebellum holds about 80 % of the brain's neurons; here it gets 12 % so the cortex stays visible.
- The thalamus is grouped with the limbic system as one deep region.

## What's new in 1.1

- **Deep sleep and seizure now behave as described.** In 1.0 the deep-sleep preset only produced sparse noise, and the seizure preset sat at a constant saturation with a third of all neurons firing every step. Adding spike-frequency adaptation gives real slow waves (up and down states) in sleep and rhythmic bursts in a seizure. The presets were re-tuned by measuring the population rate and its rhythm in a headless run of the model.
- **Neuron probe** with a live membrane-potential and threshold trace.
- **Synaptic learning (STDP)**, drawn on the synapses in 3D.
- **Lesion tool** with a heal button.
- **Spike raster** next to the EEG-like trace.
- **Spike sound.**
- **Adaptation slider** in Neuron Dynamics.
- The bottom bar wraps on phones instead of running off the screen, and the page has a favicon.

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
| Click the brain | Use the selected tool (stimulate, probe or lesion) |
| 1 / 2 / 3 | Stimulate / Probe / Lesion tool |
| M | Sound on / off |
| Space | Pause / resume |
| S | Stimulate the whole brain |
| R | Reset the simulation |

Add `?lang=tr` or `?lang=en` to the URL to open in a given language. The choice is remembered in the browser.

## Türkçe

NeuroSim 3D, tarayıcıda çalışan interaktif bir insan beyni ve nöron ateşleme simülatörüdür. Binlerce nöronun 3D beyin içinde ateşlenmesini izler; bir bölgeyi ya da korteksteki bir noktayı uyarır, beyni derin uyku, kafein, nöbet veya anestezi moduna alıp aktivitenin ağda nasıl yayıldığını görürsün. 1.1 sürümüyle tek bir nöronu prob ile kaydedebilir (canlı membran potansiyeli), sinapsların STDP ile öğrenmesini izleyebilir, lezyon aracıyla korteksin bir parçasını susturabilir ve ateşlemeleri ses olarak dinleyebilirsin. Derin uyku artık gerçek yavaş dalgalar, nöbet ise ritmik patlamalar üretiyor. Arayüz varsayılan olarak İngilizcedir; sağ üstteki EN | TR düğmesiyle Türkçeye geçebilirsin. Seçimin tarayıcıda hatırlanır.

## Author

Mustafa Karatüm · ORCID [0009-0006-7053-2872](https://orcid.org/0009-0006-7053-2872)

## Citation

If you use NeuroSim 3D, please cite it through Zenodo:

> Karatüm, M. (2026). *NeuroSim 3D: Interactive Brain & Neuron Firing Simulator* (v1.0.0). Zenodo. https://doi.org/10.5281/zenodo.23837033

The concept DOI [10.5281/zenodo.23837032](https://doi.org/10.5281/zenodo.23837032) always points to the latest version. Citation metadata is in [CITATION.cff](CITATION.cff).

## License

[MIT](LICENSE) © 2026 Mustafa Karatüm
