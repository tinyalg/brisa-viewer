# Active Settings Viewer for Aerophone Brisa

A web-based SysEx monitor and active parameter visualizer for the Roland Aerophone Brisa (AE-BRISA).
Try it here: [https://brisa-viewer.tinyalg.com](https://brisa-viewer.tinyalg.com)

## About the Aerophone Brisa
The Roland Aerophone Brisa (AE-BRISA) is a digital wind instrument that features a traditional flute-style key layout and a dedicated sound engine for realistic wind articulations. While it provides highly expressive playing experiences and deep customization options, its intricate internal parameter routing can be challenging to manage through the device's screen alone.

## What is this tool?
This is a single-page web application that connects to your Aerophone Brisa via Web MIDI API. It reads the internal system and tone data (SysEx) and displays exactly which parameters are currently active.

## Why is it needed?
While Roland's official "Aerophone Brisa Plus" app provides great access to the System Common settings, it leaves the Tone-specific parameters and the complex priority routing (System vs. Tone) completely invisible. 

For example, you might change an assign setting in the official app, only to find it doesn't work because the selected Tone is overriding it. The official app won't tell you this. This viewer bridges that gap by reading all relevant data, calculating the priority routing, and showing exactly what is actively functioning on one screen.

## How it works
This tool uses the **Web MIDI API** to communicate directly with the AE-BRISA.
1. It sends SysEx Request (RQ1) messages to read the `Setup`, `System Common`, and `Tone Common` areas.
2. Based on the `Source` parameters found in the System Common data, it determines whether it needs to fetch the Assign data from the System area or the Tone area.
3. It dynamically sends secondary requests only for the necessary data blocks.
4. Finally, it parses the hidden parameters (including undocumented ones like Setup Effect values) and translates the raw hexadecimal MIDI data into human-readable formats.

## Usage
1. Connect your Aerophone Brisa to your computer/device via USB or Bluetooth MIDI.
2. Open the application in a Web MIDI-supported browser (e.g., Chrome, Edge).
3. Click **"Connect to MIDI Device"**.
4. Select your target tone from the dropdown.
5. Click **"Read Selected"** to fetch and view your active settings.

## License
This project is licensed under the 3-Clause BSD License - see the [LICENSE](LICENSE) file for details.